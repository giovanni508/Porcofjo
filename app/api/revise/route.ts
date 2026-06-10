import { buildRevisionSystemPrompt, buildRevisionUserPrompt } from '@/lib/prompts';
import { streamClaudeText } from '@/lib/stream';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(req: Request) {
  let body: { html?: string; instruction?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }
  if (!body.html?.trim() || !body.instruction?.trim()) {
    return Response.json({ error: 'html e instruction sono obbligatori' }, { status: 400 });
  }
  return streamClaudeText(buildRevisionSystemPrompt(), buildRevisionUserPrompt(body.html, body.instruction));
}
