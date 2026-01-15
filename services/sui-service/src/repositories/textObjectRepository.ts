import { SUITextObject } from '@dlux-sui/types';
import { logger } from '../utils/logger';

// Simple in-memory repository - replace with database in production
class TextObjectRepository {
  private objects = new Map<string, SUITextObject>();

  async save(textObject: SUITextObject): Promise<void> {
    try {
      this.objects.set(textObject.id, {
        ...textObject,
        updatedAt: new Date()
      });
      logger.debug('Saved text object', { id: textObject.id });
    } catch (error) {
      logger.error('Error saving text object', { id: textObject.id, error });
      throw error;
    }
  }

  async findById(id: string): Promise<SUITextObject | null> {
    return this.objects.get(id) || null;
  }

  async findByOwner(owner: string): Promise<SUITextObject[]> {
    return Array.from(this.objects.values()).filter(obj => obj.owner === owner);
  }

  async findAll(limit = 100, offset = 0): Promise<SUITextObject[]> {
    const all = Array.from(this.objects.values());
    return all.slice(offset, offset + limit);
  }

  async search(query: string): Promise<SUITextObject[]> {
    const all = Array.from(this.objects.values());
    const lowerQuery = query.toLowerCase();
    return all.filter(obj =>
      obj.content.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(obj.metadata).toLowerCase().includes(lowerQuery)
    );
  }
}

export const textObjectRepository = new TextObjectRepository();