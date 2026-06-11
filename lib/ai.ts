/**
 * Configurazione multi-provider AI (condivisa client/server).
 * Le chiavi inserite dall'interfaccia restano nel browser (localStorage) e
 * vengono inviate solo alle API di questa app; in alternativa si possono
 * configurare come variabili d'ambiente sul server.
 */

export type AiProvider = 'claude' | 'gemini' | 'groq' | 'openrouter' | 'custom';

export interface AiSettings {
  provider: AiProvider;
  model?: string;
  apiKey?: string;
  /** Solo per provider 'custom': base URL compatibile OpenAI (es. https://host/v1) */
  baseUrl?: string;
}

export interface ProviderInfo {
  label: string;
  free: boolean;
  defaultModel: string;
  /** Base URL API compatibile OpenAI (assente per Claude) */
  baseUrl?: string;
  envKey: string;
  keyUrl: string;
  note: string;
}

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  claude: {
    label: 'Claude (Anthropic)',
    free: false,
    defaultModel: 'claude-opus-4-8',
    envKey: 'ANTHROPIC_API_KEY',
    keyUrl: 'https://platform.claude.com',
    note: 'Qualità massima di design e aderenza al copy. A pagamento.',
  },
  gemini: {
    label: 'Google Gemini',
    free: true,
    defaultModel: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    envKey: 'GEMINI_API_KEY',
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Piano gratuito generoso. Chiave gratis da Google AI Studio.',
  },
  groq: {
    label: 'Groq',
    free: true,
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    keyUrl: 'https://console.groq.com/keys',
    note: 'Velocissimo e con piano gratuito. Modelli open source (Llama).',
  },
  openrouter: {
    label: 'OpenRouter',
    free: true,
    defaultModel: 'deepseek/deepseek-chat-v3-0324:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Un solo account per centinaia di modelli, molti con variante ":free".',
  },
  custom: {
    label: 'Endpoint personalizzato',
    free: false,
    defaultModel: '',
    envKey: 'CUSTOM_AI_API_KEY',
    keyUrl: '',
    note: 'Qualunque API compatibile OpenAI (Ollama, LM Studio, Together, ecc.).',
  },
};

export const DEFAULT_AI: AiSettings = { provider: 'claude' };

const STORAGE_KEY = 'lampo:ai-settings';

export function loadAiSettings(): AiSettings {
  if (typeof window === 'undefined') return DEFAULT_AI;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI;
    const parsed = JSON.parse(raw) as AiSettings;
    if (!PROVIDERS[parsed.provider]) return DEFAULT_AI;
    return parsed;
  } catch {
    return DEFAULT_AI;
  }
}

export function saveAiSettings(s: AiSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota */ }
}
