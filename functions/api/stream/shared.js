// shared.js

import {
  TOKEN_TTL_MS,
  MAX_STREAMS_PER_TOKEN,
  DAILY_TOKEN_LIMIT,
  COUNTER_TTL_SECONDS,
} from "./globals.js";

export const activeTokens = new Map();

function getTodayKey() {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `daily:${d.getUTCFullYear()}-${mm}-${dd}`;
}
async function getCount(kv) {
  const val = await kv.get(getTodayKey());
  return val ? parseInt(val, 10) : 0;
}
async function incrementCount(kv) {
  const key   = getTodayKey();
  const val   = await kv.get(key);
  const next  = (val ? parseInt(val, 10) : 0) + 1;
  await kv.put(key, String(next), { expirationTtl: COUNTER_TTL_SECONDS });
  return next;
}


export async function canIssueToken(kv) {
  const count = await getCount(kv);
  return count < DAILY_TOKEN_LIMIT;
}

export async function issueToken(kv) {
  await incrementCount(kv);

  const token  = crypto.randomUUID();
  const expiry = Date.now() + TOKEN_TTL_MS;

  activeTokens.set(token, {
    expiry,
    streamsOpened: 0,
    maxStreams: MAX_STREAMS_PER_TOKEN,
  });

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

  if (record.streamsOpened >= record.maxStreams) {
    activeTokens.delete(token);
  }

  return true;
}