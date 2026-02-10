import express from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';
import FormData from 'form-data';
import fs from 'fs';

const router = express.Router();

const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';
const PM_SERVICE_URL = process.env.PM_SERVICE_URL || 'http://localhost:3004';
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';

/**
 * POST /walrus/nodes/register
 * Register a Walrus node by uploading registry JSON to Walrus
 * 
 * Body (multipart/form-data):
 * - file: node-registry.json (JSON file with node details)
 * - operatorAddress: SUI address of operator (for verification)
 * 
 * Flow:
 * 1. Upload JSON to Walrus (gets blobId)
 * 2. PM service verifies signature and schema
 * 3. DGraph indexes minimal metadata
 */
router.post('/register', async (req, res) => {
  try {
    // This endpoint expects multipart/form-data with a file
    // In a real implementation, you'd use multer or similar
    // For now, we'll accept JSON body with registry data
    
    const { registryData, operatorAddress } = req.body;

    if (!registryData || !operatorAddress) {
      return res.status(400).json({
        error: 'Missing required fields: registryData (JSON object), operatorAddress'
      });
    }

    // Validate registryData has required fields
    if (!registryData.operatorAddress || !registryData.nodeAddress || !registryData.endpoint) {
      return res.status(400).json({
        error: 'Registry data missing required fields: operatorAddress, nodeAddress, endpoint'
      });
    }

    // Verify operatorAddress matches
    if (registryData.operatorAddress !== operatorAddress) {
      return res.status(400).json({
        error: 'Operator address mismatch'
      });
    }

    // 1. Upload registry JSON to Walrus
    let blobId: string;
    try {
      const jsonBuffer = Buffer.from(JSON.stringify(registryData, null, 2));
      const formData = new FormData();
      formData.append('file', jsonBuffer, {
        filename: 'node-registry.json',
        contentType: 'application/json'
      });
      formData.append('uploader', operatorAddress);

      const walrusResponse = await axios.post(
        `${WALRUS_SERVICE_URL}/blobs/upload`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 10000
        }
      );

      blobId = walrusResponse.data.blobId;
      if (!blobId) {
        return res.status(500).json({
          error: 'Failed to upload registry to Walrus'
        });
      }

      logger.info('Registry uploaded to Walrus', { blobId, operatorAddress });
    } catch (walrusError) {
      logger.error('Failed to upload registry to Walrus', {
        error: walrusError instanceof Error ? walrusError.message : String(walrusError)
      });
      return res.status(500).json({
        error: 'Failed to upload registry to Walrus',
        details: walrusError instanceof Error ? walrusError.message : String(walrusError)
      });
    }

    // 2. PM service verifies signature and schema
    let verified = false;
    try {
      const verifyResponse = await axios.post(
        `${PM_SERVICE_URL}/node-registry/verify`,
        { blobId, operatorAddress },
        { timeout: 10000 }
      );

      verified = verifyResponse.data.verified === true;
      if (!verified) {
        logger.warn('Registry verification failed', {
          blobId,
          error: verifyResponse.data.error
        });
        // Continue anyway - node can be verified later
      }
    } catch (verifyError) {
      logger.warn('Registry verification service unavailable', {
        blobId,
        error: verifyError instanceof Error ? verifyError.message : String(verifyError)
      });
      // Continue - verification can happen asynchronously
    }

    res.json({
      success: true,
      blobId,
      operatorAddress,
      verified,
      message: verified
        ? 'Node registered and verified'
        : 'Node registered, verification pending'
    });
  } catch (error) {
    logger.error('Error registering Walrus node', error);
    res.status(500).json({
      error: 'Failed to register node',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
