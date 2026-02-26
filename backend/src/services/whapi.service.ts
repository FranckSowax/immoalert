import axios, { AxiosInstance } from 'axios';

export interface WhapiMessage {
  to: string;
  body: string;
  media?: string;
}

export interface WhapiTemplate {
  to: string;
  templateName: string;
  language?: string;
  components?: any[];
}

export class WhapiService {
  private client: AxiosInstance;
  private baseURL: string;
  private token: string;

  constructor() {
    this.baseURL = process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud';
    this.token = process.env.WHAPI_TOKEN || '';

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Whapi API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          endpoint: error.config?.url,
        });
        throw error;
      }
    );
  }

  /**
   * Send a text message
   */
  async sendText(to: string, body: string): Promise<any> {
    try {
      const response = await this.client.post('/messages/text', {
        to: `${to}@s.whatsapp.net`,
        body,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending text message:', error);
      throw new Error(`Failed to send message to ${to}`);
    }
  }

  /**
   * Send an image with optional caption
   */
  async sendImage(to: string, imageUrl: string, caption?: string): Promise<any> {
    try {
      const response = await this.client.post('/messages/image', {
        to: `${to}@s.whatsapp.net`,
        media: imageUrl,
        caption: caption || '',
      });
      return response.data;
    } catch (error) {
      console.error('Error sending image:', error);
      throw new Error(`Failed to send image to ${to}`);
    }
  }

  /**
   * Send multiple images as an album
   */
  async sendAlbum(to: string, imageUrls: string[], caption?: string): Promise<any> {
    try {
      const response = await this.client.post('/messages/album', {
        to: `${to}@s.whatsapp.net`,
        media: imageUrls,
        caption: caption || '',
      });
      return response.data;
    } catch (error) {
      console.error('Error sending album:', error);
      // Fallback to sending first image only
      if (imageUrls.length > 0) {
        return this.sendImage(to, imageUrls[0], caption);
      }
      throw error;
    }
  }

  /**
   * Send a template message (for structured messages with buttons)
   */
  async sendTemplate(to: string, templateName: string, components: any[] = []): Promise<any> {
    try {
      const response = await this.client.post('/messages/template', {
        to: `${to}@s.whatsapp.net`,
        name: templateName,
        language: { code: 'fr' },
        components,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending template:', error);
      throw new Error(`Failed to send template to ${to}`);
    }
  }

  /**
   * Send a message with quick reply buttons
   */
  async sendButtons(to: string, body: string, buttons: Array<{ id: string; title: string }>): Promise<any> {
    try {
      const response = await this.client.post('/messages/interactive', {
        to: `${to}@s.whatsapp.net`,
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title },
          })),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error sending buttons:', error);
      throw new Error(`Failed to send buttons to ${to}`);
    }
  }

  /**
   * Send a typing indicator
   */
  async sendTyping(to: string): Promise<void> {
    try {
      await this.client.post('/messages/typing', {
        to: `${to}@s.whatsapp.net`,
      });
    } catch (error) {
      // Silently fail for typing indicators
      console.debug('Typing indicator failed:', error);
    }
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post('/messages/read', {
        message_id: messageId,
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<any> {
    try {
      const response = await this.client.get(`/messages/${messageId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting message status:', error);
      return null;
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    const expectedSecret = process.env.WHAPI_WEBHOOK_SECRET || '';
    // Implement HMAC validation if needed
    return signature === expectedSecret;
  }

  /**
   * Format phone number to international format
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing
    if (cleaned.length === 9 && cleaned.startsWith('6')) {
      cleaned = '33' + cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
      cleaned = '33' + cleaned.substring(1);
    }
    
    return cleaned;
  }
}

export const whapiService = new WhapiService();
