import crypto from 'crypto';
import { logger } from './logger';

/**
 * Verify GitHub webhook signature
 * @param payload - Raw request body as string
 * @param signature - X-Hub-Signature-256 header value
 * @param secret - Webhook secret from environment
 * @returns true if signature is valid
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    logger.warn('No signature provided in webhook request');
    return false;
  }

  if (!secret) {
    logger.error('GITHUB_WEBHOOK_SECRET not configured');
    return false;
  }

  // GitHub sends signature as: sha256=<hash>
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;

  // Use constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    logger.warn('Signature length mismatch');
    return false;
  }

  const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!isValid) {
    logger.warn('Invalid webhook signature');
  }

  return isValid;
}
