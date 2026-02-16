import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import * as path from 'path';

const execAsync = promisify(exec);

const REPO_PATH = process.env.REPO_PATH || '/home/ubuntu/dlux-sui';
const DEPLOY_SCRIPT_PATH = process.env.DEPLOY_SCRIPT_PATH || path.join(REPO_PATH, 'deploy-server.sh');
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'main';
const TEST_DEPLOY_BRANCH = process.env.TEST_DEPLOY_BRANCH || 'move';
const DEPLOY_TEST_FRONTEND_SCRIPT = path.join(REPO_PATH, 'scripts', 'deploy-test-frontend.sh');
const DEPLOY_PROD_FRONTEND_SCRIPT = path.join(REPO_PATH, 'scripts', 'deploy-prod-frontend.sh');
const RESET_SCRIPT_PATH = process.env.DGRAPH_RESET_SCRIPT_PATH || path.join(REPO_PATH, 'scripts', 'reset-dgraph.sh');

export interface DeploymentResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Execute deployment script (full deploy - all services)
 */
export async function deploy(): Promise<DeploymentResult> {
  try {
    logger.info(`Starting full deployment from ${REPO_PATH}`);
    
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
 * Deploy test frontend from move branch to test.dlux.io
 */
export async function deployTestFrontend(): Promise<DeploymentResult> {
  try {
    logger.info(`Starting test frontend deployment from ${TEST_DEPLOY_BRANCH} branch`);
    
    // Check if deploy script exists
    const { stdout: scriptExists } = await execAsync(`test -f ${DEPLOY_TEST_FRONTEND_SCRIPT} && echo "exists" || echo "missing"`);
    
    if (scriptExists.trim() !== 'exists') {
      throw new Error(`Test frontend deploy script not found at ${DEPLOY_TEST_FRONTEND_SCRIPT}`);
    }

    // Make sure script is executable
    await execAsync(`chmod +x ${DEPLOY_TEST_FRONTEND_SCRIPT}`);

    // Run deployment script
    logger.info(`Executing test frontend deploy script: ${DEPLOY_TEST_FRONTEND_SCRIPT}`);
    const { stdout, stderr } = await execAsync(
      `cd ${REPO_PATH} && ${DEPLOY_TEST_FRONTEND_SCRIPT}`,
      {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        timeout: 300000, // 5 minute timeout
      }
    );

    const output = stdout || '';
    const error = stderr || '';

    if (error && !output.includes('✅')) {
      logger.warn('Test frontend deployment completed with warnings', { error });
    }

    logger.info('Test frontend deployment completed successfully');
    
    return {
      success: true,
      output: output + (error ? `\nWarnings: ${error}` : ''),
    };
  } catch (error: any) {
    logger.error('Test frontend deployment failed', { error: error.message, stack: error.stack });
    
    return {
      success: false,
      output: error.stdout || '',
      error: error.message || 'Unknown test frontend deployment error',
    };
  }
}

/**
 * Deploy production frontend from main branch to dlux.io
 */
export async function deployProdFrontend(): Promise<DeploymentResult> {
  try {
    logger.info(`Starting production frontend deployment from ${DEPLOY_BRANCH} branch`);
    
    // Check if deploy script exists
    const { stdout: scriptExists } = await execAsync(`test -f ${DEPLOY_PROD_FRONTEND_SCRIPT} && echo "exists" || echo "missing"`);
    
    if (scriptExists.trim() !== 'exists') {
      throw new Error(`Production frontend deploy script not found at ${DEPLOY_PROD_FRONTEND_SCRIPT}`);
    }

    // Make sure script is executable
    await execAsync(`chmod +x ${DEPLOY_PROD_FRONTEND_SCRIPT}`);

    // Run deployment script
    logger.info(`Executing production frontend deploy script: ${DEPLOY_PROD_FRONTEND_SCRIPT}`);
    const { stdout, stderr } = await execAsync(
      `cd ${REPO_PATH} && ${DEPLOY_PROD_FRONTEND_SCRIPT}`,
      {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        timeout: 300000, // 5 minute timeout
      }
    );

    const output = stdout || '';
    const error = stderr || '';

    if (error && !output.includes('✅')) {
      logger.warn('Production frontend deployment completed with warnings', { error });
    }

    logger.info('Production frontend deployment completed successfully');
    
    return {
      success: true,
      output: output + (error ? `\nWarnings: ${error}` : ''),
    };
  } catch (error: any) {
    logger.error('Production frontend deployment failed', { error: error.message, stack: error.stack });
    
    return {
      success: false,
      output: error.stdout || '',
      error: error.message || 'Unknown production frontend deployment error',
    };
  }
}

/**
 * Reset Dgraph (optional, guarded by webhook flag)
 */
export async function resetDgraph(): Promise<DeploymentResult> {
  try {
    logger.info(`Starting Dgraph reset using ${RESET_SCRIPT_PATH}`);

    const { stdout: scriptExists } = await execAsync(`test -f ${RESET_SCRIPT_PATH} && echo "exists" || echo "missing"`);
    if (scriptExists.trim() !== 'exists') {
      throw new Error(`Dgraph reset script not found at ${RESET_SCRIPT_PATH}`);
    }

    await execAsync(`chmod +x ${RESET_SCRIPT_PATH}`);

    const { stdout, stderr } = await execAsync(
      `cd ${REPO_PATH} && ${RESET_SCRIPT_PATH}`,
      {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 300000,
      }
    );

    const output = stdout || '';
    const error = stderr || '';

    if (error && !output.includes('✅')) {
      logger.warn('Dgraph reset completed with warnings', { error });
    }

    logger.info('Dgraph reset completed successfully');

    return {
      success: true,
      output: output + (error ? `\nWarnings: ${error}` : ''),
    };
  } catch (error: any) {
    logger.error('Dgraph reset failed', { error: error.message, stack: error.stack });

    return {
      success: false,
      output: error.stdout || '',
      error: error.message || 'Unknown Dgraph reset error',
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
