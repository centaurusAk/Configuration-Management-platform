/**
 * Circuit Breaker Implementation
 * 
 * Implements the circuit breaker pattern to prevent cascading failures.
 * States: CLOSED (normal), OPEN (failing fast), HALF_OPEN (testing recovery)
 * 
 * Requirements: 9.4, 9.5
 */

export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitBreakerOptions {
  threshold?: number;        // Failures before opening (default: 5)
  timeout?: number;          // Time before retry in ms (default: 60000)
  successThreshold?: number; // Successes to close from half-open (default: 2)
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly successThreshold: number;
  
  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.threshold ?? 5;
    this.timeout = options.timeout ?? 60000;
    this.successThreshold = options.successThreshold ?? 2;
  }
  
  /**
   * Execute an operation with circuit breaker protection
   * @throws Error if circuit is OPEN
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        // Requirement 9.5: Fail fast when open
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        // Recovered, close the circuit
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Requirement 9.4: Open after threshold failures
    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }
  
  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }
  
  /**
   * Reset the circuit breaker to CLOSED state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}
