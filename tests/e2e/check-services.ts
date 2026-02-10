/**
 * Script to check if required services are running before E2E tests
 */

import { apiClient } from './helpers/api-helpers';

async function checkServices() {
  console.log('Checking service availability...\n');

  // Allow environment variables to override default ports
  const dgraphUrl = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
  const walrusUrl = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';
  const suiUrl = process.env.SUI_SERVICE_URL || 'http://localhost:3001';

  const services = [
    { name: 'DGraph Service', type: 'dgraph' as const, url: dgraphUrl },
    { name: 'Walrus Service', type: 'walrus' as const, url: walrusUrl },
    { name: 'SUI Service', type: 'sui' as const, url: suiUrl },
  ];

  const results = await Promise.all(
    services.map(async (service) => {
      const healthy = await apiClient.checkHealth(service.type);
      return { ...service, healthy };
    })
  );

  let allHealthy = true;
  results.forEach((result) => {
    const status = result.healthy ? '✅' : '❌';
    const url = new URL(result.url);
    console.log(`${status} ${result.name} (${url.host}): ${result.healthy ? 'Running' : 'Not running'}`);
    if (!result.healthy) allHealthy = false;
  });

  console.log('');
  if (allHealthy) {
    console.log('✅ All services are running! You can run E2E tests.');
    process.exit(0);
  } else {
    console.log('❌ Some services are not running. Please start services before running E2E tests.');
    console.log('\nTo start services:');
    console.log('  npm run dev:all  # Start all services in parallel');
    console.log('  npm run dev       # Alternative: same as dev:all');
    console.log('\nOr start individual services:');
    console.log('  cd services/dgraph-service && npm run dev');
    console.log('  cd services/walrus-service && npm run dev');
    console.log('  cd services/sui-service && npm run dev');
    process.exit(1);
  }
}

checkServices().catch((error) => {
  console.error('Error checking services:', error);
  process.exit(1);
});
