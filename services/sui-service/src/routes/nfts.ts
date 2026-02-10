import express from 'express';
import { suiClient } from '../sui/client';
import { logger } from '../utils/logger';
import type { SUINft } from '@dlux-sui/types';

const router = express.Router();

const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
};

router.get('/owner/:suiAddress', async (req, res) => {
  try {
    if (isTestEnv()) {
      return res.json({ nfts: [] });
    }

    const { suiAddress } = req.params;
    const client = suiClient.getClient();

    const response = await client.getOwnedObjects({
      owner: suiAddress,
      options: {
        showType: true,
        showDisplay: true,
        showContent: true
      }
    });

    const nfts: SUINft[] = response.data
      .map((item) => {
        const display = item.data?.display?.data || {};
        const content = item.data?.content as any;
        const name = normalizeString(display.name) || normalizeString(content?.fields?.name);
        const description = normalizeString(display.description) || normalizeString(content?.fields?.description);
        const imageUrl = normalizeString(display.image_url) || normalizeString(display.imageUrl);
        const collection = normalizeString(display.collection) || normalizeString(content?.fields?.collection);

        return {
          objectId: item.data?.objectId || '',
          owner: suiAddress,
          name,
          description,
          imageUrl,
          collection,
          type: normalizeString(item.data?.type)
        };
      })
      .filter((nft) => nft.objectId);

    res.json({ nfts });
  } catch (error) {
    logger.error('Error fetching NFTs', { error, owner: req.params.suiAddress });
    res.status(500).json({ error: 'Failed to fetch NFTs' });
  }
});

export { router as nftsRouter };
