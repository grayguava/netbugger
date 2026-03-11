// index.js — GET /api/stream
import { canIssueToken, issueToken } from "./shared.js";

export async function onRequestGet({ request, env }) {

  const kv = env.LIBREPROBE_THROUGHPUT_RL;

  if (!kv) {

    console.error("LIBREPROBE_THROUGHPUT_RL binding is not configured.");
    return new Response(JSON.stringify({
      ok:    false,
      error: "server_error",
      message: "Service misconfigured. Please try again later.",
    }), {
      status:  500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }


  if (!await canIssueToken(kv)) {
    return new Response(JSON.stringify({
      ok:    false,
      error: "daily_limit",
      message: "Daily beta limit reached — try again tomorrow.",
    }), {
      status:  429,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const token = await issueToken(kv);

  return new Response(JSON.stringify({ ok: true, token }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}