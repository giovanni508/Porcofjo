import { GhlError, listFunnels } from '@/lib/ghl';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { token, locationId } = await req.json().catch(() => ({}));
  if (!token || !locationId) {
    return Response.json({ error: 'token e locationId sono obbligatori' }, { status: 400 });
  }
  try {
    const funnels = await listFunnels(token, locationId);
    return Response.json({ funnels });
  } catch (err) {
    const status = err instanceof GhlError ? err.status : 500;
    return Response.json({ error: err instanceof Error ? err.message : 'Errore GHL' }, { status });
  }
}
