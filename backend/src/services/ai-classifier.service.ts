import OpenAI from 'openai';
import { ScrapedListing, PropertyType } from '@prisma/client';
import { prisma } from '../config/database';

export interface ExtractedPropertyData {
  title?: string;
  price?: number;
  location?: string;
  surface?: number;
  rooms?: number;
  propertyType?: 'HOUSE' | 'APARTMENT' | 'BOTH';
  contact?: string;
  furnished?: boolean;
  description?: string;
  confidence: number;
}

export class AIClassifierService {
  private openai: OpenAI;
  private model: string;
  private fallbackModel: string;
  private confidenceThreshold: number;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
    this.fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
    this.confidenceThreshold = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.6');
  }

  /**
   * Extract property data from raw text using AI
   */
  async extractPropertyData(text: string): Promise<ExtractedPropertyData> {
    const prompt = `Analyse cette annonce immobilière et extrait les informations structurées.

Texte de l'annonce:
"""
${text}
"""

Retourne UNIQUEMENT un JSON valide avec ce format exact:
{
  "title": "titre de l'annonce (max 100 caractères)",
  "price": nombre entier du prix en FCFA (null si non trouvé),
  "location": "ville et/ou quartier précis",
  "surface": nombre entier en m² (null si non trouvé),
  "rooms": nombre de pièces (null si non trouvé),
  "propertyType": "HOUSE" | "APARTMENT" | "BOTH" | null,
  "contact": "téléphone ou email trouvé",
  "furnished": boolean (true/false/null),
  "description": "résumé de 2-3 phrases",
  "confidence": nombre entre 0 et 1 représentant la confiance globale
}

Règles:
- Pour le prix: extraire uniquement le nombre en FCFA, sans symboles. Les prix sont en Francs CFA (FCFA)
- Pour propertyType: "HOUSE" pour maison/villa, "APARTMENT" pour appartement
- Pour furnished: true si meublé, false si non meublé, null si non précisé
- confidence doit refléter la qualité des données extraites`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const extracted: ExtractedPropertyData = JSON.parse(content);
      
      // Validate extracted data
      return this.validateExtractedData(extracted);
    } catch (error) {
      console.error('Error extracting property data:', error);
      
      // Try fallback model
      try {
        return await this.extractWithFallback(text);
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
        return { confidence: 0 };
      }
    }
  }

  /**
   * Fallback extraction with simpler model
   */
  private async extractWithFallback(text: string): Promise<ExtractedPropertyData> {
    const prompt = `Extract real estate listing data from this text. Return JSON only:

Text: "${text.substring(0, 1000)}"

Format: {"price": number|null, "location": string|null, "surface": number|null, "rooms": number|null, "propertyType": "HOUSE"|"APARTMENT"|null, "confidence": 0-1}`;

    const response = await this.openai.chat.completions.create({
      model: this.fallbackModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[^}]+\}/);
    
    if (jsonMatch) {
      return this.validateExtractedData(JSON.parse(jsonMatch[0]));
    }
    
    return { confidence: 0 };
  }

  /**
   * Validate and normalize extracted data
   */
  private validateExtractedData(data: any): ExtractedPropertyData {
    return {
      title: data.title?.substring(0, 100),
      price: typeof data.price === 'number' && data.price > 0 ? Math.round(data.price) : undefined,
      location: data.location || undefined,
      surface: typeof data.surface === 'number' && data.surface > 0 ? Math.round(data.surface) : undefined,
      rooms: typeof data.rooms === 'number' && data.rooms > 0 ? Math.round(data.rooms) : undefined,
      propertyType: ['HOUSE', 'APARTMENT', 'BOTH'].includes(data.propertyType) ? data.propertyType : undefined,
      contact: data.contact || undefined,
      furnished: typeof data.furnished === 'boolean' ? data.furnished : undefined,
      description: data.description || undefined,
      confidence: typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : 0,
    };
  }

  /**
   * Enrich a scraped listing with AI
   */
  async enrichListing(listing: ScrapedListing): Promise<ScrapedListing> {
    const extracted = await this.extractPropertyData(listing.originalText);
    
    // Check if listing is valid
    const isValid = this.isValidListing(extracted);

    const updated = await prisma.scrapedListing.update({
      where: { id: listing.id },
      data: {
        title: extracted.title,
        price: extracted.price,
        location: extracted.location,
        surface: extracted.surface,
        rooms: extracted.rooms,
        propertyType: extracted.propertyType as PropertyType | undefined,
        contact: extracted.contact,
        furnished: extracted.furnished,
        description: extracted.description,
        extractedData: extracted as any,
        aiEnriched: true,
        confidenceScore: extracted.confidence,
        isValid,
      },
    });

    console.log(`✨ Listing enriched: ${listing.postId} (confidence: ${extracted.confidence.toFixed(2)})`);
    return updated;
  }

  /**
   * Check if extracted data is valid for a real estate listing
   */
  private isValidListing(data: ExtractedPropertyData): boolean {
    // Must have minimum data
    if (data.confidence < this.confidenceThreshold) {
      return false;
    }

    // Must have at least price or location
    if (!data.price && !data.location) {
      return false;
    }

    // Price should be reasonable in FCFA (10 000 - 10 000 000 FCFA)
    if (data.price && (data.price < 10000 || data.price > 10000000)) {
      return false;
    }

    return true;
  }

  /**
   * Generate personalized message for a user
   */
  async generateUserMessage(listing: ScrapedListing, userCriteria: any): Promise<string> {
    const data = listing.extractedData as ExtractedPropertyData;
    
    const prompt = `Génère un message WhatsApp court et enthousiaste pour cette annonce immobilière.

Détails de l'annonce:
- Type: ${data.propertyType === 'HOUSE' ? 'Maison' : 'Appartement'}
- Prix: ${data.price} FCFA
- Surface: ${data.surface}m²
- Pièces: ${data.rooms}
- Localisation: ${data.location}
${data.furnished ? '- Meublé' : ''}

Critères de l'utilisateur:
- Budget: ${userCriteria.minPrice} - ${userCriteria.maxPrice} FCFA
- Zones: ${userCriteria.locations?.join(', ')}
- Type: ${userCriteria.propertyType}

Instructions:
- Maximum 2-3 phrases courtes
- Ton enthousiaste mais professionnel
- Mentionne pourquoi ça correspond aux critères
- Appel à l'action clair
- Utilise des emojis appropriés

Réponds uniquement avec le texte du message, sans formatage JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.fallbackModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content || this.generateDefaultMessage(listing, userCriteria);
    } catch (error) {
      console.error('Error generating user message:', error);
      return this.generateDefaultMessage(listing, userCriteria);
    }
  }

  /**
   * Generate default message when AI fails
   */
  private generateDefaultMessage(listing: ScrapedListing, userCriteria: any): string {
    const data = listing.extractedData as ExtractedPropertyData;
    
    return `🏠 *Nouvelle annonce trouvée !*

${data.propertyType === 'HOUSE' ? '🏡' : '🏢'} ${data.rooms} pièces • ${data.surface}m²
💰 ${data.price?.toLocaleString()} FCFA
📍 ${data.location}

Cette annonce correspond à vos critères ! Souhaitez-vous plus d'informations ?`;
  }

  /**
   * Process all unprocessed listings
   */
  async processUnprocessedListings(): Promise<number> {
    const listings = await prisma.scrapedListing.findMany({
      where: {
        aiEnriched: false,
        isValid: true,
      },
      take: 50, // Process in batches
    });

    for (const listing of listings) {
      try {
        await this.enrichListing(listing);
      } catch (error) {
        console.error(`Error enriching listing ${listing.id}:`, error);
      }
    }

    return listings.length;
  }

  /**
   * Classify multiple listings in batch
   */
  async classifyBatch(listings: ScrapedListing[]): Promise<void> {
    for (const listing of listings) {
      try {
        await this.enrichListing(listing);
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Batch classification error for ${listing.id}:`, error);
      }
    }
  }
}

export const aiClassifierService = new AIClassifierService();
