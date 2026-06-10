/**
 * Client per l'API ufficiale GoHighLevel 2.0 (services.leadconnectorhq.com).
 * Autenticazione: Private Integration Token (PIT) del sub-account (location-scoped).
 *
 * Nota: l'API pubblica di GHL espone i funnel in LETTURA (lista funnel, lista pagine).
 * Non esiste a oggi un endpoint pubblico per creare/aggiornare una pagina funnel con
 * HTML custom: il deploy avviene quindi con flusso guidato (vedi GhlPanel).
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export class GhlError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function ghlFetch<T>(token: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(GHL_BASE + path);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.message ? ` — ${Array.isArray(j.message) ? j.message.join('; ') : j.message}` : '';
    } catch {
      /* corpo non JSON */
    }
    throw new GhlError(res.status, `GHL ${res.status}${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function verifyLocation(token: string, locationId: string) {
  const data = await ghlFetch<{ location?: { id: string; name: string; companyId?: string } }>(
    token,
    `/locations/${encodeURIComponent(locationId)}`,
  );
  return data.location ?? null;
}

export async function listFunnels(token: string, locationId: string) {
  const data = await ghlFetch<{ funnels?: unknown[] }>(token, '/funnels/funnel/list', {
    locationId,
  });
  return data.funnels ?? [];
}

export async function listFunnelPages(token: string, locationId: string, funnelId: string) {
  const data = await ghlFetch<{ pages?: unknown[] }>(token, '/funnels/page', {
    locationId,
    funnelId,
    limit: '50',
    offset: '0',
  });
  return data.pages ?? [];
}
