'use client';

import { useEffect, useRef, useState } from 'react';
import type { Brief, Complexity } from '@/lib/types';

const DRAFT_KEY = 'lampo:brief-draft';

const COMPLEXITY_LABELS: { n: Complexity; title: string; desc: string }[] = [
  { n: 1, title: 'Essenziale', desc: 'Minimale e pulitissimo, solo micro-hover. La qualità è nella tipografia.' },
  { n: 2, title: 'Raffinato', desc: 'Transizioni dolci e reveal leggeri allo scroll. Eleganza discreta.' },
  { n: 3, title: 'Dinamico', desc: 'Animazioni scroll, contatori, parallax leggero, micro-interazioni.' },
  { n: 4, title: 'Avanzato', desc: 'Parallax multi-layer, 3D tilt, bottoni magnetici, gradient animati, cursore custom.' },
  { n: 5, title: 'Spettacolare', desc: 'Scroll-telling cinematografico, canvas/particles, sezioni pinned, effetto WOW totale.' },
];

const SECTORS = ['E-commerce', 'Servizi locali', 'Coaching / Formazione', 'Immobiliare', 'Ristorazione', 'Salute & Benessere', 'SaaS / Tech', 'Eventi', 'Altro'];
const GOALS = ['Generare lead (form)', 'Vendita diretta', 'Prenotazione chiamata', 'Iscrizione webinar/evento', 'Download risorsa', 'Contatto WhatsApp'];
const LANGS = ['Italiano', 'English', 'Español', 'Français', 'Deutsch'];

const emptyBrief: Brief = {
  copy: '',
  language: 'Italiano',
  sector: '',
  goal: '',
  paletteMode: 'ai',
  palette: [],
  complexity: 3,
  mood: '',
  references: '',
  imageUrls: [],
  notes: '',
  fontPreference: '',
};

