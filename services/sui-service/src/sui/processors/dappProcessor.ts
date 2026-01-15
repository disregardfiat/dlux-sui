import { SuiEvent } from '@mysten/sui/client';
import { SUIdApp } from '@dlux-sui/types';
import { logger } from '../../utils/logger';
import { suiClient } from '../client';
import { dappRepository } from '../../repositories/dappRepository';

class DAppProcessor {
  async process(event: SuiEvent): Promise<void> {
    try {
      logger.debug('Processing dApp event', { eventId: event.id });

      // Extract dApp data from event
      const dapp = await this.extractDAppFromEvent(event);

      if (dapp) {
        // Store in repository
        await dappRepository.save(dapp);

        // TODO: Send to dGraph service for indexing
        await this.sendToDGraph(dapp);

        // Create prediction market if posting fee exists in event
        await this.createPredictionMarket(dapp, event);

        logger.info('Processed dApp', { id: dapp.id, name: dapp.name, owner: dapp.owner });
      }

    } catch (error) {
      logger.error('Error processing dApp event', { eventId: event.id, error });
      throw error;
    }
  }

  private async extractDAppFromEvent(event: SuiEvent): Promise<SUIdApp | null> {
    try {
      // This is a simplified implementation
      // In reality, you'd parse the event data to extract the dApp

      const eventData = event.parsedJson as any;

      // Check if this is a dApp registration/modification event
      if (!this.isValidDAppEvent(eventData)) {
        return null;
      }

      const dapp: SUIdApp = {
        id: eventData.id || event.id,
        name: eventData.name || '',
        description: eventData.description || '',
        owner: eventData.owner || '',
        version: eventData.version || '1.0.0',
        manifest: eventData.manifest || {},
        blobIds: eventData.blobIds || [],
        tags: eventData.tags || [],
        createdAt: event.timestampMs ? new Date(Number(event.timestampMs)) : new Date(),
        updatedAt: event.timestampMs ? new Date(Number(event.timestampMs)) : new Date(),
        permlink: eventData.permlink || eventData.id || ''
      };

      return dapp;

    } catch (error) {
      logger.error('Error extracting dApp from event', error);
      return null;
    }
  }

  private isValidDAppEvent(eventData: any): boolean {
    // TODO: Implement validation logic for dApp events
    return eventData && (eventData.name || eventData.manifest);
  }

  private async sendToDGraph(dapp: SUIdApp): Promise<void> {
    // TODO: Implement HTTP call to dGraph service
    logger.debug('Would send to dGraph', { id: dapp.id });
  }

  private async createPredictionMarket(dapp: SUIdApp, event: SuiEvent): Promise<void> {
    try {
      // Extract posting fee from event if available
      const eventData = event.parsedJson as any;
      const postingFee = eventData.postingFee || eventData.fee || 0;

      if (postingFee > 0) {
        const axios = require('axios');
        const PM_SERVICE = process.env.PM_SERVICE_URL || 'http://localhost:3008';
        const marketContribution = postingFee * 0.5; // 50% to market

        await axios.post(`${PM_SERVICE}/markets`, {
          dappId: dapp.id,
          safetyMetric: 'nsfw', // Default safety metric
          description: `Safety review for ${dapp.name}`,
          postingFeeContribution: marketContribution,
          triggeredBy: 'posting',
          triggeredByAddress: dapp.owner
        });

        logger.info('Created prediction market for dApp', { 
          dappId: dapp.id, 
          contribution: marketContribution 
        });
      }
    } catch (error) {
      logger.error('Failed to create prediction market', error);
      // Don't fail dApp processing if PM creation fails
    }
  }
}

export const dappProcessor = new DAppProcessor();