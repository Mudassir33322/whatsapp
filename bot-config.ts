// Centralized bot configuration — override via environment variables

export const BOT_CONFIG = {
  rateLimitWindow: parseInt(process.env.BOT_RATE_LIMIT_WINDOW || '2000', 10),
  stateTimeoutMs: parseInt(process.env.BOT_STATE_TIMEOUT_MS || String(4 * 60 * 60 * 1000), 10),
  recentTimeoutMs: parseInt(process.env.BOT_RECENT_TIMEOUT_MS || '5000', 10),
  rateLimitCleanupInterval: parseInt(process.env.BOT_RATE_LIMIT_CLEANUP_INTERVAL || String(5 * 60 * 1000), 10),
  pointsPerPriceDivisor: parseInt(process.env.BOT_POINTS_DIVISOR || '10', 10),
  rescheduleWindowDays: parseInt(process.env.BOT_RESCHEDULE_WINDOW_DAYS || '7', 10),
  currency: process.env.BOT_CURRENCY || 'Rs.',
  maxRetries: parseInt(process.env.BOT_MAX_RETRIES || '3', 10),
};
