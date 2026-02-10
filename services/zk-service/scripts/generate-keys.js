#!/usr/bin/env node

/**
 * Generate homomorphic encryption keys for ad verification
 * Run this script and add the output to your .env file
 */

const { generateRandomKeys } = require('paillier-bigint');

async function main() {
  console.log('Generating homomorphic encryption keys...');
  console.log('This may take a few seconds...\n');

  const { publicKey, privateKey } = await generateRandomKeys(3072);

  // Serialize keys
  const publicKeyJson = {
    n: publicKey.n.toString(),
    g: publicKey.g.toString()
  };

  const privateKeyJson = {
    lambda: privateKey.lambda.toString(),
    mu: privateKey.mu.toString(),
    n: publicKey.n.toString(),
    g: publicKey.g.toString()
  };

  const publicKeyB64 = Buffer.from(JSON.stringify(publicKeyJson)).toString('base64');
  const privateKeyB64 = Buffer.from(JSON.stringify(privateKeyJson)).toString('base64');

  console.log('Keys generated successfully!\n');
  console.log('Add these to your .env file:\n');
  console.log(`HOMOMORPHIC_PUBLIC_KEY=${publicKeyB64}`);
  console.log(`HOMOMORPHIC_PRIVATE_KEY=${privateKeyB64}\n`);
  console.log('⚠️  Keep the private key secure! It can decrypt all encrypted data.');
}

main().catch(error => {
  console.error('Error generating keys:', error);
  process.exit(1);
});
