type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
};

export default function rateLimit(options?: Options) {
  const tokenCache = new Map<string, { count: number; resetAt: number; lastSeen: number }>();
  const interval = options?.interval ?? 60000;
  const maxUniqueTokens = options?.uniqueTokenPerInterval ?? 50000;

  const pruneExpired = (now: number) => {
    for (const [token, entry] of tokenCache.entries()) {
      if (entry.resetAt <= now) {
        tokenCache.delete(token);
      }
    }
  };

  const evictLeastRecentlySeen = () => {
    let candidateToken: string | null = null;
    let oldestSeen = Number.POSITIVE_INFINITY;

    for (const [token, entry] of tokenCache.entries()) {
      if (entry.lastSeen < oldestSeen) {
        oldestSeen = entry.lastSeen;
        candidateToken = token;
      }
    }

    if (candidateToken) {
      tokenCache.delete(candidateToken);
    }
  };

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const now = Date.now();
        pruneExpired(now);

        if (!tokenCache.has(token) && tokenCache.size >= maxUniqueTokens) {
          evictLeastRecentlySeen();
        }

        let entry = tokenCache.get(token);
        if (!entry || entry.resetAt <= now) {
          entry = {
            count: 0,
            resetAt: now + interval,
            lastSeen: now,
          };
          tokenCache.set(token, entry);
        }

        entry.count += 1;
        entry.lastSeen = now;

        const isRateLimited = entry.count > limit;
        
        if (isRateLimited) {
          reject();
        } else {
          resolve();
        }
      }),
  };
}
