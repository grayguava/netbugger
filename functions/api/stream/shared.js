// shared.js

import {
  TOKEN_TTL_MS,
  MAX_STREAMS_PER_TOKEN,
  DAILY_TOKEN_LIMIT
} from "./globals.js";

// In-memory state (per isolate)
export const activeTokens = new Map();

let currentDay = null;
let dailyCount = 0;

function getTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function resetDailyIfNeeded() {
  const today = getTodayKey();
  if (currentDay !== today) {
    currentDay = today;
    dailyCount = 0;
  }
}

export function canIssueToken() {
  resetDailyIfNeeded();
  return dailyCount < DAILY_TOKEN_LIMIT;
}

export function issueToken() {
  const token = crypto.randomUUID();
  const expiry = Date.now() + TOKEN_TTL_MS;

  activeTokens.set(token, {
    expiry,
    streamsOpened: 0,
    maxStreams: MAX_STREAMS_PER_TOKEN
  });

  dailyCount++;
  return token;
}

export function validateAndConsumeStream(token) {
  if (!token) return false;

  const record = activeTokens.get(token);
  if (!record) return false;

  if (Date.now() > record.expiry) {
    activeTokens.delete(token);
    return false;
  }

  if (record.streamsOpened >= record.maxStreams) {
    activeTokens.delete(token);
    return false;
  }

  record.streamsOpened++;

  // If max streams reached, invalidate token
  if (record.streamsOpened >= record.maxStreams) {
    activeTokens.delete(token);
  }

  return true;
}