export async function onRequestGet(context) {
  const { request } = context;
  const cf = request.cf || {};

  return Response.json({
    colo: cf.colo,
    city: cf.city,
    country: cf.country,
    asn: cf.asn,
    isp: cf.asOrganization,
    tls: cf.tlsVersion,
    http: cf.httpProtocol,

    /* client coordinates (Cloudflare provides these) */
    clientLat: cf.latitude,
    clientLon: cf.longitude

  }, { headers:{ "Cache-Control":"no-store" }});
}