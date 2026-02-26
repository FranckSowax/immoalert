import { Request, Response } from 'express';
import { conversationService } from '../services/conversation.service';
import { prisma } from '../config/database';

export class WebhookController {
  /**
   * Handle incoming WhatsApp webhook from Whapi
   */
  async handleWhapiWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('📥 Webhook received:', JSON.stringify(req.body, null, 2));

      const { messages, contacts } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Invalid payload: messages array required' });
        return;
      }

      for (const message of messages) {
        // Process only text messages
        if (message.type === 'text' && message.text?.body) {
          const from = message.from?.replace('@s.whatsapp.net', '');
          const text = message.text.body;
          const messageId = message.id;

          if (from && text) {
            // Process asynchronously to respond quickly
            conversationService.handleIncomingMessage(from, text, messageId)
              .catch(error => console.error('Error processing message:', error));
          }
        }

        // Process image messages with captions
        if (message.type === 'image' && message.image?.caption) {
          const from = message.from?.replace('@s.whatsapp.net', '');
          const caption = message.image.caption;
          
          if (from && caption) {
            conversationService.handleIncomingMessage(from, caption)
              .catch(error => console.error('Error processing image caption:', error));
          }
        }
      }

      // Always return 200 to acknowledge receipt
      res.status(200).json({ 
        status: 'ok',
        processed: messages.length 
      });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle status updates (message delivered, read, etc.)
   */
  async handleStatusUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { statuses } = req.body;

      if (statuses && Array.isArray(statuses)) {
        for (const status of statuses) {
          // Update message status in database if needed
          console.log(`📊 Message ${status.id} status: ${status.status}`);
        }
      }

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('Status update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Verify webhook endpoint (for initial setup)
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    const challenge = req.query.challenge;
    
    if (challenge) {
      res.status(200).send(challenge);
    } else {
      res.status(200).json({ 
        status: 'ok',
        message: 'Webhook endpoint active'
      });
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(req: Request, res: Response): Promise<void> {
    try {
      // Get recent conversations
      const recentMessages = await prisma.conversation.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      const stats = {
        status: 'healthy',
        last24hMessages: recentMessages,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(stats);
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}

export const webhookController = new WebhookController();
