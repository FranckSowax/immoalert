import { ConversationState, Direction, MessageType, User } from '@prisma/client';
import { prisma } from '../config/database';
import { whapiService } from './whapi.service';

export interface MessageContext {
  step: number;
  data: Partial<{
    propertyType: string;
    minPrice: number;
    maxPrice: number;
    locations: string[];
    minRooms: number;
    minSurface: number;
  }>;
}

export class ConversationService {
  private contexts: Map<string, MessageContext> = new Map();

  /**
   * Handle incoming WhatsApp message
   */
  async handleIncomingMessage(whatsappNumber: string, message: string, messageId?: string): Promise<void> {
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { whatsappNumber },
      include: { criteria: true },
    });

    if (!user) {
      user = await this.createNewUser(whatsappNumber);
      await this.sendWelcomeMessage(whatsappNumber);
      return;
    }

    // Update last interaction
    await prisma.user.update({
      where: { id: user.id },
      data: { lastInteraction: new Date() },
    });

    // Save incoming message
    await prisma.conversation.create({
      data: {
        userId: user.id,
        direction: 'INCOMING',
        content: message,
        whatsappMessageId: messageId,
      },
    });

    // Handle based on conversation state
    switch (user.conversationState) {
      case 'IDLE':
        await this.handleIdleState(user, message);
        break;
      case 'COLLECTING_CRITERIA':
        await this.handleCriteriaCollection(user, message);
        break;
      case 'CONFIRMING':
        await this.handleConfirmation(user, message);
        break;
      case 'ACTIVE':
        await this.handleActiveState(user, message);
        break;
      case 'PAUSED':
        await this.handlePausedState(user, message);
        break;
    }
  }

  /**
   * Create a new user
   */
  private async createNewUser(phone: string): Promise<User> {
    const user = await prisma.user.create({
      data: {
        whatsappNumber: phone,
        conversationState: 'IDLE',
      },
    });

    // Create empty criteria
    await prisma.propertyCriteria.create({
      data: {
        userId: user.id,
        propertyType: 'BOTH',
        locations: [],
      },
    });

    return user;
  }

  /**
   * Send welcome message to new user
   */
  private async sendWelcomeMessage(to: string): Promise<void> {
    const message = `🏠 *Bienvenue sur ImmoAlert!*

Je suis votre assistant immobilier personnel qui surveille les groupes Facebook pour vous.

Je vais vous envoyer instantanément les annonces qui correspondent à vos critères !

Pour commencer, dites-moi : cherchez-vous une *maison* 🏡 ou un *appartement* 🏢 ?

(ou les deux - tapez "les deux")`;

    await this.sendMessage(to, message);

    // Update user state
    await prisma.user.update({
      where: { whatsappNumber: to },
      data: { conversationState: 'COLLECTING_CRITERIA' },
    });

    // Initialize context
    this.contexts.set(to, { step: 1, data: {} });
  }

  /**
   * Handle idle state - user sends first command
   */
  private async handleIdleState(user: User, message: string): Promise<void> {
    const text = message.toLowerCase().trim();

    if (text === 'modifier' || text === 'change' || text === 'critères') {
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: 'COLLECTING_CRITERIA' },
      });
      this.contexts.set(user.whatsappNumber, { step: 1, data: {} });
      await this.sendMessage(user.whatsappNumber, 'D accord, modifions vos critères. Cherchez-vous une maison ou un appartement ?');
    } else if (text === 'statut' || text === 'status') {
      await this.sendCurrentStatus(user);
    } else if (text === 'aide' || text === 'help') {
      await this.sendHelpMessage(user.whatsappNumber);
    } else if (text === 'pause' || text === 'stop') {
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: 'PAUSED' },
      });
      await this.sendMessage(user.whatsappNumber, '⏸️ *Alertes suspendues.*\n\nVous ne recevrez plus de notifications. Tapez *REPRENDRE* pour réactiver.');
    } else {
      await this.sendMainMenu(user.whatsappNumber);
    }
  }

  /**
   * Handle criteria collection flow
   */
  private async handleCriteriaCollection(user: User, message: string): Promise<void> {
    const context = this.contexts.get(user.whatsappNumber) || { step: 1, data: {} };
    const text = message.toLowerCase().trim();

    switch (context.step) {
      case 1: // Property type
        if (text.includes('maison') || text.includes('house')) {
          context.data.propertyType = 'HOUSE';
        } else if (text.includes('appartement') || text.includes('appart') || text.includes('apartment')) {
          context.data.propertyType = 'APARTMENT';
        } else if (text.includes('deux') || text.includes('both') || text.includes('tout')) {
          context.data.propertyType = 'BOTH';
        } else {
          await this.sendMessage(user.whatsappNumber, 'Je n ai pas compris. Veuillez répondre "maison", "appartement", ou "les deux".');
          return;
        }
        
        context.step = 2;
        await this.sendMessage(user.whatsappNumber, `Parfait ! Quelle est votre *fourchette de prix* en FCFA ? 💰\n\nExemples :\n• "Entre 100000 et 300000 FCFA"\n• "Maximum 500000 FCFA"\n• "150000 FCFA minimum"`);
        break;

      case 2: // Price range
        const priceMatch = message.match(/(\d+)[^\d]*(\d+)?/g);
        if (priceMatch) {
          const prices = priceMatch.map(p => parseInt(p.replace(/\D/g, ''))).filter(p => p > 0);
          if (prices.length >= 1) {
            if (prices.length === 1) {
              if (text.includes('max') || text.includes('maximum')) {
                context.data.maxPrice = prices[0];
                context.data.minPrice = 0;
              } else {
                context.data.maxPrice = prices[0];
                context.data.minPrice = Math.floor(prices[0] * 0.6);
              }
            } else {
              context.data.minPrice = Math.min(...prices);
              context.data.maxPrice = Math.max(...prices);
            }
          }
        }

        if (!context.data.minPrice && !context.data.maxPrice) {
          await this.sendMessage(user.whatsappNumber, 'Je n ai pas compris la fourchette de prix. Pouvez-vous reformuler ?\nExemple : "Entre 100000 et 300000 FCFA"');
          return;
        }

        context.step = 3;
        await this.sendMessage(user.whatsappNumber, `Super ! Dans quelle(s) *zone(s)* souhaitez-vous chercher ? 📍\n\nExemples :\n• "Lyon 3ème, Villeurbanne"\n• "Paris intra-muros"\n• "Bordeaux centre et alentours"`);
        break;

      case 3: // Location
        const locations = message.split(/[,;/\-]/).map(l => l.trim()).filter(l => l.length > 2);
        if (locations.length === 0) {
          await this.sendMessage(user.whatsappNumber, 'Veuillez indiquer au moins une zone de recherche. Exemple : "Lyon 3ème"');
          return;
        }
        context.data.locations = locations;

        context.step = 4;
        await this.sendMessage(user.whatsappNumber, `D accord ! Combien de *pièces minimum* ? 🚪\n\nExemples :\n• "2 pièces minimum"\n• "T3 ou plus"\n• "Pas d importance" (pour ignorer)`);
        break;

      case 4: // Rooms
        if (!text.includes('pas') && !text.includes('ignore') && !text.includes('peu')) {
          const roomsMatch = message.match(/(\d+)/);
          if (roomsMatch) {
            context.data.minRooms = parseInt(roomsMatch[1]);
          }
        }

        context.step = 5;
        await this.sendMessage(user.whatsappNumber, `Surface minimum souhaitée ? 📐\n\nExemples :\n• "30m2 minimum"\n• "50m² ou plus"\n• "Pas important" (pour ignorer)`);
        break;

      case 5: // Surface
        if (!text.includes('pas') && !text.includes('ignore') && !text.includes('peu')) {
          const surfaceMatch = message.match(/(\d+)/);
          if (surfaceMatch) {
            context.data.minSurface = parseInt(surfaceMatch[1]);
          }
        }

        // Save criteria
        await this.saveCriteria(user.id, context.data);

        // Send summary
        await this.sendSummary(user.whatsappNumber, context.data);

        // Update state
        await prisma.user.update({
          where: { id: user.id },
          data: { conversationState: 'CONFIRMING' },
        });

        this.contexts.delete(user.whatsappNumber);
        break;
    }

    this.contexts.set(user.whatsappNumber, context);
  }

  /**
   * Handle confirmation state
   */
  private async handleConfirmation(user: User, message: string): Promise<void> {
    const text = message.toLowerCase().trim();

    if (text === 'oui' || text === 'yes' || text === 'ok' || text === 'parfait') {
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          conversationState: 'ACTIVE',
          isActive: true,
        },
      });

      const confirmationMessage = `✅ *Parfait ! Vos critères sont enregistrés.*\n\n🤖 Je surveille maintenant les groupes Facebook en temps réel.\n\n📱 Vous recevrez immédiatement les annonces correspondantes par WhatsApp !\n\n*Commandes disponibles :*\n• *MODIFIER* - Changer vos critères\n• *PAUSE* - Arrêter temporairement\n• *REPRENDRE* - Réactiver les alertes\n• *STATUT* - Voir vos critères actuels\n• *AIDE* - Obtenir de l aide`;

      await this.sendMessage(user.whatsappNumber, confirmationMessage);
    } else if (text === 'non' || text === 'no' || text === 'modifier' || text === 'change') {
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: 'COLLECTING_CRITERIA' },
      });
      this.contexts.set(user.whatsappNumber, { step: 1, data: {} });
      await this.sendMessage(user.whatsappNumber, 'D accord, reprenons. Quel critère voulez-vous modifier ?\n\nRépondez par : TYPE, PRIX, ZONE, PIÈCES, ou SURFACE');
    } else {
      await this.sendMessage(user.whatsappNumber, 'Veuillez répondre par *OUI* pour confirmer ou *MODIFIER* pour changer vos critères.');
    }
  }

  /**
   * Handle active state
   */
  private async handleActiveState(user: User, message: string): Promise<void> {
    const text = message.toLowerCase().trim();

    if (text === 'modifier') {
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: 'COLLECTING_CRITERIA' },
      });
      this.contexts.set(user.whatsappNumber, { step: 1, data: {} });
      await this.sendMessage(user.whatsappNumber, 'Modifions vos critères. Cherchez-vous une maison ou un appartement ?');
    } else if (text === 'pause' || text === 'stop') {
      await prisma.user.update({
        where: { id: user.id },
        data: { conversationState: 'PAUSED' },
      });
      await this.sendMessage(user.whatsappNumber, '⏸️ *Alertes suspendues.*\n\nVous ne recevrez plus de notifications. Tapez *REPRENDRE* pour réactiver.');
    } else if (text === 'statut' || text === 'status') {
      await this.sendCurrentStatus(user);
    } else if (text === 'aide' || text === 'help') {
      await this.sendHelpMessage(user.whatsappNumber);
    } else {
      // Default - acknowledge but remind of commands
      await this.sendMessage(user.whatsappNumber, 'Message reçu ! \n\n*Commandes disponibles :*\n• *MODIFIER* - Changer critères\n• *PAUSE* - Suspendre alertes\n• *STATUT* - Voir configuration\n• *AIDE* - Plus d options');
    }
  }

  /**
   * Handle paused state
   */
  private async handlePausedState(user: User, message: string): Promise<void> {
    const text = message.toLowerCase().trim();

    if (text === 'reprendre' || text === 'resume' || text === 'start') {
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          conversationState: 'ACTIVE',
          isActive: true,
        },
      });
      await this.sendMessage(user.whatsappNumber, '▶️ *Alertes réactivées !*\n\nVous recevrez à nouveau les nouvelles annonces correspondant à vos critères.');
    } else if (text === 'statut') {
      await this.sendCurrentStatus(user);
    } else {
      await this.sendMessage(user.whatsappNumber, 'Les alertes sont actuellement *suspendues*.\n\nTapez *REPRENDRE* pour réactiver ou *STATUT* pour voir vos critères.');
    }
  }

  /**
   * Send current status to user
   */
  private async sendCurrentStatus(user: User): Promise<void> {
    const userWithCriteria = await prisma.user.findUnique({
      where: { id: user.id },
      include: { criteria: true },
    });

    if (!userWithCriteria?.criteria) {
      await this.sendMessage(user.whatsappNumber, 'Vous n avez pas encore configuré de critères. Tapez *MODIFIER* pour commencer.');
      return;
    }

    const c = userWithCriteria.criteria;
    const statusMessage = `📋 *Vos critères actuels :*

🏠 Type : ${c.propertyType === 'HOUSE' ? 'Maison' : c.propertyType === 'APARTMENT' ? 'Appartement' : 'Les deux'}
💰 Budget : ${c.minPrice?.toLocaleString() || 'Non défini'} - ${c.maxPrice?.toLocaleString() || 'Non défini'} FCFA
📍 Zones : ${c.locations.join(', ') || 'Non définies'}
🚪 Pièces : ${c.minRooms ? c.minRooms + '+' : 'Non défini'}
📐 Surface : ${c.minSurface ? c.minSurface + 'm²+' : 'Non définie'}

📊 Statut : ${user.conversationState === 'ACTIVE' ? '🟢 Actif' : user.conversationState === 'PAUSED' ? '⏸️ En pause' : '🔴 Inactif'}`;

    await this.sendMessage(user.whatsappNumber, statusMessage);
  }

  /**
   * Send help message
   */
  private async sendHelpMessage(to: string): Promise<void> {
    const helpMessage = `🔧 *Menu d aide*

*Commandes principales :*
• *MODIFIER* - Changer vos critères de recherche
• *PAUSE* - Arrêter temporairement les alertes
• *REPRENDRE* - Réactiver les alertes
• *STATUT* - Voir vos critères actuels
• *AIDE* - Ce message

*Besoin d aide supplémentaire ?*
Contactez-nous : support@immoalert.fr`;

    await this.sendMessage(to, helpMessage);
  }

  /**
   * Send main menu
   */
  private async sendMainMenu(to: string): Promise<void> {
    const menuMessage = `🔧 *Menu principal*

Que souhaitez-vous faire ?

• *MODIFIER* - Changer vos critères
• *PAUSE* - Suspendre les alertes
• *REPRENDRE* - Réactiver les alertes
• *STATUT* - Voir configuration actuelle
• *AIDE* - Plus d options`;

    await this.sendMessage(to, menuMessage);
  }

  /**
   * Send summary of collected criteria
   */
  private async sendSummary(to: string, data: MessageContext['data']): Promise<void> {
    const summary = `📋 *Récapitulatif de vos critères :*

🏠 Type : ${data.propertyType === 'HOUSE' ? 'Maison' : data.propertyType === 'APARTMENT' ? 'Appartement' : 'Les deux'}
💰 Budget : ${data.minPrice?.toLocaleString()} - ${data.maxPrice?.toLocaleString()} FCFA
📍 Zones : ${data.locations?.join(', ')}
🚪 Pièces : ${data.minRooms ? data.minRooms + '+' : 'Non spécifié'}
📐 Surface : ${data.minSurface ? data.minSurface + 'm²+' : 'Non spécifiée'}

Tout est correct ? Répondez *OUI* pour activer la surveillance ou *MODIFIER* pour changer.`;

    await this.sendMessage(to, summary);
  }

  /**
   * Save user criteria
   */
  private async saveCriteria(userId: string, data: MessageContext['data']): Promise<void> {
    await prisma.propertyCriteria.upsert({
      where: { userId },
      create: {
        userId,
        propertyType: (data.propertyType as any) || 'BOTH',
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        locations: data.locations || [],
        minRooms: data.minRooms,
        minSurface: data.minSurface,
      },
      update: {
        propertyType: (data.propertyType as any) || 'BOTH',
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        locations: data.locations || [],
        minRooms: data.minRooms,
        minSurface: data.minSurface,
      },
    });
  }

  /**
   * Send message and save to database
   */
  private async sendMessage(to: string, content: string, options?: { mediaUrl?: string }): Promise<void> {
    try {
      // Send via WhatsApp API
      if (options?.mediaUrl) {
        await whapiService.sendImage(to, options.mediaUrl, content);
      } else {
        await whapiService.sendText(to, content);
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { whatsappNumber: to },
      });

      if (user) {
        // Save to database
        await prisma.conversation.create({
          data: {
            userId: user.id,
            direction: 'OUTGOING',
            content,
            mediaUrl: options?.mediaUrl,
            isAiGenerated: false,
          },
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  /**
   * Get conversation history for a user
   */
  async getConversationHistory(userId: string, limit: number = 50) {
    return prisma.conversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const conversationService = new ConversationService();
