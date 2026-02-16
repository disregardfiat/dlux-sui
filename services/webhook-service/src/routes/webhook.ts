import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { verifyGitHubSignature } from '../utils/webhookVerifier';
import { deploy, deployTestFrontend, deployProdFrontend, pullGitChanges, resetDgraph, DeploymentResult } from '../utils/deployer';

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
const TEST_DEPLOY_BRANCH = process.env.TEST_DEPLOY_BRANCH || 'move';

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
      
      // Get the branch that was pushed to
      const refBranch = payload.ref.replace('refs/heads/', '');
      
      // Determine which deployment to trigger based on branch
      let deployType: 'main' | 'test' | 'none' = 'none';
      
      if (refBranch === DEPLOY_BRANCH) {
        // Main branch push - deploy production frontend only (no services)
        deployType = 'main';
      } else if (refBranch === TEST_DEPLOY_BRANCH) {
        // Move branch push - deploy test frontend
        deployType = 'test';
      } else {
        logger.info(`Push to ${refBranch} ignored (deploying only ${DEPLOY_BRANCH} or ${TEST_DEPLOY_BRANCH})`);
        return res.json({ 
          message: `Push to ${refBranch} ignored`,
          deployed: false 
        });
      }

      const shouldResetDgraph = payload.commits.some(commit =>
        /-reset dgraph/i.test(commit.message)
      );

      logger.info(`Push to ${refBranch} branch detected`, {
        repository: payload.repository.full_name,
        commits: payload.commits.length,
        commitIds: payload.commits.map(c => c.id.substring(0, 7)),
        resetDgraph: shouldResetDgraph,
        deployType,
      });

      // Start deployment asynchronously
      deployAsync(payload, shouldResetDgraph, deployType)
        .then((result) => {
          if (result.success) {
            logger.info(`Deployment completed successfully for ${refBranch}`, { deliveryId });
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
        deployType,
        commits: payload.commits.length,
        resetDgraph: shouldResetDgraph,
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
async function deployAsync(payload: GitHubPushEvent, shouldResetDgraph: boolean, deployType: 'main' | 'test' | 'none' = 'none'): Promise<DeploymentResult> {
  try {
    // Let deploy-server.sh handle git pull - avoids double-pull causing "no changes" early exit
    if (shouldResetDgraph) {
      const resetResult = await resetDgraph();
      if (!resetResult.success) {
        logger.error('Dgraph reset failed, aborting deployment', { error: resetResult.error });
        return resetResult;
      }
    }

    // Run deployment based on branch type
    let deployResult: DeploymentResult;
    
    if (deployType === 'test') {
      // Move branch - deploy test frontend to test.dlux.io
      logger.info('Deploying test frontend from move branch');
      deployResult = await deployTestFrontend();
    } else if (deployType === 'main') {
      // Main branch - deploy production frontend to dlux.io
      logger.info('Deploying production frontend from main branch');
      deployResult = await deployProdFrontend();
    } else {
      // Full deployment (all services) - legacy behavior
      logger.info('Deploying all services');
      deployResult = await deploy();
    }
    
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
