import Anthropic from '@anthropic-ai/sdk';
import { MODEL } from './prompts';

/**
 * Esegue una richiesta streaming a Claude e restituisce una Response
 * che emette il testo generato man mano (text/plain chunked).
 */
export function streamClaudeText(system: string, userPrompt: string): Response {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY non configurata sul server. Aggiungila al file .env.' },
      { status: 500 },
    );
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt }],
      });

      stream.on('text', (delta) => controller.enqueue(encoder.encode(delta)));

      try {
        const final = await stream.finalMessage();
        if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode('\n<!--LAMPO_ERROR:output troncato (max_tokens). Riprova con un brief più sintetico.-->'));
        }
      } catch (err) {
        const msg = err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err);
        controller.enqueue(encoder.encode(`\n<!--LAMPO_ERROR:${msg.replace(/-->/g, '')}-->`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
