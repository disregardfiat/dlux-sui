import { SuiEvent } from '@mysten/sui/client';
import { SUITextObject } from '@dlux-sui/types';
import { logger } from '../../utils/logger';
import { suiClient } from '../client';
import { textObjectRepository } from '../../repositories/textObjectRepository';

class TextObjectProcessor {
  async process(event: SuiEvent): Promise<void> {
    try {
      logger.debug('Processing text object event', { eventId: event.id });

      // Extract text object data from event
      const textObject = await this.extractTextObjectFromEvent(event);

      if (textObject) {
        // Store in repository
        await textObjectRepository.save(textObject);

        // TODO: Send to dGraph service for indexing
        await this.sendToDGraph(textObject);

        logger.info('Processed text object', { id: textObject.id, owner: textObject.owner });
      }

    } catch (error) {
      logger.error('Error processing text object event', { eventId: event.id, error });
      throw error;
    }
  }

  private async extractTextObjectFromEvent(event: SuiEvent): Promise<SUITextObject | null> {
    try {
      // This is a simplified implementation
      // In reality, you'd parse the event data to extract the text object

      const eventData = event.parsedJson as any;

      // Check if this is a text object creation/modification event
      if (!this.isValidTextObjectEvent(eventData)) {
        return null;
      }

      const textObject: SUITextObject = {
        id: eventData.id || event.id,
        owner: eventData.owner || '',
        content: eventData.content || '',
        metadata: eventData.metadata || {},
        createdAt: event.timestampMs ? new Date(Number(event.timestampMs)) : new Date(),
        updatedAt: event.timestampMs ? new Date(Number(event.timestampMs)) : new Date()
      };

      return textObject;

    } catch (error) {
      logger.error('Error extracting text object from event', error);
      return null;
    }
  }

  private isValidTextObjectEvent(eventData: any): boolean {
    // TODO: Implement validation logic for text object events
    return eventData && (eventData.content || eventData.text);
  }

  private async sendToDGraph(textObject: SUITextObject): Promise<void> {
    // TODO: Implement HTTP call to dGraph service
    logger.debug('Would send to dGraph', { id: textObject.id });
  }
}

export const textObjectProcessor = new TextObjectProcessor();