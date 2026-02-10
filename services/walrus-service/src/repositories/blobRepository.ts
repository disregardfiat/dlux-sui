import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface BlobMetadata {
  id: string;
  size: number;
  contentType?: string;
  uploadedBy?: string;
  checksum?: string;
  uploadedAt: Date;
}

const WALRUS_DATA_DIR = process.env.WALRUS_DATA_DIR || '';

/** Safe filename from blobId (no path traversal). */
function safeBlobPath(blobId: string): string {
  const safe = blobId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
  return safe || 'blob';
}

/** In-memory metadata store; when WALRUS_DATA_DIR is set, persisted to disk. */
const blobs = new Map<string, BlobMetadata>();
/** Local copy of blob content for serving; persisted to disk when WALRUS_DATA_DIR is set. */
const contentCache = new Map<string, Buffer>();

async function persistMetadata(id: string, record: BlobMetadata): Promise<void> {
  if (!WALRUS_DATA_DIR) return;
  const dir = path.join(WALRUS_DATA_DIR, 'blobs');
  await fs.promises.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${safeBlobPath(id)}.meta.json`);
  await fs.promises.writeFile(
    file,
    JSON.stringify({
      ...record,
      uploadedAt: record.uploadedAt.toISOString()
    }),
    'utf8'
  );
}

async function persistContent(id: string, content: Buffer): Promise<void> {
  if (!WALRUS_DATA_DIR) return;
  const dir = path.join(WALRUS_DATA_DIR, 'blobs');
  await fs.promises.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${safeBlobPath(id)}.bin`);
  await fs.promises.writeFile(file, content);
}

async function loadFromDisk(): Promise<void> {
  if (!WALRUS_DATA_DIR) return;
  const dir = path.join(WALRUS_DATA_DIR, 'blobs');
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.meta.json')) {
        const baseName = e.name.replace(/\.meta\.json$/, '');
        const raw = await fs.promises.readFile(path.join(dir, e.name), 'utf8');
        const parsed = JSON.parse(raw);
        const record: BlobMetadata = {
          id: parsed.id ?? baseName,
          size: parsed.size ?? 0,
          contentType: parsed.contentType,
          uploadedBy: parsed.uploadedBy,
          checksum: parsed.checksum,
          uploadedAt: parsed.uploadedAt ? new Date(parsed.uploadedAt) : new Date(0)
        };
        blobs.set(record.id, record);
        const binPath = path.join(dir, `${baseName}.bin`);
        try {
          const content = await fs.promises.readFile(binPath);
          contentCache.set(record.id, content);
        } catch {
          // content file missing; metadata only (e.g. migrated)
        }
      }
    }
    logger.info('Loaded blobs from disk', { count: blobs.size, dir });
  } catch (err: any) {
    if (err?.code !== 'ENOENT') logger.warn('Could not load blobs from disk', { dir, error: err?.message });
  }
}

async function unpersist(id: string): Promise<void> {
  if (!WALRUS_DATA_DIR) return;
  const dir = path.join(WALRUS_DATA_DIR, 'blobs');
  const base = safeBlobPath(id);
  try {
    await fs.promises.unlink(path.join(dir, `${base}.meta.json`));
  } catch { /* ignore */ }
  try {
    await fs.promises.unlink(path.join(dir, `${base}.bin`));
  } catch { /* ignore */ }
}

export class BlobRepository {
  private initPromise: Promise<void> | null = null;

  private async ensureLoaded(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = loadFromDisk();
    return this.initPromise;
  }

  async save(
    id: string,
    metadata: Omit<BlobMetadata, 'id' | 'uploadedAt'> & { uploadedAt?: Date },
    content?: Buffer
  ): Promise<void> {
    await this.ensureLoaded();
    const record: BlobMetadata = {
      id,
      size: metadata.size,
      contentType: metadata.contentType,
      uploadedBy: metadata.uploadedBy,
      checksum: metadata.checksum,
      uploadedAt: metadata.uploadedAt ?? new Date()
    };
    blobs.set(id, record);
    if (content) contentCache.set(id, content);
    await persistMetadata(id, record);
    if (content) await persistContent(id, content);
    logger.debug('Blob metadata saved', { blobId: id, size: record.size, cached: !!content, persisted: !!WALRUS_DATA_DIR });
  }

  getContent(id: string): Buffer | null {
    return contentCache.get(id) ?? null;
  }

  setContent(id: string, content: Buffer): void {
    contentCache.set(id, content);
    if (WALRUS_DATA_DIR) persistContent(id, content).catch((e) => logger.warn('Persist content failed', { blobId: id, error: e?.message }));
  }

  async findById(id: string): Promise<BlobMetadata | null> {
    await this.ensureLoaded();
    return blobs.get(id) || null;
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureLoaded();
    contentCache.delete(id);
    const existed = blobs.delete(id);
    await unpersist(id);
    logger.debug('Blob metadata deleted', { blobId: id, existed });
    return existed;
  }

  async findAll(): Promise<BlobMetadata[]> {
    await this.ensureLoaded();
    const all = Array.from(blobs.values()).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    return all;
  }

  async findByUploader(uploader: string): Promise<BlobMetadata[]> {
    await this.ensureLoaded();
    const all = Array.from(blobs.values()).filter((b) => b.uploadedBy === uploader);
    all.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    return all;
  }

  async getStats(): Promise<{ totalBlobs: number; totalBytes: number }> {
    await this.ensureLoaded();
    const all = Array.from(blobs.values());
    return {
      totalBlobs: all.length,
      totalBytes: all.reduce((sum, b) => sum + (b.size || 0), 0)
    };
  }
}

export const blobRepository = new BlobRepository();
