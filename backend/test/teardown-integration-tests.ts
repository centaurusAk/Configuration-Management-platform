/**
 * Teardown script for integration tests
 * This runs after all integration tests to clean up
 */

import { execSync } from 'child_process';
import { resolve } from 'path';

export default async function teardownIntegrationTests() {
  console.log('🧹 Cleaning up integration test environment...');

  try {
    // Stop and remove test containers
    execSync('docker-compose -f docker-compose.test.yml down -v', {
      stdio: 'inherit',
      cwd: resolve(__dirname, '../..'),
    });

    console.log('✅ Integration test environment cleaned up!');
  } catch (error) {
    console.error('❌ Failed to cleanup integration test environment:', error);
    process.exit(1);
  }
}
