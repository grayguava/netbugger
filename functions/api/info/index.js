export async function onRequestGet(context) {
  const { request } = context;
  const cf = request.cf || {};

  return Response.json({
    colo: cf.colo ?? null,
    city: cf.city ?? null,
    region: cf.region ?? null,
    regionCode: cf.regionCode ?? null,
    country: cf.country ?? null,
    continent: cf.continent ?? null,
    timezone: cf.timezone ?? null,

    asn: cf.asn ?? null,
    isp: cf.asOrganization ?? null,

    tls: cf.tlsVersion ?? null,
    http: cf.httpProtocol ?? null,

    clientIp: request.headers.get("CF-Connecting-IP") ?? null,

    clientLat: cf.latitude ?? null,
    clientLon: cf.longitude ?? null
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}