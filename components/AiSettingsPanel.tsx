'use client';

import { useState } from 'react';
import { PROVIDERS, saveAiSettings, type AiProvider, type AiSettings } from '@/lib/ai';

export default function AiSettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: AiSettings;
  onChange: (s: AiSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AiSettings>(settings);
  const info = PROVIDERS[draft.provider];

  function set(patch: Partial<AiSettings>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function save() {
    const clean: AiSettings = {
      provider: draft.provider,
      model: draft.model?.trim() || undefined,
      apiKey: draft.apiKey?.trim() || undefined,
      baseUrl: draft.provider === 'custom' ? draft.baseUrl?.trim() || undefined : undefined,
    };
    saveAiSettings(clean);
    onChange(clean);
    onClose();
  }

  return (
    <aside className="side-panel">
      <header>
        <h3>⚙️ Motore AI</h3>
        <button className="btn sm ghost" onClick={onClose}>✕</button>
      </header>
      <div className="body">
        <p className="hint" style={{ marginTop: 0 }}>
          Scegli quale AI genera le pagine. Le chiavi restano salvate <b>solo in questo browser</b>{' '}
          (in alternativa si possono impostare come variabili d’ambiente sul server).
        </p>

        <div className="complexity">
          {(Object.keys(PROVIDERS) as AiProvider[]).map((p) => (
            <button
              key={p}
              className={`lvl ${draft.provider === p ? 'active' : ''}`}
              onClick={() => set({ provider: p, model: undefined })}
            >
              <span className="n">{draft.provider === p ? '●' : '○'}</span>
              <span>
                <b>
                  {PROVIDERS[p].label}{' '}
                  {PROVIDERS[p].free && <span style={{ color: 'var(--accent-2)' }}>· GRATIS</span>}
                </b>
                <span>{PROVIDERS[p].note}</span>
              </span>
            </button>
          ))}
        </div>

        {draft.provider === 'custom' && (
          <label className="field">
            <span>Base URL (compatibile OpenAI)</span>
            <input
              type="url"
              placeholder="https://il-tuo-host/v1"
              value={draft.baseUrl ?? ''}
              onChange={(e) => set({ baseUrl: e.target.value })}
            />
          </label>
        )}

        <label className="field">
          <span>Modello <em>(vuoto = predefinito{info.defaultModel ? `: ${info.defaultModel}` : ''})</em></span>
          <input
            type="text"
            placeholder={info.defaultModel || 'nome-modello'}
            value={draft.model ?? ''}
            onChange={(e) => set({ model: e.target.value })}
          />
        </label>

        <label className="field">
          <span>
            Chiave API{' '}
            {info.keyUrl && (
              <em>
                — la ottieni gratis su{' '}
                <a href={info.keyUrl} target="_blank" rel="noreferrer">{info.keyUrl.replace('https://', '')}</a>
              </em>
            )}
          </span>
          <input
            type="password"
            placeholder={`Chiave ${info.label} (oppure configura ${info.envKey} sul server)`}
            value={draft.apiKey ?? ''}
            onChange={(e) => set({ apiKey: e.target.value })}
            autoComplete="off"
          />
        </label>

        <div className="row end" style={{ marginTop: 14 }}>
          <button className="btn sm ghost" onClick={onClose}>Annulla</button>
          <button className="btn sm primary" onClick={save}>Salva</button>
        </div>
      </div>
    </aside>
  );
}
