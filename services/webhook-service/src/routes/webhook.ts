import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { verifyGitHubSignature } from '../utils/webhookVerifier';
import { deploy, pullGitChanges, DeploymentResult } from '../utils/deployer';

const router = Router();

interface GitHubPushEvent {
  ref: string;
  repository: {
    name: string;
    full_name: string;
  };
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}

const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'main';

// Middleware to capture raw body for signature verification
router.use((req: Request, res: Response, next) => {
  if (req.path === '/webhook' && req.method === 'POST') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      (req as any).rawBody = data;
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
});

/**
 * POST /webhook
 * Handle GitHub webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.error('GITHUB_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get raw body for signature verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-hub-signature-256'] as string;

    // Verify signature
    if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
      logger.warn('Invalid webhook signature', {
        signature: signature?.substring(0, 20) + '...',
        ip: req.ip,
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;

    logger.info('Webhook received', { event, deliveryId });

    // Handle push events
    if (event === 'push') {
      const payload = req.body as GitHubPushEvent;
      
      // Only deploy on push to main branch
      const refBranch = payload.ref.replace('refs/heads/', '');
      
      if (refBranch !== DEPLOY_BRANCH) {
        logger.info(`Push to ${refBranch} ignored (only deploying ${DEPLOY_BRANCH})`);
        return res.json({ 
          message: `Push to ${refBranch} ignored`,
          deployed: false 
        });
      }

      logger.info('Push to main branch detected', {
        repository: payload.repository.full_name,
        commits: payload.commits.length,
        commitIds: payload.commits.map(c => c.id.substring(0, 7)),
      });

      // Start deployment asynchronously
      deployAsync(payload)
        .then((result) => {
          if (result.success) {
            logger.info('Deployment completed successfully', { deliveryId });
          } else {
            logger.error('Deployment failed', { deliveryId, error: result.error });
          }
        })
        .catch((error) => {
          logger.error('Deployment error', { deliveryId, error: error.message });
        });

      // Return immediately - deployment happens in background
      return res.json({
        message: 'Webhook received, deployment started',
        repository: payload.repository.full_name,
        branch: refBranch,
        commits: payload.commits.length,
        deliveryId,
      });
    }

    // Handle ping events (GitHub webhook test)
    if (event === 'ping') {
      logger.info('Webhook ping received', { deliveryId });
      return res.json({ message: 'Webhook configured correctly', event: 'ping' });
    }

    logger.info(`Unhandled webhook event: ${event}`, { deliveryId });
    return res.json({ message: `Event ${event} received but not handled` });

  } catch (error: any) {
    logger.error('Webhook processing error', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Async deployment function
 */
async function deployAsync(payload: GitHubPushEvent): Promise<DeploymentResult> {
  try {
    // First pull latest changes
    const pullResult = await pullGitChanges(DEPLOY_BRANCH);
    
    if (!pullResult.success) {
      logger.error('Git pull failed, aborting deployment', { error: pullResult.error });
      return pullResult;
    }

    // Then run deployment
    const deployResult = await deploy();
    
    return deployResult;
  } catch (error: any) {
    logger.error('Deployment async error', { error: error.message });
    return {
      success: false,
      output: '',
      error: error.message || 'Unknown error',
    };
  }
}

export { router as webhookRouter };
