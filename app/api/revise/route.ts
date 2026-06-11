import { buildRevisionSystemPrompt, buildRevisionUserPrompt } from '@/lib/prompts';
import { streamAiText } from '@/lib/stream';
import type { AiSettings } from '@/lib/ai';

export const runtime = 'nodejs';
// Limite del piano Vercel Hobby (vedi app/api/generate/route.ts)
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { html?: string; instruction?: string; ai?: AiSettings };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }
  if (!body.html?.trim() || !body.instruction?.trim()) {
    return Response.json({ error: 'html e instruction sono obbligatori' }, { status: 400 });
  }
  return streamAiText(buildRevisionSystemPrompt(), buildRevisionUserPrompt(body.html, body.instruction), body.ai);
}
