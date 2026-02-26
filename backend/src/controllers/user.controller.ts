import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { conversationService } from '../services/conversation.service';

export class UserController {
  /**
   * Get all users with pagination and filtering
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const where: any = {};

      // Filter by status
      if (req.query.isActive === 'true') {
        where.isActive = true;
      } else if (req.query.isActive === 'false') {
        where.isActive = false;
      }

      // Search by phone or name
      if (req.query.search) {
        where.OR = [
          { whatsappNumber: { contains: req.query.search as string } },
          { name: { contains: req.query.search as string, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: {
            criteria: true,
            _count: {
              select: {
                matches: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  /**
   * Get single user by ID
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          criteria: true,
          conversations: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          matches: {
            include: { listing: true },
            orderBy: { matchScore: 'desc' },
            take: 10,
          },
          notifications: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  /**
   * Update user
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, isActive, conversationState, criteria } = req.body;

      const updated = await prisma.user.update({
        where: { id },
        data: {
          name,
          isActive,
          conversationState,
          ...(criteria && {
            criteria: {
              upsert: {
                create: criteria,
                update: criteria,
              },
            },
          }),
        },
        include: { criteria: true },
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await prisma.user.delete({
        where: { id },
      });

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await prisma.$transaction([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { conversationState: 'ACTIVE' } }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.match.groupBy({
          by: ['userId'],
          _count: { userId: true },
        }),
      ]);

      res.json({
        totalUsers: stats[0],
        activeUsers: stats[1],
        usersReceivingAlerts: stats[2],
        newUsersLast7Days: stats[3],
        usersWithMatches: stats[4].length,
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }

  /**
   * Send message to user
   */
  async sendMessageToUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { message } = req.body;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Send via conversation service
      await conversationService.handleIncomingMessage(user.whatsappNumber, message);

      res.json({ message: 'Message sent successfully' });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  /**
   * Get conversation history for user
   */
  async getUserConversations(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const conversations = await prisma.conversation.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }
}

export const userController = new UserController();
