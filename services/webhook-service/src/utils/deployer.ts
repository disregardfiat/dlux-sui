import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import * as path from 'path';

const execAsync = promisify(exec);

const REPO_PATH = process.env.REPO_PATH || '/home/ubuntu/dlux-sui';
const DEPLOY_SCRIPT_PATH = process.env.DEPLOY_SCRIPT_PATH || path.join(REPO_PATH, 'deploy.sh');
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'main';

export interface DeploymentResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Execute deployment script
 */
export async function deploy(): Promise<DeploymentResult> {
  try {
    logger.info(`Starting deployment from ${REPO_PATH}`);
    
    // Check if deploy script exists
    const { stdout: scriptExists } = await execAsync(`test -f ${DEPLOY_SCRIPT_PATH} && echo "exists" || echo "missing"`);
    
    if (scriptExists.trim() !== 'exists') {
      throw new Error(`Deploy script not found at ${DEPLOY_SCRIPT_PATH}`);
    }

    // Make sure script is executable
    await execAsync(`chmod +x ${DEPLOY_SCRIPT_PATH}`);

    // Run deployment script
    logger.info(`Executing deployment script: ${DEPLOY_SCRIPT_PATH}`);
    const { stdout, stderr } = await execAsync(
      `cd ${REPO_PATH} && ${DEPLOY_SCRIPT_PATH}`,
      {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        timeout: 300000, // 5 minute timeout
      }
    );

    const output = stdout || '';
    const error = stderr || '';

    if (error && !output.includes('✅')) {
      logger.warn('Deployment completed with warnings', { error });
    }

    logger.info('Deployment completed successfully');
    
    return {
      success: true,
      output: output + (error ? `\nWarnings: ${error}` : ''),
    };
  } catch (error: any) {
    logger.error('Deployment failed', { error: error.message, stack: error.stack });
    
    return {
      success: false,
      output: error.stdout || '',
      error: error.message || 'Unknown deployment error',
    };
  }
}

/**
 * Pull latest changes from git
 */
export async function pullGitChanges(branch: string = DEPLOY_BRANCH): Promise<DeploymentResult> {
  try {
    logger.info(`Pulling latest changes from branch: ${branch}`);
    
    const { stdout, stderr } = await execAsync(
      `cd ${REPO_PATH} && git fetch origin && git pull origin ${branch}`,
      {
        maxBuffer: 1024 * 1024, // 1MB buffer
        timeout: 60000, // 1 minute timeout
      }
    );

    const output = stdout || '';
    const error = stderr || '';

    logger.info('Git pull completed', { output, error });

    return {
      success: true,
      output: output + (error ? `\n${error}` : ''),
    };
  } catch (error: any) {
    logger.error('Git pull failed', { error: error.message });
    
    return {
      success: false,
      output: error.stdout || '',
      error: error.message || 'Unknown git error',
    };
  }
}