export default function Wizard({ onGenerate }: { onGenerate: (brief: Brief) => void }) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [colorDraft, setColorDraft] = useState('#1f6feb');
  const [imageDraft, setImageDraft] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setBrief({ ...emptyBrief, ...JSON.parse(saved) });
    } catch { /* draft corrotto: si riparte da zero */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(brief)); } catch { /* quota piena */ }
  }, [brief]);

  const set = (patch: Partial<Brief>) => setBrief((b) => ({ ...b, ...patch }));

  const steps = ['Copy', 'Brand', 'Stile', 'Dettagli', 'Riepilogo'];
  const canNext =
    step === 0 ? brief.copy.trim().length >= 20 : true;

  async function onCopyFile(file: File) {
    setFileError(null);
    const name = file.name.toLowerCase();

    // I formati di testo semplice si leggono direttamente nel browser
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      set({ copy: await file.text() });
      return;
    }

    // Word (.docx) e PDF vengono estratti lato server
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`);
      set({ copy: j.text });
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Impossibile leggere il file');
    } finally {
      setExtracting(false);
    }
  }

  async function onLogoFile(file: File) {
    if (file.size > 1.5 * 1024 * 1024) {
      alert('Logo troppo pesante (max 1.5MB): verrà incorporato nell’HTML, usa un file leggero (SVG/PNG ottimizzato).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="container">
      <div className="hero" style={{ display: step === 0 ? 'block' : 'none' }}>
        <h1>
          <span className="glow">⚡ LAMPO</span>
        </h1>
        <p>
          Landing page all’avanguardia generate dall’AI. Il tuo copy rispettato alla lettera,
          editor visuale live, revisioni via prompt, export in un singolo HTML e deploy su GoHighLevel.
        </p>
      </div>

      <div className="steps" role="progressbar" aria-valuenow={step + 1} aria-valuemax={steps.length}>
        {steps.map((s, i) => (
          <div key={s} className={`step ${i <= step ? 'done' : ''}`} title={s} />
        ))}
      </div>

      {step === 0 && (
        <div className="card">
          <h2>1 · Il tuo Copy</h2>
          <p className="hint">
            Incolla il copy completo della pagina. Verrà usato <b>parola per parola</b>, senza
            riscritture: l’AI deciderà solo come distribuirlo e metterlo in scena. Se carichi un
            file Word, la formattazione originale (titoli, grassetti, elenchi) viene preservata e
            rispettata nella pagina.
          </p>
          <label className="field">
            <span>Copy della landing <em>(obbligatorio, min. 20 caratteri)</em></span>
            <textarea
              rows={12}
              placeholder={'Es.\nTitolo principale...\nSottotitolo...\nBenefici...\nTestimonianze...\nCTA: Prenota ora'}
              value={brief.copy}
              onChange={(e) => set({ copy: e.target.value })}
            />
          </label>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={() => fileInput.current?.click()} disabled={extracting}>
              {extracting ? <><span className="spinner" /> Estraggo il testo…</> : '📄 Carica file (Word / PDF / txt / md)'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) onCopyFile(e.target.files[0]);
                e.target.value = '';
              }}
            />
            <span className="hint" style={{ margin: 0 }}>{brief.copy.trim().length} caratteri</span>
          </div>
          {fileError && <div className="alert error">{fileError}</div>}
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2>2 · Brand</h2>
          <p className="hint">Vuoi usare una palette di colori particolare? Un logo? Dimmelo qui — oppure lascia carta bianca all’AI.</p>

          <label className="field"><span>Palette colori</span></label>
          <div className="choices" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className={`choice ${brief.paletteMode === 'ai' ? 'active' : ''}`} onClick={() => set({ paletteMode: 'ai' })}>
              🎨 Decide l’AI
            </button>
            <button className={`choice ${brief.paletteMode === 'custom' ? 'active' : ''}`} onClick={() => set({ paletteMode: 'custom' })}>
              ✏️ Colori miei
            </button>
          </div>

          {brief.paletteMode === 'custom' && (
            <div className="swatches">
              {brief.palette.map((c, i) => (
                <div className="swatch" key={`${c}-${i}`}>
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => {
                      const palette = [...brief.palette];
                      palette[i] = e.target.value;
                      set({ palette });
                    }}
                  />
                  <button className="x" aria-label="Rimuovi colore" onClick={() => set({ palette: brief.palette.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <input type="color" value={colorDraft} onChange={(e) => setColorDraft(e.target.value)} aria-label="Nuovo colore" />
              <button className="btn sm" disabled={brief.palette.length >= 6} onClick={() => set({ palette: [...brief.palette, colorDraft] })}>
                + Aggiungi
              </button>
            </div>
          )}

          <label className="field">
            <span>Logo <em>(opzionale — verrà incorporato nell’HTML)</em></span>
          </label>
          <div className="row">
            <button className="btn sm" onClick={() => logoInput.current?.click()}>🖼 Carica logo</button>
            {brief.logoDataUrl && (
              <button className="btn sm danger" onClick={() => set({ logoDataUrl: undefined })}>Rimuovi</button>
            )}
            <input
              ref={logoInput}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              hidden
              onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])}
            />
          </div>
          {brief.logoDataUrl && <img src={brief.logoDataUrl} alt="Anteprima logo" className="logo-preview" />}

          <label className="field">
            <span>Preferenza tipografica <em>(opzionale)</em></span>
            <input
              type="text"
              placeholder="Es. serif editoriale elegante / sans geometrico bold / lascia decidere"
              value={brief.fontPreference}
              onChange={(e) => set({ fontPreference: e.target.value })}
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>3 · Stile</h2>
          <p className="hint">Scegli il livello di complessità stilistica: più alto = più animazioni ed effetti speciali.</p>
          <div className="complexity">
            {COMPLEXITY_LABELS.map((l) => (
              <button
                key={l.n}
                className={`lvl ${brief.complexity === l.n ? 'active' : ''}`}
                onClick={() => set({ complexity: l.n })}
              >
                <span className="n">{l.n}</span>
                <span>
                  <b>{l.title}</b>
                  <span>{l.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <label className="field">
            <span>Mood / parole chiave <em>(opzionale)</em></span>
            <input
              type="text"
              placeholder="Es. lussuoso, brutalist, giocoso, dark premium, editoriale..."
              value={brief.mood}
              onChange={(e) => set({ mood: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Referenze <em>(opzionale — URL o descrizioni di siti/stili che ti piacciono)</em></span>
            <textarea
              rows={3}
              placeholder={'Es. https://linear.app — mi piace la pulizia\nStile Apple per la sezione prodotto'}
              value={brief.references}
              onChange={(e) => set({ references: e.target.value })}
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>4 · Dettagli</h2>

          <label className="field">
            <span>Lingua della pagina</span>
            <select value={brief.language} onChange={(e) => set({ language: e.target.value })}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>

          <label className="field"><span>Settore</span></label>
          <div className="choices">
            {SECTORS.map((s) => (
              <button key={s} className={`choice ${brief.sector === s ? 'active' : ''}`} onClick={() => set({ sector: s })}>
                {s}
              </button>
            ))}
          </div>

          <label className="field"><span>Obiettivo della pagina</span></label>
          <div className="choices">
            {GOALS.map((g) => (
              <button key={g} className={`choice ${brief.goal === g ? 'active' : ''}`} onClick={() => set({ goal: g })}>
                {g}
              </button>
            ))}
          </div>

          <label className="field">
            <span>Immagini da usare <em>(opzionale — URL pubblici)</em></span>
          </label>
          <div className="row">
            <input
              type="url"
              placeholder="https://..."
              value={imageDraft}
              onChange={(e) => setImageDraft(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button
              className="btn sm"
              disabled={!imageDraft.trim().startsWith('http')}
              onClick={() => {
                set({ imageUrls: [...(brief.imageUrls ?? []), imageDraft.trim()] });
                setImageDraft('');
              }}
            >
              + Aggiungi
            </button>
          </div>
          {(brief.imageUrls ?? []).map((u, i) => (
            <div className="row between" key={`${u}-${i}`} style={{ marginTop: 6 }}>
              <span className="hint" style={{ margin: 0, wordBreak: 'break-all' }}>{u}</span>
              <button className="btn sm danger" onClick={() => set({ imageUrls: brief.imageUrls!.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}

          <label className="field">
            <span>Altre accortezze / note per l’AI <em>(opzionale)</em></span>
            <textarea
              rows={3}
              placeholder="Es. evita lo sfondo nero, includi una FAQ, il pubblico è over 50..."
              value={brief.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h2>5 · Riepilogo</h2>
          <p className="hint">Controlla il brief: l’AI lo seguirà alla lettera.</p>
          <dl className="summary">
            <dt>Copy</dt>
            <dd className="copy-box">{brief.copy.trim()}</dd>
            <dt>Lingua · Settore · Obiettivo</dt>
            <dd>{brief.language} · {brief.sector || '—'} · {brief.goal || '—'}</dd>
            <dt>Palette</dt>
            <dd>
              {brief.paletteMode === 'ai' ? 'Decide l’AI' : brief.palette.join(', ') || '—'}
              {'  '}· Logo: {brief.logoDataUrl ? 'caricato ✓' : 'nessuno'}
              {brief.fontPreference ? ` · Font: ${brief.fontPreference}` : ''}
            </dd>
            <dt>Complessità stilistica</dt>
            <dd>
              Livello {brief.complexity} — {COMPLEXITY_LABELS.find((l) => l.n === brief.complexity)?.title}
            </dd>
            {brief.mood && (<><dt>Mood</dt><dd>{brief.mood}</dd></>)}
            {brief.references && (<><dt>Referenze</dt><dd>{brief.references}</dd></>)}
            {(brief.imageUrls?.length ?? 0) > 0 && (<><dt>Immagini</dt><dd>{brief.imageUrls!.join('\n')}</dd></>)}
            {brief.notes && (<><dt>Note</dt><dd>{brief.notes}</dd></>)}
          </dl>
        </div>
      )}

      <div className="row between">
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          ← Indietro
        </button>
        {step < steps.length - 1 ? (
          <button className="btn primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Avanti →
          </button>
        ) : (
          <button className="btn primary" onClick={() => onGenerate(brief)}>
            ⚡ Genera la landing page
          </button>
        )}
      </div>
    </div>
  );
}
