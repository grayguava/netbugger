export async function onRequestGet(context) {
  const { request } = context;
  const cf = request.cf || {};

  return Response.json({
    client: {
      ip: request.headers.get("CF-Connecting-IP") ?? null,
      city: cf.city ?? null,
      region: cf.region ?? null,
      country: cf.country ?? null,
      continent: cf.continent ?? null,
      timezone: cf.timezone ?? null,
      latitude: cf.latitude ?? null,
      longitude: cf.longitude ?? null
    },

    network: {
      asn: cf.asn ?? null,
      originAsOrg: cf.asOrganization ?? null
    },

    protocol: {
      tlsVersion: cf.tlsVersion ?? null,
      httpVersion: cf.httpProtocol ?? null
    },

    edge: {
      colo: cf.colo ?? null,
      rayId: request.headers.get("CF-Ray") ?? null
    }
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}