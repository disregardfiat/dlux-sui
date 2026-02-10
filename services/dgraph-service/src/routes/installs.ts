import { Router } from 'express';
import { dgraphClient } from '../dgraph/client';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /installs/blobs/referenced
 * Returns all blob IDs referenced by dApps (blobIds + pathMap values). Used by Walrus orphan cleanup.
 */
router.get('/blobs/referenced', async (_req, res) => {
  try {
    const query = `
      query {
        dapps(func: type(DApp)) {
          blobIds
          manifestJson
        }
      }
    `;
    const result = await dgraphClient.query(query);
    const dapps = result.dapps || [];
    const referenced = new Set<string>();
    for (const d of dapps) {
      for (const id of d.blobIds || []) {
        if (id && typeof id === 'string') referenced.add(id);
      }
      if (d.manifestJson) {
        try {
          const m = typeof d.manifestJson === 'string' ? JSON.parse(d.manifestJson) : d.manifestJson;
          const pathMap = m?.pathMap;
          if (pathMap && typeof pathMap === 'object') {
            for (const id of Object.values(pathMap)) {
              if (id && typeof id === 'string') referenced.add(id);
            }
          }
          const ep = m?.entryPoint;
          if (ep && typeof ep === 'string' && /^[a-zA-Z0-9_-]+$/.test(ep)) referenced.add(ep);
        } catch { /* ignore */ }
      }
    }
    res.json({ blobIds: Array.from(referenced) });
  } catch (error) {
    logger.error('Error getting referenced blobs', error);
    res.status(500).json({ error: 'Failed to get referenced blobs' });
  }
});

/**
 * POST /installs/dapps/index
 * Receives resolved dApp from SUI service (after on-chain event; manifest already resolved from walrus:blobId).
 * Stores full manifest (including pathMap) as manifestJson so directory structure is preserved in DGraph.
 */
router.post('/dapps/index', async (req, res) => {
  try {
    const {
      id,
      name,
      description,
      owner,
      permlink,
      version,
      manifest,
      blobIds,
      tags,
      category,
      postingFee,
      txDigest,
      createdAt,
      updatedAt
    } = req.body || {};

    if (!id || !name || !owner || !permlink) {
      return res.status(400).json({ error: 'id, name, owner, and permlink are required' });
    }

    const manifestJson = typeof manifest === 'object' ? JSON.stringify(manifest) : (manifest && typeof manifest === 'string' && !manifest.startsWith('walrus:') ? manifest : '{}');

    const query = `
      query dappById($id: string) {
        dapp(func: eq(id, $id)) @filter(type(DApp)) {
          uid
        }
      }
    `;
    const qr = await dgraphClient.query(query, { $id: id });
    const existing = qr.dapp?.[0];
    const uid = existing?.uid ?? `_:dapp_${id}`;

    const mutation = {
      set: {
        uid,
        dgraph_type: 'DApp',
        id,
        name,
        description: description || '',
        owner,
        permlink,
        version: version || '1.0.0',
        manifestJson,
        blobIds: Array.isArray(blobIds) ? blobIds : [],
        tags: Array.isArray(tags) ? tags : [],
        category: category || '',
        postingFee: postingFee || 0,
        txDigest: txDigest || '',
        ...(existing ? {} : { rating: 0, downloadCount: 0 }),
        createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
        updatedAt: updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString()
      }
    };

    await dgraphClient.mutate(mutation);
    logger.info('Indexed dApp from SUI chain', { id, name, hasPathMap: !!(typeof manifest === 'object' && manifest?.pathMap) });
    res.status(201).json({ success: true, id });
  } catch (error) {
    logger.error('Error indexing dApp', { error });
    res.status(500).json({ error: 'Failed to index dApp' });
  }
});

router.post('/dapps/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;
    const { installId, suiAddress, platform, userAgent, subscription } = req.body || {};

    if (!dappId || !installId || !suiAddress) {
      return res.status(400).json({ error: 'dappId, installId, and suiAddress are required' });
    }

    const installQuery = `
      query install($installId: string) {
        install(func: eq(installId, $installId)) @filter(type(DAppInstall)) {
          uid
          installId
          dappId
        }
      }
    `;
    const installResult = await dgraphClient.query(installQuery, { $installId: installId });
    const existingInstall = installResult.install?.[0];

    const dappQuery = `
      query dapp($id: string) {
        dapp(func: eq(id, $id)) @filter(type(DApp)) {
          uid
          downloadCount
        }
      }
    `;
    const dappResult = await dgraphClient.query(dappQuery, { $id: dappId });
    const dappNode = dappResult.dapp?.[0];

    if (!dappNode) {
      return res.status(404).json({ error: 'dApp not found' });
    }

    if (existingInstall) {
      return res.json({
        created: false,
        downloadCount: dappNode.downloadCount || 0
      });
    }

    const nextCount = (dappNode.downloadCount || 0) + 1;

    const mutation = {
      set: [
        {
          uid: `_:install_${installId}`,
          dgraph_type: 'DAppInstall',
          id: installId,
          installId,
          dappId,
          suiAddress,
          platform: platform || 'unknown',
          userAgent: userAgent || '',
          subscriptionJson: subscription ? JSON.stringify(subscription) : '',
          createdAt: new Date().toISOString()
        },
        {
          uid: dappNode.uid,
          downloadCount: nextCount,
          updatedAt: new Date().toISOString()
        }
      ]
    };

    await dgraphClient.mutate(mutation);

    res.json({
      created: true,
      downloadCount: nextCount
    });
  } catch (error) {
    logger.error('Failed to record install', { error });
    res.status(500).json({ error: 'Failed to record install' });
  }
});

export default router;
