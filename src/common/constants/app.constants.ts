export const APP_CONSTANTS = {
  MAX_FILE_SIZE_BYTES:     2048 * 1024,      //2 mb  per file — prevents memory spikes from reading minified bundles
  MAX_CACHE_ENTRIES:       5_000,           // LRU eviction kicks in after this
  CLONE_TIMEOUT_MS:        120_000,         // 2 min — prevents hanging on slow/large repos
  CLONE_MAX_RETRIES:       2,
  MAX_REPO_FILES:          50_000,          // refuse repos larger than this
  ANALYSIS_TIMEOUT_MS:     180_000,         // 3 min total per analysis request
  RATE_LIMIT_TTL_SECONDS:  60,
  RATE_LIMIT_MAX_REQUESTS: 10,             // 10 analyses per IP per minute
  GITHUB_URL_REGEX:        /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/,
} as const;