import { logger } from '../utils/logger';

interface Blob {
  id: string;
  data: Buffer;
  contentType: string;
  size: number;
  originalName: string;
  uploadedAt: Date;
}

// In-memory storage - replace with database/object storage in production
const blobs = new Map<string, Blob>();

export class BlobRepository {
  async save(blob: Blob): Promise<void> {
    blobs.set(blob.id, blob);
    logger.debug('Blob saved', { blobId: blob.id, size: blob.size });
  }

  async findById(id: string): Promise<Blob | null> {
    return blobs.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    blobs.delete(id);
    logger.debug('Blob deleted', { blobId: id });
  }

  async findAll(limit = 100, offset = 0): Promise<Blob[]> {
    return Array.from(blobs.values()).slice(offset, offset + limit);
  }
}

export const blobRepository = new BlobRepository();
