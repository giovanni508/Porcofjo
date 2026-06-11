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

/** Streaming per qualunque provider con API compatibile OpenAI (Gemini, Groq, OpenRouter, custom).
 *  Se il modello tronca l'output per limite di lunghezza, chiede automaticamente
 *  di continuare da dove si era fermato finché il documento non è completo. */
function streamOpenAiCompat(
  system: string,
  userPrompt: string,
  baseUrl: string,
  apiKey: string,
  model: string,
): Response {
  const encoder = new TextEncoder();
  const isGemini = baseUrl.includes('generativelanguage.googleapis.com');
  const isGroq = baseUrl.includes('api.groq.com');
  // Limite di output per richiesta: Gemini arriva a 65k, Groq a 32k;
  // per gli altri si resta prudenti e ci pensa la continuazione automatica
  const maxTokens = isGemini ? 65536 : isGroq ? 32768 : 16384;
  const MAX_CONTINUATIONS = 4;

  type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

  async function requestOnce(
    messages: Msg[],
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<{ text: string; finish: string | null; error?: string }> {
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
        max_tokens: maxTokens,
        // Su Gemini il "ragionamento" consuma il budget di output: lo riduciamo
        ...(isGemini ? { reasoning_effort: 'low' } : {}),
        messages,
      }),
    });

    if (!res.ok || !res.body) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail += ` — ${j?.error?.message || JSON.stringify(j).slice(0, 300)}`;
      } catch { /* corpo non JSON */ }
      return { text: '', finish: null, error: detail };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let finish: string | null = null;

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
          if (delta) {
            text += delta;
            controller.enqueue(encoder.encode(delta));
          }
          if (choice?.finish_reason) finish = choice.finish_reason;
        } catch { /* riga SSE parziale o keep-alive */ }
      }
    }
    return { text, finish };
  }

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const baseMessages: Msg[] = [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ];

        let result = await requestOnce(baseMessages, controller);
        let accumulated = result.text;
        let rounds = 0;

        // Continuazione automatica finché l'output è troncato e il documento incompleto
        while (
          !result.error &&
          result.finish === 'length' &&
          !/<\/html>\s*$/i.test(accumulated) &&
          rounds < MAX_CONTINUATIONS
        ) {
          rounds++;
          const contMessages: Msg[] = [
            ...baseMessages,
            { role: 'assistant', content: accumulated },
            {
              role: 'user',
              content:
                'La tua risposta è stata interrotta per limite di lunghezza. ' +
                'CONTINUA ESATTAMENTE dal punto in cui ti sei fermato: riprendi dal carattere ' +
                'successivo all’ultimo che hai scritto, senza ripetere nulla di già scritto, ' +
                'senza commenti, senza blocchi markdown. Completa il documento fino a </html>.',
            },
          ];
          result = await requestOnce(contMessages, controller);
          if (!result.text) break;
          accumulated += result.text;
        }

        if (result.error) {
          controller.enqueue(encoder.encode(errorChunk(result.error)));
        } else if (result.finish === 'length' && !/<\/html>\s*$/i.test(accumulated)) {
          controller.enqueue(encoder.encode(errorChunk(
            'output troncato dal modello anche dopo i tentativi di continuazione: prova un modello con più output (es. Gemini) o un brief più corto.',
          )));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(errorChunk(err instanceof Error ? err.message : String(err))));
      }
      controller.close();
    },
  });

  return new Response(readable, { headers: TEXT_HEADERS });
}
