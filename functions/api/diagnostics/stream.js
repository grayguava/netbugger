export async function onRequestGet({ request }) {

  const CHUNK_SIZE = 64 * 1024;
  const chunk = new Uint8Array(CHUNK_SIZE);
  crypto.getRandomValues(chunk);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  let active = true;

  // stop when browser aborts fetch
  request.signal.addEventListener("abort", () => {
    active = false;
    writer.close();
  });

  async function pump() {
    try {
      while (active) {
        await writer.write(chunk);
      }
    } catch {}
  }

  pump();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Encoding": "identity"
    }
  });
}
