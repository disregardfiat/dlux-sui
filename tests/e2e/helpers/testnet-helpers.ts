/**
 * Testnet setup/teardown helpers (infra only). docs/testing-style.md.
 * Used by CI or local setup scripts. NOT used by Playwright specs (backend no-touch).
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const SCRIPTS = resolve(__dirname, '../scripts');

function runScript(name: string, env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolvePromise) => {
    const child = spawn('bash', [resolve(SCRIPTS, name)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      cwd: process.cwd(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code, signal) => {
      resolvePromise({ stdout, stderr, code: code ?? (signal ? 1 : 0) });
    });
  });
}

/**
 * Start local Sui validator. Blocks until RPC is ready or timeout.
 */
export async function startValidator(): Promise<{ ok: boolean; message?: string }> {
  const result = await runScript('start-validator.sh');
  if (result.code !== 0) {
    return { ok: false, message: result.stderr || result.stdout };
  }
  return { ok: true };
}

/**
 * Stop local Sui validator.
 */
export async function stopValidator(): Promise<{ ok: boolean }> {
  await runScript('stop-validator.sh');
  return { ok: true };
}

/**
 * Deploy contracts to local testnet. Requires validator running.
 * Returns PACKAGE_ID or throws.
 */
export async function deployContracts(rpcUrl = process.env.SUI_RPC_URL || 'http://localhost:9000'): Promise<string> {
  const result = await runScript('deploy-contracts.sh', { SUI_RPC_URL: rpcUrl });
  if (result.code !== 0) {
    throw new Error(`deploy-contracts failed: ${result.stderr || result.stdout}`);
  }
  const outFile = resolve(SCRIPTS, '.package_id');
  if (existsSync(outFile)) {
    return readFileSync(outFile, 'utf8').trim();
  }
  const match = result.stdout.match(/PACKAGE_ID=(0x[a-fA-F0-9]+)/);
  if (match) return match[1];
  throw new Error('Could not determine PACKAGE_ID from deploy output');
}
