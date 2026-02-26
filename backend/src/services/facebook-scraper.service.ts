import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database';

export interface FacebookPost {
  id: string;
  text: string;
  url?: string;
  author?: {
    name: string;
    id: string;
  };
  time?: string;
  timestamp?: number;
  images?: string[];
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface ScrapingResult {
  success: boolean;
  posts: FacebookPost[];
  cursor?: string | null;
  error?: string;
}

export class FacebookScraperService {
  private client: AxiosInstance;

  constructor() {
    const host = process.env.RAPIDAPI_HOST || 'facebook-scraper3.p.rapidapi.com';

    this.client = axios.create({
      baseURL: `https://${host}`,
      headers: {
        'x-rapidapi-host': host,
        'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
      },
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
   * GET /search/groups?query=...&cursor=...
   */
  async searchGroups(query: string, cursor?: string): Promise<any> {
    try {
      const params: Record<string, string> = { query };
      if (cursor) params.cursor = cursor;

      const response = await this.client.get('/search/groups', { params });
      return response.data;
    } catch (error) {
      console.error('Error searching groups:', error);
      throw new Error('Failed to search Facebook groups');
    }
  }

  /**
   * Get group details (name, description, members...)
   * GET /group/details?url=https://www.facebook.com/groups/...
   */
  async getGroupDetails(groupUrl: string): Promise<any> {
    try {
      const response = await this.client.get('/group/details', {
        params: { url: groupUrl },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching group details:', error);
      throw new Error('Failed to fetch group details');
    }
  }

  /**
   * Get group numeric ID from URL
   * GET /group/id?url=https://www.facebook.com/groups/...
   */
  async getGroupId(groupUrl: string): Promise<any> {
    try {
      const response = await this.client.get('/group/id', {
        params: { url: groupUrl },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching group ID:', error);
      throw new Error('Failed to fetch group ID');
    }
  }

  /**
   * Get posts from a specific group (single page)
   * GET /group/posts?group_id=...&sorting_order=CHRONOLOGICAL&cursor=...
   */
  async getGroupPostsPage(groupId: string, cursor?: string): Promise<ScrapingResult> {
    try {
      const params: Record<string, string> = {
        group_id: groupId,
        sorting_order: 'CHRONOLOGICAL',
      };
      if (cursor) params.cursor = cursor;

      const response = await this.client.get('/group/posts', { params });

      const posts = this.parsePosts(response.data);

      return {
        success: true,
        posts,
        cursor: response.data?.cursor || null,
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
   * Get posts from a group with automatic pagination
   * Fetches up to `maxPages` pages (API returns ~3 posts per page)
   */
  async getGroupPosts(groupId: string, maxPages: number = 3): Promise<ScrapingResult> {
    const allPosts: FacebookPost[] = [];
    let currentCursor: string | undefined;
    let lastCursor: string | null = null;

    for (let page = 0; page < maxPages; page++) {
      const result = await this.getGroupPostsPage(groupId, currentCursor);

      if (!result.success) {
        if (page === 0) return result;
        break;
      }

      allPosts.push(...result.posts);
      lastCursor = result.cursor || null;

      if (!result.cursor || result.posts.length === 0) break;
      currentCursor = result.cursor;
    }

    return {
      success: true,
      posts: allPosts,
      cursor: lastCursor,
    };
  }

  /**
   * Search posts within groups
   * GET /search/groups_posts?query=...&group_id=...&cursor=...
   */
  async searchGroupPosts(query: string, groupId?: string, cursor?: string): Promise<ScrapingResult> {
    try {
      const params: Record<string, string> = { query };
      if (groupId) params.group_id = groupId;
      if (cursor) params.cursor = cursor;

      const response = await this.client.get('/search/groups_posts', { params });

      const posts = this.parsePosts(response.data);

      return {
        success: true,
        posts,
        cursor: response.data?.cursor || null,
      };
    } catch (error) {
      console.error('Error searching group posts:', error);
      return {
        success: false,
        posts: [],
        error: 'Failed to search group posts',
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
   * API returns { posts: [...] } format
   */
  private parsePosts(data: any): FacebookPost[] {
    const rawPosts = data?.posts || data?.results || data?.data;
    if (!rawPosts || !Array.isArray(rawPosts)) {
      return [];
    }

    return rawPosts.map((post: any) => {
      const attached = post.attached_post;
      // For shared posts, message is null — use attached_post.message
      const text = post.message || post.text || post.content
        || attached?.message || '';
      // For shared posts, URL of the original post
      const url = post.url || attached?.url || '';

      return {
        id: post.post_id || post.id || '',
        text,
        url,
        author: {
          name: post.author?.name || 'Unknown',
          id: post.author?.id || post.author?.url || '',
        },
        time: post.timestamp ? new Date(post.timestamp * 1000).toISOString() : post.time || post.created_time,
        timestamp: post.timestamp,
        images: this.extractImages(post, attached),
        likes: post.reactions_count || post.likes || 0,
        comments: post.comments_count || post.comments || 0,
        shares: post.reshare_count || post.shares || 0,
      };
    });
  }

  /**
   * Extract images from various post formats, including attached (shared) posts
   */
  private extractImages(post: any, attached?: any): string[] {
    const images: string[] = [];

    // Single image
    if (post.image?.uri) {
      images.push(post.image.uri);
    }

    // Album preview
    if (Array.isArray(post.album_preview)) {
      for (const item of post.album_preview) {
        if (item.image_file_uri) {
          images.push(item.image_file_uri);
        }
      }
    }

    // Video thumbnail
    if (post.video_thumbnail) {
      images.push(post.video_thumbnail);
    }

    // Attached post images (shared posts)
    if (images.length === 0 && attached) {
      if (attached.photo_url) {
        images.push(attached.photo_url);
      }
      if (attached.album_url) {
        images.push(attached.album_url);
      }
    }

    // Fallback
    if (images.length === 0 && Array.isArray(post.images)) {
      return post.images;
    }

    return images;
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

        const result = await this.getGroupPosts(group.groupId);

        if (!result.success) {
          console.error(`❌ Failed to scrape group ${group.name}: ${result.error}`);
          continue;
        }

        let newPosts = 0;
        for (const post of result.posts) {
          const created = await this.processPost(post, group);
          if (created) newPosts++;
        }

        // Update last scraped timestamp and stats
        await prisma.facebookGroup.update({
          where: { id: group.id },
          data: {
            lastScrapedAt: new Date(),
            totalPosts: { increment: newPosts },
          },
        });

        console.log(`✅ Scraped ${result.posts.length} posts from ${group.name} (${newPosts} new)`);
      } catch (error) {
        console.error(`❌ Error scraping group ${group.name}:`, error);
      }
    }
  }

  /**
   * Process a single post — returns true if a new listing was created
   */
  async processPost(post: FacebookPost, group: { id: string; name: string; keywords: string[] }): Promise<boolean> {
    if (!post.id) return false;

    // Check if post already exists
    const existing = await prisma.scrapedListing.findUnique({
      where: { postId: post.id },
    });

    if (existing) return false;

    // Filter by keywords if configured
    if (group.keywords.length > 0) {
      const hasKeyword = group.keywords.some(keyword =>
        post.text.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // Create new listing
    await prisma.scrapedListing.create({
      data: {
        source: 'FACEBOOK',
        groupId: group.id,
        groupName: group.name,
        postId: post.id,
        postUrl: post.url,
        authorName: post.author?.name,
        authorId: post.author?.id,
        originalText: post.text,
        images: post.images || [],
        postedAt: post.time ? new Date(post.time) : new Date(),
        isValid: true,
      },
    });

    return true;
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
