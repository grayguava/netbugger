// index.js

import {
  canIssueToken,
  issueToken
} from "./shared.js";

export async function onRequestGet() {

  if (!canIssueToken()) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Daily token limit reached"
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  }

  const token = issueToken();

  return new Response(JSON.stringify({
    ok: true,
    token
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}