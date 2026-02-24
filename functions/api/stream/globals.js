// globals.js

// ====== STREAM CONFIGURATION ======
export const TOTAL_BYTES = 100 * 1024 * 1024; // 100MB per stream
export const CHUNK_SIZE = 64 * 1024; // 64KB per chunk

// ====== TOKEN POLICY ======
export const TOKEN_TTL_MS = 30 * 1000; // 30 seconds
export const MAX_STREAMS_PER_TOKEN = 6; // parallel streams allowed per token

// ====== DAILY LIMIT POLICY ======
export const DAILY_TOKEN_LIMIT = 50; // number of tokens issued per day (per isolate)

// ====== RATE LIMIT POLICY (optional hook for later) ======
export const ENABLE_RATE_LIMIT = false;