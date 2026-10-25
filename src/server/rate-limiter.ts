import { rateLimited } from "./errors";

type RateLimitBucket = {
  tokens: number;
  lastRefillMs: number;
};

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    public readonly maxTokens: number = 30, // capacity
    public readonly refillRatePerSecond: number = 0.5 // refill tokens/sec
  ) {}

  consume(key: string, cost = 1): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefillMs: now };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSeconds = (now - bucket.lastRefillMs) / 1000;
      const refilled = elapsedSeconds * this.refillRatePerSecond;
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + refilled);
      bucket.lastRefillMs = now;
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    return { allowed: false, remaining: 0 };
  }

  assertAllowed(key: string, cost = 1, context = "Request"): void {
    const result = this.consume(key, cost);
    if (!result.allowed) {
      throw rateLimited(`${context} rate limit exceeded. Please wait a moment before trying again.`);
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}

// Global default limiters for different actions
export const analysisRateLimiter = new TokenBucketRateLimiter(20, 0.33); // 20 bursting, ~20/min
export const uploadRateLimiter = new TokenBucketRateLimiter(10, 0.16); // 10 bursting, ~10/min
