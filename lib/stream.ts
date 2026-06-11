import Anthropic from '@anthropic-ai/sdk';
import { PROVIDERS, type AiSettings } from './ai';

const TEXT_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
};

function errorChunk(msg: string): string {
  return `\n<!--LAMPO_ERROR:${msg.replace(/-->/g, '')}-->`;
}

/**
 * Esegue una richiesta streaming al provider AI scelto e restituisce una
 * Response che emette il testo generato man mano (text/plain chunked).
 */
export function streamAiText(system: string, userPrompt: string, ai?: AiSettings): Response {
  const settings: AiSettings = ai && PROVIDERS[ai.provider] ? ai : { provider: 'claude' };
  const info = PROVIDERS[settings.provider];
  const apiKey = settings.apiKey?.trim() || process.env[info.envKey] || '';

  if (!apiKey) {
    return Response.json(
      {
        error:
          `Nessuna chiave API per ${info.label}. Inseriscila nel pannello "⚙️ AI" ` +
          `oppure configura ${info.envKey} sul server.`,
      },
      { status: 401 },
    );
  }

  if (settings.provider === 'claude') {
    return streamClaude(system, userPrompt, apiKey, settings.model || info.defaultModel);
  }

  const baseUrl = (settings.provider === 'custom' ? settings.baseUrl : info.baseUrl)?.replace(/\/+$/, '');
  if (!baseUrl) {
    return Response.json({ error: 'Base URL mancante per l’endpoint personalizzato.' }, { status: 400 });
  }
  const model = settings.model?.trim() || info.defaultModel;
  if (!model) {
    return Response.json({ error: 'Indica il nome del modello nel pannello "⚙️ AI".' }, { status: 400 });
  }
  return streamOpenAiCompat(system, userPrompt, baseUrl, apiKey, model);
}

function streamClaude(system: string, userPrompt: string, apiKey: string, model: string): Response {
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stream = client.messages.stream({
        model,
        max_tokens: 64000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt }],
      });

      stream.on('text', (delta) => controller.enqueue(encoder.encode(delta)));

      try {
        const final = await stream.finalMessage();
        if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode(errorChunk('output troncato (max_tokens). Riprova con un brief più sintetico.')));
        }
      } catch (err) {
        const msg = err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err);
        controller.enqueue(encoder.encode(errorChunk(msg)));
      }
      controller.close();
    },
  });

  return new Response(readable, { headers: TEXT_HEADERS });
}

/** Streaming per qualunque provider con API compatibile OpenAI (Gemini, Groq, OpenRouter, custom). */
function streamOpenAiCompat(
  system: string,
  userPrompt: string,
  baseUrl: string,
  apiKey: string,
  model: string,
): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            // Intestazioni richieste da OpenRouter per l'attribuzione (innocue altrove)
            'HTTP-Referer': 'https://lampo-landing-builder.vercel.app',
            'X-Title': 'LAMPO Landing Builder',
          },
          body: JSON.stringify({
            model,
            stream: true,
            max_tokens: 32768,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (!res.ok || !res.body) {
          let detail = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            detail += ` — ${j?.error?.message || JSON.stringify(j).slice(0, 300)}`;
          } catch { /* corpo non JSON */ }
          controller.enqueue(encoder.encode(errorChunk(detail)));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finishReason: string | null = null;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const choice = json.choices?.[0];
              const delta: string | undefined = choice?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
              if (choice?.finish_reason) finishReason = choice.finish_reason;
            } catch { /* riga SSE parziale o keep-alive */ }
          }
        }

        if (finishReason === 'length') {
          controller.enqueue(encoder.encode(errorChunk('output troncato dal modello: scegli un modello con più output o un brief più corto.')));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(errorChunk(err instanceof Error ? err.message : String(err))));
      }
      controller.close();
    },
  });

  return new Response(readable, { headers: TEXT_HEADERS });
}
