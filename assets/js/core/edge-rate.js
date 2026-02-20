export async function measureEdgeRate(seconds = 5) {

    const url = "/api/diagnostics/stream?nocache=" + crypto.randomUUID();

    const response = await fetch(url, {
        cache: "no-store"
    });

    if (!response.body)
        throw new Error("ReadableStream not supported");

    const reader = response.body.getReader();

    let bytes = 0;
    const end = performance.now() + seconds * 1000;

    while (performance.now() < end) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
    }

    // stop download immediately
    await reader.cancel();

    const mb = bytes / (1024 * 1024);

    return {
        transferredMB: mb,
        duration: seconds,
        rateMBps: mb / seconds
    };
}
