import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database';

export interface FacebookPost {
  id: string;
  text: string;
  author?: {
    name: string;
    id: string;
  };
  time?: string;
  images?: string[];
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface ScrapingResult {
  success: boolean;
  posts: FacebookPost[];
  error?: string;
}

export class FacebookScraperService {
  private client: AxiosInstance;
  private baseURL: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseURL = `https://${process.env.RAPIDAPI_HOST || 'facebook-scraper3.p.rapidapi.com'}`;
    this.headers = {
      'x-rapidapi-host': process.env.RAPIDAPI_HOST || 'facebook-scraper3.p.rapidapi.com',
      'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
    };

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: this.headers,
      timeout: 60000,
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Facebook Scraper API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          endpoint: error.config?.url,
        });
        throw error;
      }
    );
  }

  /**
   * Search for Facebook groups
   */
  async searchGroups(query: string, location?: string): Promise<any> {
    try {
      const searchQuery = location ? `${query} ${location}` : query;
      const response = await this.client.get('/search/groups', {
        params: { query: searchQuery, limit: 20 },
      });
      return response.data;
    } catch (error) {
      console.error('Error searching groups:', error);
      throw new Error('Failed to search Facebook groups');
    }
  }

  /**
   * Get posts from a specific group
   */
  async getGroupPosts(groupId: string, limit: number = 20): Promise<ScrapingResult> {
    try {
      const response = await this.client.get('/group/posts', {
        params: { id: groupId, limit },
      });

      const posts = this.parsePosts(response.data);
      
      return {
        success: true,
        posts,
      };
    } catch (error) {
      console.error(`Error fetching posts for group ${groupId}:`, error);
      return {
        success: false,
        posts: [],
        error: 'Failed to fetch group posts',
      };
    }
  }

  /**
   * Get detailed information about a specific post
   */
  async getPostDetails(postId: string): Promise<any> {
    try {
      const response = await this.client.get('/post/details', {
        params: { id: postId },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching post details for ${postId}:`, error);
      throw new Error('Failed to fetch post details');
    }
  }

  /**
   * Parse posts from API response
   */
  private parsePosts(data: any): FacebookPost[] {
    if (!data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((post: any) => ({
      id: post.id || post.post_id || '',
      text: post.text || post.message || post.content || '',
      author: {
        name: post.author?.name || post.user_name || 'Unknown',
        id: post.author?.id || post.user_id || '',
      },
      time: post.time || post.created_time || post.date,
      images: post.images || post.attachments?.images || [],
      likes: post.likes || post.reactions?.likes || 0,
      comments: post.comments || 0,
      shares: post.shares || 0,
    }));
  }

  /**
   * Scrape all configured groups
   */
  async scrapeAllGroups(): Promise<void> {
    const groups = await prisma.facebookGroup.findMany({
      where: { isActive: true },
    });

    for (const group of groups) {
      try {
        console.log(`🔍 Scraping group: ${group.name}`);
        
        const result = await this.getGroupPosts(group.groupId, 10);
        
        if (!result.success) {
          console.error(`❌ Failed to scrape group ${group.name}: ${result.error}`);
          continue;
        }

        for (const post of result.posts) {
          await this.processPost(post, group.id, group.name);
        }

        // Update last scraped timestamp
        await prisma.facebookGroup.update({
          where: { id: group.id },
          data: { lastScrapedAt: new Date() },
        });

        console.log(`✅ Scraped ${result.posts.length} posts from ${group.name}`);
      } catch (error) {
        console.error(`❌ Error scraping group ${group.name}:`, error);
      }
    }
  }

  /**
   * Process a single post
   */
  private async processPost(post: FacebookPost, groupId: string, groupName: string): Promise<void> {
    // Check if post already exists
    const existing = await prisma.scrapedListing.findUnique({
      where: { postId: post.id },
    });

    if (existing) {
      return;
    }

    // Filter by keywords if configured
    const group = await prisma.facebookGroup.findUnique({
      where: { groupId },
    });

    if (group?.keywords && group.keywords.length > 0) {
      const hasKeyword = group.keywords.some(keyword =>
        post.text.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        console.log(`⏭️ Post filtered by keywords: ${post.id}`);
        return;
      }
    }

    // Create new listing
    await prisma.scrapedListing.create({
      data: {
        source: 'FACEBOOK',
        groupId,
        groupName,
        postId: post.id,
        authorName: post.author?.name,
        authorId: post.author?.id,
        originalText: post.text,
        images: post.images || [],
        postedAt: post.time ? new Date(post.time) : new Date(),
        isValid: true,
      },
    });

    console.log(`✨ New listing created: ${post.id}`);
  }

  /**
   * Add a new Facebook group to monitor
   */
  async addGroup(groupId: string, name: string, keywords: string[] = []): Promise<void> {
    try {
      await prisma.facebookGroup.upsert({
        where: { groupId },
        create: {
          groupId,
          name,
          keywords,
          isActive: true,
        },
        update: {
          name,
          keywords,
          isActive: true,
        },
      });
      console.log(`✅ Group added: ${name}`);
    } catch (error) {
      console.error('Error adding group:', error);
      throw error;
    }
  }

  /**
   * Remove a Facebook group from monitoring
   */
  async removeGroup(groupId: string): Promise<void> {
    try {
      await prisma.facebookGroup.update({
        where: { groupId },
        data: { isActive: false },
      });
      console.log(`✅ Group removed: ${groupId}`);
    } catch (error) {
      console.error('Error removing group:', error);
      throw error;
    }
  }
}

export const facebookScraperService = new FacebookScraperService();
