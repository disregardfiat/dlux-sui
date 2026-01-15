import { marketService } from './marketService';
import { logger } from '../utils/logger';

/**
 * Scheduler service to check and resolve expired markets
 * Should be called periodically (e.g., every hour)
 */
export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;

  start(intervalMs: number = 60 * 60 * 1000): void {
    // Check expired markets every hour
    this.intervalId = setInterval(async () => {
      try {
        await marketService.checkExpiredMarkets();
        logger.info('Checked expired markets');
      } catch (error) {
        logger.error('Error checking expired markets', error);
      }
    }, intervalMs);

    // Run immediately on start
    marketService.checkExpiredMarkets().catch(err => {
      logger.error('Error in initial market check', err);
    });

    logger.info('Scheduler started', { intervalMs });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduler stopped');
    }
  }
}

export const schedulerService = new SchedulerService();
