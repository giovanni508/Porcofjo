import { GhlError, listFunnelPages } from '@/lib/ghl';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { token, locationId, funnelId } = await req.json().catch(() => ({}));
  if (!token || !locationId || !funnelId) {
    return Response.json({ error: 'token, locationId e funnelId sono obbligatori' }, { status: 400 });
  }
  try {
    const pages = await listFunnelPages(token, locationId, funnelId);
    return Response.json({ pages });
  } catch (err) {
    const status = err instanceof GhlError ? err.status : 500;
    return Response.json({ error: err instanceof Error ? err.message : 'Errore GHL' }, { status });
  }
}
