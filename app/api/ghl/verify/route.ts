import { GhlError, verifyLocation } from '@/lib/ghl';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { token, locationId } = await req.json().catch(() => ({}));
  if (!token || !locationId) {
    return Response.json({ error: 'token e locationId sono obbligatori' }, { status: 400 });
  }
  try {
    const location = await verifyLocation(token, locationId);
    return Response.json({ ok: true, location });
  } catch (err) {
    const status = err instanceof GhlError ? err.status : 500;
    return Response.json({ error: err instanceof Error ? err.message : 'Errore GHL' }, { status });
  }
}
