import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { facebookScraperService, DEFAULT_IMMO_KEYWORDS } from '../services/facebook-scraper.service';
import { aiClassifierService } from '../services/ai-classifier.service';
import { matchingService } from '../services/matching.service';

export class AdminController {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        users,
        listings,
        matches,
        groups,
        recentListings,
        matchStats,
      ] = await Promise.all([
        // User stats
        prisma.$transaction([
          prisma.user.count(),
          prisma.user.count({ where: { isActive: true } }),
          prisma.user.count({
            where: {
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
          }),
        ]),

        // Listing stats
        prisma.$transaction([
          prisma.scrapedListing.count(),
          prisma.scrapedListing.count({ where: { isValid: true } }),
          prisma.scrapedListing.count({ where: { aiEnriched: true } }),
          prisma.scrapedListing.count({
            where: {
              scrapedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          }),
        ]),

        // Match stats
        prisma.$transaction([
          prisma.match.count(),
          prisma.match.count({ where: { isNotified: true } }),
          prisma.match.count({ where: { isViewed: true } }),
        ]),

        // Groups
        prisma.facebookGroup.findMany({
          where: { isActive: true },
        }),

        // Recent listings
        prisma.scrapedListing.findMany({
          take: 5,
          orderBy: { scrapedAt: 'desc' },
          include: { _count: { select: { matches: true } } },
        }),

        // Match stats by day
        matchingService.getStats(),
      ]);

      res.json({
        users: {
          total: users[0],
          active: users[1],
          newThisWeek: users[2],
        },
        listings: {
          total: listings[0],
          valid: listings[1],
          enriched: listings[2],
          last24h: listings[3],
        },
        matches: {
          total: matches[0],
          notified: matches[1],
          viewed: matches[2],
          ...matchStats,
        },
        groups,
        recentListings,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }

  /**
   * Get all listings with filtering
   */
  async getListings(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const where: any = {};

      // Filters
      if (req.query.isValid === 'true') {
        where.isValid = true;
      } else if (req.query.isValid === 'false') {
        where.isValid = false;
      }

      if (req.query.aiEnriched === 'true') {
        where.aiEnriched = true;
      }

      if (req.query.groupId) {
        where.groupId = req.query.groupId as string;
      }

      // Search
      if (req.query.search) {
        where.OR = [
          { originalText: { contains: req.query.search as string, mode: 'insensitive' } },
          { title: { contains: req.query.search as string, mode: 'insensitive' } },
          { location: { contains: req.query.search as string, mode: 'insensitive' } },
        ];
      }

      const [listings, total] = await Promise.all([
        prisma.scrapedListing.findMany({
          where,
          include: {
            _count: { select: { matches: true } },
          },
          skip,
          take: limit,
          orderBy: { scrapedAt: 'desc' },
        }),
        prisma.scrapedListing.count({ where }),
      ]);

      res.json({
        listings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching listings:', error);
      res.status(500).json({ error: 'Failed to fetch listings' });
    }
  }

  /**
   * Get listing by ID
   */
  async getListingById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const listing = await prisma.scrapedListing.findUnique({
        where: { id },
        include: {
          matches: {
            include: {
              user: {
                select: {
                  whatsappNumber: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!listing) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      res.json(listing);
    } catch (error) {
      console.error('Error fetching listing:', error);
      res.status(500).json({ error: 'Failed to fetch listing' });
    }
  }

  /**
   * Update listing (manual validation/editing)
   */
  async updateListing(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body;

      const updated = await prisma.scrapedListing.update({
        where: { id },
        data,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating listing:', error);
      res.status(500).json({ error: 'Failed to update listing' });
    }
  }

  /**
   * Delete listing
   */
  async deleteListing(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await prisma.scrapedListing.delete({
        where: { id },
      });

      res.json({ message: 'Listing deleted successfully' });
    } catch (error) {
      console.error('Error deleting listing:', error);
      res.status(500).json({ error: 'Failed to delete listing' });
    }
  }

  /**
   * Search Facebook groups by keyword
   */
  async searchGroups(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const cursor = req.query.cursor as string | undefined;

      if (!query) {
        res.status(400).json({ error: 'Query parameter "q" is required' });
        return;
      }

      const results = await facebookScraperService.searchGroups(query, cursor);
      res.json(results);
    } catch (error) {
      console.error('Error searching groups:', error);
      res.status(500).json({ error: 'Failed to search Facebook groups' });
    }
  }

  /**
   * Get all Facebook groups
   */
  async getGroups(req: Request, res: Response): Promise<void> {
    try {
      const groups = await prisma.facebookGroup.findMany({
        orderBy: { priority: 'desc' },
      });

      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to fetch groups', details: errMsg });
    }
  }

  /**
   * Add Facebook group
   */
  async addGroup(req: Request, res: Response): Promise<void> {
    try {
      const { groupId, name, keywords, priority } = req.body;

      if (!groupId || !name) {
        res.status(400).json({ error: 'groupId and name are required' });
        return;
      }

      const group = await prisma.facebookGroup.upsert({
        where: { groupId },
        create: {
          groupId,
          name,
          keywords: keywords || [],
          priority: priority || 0,
          isActive: true,
        },
        update: {
          name,
          keywords: keywords || [],
          priority: priority || 0,
          isActive: true,
        },
      });

      res.json(group);
    } catch (error) {
      console.error('Error adding group:', error);
      res.status(500).json({ error: 'Failed to add group' });
    }
  }

  /**
   * Update Facebook group
   */
  async updateGroup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, keywords, priority, isActive } = req.body;

      const updated = await prisma.facebookGroup.update({
        where: { id },
        data: { name, keywords, priority, isActive },
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating group:', error);
      res.status(500).json({ error: 'Failed to update group' });
    }
  }

  /**
   * Delete Facebook group
   */
  async deleteGroup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await prisma.facebookGroup.delete({
        where: { id },
      });

      res.json({ message: 'Group deleted successfully' });
    } catch (error) {
      console.error('Error deleting group:', error);
      res.status(500).json({ error: 'Failed to delete group' });
    }
  }

  /**
   * Scrape a single group and return results synchronously
   */
  async scrapeGroup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const group = await prisma.facebookGroup.findUnique({ where: { id } });
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      const result = await facebookScraperService.getGroupPosts(group.groupId);

      if (!result.success) {
        res.status(502).json({ error: result.error || 'Failed to fetch posts from Facebook' });
        return;
      }

      // Use group keywords, or default immobilier keywords if none configured
      const keywords = group.keywords.length > 0 ? group.keywords : DEFAULT_IMMO_KEYWORDS;
      const filteredPosts = result.posts.filter(post => {
        const textLower = post.text.toLowerCase();
        return keywords.some(kw => textLower.includes(kw.toLowerCase()));
      });

      // Save filtered posts to DB
      const newListingIds: string[] = [];
      for (const post of filteredPosts) {
        const listingId = await facebookScraperService.processPost(post, group);
        if (listingId) newListingIds.push(listingId);
      }

      // Update group stats
      await prisma.facebookGroup.update({
        where: { id },
        data: {
          lastScrapedAt: new Date(),
          totalPosts: { increment: newListingIds.length },
        },
      });

      // Auto-enrich new listings with AI (fire-and-forget for speed)
      if (newListingIds.length > 0) {
        this.enrichListingsAsync(newListingIds);
      }

      // Fetch the latest listings for this group to return
      const listings = await prisma.scrapedListing.findMany({
        where: { groupId: id },
        orderBy: { scrapedAt: 'desc' },
        take: 50,
      });

      res.json({
        success: true,
        totalFetched: result.posts.length,
        totalPosts: filteredPosts.length,
        newPosts: newListingIds.length,
        cursor: result.cursor,
        posts: filteredPosts,
        listings,
      });
    } catch (error) {
      console.error('Error scraping group:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to scrape group', details: errMsg });
    }
  }

  /**
   * Enrich listings with AI in background (fire-and-forget)
   */
  private enrichListingsAsync(listingIds: string[]): void {
    (async () => {
      for (const id of listingIds) {
        try {
          const listing = await prisma.scrapedListing.findUnique({ where: { id } });
          if (listing && !listing.aiEnriched) {
            await aiClassifierService.enrichListing(listing);
          }
        } catch (error) {
          console.error(`Error enriching listing ${id}:`, error);
        }
      }
    })().catch(err => console.error('Background enrichment failed:', err));
  }

  /**
   * Trigger manual scrape
   */
  async triggerScrape(req: Request, res: Response): Promise<void> {
    try {
      // Run scrape asynchronously
      facebookScraperService.scrapeAllGroups()
        .then(() => console.log('Manual scrape completed'))
        .catch(error => console.error('Manual scrape failed:', error));

      res.json({ 
        message: 'Scrape triggered successfully',
        status: 'running'
      });
    } catch (error) {
      console.error('Error triggering scrape:', error);
      res.status(500).json({ error: 'Failed to trigger scrape' });
    }
  }

  /**
   * Trigger AI enrichment
   */
  async triggerEnrichment(req: Request, res: Response): Promise<void> {
    try {
      // Run enrichment asynchronously
      aiClassifierService.processUnprocessedListings()
        .then(count => console.log(`Enrichment completed: ${count} listings processed`))
        .catch(error => console.error('Enrichment failed:', error));

      res.json({ 
        message: 'Enrichment triggered successfully',
        status: 'running'
      });
    } catch (error) {
      console.error('Error triggering enrichment:', error);
      res.status(500).json({ error: 'Failed to trigger enrichment' });
    }
  }

  /**
   * Trigger matching
   */
  async triggerMatching(req: Request, res: Response): Promise<void> {
    try {
      // Run matching asynchronously
      matchingService.processAllMatches()
        .then(result => console.log(`Matching completed: ${result.processed} processed, ${result.notified} notified`))
        .catch(error => console.error('Matching failed:', error));

      res.json({ 
        message: 'Matching triggered successfully',
        status: 'running'
      });
    } catch (error) {
      console.error('Error triggering matching:', error);
      res.status(500).json({ error: 'Failed to trigger matching' });
    }
  }

  /**
   * Get activity logs
   */
  async getActivityLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;

      const logs = await prisma.activityLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }

  /**
   * Get system configuration
   */
  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const configs = await prisma.systemConfig.findMany();

      const configMap = configs.reduce((acc, config) => {
        acc[config.key] = config.value;
        return acc;
      }, {} as Record<string, any>);

      res.json(configMap);
    } catch (error) {
      console.error('Error fetching config:', error);
      res.status(500).json({ error: 'Failed to fetch config' });
    }
  }

  /**
   * Update system configuration
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { key, value, description } = req.body;

      const config = await prisma.systemConfig.upsert({
        where: { key },
        create: { key, value, description },
        update: { value, description },
      });

      res.json(config);
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: 'Failed to update config' });
    }
  }
}

export const adminController = new AdminController();
