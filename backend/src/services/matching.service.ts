import { ScrapedListing, User, PropertyCriteria, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { whapiService } from './whapi.service';
import { aiClassifierService } from './ai-classifier.service';

export interface MatchResult {
  userId: string;
  listingId: string;
  score: number;
  reasons: string[];
  shouldNotify: boolean;
}

export class MatchingService {
  /**
   * Find matching users for a listing
   */
  async findMatchesForListing(listing: ScrapedListing): Promise<MatchResult[]> {
    if (!listing.isValid || !listing.aiEnriched) {
      return [];
    }

    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: { criteria: true },
    });

    const matches: MatchResult[] = [];

    for (const user of users) {
      if (!user.criteria) continue;

      const score = this.calculateMatchScore(listing, user.criteria);
      
      if (score.total >= 60) { // Minimum threshold
        const reasons = this.generateMatchReasons(listing, user.criteria, score);
        
        matches.push({
          userId: user.id,
          listingId: listing.id,
          score: score.total,
          reasons,
          shouldNotify: score.total >= 70,
        });
      }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate comprehensive match score
   */
  private calculateMatchScore(
    listing: ScrapedListing,
    criteria: PropertyCriteria
  ): { total: number; price: number; location: number; surface: number; rooms: number; type: number } {
    let score = { price: 0, location: 0, surface: 0, rooms: 0, type: 0 };

    // Type matching (10%)
    if (listing.propertyType && 
        (criteria.propertyType === 'BOTH' || criteria.propertyType === listing.propertyType)) {
      score.type = 10;
    }

    // Price matching (30%)
    if (listing.price && criteria.minPrice && criteria.maxPrice) {
      if (listing.price >= criteria.minPrice && listing.price <= criteria.maxPrice) {
        score.price = 30;
      } else {
        // Partial score if close to range
        const diff = Math.min(
          Math.abs(listing.price - criteria.minPrice),
          Math.abs(listing.price - criteria.maxPrice)
        );
        const percentage = diff / listing.price;
        score.price = Math.max(0, 30 - (percentage * 100));
      }
    } else if (!criteria.minPrice && !criteria.maxPrice) {
      score.price = 30; // No preference = full points
    }

    // Location matching (25%)
    if (listing.location && criteria.locations.length > 0) {
      const locationMatch = criteria.locations.some(loc =>
        listing.location!.toLowerCase().includes(loc.toLowerCase())
      );
      if (locationMatch) {
        score.location = 25;
      }
    }

    // Surface matching (20%)
    if (listing.surface && criteria.minSurface && criteria.maxSurface) {
      if (listing.surface >= criteria.minSurface && listing.surface <= criteria.maxSurface) {
        score.surface = 20;
      }
    } else if (!criteria.minSurface && !criteria.maxSurface) {
      score.surface = 20;
    }

    // Rooms matching (15%)
    if (listing.rooms && criteria.minRooms && criteria.maxRooms) {
      if (listing.rooms >= criteria.minRooms && listing.rooms <= criteria.maxRooms) {
        score.rooms = 15;
      }
    } else if (!criteria.minRooms && !criteria.maxRooms) {
      score.rooms = 15;
    }

    const total = score.price + score.location + score.surface + score.rooms + score.type;
    return { ...score, total };
  }

  /**
   * Generate human-readable match reasons
   */
  private generateMatchReasons(
    listing: ScrapedListing,
    criteria: PropertyCriteria,
    score: any
  ): string[] {
    const reasons: string[] = [];

    if (score.price >= 25) {
      reasons.push('💰 Prix dans votre budget');
    } else if (score.price > 0) {
      reasons.push('💰 Prix proche de votre budget');
    }

    if (score.location >= 20) {
      reasons.push('📍 Localisation recherchée');
    }

    if (score.surface >= 15) {
      reasons.push(`📐 Surface: ${listing.surface}m²`);
    }

    if (score.rooms >= 10) {
      reasons.push(`🚪 ${listing.rooms} pièces`);
    }

    if (score.type >= 8) {
      reasons.push(listing.propertyType === 'HOUSE' ? '🏠 Maison' : '🏢 Appartement');
    }

    return reasons;
  }

  /**
   * Process matches and create notifications
   */
  async processMatches(listing: ScrapedListing): Promise<number> {
    const matches = await this.findMatchesForListing(listing);
    let notifiedCount = 0;

    for (const match of matches) {
      try {
        // Check if match already exists
        const existingMatch = await prisma.match.findFirst({
          where: {
            userId: match.userId,
            listingId: match.listingId,
          },
        });

        if (existingMatch) {
          continue;
        }

        // Create match record
        const createdMatch = await prisma.match.create({
          data: {
            userId: match.userId,
            listingId: match.listingId,
            matchScore: match.score,
            matchReasons: match.reasons,
            isNotified: false,
          },
        });

        // Update listing
        await prisma.scrapedListing.update({
          where: { id: listing.id },
          data: {
            sentToUsers: {
              push: match.userId,
            },
          },
        });

        // Notify user if score is high enough
        if (match.shouldNotify) {
          await this.notifyUser(createdMatch.id);
          notifiedCount++;
        }
      } catch (error) {
        console.error(`Error processing match:`, error);
      }
    }

    return notifiedCount;
  }

  /**
   * Send notification to user
   */
  async notifyUser(matchId: string): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        user: true,
        listing: true,
      },
    });

    if (!match || match.isNotified) {
      return;
    }

    try {
      // Generate personalized message
      const message = await aiClassifierService.generateUserMessage(
        match.listing,
        match.user.criteria
      );

      // Send WhatsApp message
      await whapiService.sendText(match.user.whatsappNumber, message);

      // Send images if available
      const images = (match.listing.images as string[]) || [];
      if (images.length > 0) {
        for (const image of images.slice(0, 3)) {
          await whapiService.sendImage(match.user.whatsappNumber, image);
        }
      }

      // Update match
      await prisma.match.update({
        where: { id: matchId },
        data: {
          isNotified: true,
          notifiedAt: new Date(),
        },
      });

      // Create notification record
      await prisma.notification.create({
        data: {
          userId: match.userId,
          type: 'LISTING_MATCH',
          title: 'Nouvelle annonce trouvée !',
          message: message.substring(0, 200),
          relatedEntityId: match.listingId,
          relatedEntityType: 'ScrapedListing',
        },
      });

      console.log(`📤 Notification sent to ${match.user.whatsappNumber} for listing ${match.listing.postId}`);
    } catch (error) {
      console.error(`Error notifying user ${match.userId}:`, error);
    }
  }

  /**
   * Get user's matches
   */
  async getUserMatches(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
    const where: Prisma.MatchWhereInput = { userId };
    
    if (options?.unreadOnly) {
      where.isViewed = false;
    }

    return prisma.match.findMany({
      where,
      include: { listing: true },
      orderBy: { matchScore: 'desc' },
      take: options?.limit || 50,
    });
  }

  /**
   * Mark match as viewed
   */
  async markAsViewed(matchId: string): Promise<void> {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        isViewed: true,
        viewedAt: new Date(),
      },
    });
  }

  /**
   * Get match statistics
   */
  async getStats(): Promise<{
    totalMatches: number;
    notifiedMatches: number;
    viewedMatches: number;
    interestedMatches: number;
    avgMatchScore: number;
  }> {
    const [
      totalMatches,
      notifiedMatches,
      viewedMatches,
      interestedMatches,
      avgScore,
    ] = await Promise.all([
      prisma.match.count(),
      prisma.match.count({ where: { isNotified: true } }),
      prisma.match.count({ where: { isViewed: true } }),
      prisma.match.count({ where: { isInterested: true } }),
      prisma.match.aggregate({ _avg: { matchScore: true } }),
    ]);

    return {
      totalMatches,
      notifiedMatches,
      viewedMatches,
      interestedMatches,
      avgMatchScore: avgScore._avg.matchScore || 0,
    };
  }

  /**
   * Process all unprocessed matches
   */
  async processAllMatches(): Promise<{ processed: number; notified: number }> {
    const listings = await prisma.scrapedListing.findMany({
      where: {
        isValid: true,
        aiEnriched: true,
      },
      take: 100,
    });

    let totalNotified = 0;

    for (const listing of listings) {
      const notified = await this.processMatches(listing);
      totalNotified += notified;
    }

    return {
      processed: listings.length,
      notified: totalNotified,
    };
  }
}

export const matchingService = new MatchingService();
