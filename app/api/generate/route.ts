import { buildGenerationSystemPrompt, buildGenerationUserPrompt } from '@/lib/prompts';
import { streamClaudeText } from '@/lib/stream';
import type { Brief } from '@/lib/types';

export const runtime = 'nodejs';
// Limite del piano Vercel Hobby; la generazione è in streaming quindi la
// connessione resta viva per tutta la durata della funzione
export const maxDuration = 300;

export async function POST(req: Request) {
  let brief: Brief;
  try {
    brief = (await req.json()) as Brief;
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }
  if (!brief?.copy?.trim()) {
    return Response.json({ error: 'Il copy è obbligatorio' }, { status: 400 });
  }
  return streamClaudeText(buildGenerationSystemPrompt(), buildGenerationUserPrompt(brief));
}
