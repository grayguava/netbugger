// [token].js

import {
  validateAndConsumeStream
} from "./shared.js";

import {
  TOTAL_BYTES,
  CHUNK_SIZE
} from "./globals.js";

export async function onRequestGet({ params, request }) {

  const token = params.token;

  if (!validateAndConsumeStream(token)) {
    return new Response("Forbidden", { status: 403 });
  }

  const chunk = new Uint8Array(CHUNK_SIZE);
  crypto.getRandomValues(chunk);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  let active = true;

  request.signal.addEventListener("abort", () => {
    active = false;
  });

  (async () => {
    let sent = 0;

    try {
      while (active && sent < TOTAL_BYTES) {
        const remaining = TOTAL_BYTES - sent;
        const size = remaining >= CHUNK_SIZE ? CHUNK_SIZE : remaining;

        await writer.write(chunk.subarray(0, size));
        sent += size;
      }
    } catch (err) {
      // Ignore client abort errors
    }

    try {
      await writer.close();
    } catch {}
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Encoding": "identity"
    }
  });
}