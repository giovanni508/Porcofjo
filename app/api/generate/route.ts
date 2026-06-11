import { buildGenerationSystemPrompt, buildGenerationUserPrompt } from '@/lib/prompts';
import { streamAiText } from '@/lib/stream';
import type { AiSettings } from '@/lib/ai';
import type { Brief } from '@/lib/types';

export const runtime = 'nodejs';
// Limite del piano Vercel Hobby; la generazione è in streaming quindi la
// connessione resta viva per tutta la durata della funzione
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { brief?: Brief; ai?: AiSettings };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }
  const brief = body.brief;
  if (!brief?.copy?.trim()) {
    return Response.json({ error: 'Il copy è obbligatorio' }, { status: 400 });
  }
  return streamAiText(buildGenerationSystemPrompt(), buildGenerationUserPrompt(brief), body.ai);
}
