/**
 * Property Tests: Circuit breaker behavior
 * 
 * Property 38: For any database connection with a circuit breaker configured
 * with threshold N, after N consecutive failures, the circuit breaker should
 * transition to OPEN state.
 * 
 * Property 39: For any operation protected by a circuit breaker in OPEN state,
 * the operation should fail immediately without attempting the underlying operation.
 * 
 * Validates: Requirements 9.4, 9.5
 */

import * as fc from 'fast-check';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

describe('Property 38 & 39: Circuit breaker behavior', () => {
  describe('Property 38: Circuit breaker opens after threshold failures', () => {
    it('should open after N consecutive failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate threshold between 1 and 10
          fc.integer({ min: 1, max: 10 }),
          async (threshold) => {
            // Create circuit breaker with specified threshold
            const circuitBreaker = new CircuitBreaker({
              threshold,
              timeout: 60000,
              successThreshold: 2,
            });

            // Verify initial state is CLOSED
            expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

            // Create a failing operation
            const failingOperation = async () => {
              throw new Error('Operation failed');
            };

            // Execute the operation threshold-1 times
            // Circuit should remain CLOSED
            for (let i = 0; i < threshold - 1; i++) {
              try {
                await circuitBreaker.execute(failingOperation);
              } catch (error) {
                // Expected to fail
              }
              
              // Should still be CLOSED
              expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
              expect(circuitBreaker.getFailureCount()).toBe(i + 1);
            }

            // Execute one more time to reach threshold
            try {
              await circuitBreaker.execute(failingOperation);
            } catch (error) {
              // Expected to fail
            }

            // Property 38: Circuit should now be OPEN
            expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
            expect(circuitBreaker.getFailureCount()).toBe(threshold);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reset failure count on success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (threshold) => {
            const circuitBreaker = new CircuitBreaker({
              threshold,
              timeout: 60000,
              successThreshold: 2,
            });

            const failingOperation = async () => {
              throw new Error('Operation failed');
            };

            const successfulOperation = async () => {
              return 'success';
            };

            // Fail threshold-1 times
            for (let i = 0; i < threshold - 1; i++) {
              try {
                await circuitBreaker.execute(failingOperation);
              } catch (error) {
                // Expected
              }
            }

            // Should still be CLOSED
            expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

            // Execute successful operation
            await circuitBreaker.execute(successfulOperation);

            // Failure count should be reset
            expect(circuitBreaker.getFailureCount()).toBe(0);
            expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

            // Now fail threshold times to open
            for (let i = 0; i < threshold; i++) {
              try {
                await circuitBreaker.execute(failingOperation);
              } catch (error) {
                // Expected
              }
            }

            // Should be OPEN now
            expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property 39: Circuit breaker fails fast when open', () => {
    it('should fail immediately without executing operation when OPEN', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (threshold) => {
            const circuitBreaker = new CircuitBreaker({
              threshold,
              timeout: 60000,
              successThreshold: 2,
            });

            let operationExecuted = false;
            const trackedOperation = async () => {
              operationExecuted = true;
              throw new Error('Operation failed');
            };

            // Open the circuit by failing threshold times
            for (let i = 0; i < threshold; i++) {
              operationExecuted = false;
              try {
                await circuitBreaker.execute(trackedOperation);
              } catch (error) {
                // Expected
              }
              expect(operationExecuted).toBe(true);
            }

            // Circuit should be OPEN
            expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

            // Try to execute operation again
            operationExecuted = false;
            try {
              await circuitBreaker.execute(trackedOperation);
              fail('Should have thrown error');
            } catch (error) {
              // Property 39: Should fail fast with circuit breaker error
              expect(error.message).toBe('Circuit breaker is OPEN');
              // Property 39: Operation should NOT have been executed
              expect(operationExecuted).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 10, max: 100 }), // timeout in ms
          async (threshold, timeout) => {
            const circuitBreaker = new CircuitBreaker({
              threshold,
              timeout,
              successThreshold: 2,
            });

            const failingOperation = async () => {
              throw new Error('Operation failed');
            };

            // Open the circuit
            for (let i = 0; i < threshold; i++) {
              try {
                await circuitBreaker.execute(failingOperation);
              } catch (error) {
                // Expected
              }
            }

            expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, timeout + 10));

            // Try to execute - should transition to HALF_OPEN
            try {
              await circuitBreaker.execute(failingOperation);
            } catch (error) {
              // Expected to fail, but circuit should have attempted execution
            }

            // After failure in HALF_OPEN, should go back to OPEN
            expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
          },
        ),
        { numRuns: 20 }, // Fewer runs because of timeouts
      );
    });

    it('should close after successThreshold successes in HALF_OPEN', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 10, max: 50 }),
          async (threshold, successThreshold, timeout) => {
            const circuitBreaker = new CircuitBreaker({
              threshold,
              timeout,
              successThreshold,
            });

            const failingOperation = async () => {
              throw new Error('Operation failed');
            };

            const successfulOperation = async () => {
              return 'success';
            };

            // Open the circuit
            for (let i = 0; i < threshold; i++) {
              try {
                await circuitBreaker.execute(failingOperation);
              } catch (error) {
                // Expected
              }
            }

            expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

            // Wait for timeout to transition to HALF_OPEN
            await new Promise(resolve => setTimeout(resolve, timeout + 10));

            // Execute successful operations successThreshold times
            for (let i = 0; i < successThreshold; i++) {
              await circuitBreaker.execute(successfulOperation);
            }

            // Circuit should be CLOSED now
            expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
            expect(circuitBreaker.getFailureCount()).toBe(0);
          },
        ),
        { numRuns: 20 }, // Fewer runs because of timeouts
      );
    });
  });
});
