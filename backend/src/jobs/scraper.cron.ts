import cron from 'node-cron';
import { facebookScraperService } from '../services/facebook-scraper.service';
import { aiClassifierService } from '../services/ai-classifier.service';
import { matchingService } from '../services/matching.service';

export class ScraperJob {
  private scrapeTask: cron.ScheduledTask | null = null;
  private enrichTask: cron.ScheduledTask | null = null;
  private matchTask: cron.ScheduledTask | null = null;

  /**
   * Start all scheduled jobs
   */
  start(): void {
    const intervalMinutes = parseInt(process.env.SCRAPER_INTERVAL_MINUTES || '2');

    // Scraper job - runs every X minutes
    this.scrapeTask = cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
      console.log(`[${new Date().toISOString()}] 🔄 Running scheduled scrape...`);
      try {
        await facebookScraperService.scrapeAllGroups();
        console.log(`[${new Date().toISOString()}] ✅ Scrape completed`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Scrape failed:`, error);
      }
    });

    // Enrichment job - runs every 5 minutes
    this.enrichTask = cron.schedule('*/5 * * * *', async () => {
      console.log(`[${new Date().toISOString()}] 🤖 Running AI enrichment...`);
      try {
        const count = await aiClassifierService.processUnprocessedListings();
        console.log(`[${new Date().toISOString()}] ✅ Enrichment completed: ${count} listings processed`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Enrichment failed:`, error);
      }
    });

    // Matching job - runs every 3 minutes
    this.matchTask = cron.schedule('*/3 * * * *', async () => {
      console.log(`[${new Date().toISOString()}] 💕 Running matching...`);
      try {
        const result = await matchingService.processAllMatches();
        console.log(`[${new Date().toISOString()}] ✅ Matching completed: ${result.processed} processed, ${result.notified} notified`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Matching failed:`, error);
      }
    });

    // Cleanup job - runs daily at 3 AM
    cron.schedule('0 3 * * *', async () => {
      console.log(`[${new Date().toISOString()}] 🧹 Running daily cleanup...`);
      // Implement cleanup logic here
    });

    console.log('✅ All background jobs started:');
    console.log(`   - Scraper: every ${intervalMinutes} minutes`);
    console.log('   - AI Enrichment: every 5 minutes');
    console.log('   - Matching: every 3 minutes');
    console.log('   - Cleanup: daily at 3 AM');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    if (this.scrapeTask) {
      this.scrapeTask.stop();
    }
    if (this.enrichTask) {
      this.enrichTask.stop();
    }
    if (this.matchTask) {
      this.matchTask.stop();
    }
    console.log('⏹️ All background jobs stopped');
  }

  /**
   * Run scraper once (manual trigger)
   */
  async runScraperOnce(): Promise<void> {
    console.log(`[${new Date().toISOString()}] 🔄 Manual scraper triggered...`);
    try {
      await facebookScraperService.scrapeAllGroups();
      console.log(`[${new Date().toISOString()}] ✅ Manual scrape completed`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Manual scrape failed:`, error);
      throw error;
    }
  }

  /**
   * Run enrichment once (manual trigger)
   */
  async runEnrichmentOnce(): Promise<number> {
    console.log(`[${new Date().toISOString()}] 🤖 Manual enrichment triggered...`);
    try {
      const count = await aiClassifierService.processUnprocessedListings();
      console.log(`[${new Date().toISOString()}] ✅ Manual enrichment completed: ${count} listings`);
      return count;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Manual enrichment failed:`, error);
      throw error;
    }
  }

  /**
   * Run matching once (manual trigger)
   */
  async runMatchingOnce(): Promise<{ processed: number; notified: number }> {
    console.log(`[${new Date().toISOString()}] 💕 Manual matching triggered...`);
    try {
      const result = await matchingService.processAllMatches();
      console.log(`[${new Date().toISOString()}] ✅ Manual matching completed: ${result.processed} processed, ${result.notified} notified`);
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Manual matching failed:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  getStatus(): {
    scraperRunning: boolean;
    enrichRunning: boolean;
    matchRunning: boolean;
  } {
    return {
      scraperRunning: this.scrapeTask !== null,
      enrichRunning: this.enrichTask !== null,
      matchRunning: this.matchTask !== null,
    };
  }
}
