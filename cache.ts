// cache.ts — Pluggable cache adapter
//
// Default implementation: in-memory Map (identical to the previous behavior
// in db.ts) so the local app keeps working with no external dependencies.
//
// If process.env.REDIS_URL is set, an `ioredis` client is lazily initialized
// (dynamically imported so the app still runs without the package installed)
// and used as a secondary layer. The synchronous interface the app already
// relies on (cachedQuery / setCache / clearCache) is preserved: the memory
// layer serves synchronous reads while writes/deletes are mirrored to Redis
// in the background so a shared Redis instance stays warm across instances.

interface CacheEntry<T = unknown> {
  data: T;
  expiry: number;
}

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default

// ── In-memory layer (always present for synchronous reads) ──
const memory = new Map<string, CacheEntry<unknown>>();

// ── Optional Redis layer ──
const REDIS_URL = process.env.REDIS_URL;
let redisClient: any = null;
let redisInitPromise: Promise<any> | null = null;

async function getRedis(): Promise<any | null> {
  if (!REDIS_URL) return null;
  if (redisClient) return redisClient;
  if (!redisInitPromise) {
    redisInitPromise = (async () => {
      try {
        // Use a variable so TS does not require the module to be installed.
        const moduleName = 'ioredis';
        const mod: any = await import(moduleName);
        const Redis = mod.default ?? mod;
        const client = new Redis(REDIS_URL);
        client.on('error', (err: any) => {
          console.error('[Cache Redis]', err?.message || err);
        });
        return client;
      } catch (err) {
        console.error('[Cache Redis] Failed to initialize:', (err as Error)?.message || err);
        return null;
      }
    })();
  }
  redisClient = await redisInitPromise;
  return redisClient;
}

export function cachedQuery(key: string, ttl?: number): { data: unknown } | null {
  const entry = memory.get(key);
  if (entry && Date.now() < entry.expiry) return { data: entry.data };
  return null;
}

export function setCache(key: string, data: unknown, ttl?: number): void {
  memory.set(key, { data, expiry: Date.now() + (ttl || CACHE_TTL) });
  if (REDIS_URL) {
    const seconds = Math.max(1, Math.ceil((ttl || CACHE_TTL) / 1000));
    void getRedis().then((client) => {
      if (client) client.set(key, JSON.stringify({ data }), 'EX', seconds).catch(() => {});
    });
  }
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    memory.clear();
  } else {
    for (const key of memory.keys()) {
      if (key.includes(pattern)) memory.delete(key);
    }
  }
  if (REDIS_URL) {
    void getRedis().then((client) => {
      if (!client) return;
      if (!pattern) {
        client.flushdb().catch(() => {});
        return;
      }
      client.keys(`*${pattern}*`).then((keys: string[]) => {
        if (keys && keys.length) client.del(...keys).catch(() => {});
      }).catch(() => {});
    });
  }
}

// Periodic in-memory cleanup (mirrors previous db.ts behavior)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (now >= entry.expiry) memory.delete(key);
  }
}, 60000);
