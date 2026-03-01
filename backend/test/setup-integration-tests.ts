/**
 * Setup script for integration tests
 * This runs before all integration tests to ensure the database is ready
 */

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
dotenv.config({ path: resolve(__dirname, '../.env.test') });

export default async function setupIntegrationTests() {
  console.log('🔧 Setting up integration test environment...');

  try {
    // Check if Docker is running
    try {
      execSync('docker info', { stdio: 'ignore' });
    } catch (error) {
      console.error('❌ Docker is not running. Please start Docker and try again.');
      process.exit(1);
    }

    // Start test containers
    console.log('🐳 Starting test containers...');
    execSync('docker-compose -f docker-compose.test.yml up -d', {
      stdio: 'inherit',
      cwd: resolve(__dirname, '../..'),
    });

    // Wait for containers to be healthy
    console.log('⏳ Waiting for containers to be ready...');
    let retries = 30;
    while (retries > 0) {
      try {
        const result = execSync(
          'docker-compose -f docker-compose.test.yml ps --format json',
          { cwd: resolve(__dirname, '../..'), encoding: 'utf-8' }
        );
        
        // Check if all services are healthy
        const services = result.trim().split('\n').filter(line => line);
        const allHealthy = services.every(line => {
          try {
            const service = JSON.parse(line);
            return service.Health === 'healthy' || service.State === 'running';
          } catch {
            return false;
          }
        });

        if (allHealthy && services.length >= 2) {
          console.log('✅ Test containers are ready!');
          break;
        }
      } catch (error) {
        // Ignore errors during health check
      }

      retries--;
      if (retries === 0) {
        console.error('❌ Timeout waiting for containers to be ready');
        process.exit(1);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Integration test environment is ready!');
  } catch (error) {
    console.error('❌ Failed to setup integration test environment:', error);
    process.exit(1);
  }
}
