'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAiSettings } from '@/lib/ai';
import { injectEditorRuntime } from '@/lib/editor-runtime';
import { cleanGeneratedHtml, downloadFile, extractStreamError, slugify } from '@/lib/html';
import GhlPanel from './GhlPanel';

type Device = 'mobile' | 'tablet' | 'desktop';
type Panel = 'inspector' | 'chat' | 'ghl' | null;

interface SelectedInfo {
  tag: string;
  text: string;
  hasOwnText: boolean;
  isImage: boolean;
  isLink: boolean;
  src: string | null;
  href: string | null;
  styles: { color: string; backgroundColor: string; fontSize: string; textAlign: string };
}

interface ChatMsg { role: 'user' | 'ai'; text: string }

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

export default function Editor({
  initialHtml,
  pageTitle,
  onRestart,
}: {
  initialHtml: string;
  pageTitle: string;
  onRestart: () => void;
}) {
  const [html, setHtml] = useState(initialHtml);
  const [history, setHistory] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<SelectedInfo | null>(null);
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [instruction, setInstruction] = useState('');
  const [revising, setRevising] = useState(false);
  const [reviseProgress, setReviseProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dirtyRef = useRef(false);
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const serializeWaiters = useRef(new Map<string, (h: string) => void>());

  const srcDoc = useMemo(() => injectEditorRuntime(html), [html]);

  const sendCmd = useCallback((cmd: string, value?: unknown, reqId?: string) => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'lpb-parent', cmd, value, reqId }, '*');
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (!d || d.source !== 'lpb-iframe') return;
      if (d.type === 'lpb:ready') {
        if (editModeRef.current) sendCmd('enable');
      } else if (d.type === 'lpb:selected') {
        setSelected(d.payload);
        if (d.payload) setPanel('inspector');
      } else if (d.type === 'lpb:dirty') {
        dirtyRef.current = true;
      } else if (d.type === 'lpb:html') {
        const waiter = serializeWaiters.current.get(d.payload.reqId);
        if (waiter) {
          serializeWaiters.current.delete(d.payload.reqId);
          waiter(d.payload.html);
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendCmd]);

  /** Chiede all'iframe l'HTML pulito corrente (con le modifiche manuali applicate). */
  const requestSerialize = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const reqId = Math.random().toString(36).slice(2);
      const timeout = setTimeout(() => {
        serializeWaiters.current.delete(reqId);
        resolve(html);
      }, 1500);
      serializeWaiters.current.set(reqId, (h) => {
        clearTimeout(timeout);
        resolve(h);
      });
      sendCmd('serialize', undefined, reqId);
    });
  }, [html, sendCmd]);

  /** Consolida le modifiche visuali nello stato (con history) e restituisce l'HTML corrente. */
  const commitEdits = useCallback(async (): Promise<string> => {
    if (!dirtyRef.current) return html;
    const current = await requestSerialize();
    dirtyRef.current = false;
    setHistory((h) => [...h.slice(-19), html]);
    setHtml(current);
    return current;
  }, [html, requestSerialize]);

  function toggleEditMode() {
    const next = !editMode;
    setEditMode(next);
    if (next) {
      sendCmd('enable');
    } else {
      sendCmd('disable');
      setSelected(null);
      if (panel === 'inspector') setPanel(null);
      void commitEdits();
    }
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    dirtyRef.current = false;
    setSelected(null);
    setHtml(prev);
  }

  async function exportHtml() {
    const current = await commitEdits();
    downloadFile(current, `${slugify(pageTitle)}.html`);
  }

  async function revise() {
    const text = instruction.trim();
    if (!text || revising) return;
    setError(null);
    setRevising(true);
    setReviseProgress(0);
    setChatLog((l) => [...l, { role: 'user', text }]);
    setInstruction('');

    try {
      const current = await commitEdits();
      const res = await fetch('/api/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: current, instruction: text, ai: loadAiSettings() }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Errore ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        setReviseProgress(raw.length);
      }
      const streamErr = extractStreamError(raw);
      if (streamErr) throw new Error(streamErr);
      const next = cleanGeneratedHtml(raw);
      if (!/<html/i.test(next)) throw new Error('Risposta non valida dal modello, riprova.');
      setHistory((h) => [...h.slice(-19), current]);
      dirtyRef.current = false;
      setSelected(null);
      setHtml(next);
      setChatLog((l) => [...l, { role: 'ai', text: 'Modifica applicata ✓' }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore imprevisto';
      setError(msg);
      setChatLog((l) => [...l, { role: 'ai', text: `Errore: ${msg}` }]);
    } finally {
      setRevising(false);
    }
  }

  const styleCmd = (prop: string, value: string) => sendCmd('style', { prop, value });

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <button className={`btn sm ${editMode ? 'primary' : ''}`} onClick={toggleEditMode}>
          {editMode ? '✓ Editing attivo' : '✏️ Modifica visuale'}
        </button>
        <button className="btn sm" onClick={() => setPanel(panel === 'chat' ? null : 'chat')}>
          💬 Modifica con prompt
        </button>
        <button className="btn sm" onClick={undo} disabled={history.length === 0} title="Annulla ultima modifica">
          ↩︎ Undo
        </button>

        <div className="device-toggle" role="group" aria-label="Anteprima dispositivo">
          {(['mobile', 'tablet', 'desktop'] as Device[]).map((d) => (
            <button key={d} className={device === d ? 'active' : ''} onClick={() => setDevice(d)}>
              {d === 'mobile' ? '📱' : d === 'tablet' ? '💻' : '🖥'}
            </button>
          ))}
        </div>

        <div className="spacer" style={{ flex: 1 }} />

        <button className="btn sm" onClick={() => setPanel(panel === 'ghl' ? null : 'ghl')}>
          🚀 GoHighLevel
        </button>
        <button className="btn sm primary" onClick={exportHtml}>
          ⬇️ Esporta HTML
        </button>
        <button className="btn sm ghost" onClick={onRestart} title="Nuova landing page">
          + Nuova
        </button>
      </div>

      {editMode && (
        <div className="alert" style={{ margin: '8px 14px 0' }}>
          Clicca un elemento per selezionarlo · doppio click per modificare il testo direttamente · ESC per deselezionare.
        </div>
      )}
      {error && <div className="alert error" style={{ margin: '8px 14px 0' }}>{error}</div>}

      <div className="editor-main">
        <div className="preview-area">
          <div className={`preview-shell ${device}`}>
            <iframe
              ref={iframeRef}
              title="Anteprima landing page"
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>

      {panel === 'inspector' && selected && (
        <aside className="side-panel inspector">
          <header>
            <h3>Elemento &lt;{selected.tag}&gt;</h3>
            <button className="btn sm ghost" onClick={() => { sendCmd('deselect'); setPanel(null); }}>✕</button>
          </header>
          <div className="body">
            {selected.text && <p className="tagline"><code>{selected.text}</code></p>}

            {(selected.hasOwnText || /^(h[1-6]|p|a|span|li|button|blockquote|strong|em|label|td|th|figcaption|div)$/.test(selected.tag)) && (
              <div className="group">
                <b>Testo</b>
                <button className="btn sm" onClick={() => sendCmd('editText')}>✏️ Modifica testo inline</button>
              </div>
            )}

            <div className="group">
              <b>Colori</b>
              <div className="grid2">
                <label className="field" style={{ margin: 0 }}>
                  <span>Testo</span>
                  <input
                    type="color"
                    value={rgbToHex(selected.styles.color)}
                    onChange={(e) => styleCmd('color', e.target.value)}
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span>Sfondo</span>
                  <input
                    type="color"
                    value={rgbToHex(selected.styles.backgroundColor)}
                    onChange={(e) => styleCmd('background-color', e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="group">
              <b>Dimensione testo</b>
              <div className="row">
                <button className="btn sm" onClick={() => styleCmd('font-size', `${Math.max(8, parseFloat(selected.styles.fontSize) - 2)}px`)}>A−</button>
                <span className="hint" style={{ margin: 0 }}>{selected.styles.fontSize}</span>
                <button className="btn sm" onClick={() => styleCmd('font-size', `${parseFloat(selected.styles.fontSize) + 2}px`)}>A+</button>
              </div>
            </div>

            <div className="group">
              <b>Allineamento</b>
              <div className="row">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button key={a} className="btn sm" onClick={() => styleCmd('text-align', a)}>
                    {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                  </button>
                ))}
              </div>
            </div>

            {selected.isImage && (
              <div className="group">
                <b>Immagine</b>
                <input
                  type="url"
                  defaultValue={selected.src ?? ''}
                  placeholder="URL immagine"
                  onBlur={(e) => e.target.value.trim() && sendCmd('setSrc', e.target.value.trim())}
                />
              </div>
            )}

            {selected.isLink && (
              <div className="group">
                <b>Link</b>
                <input
                  type="text"
                  defaultValue={selected.href ?? ''}
                  placeholder="https://... oppure #sezione"
                  onBlur={(e) => e.target.value.trim() && sendCmd('setHref', e.target.value.trim())}
                />
              </div>
            )}

            <div className="group">
              <b>Struttura</b>
              <div className="row">
                <button className="btn sm" onClick={() => sendCmd('moveUp')}>↑ Su</button>
                <button className="btn sm" onClick={() => sendCmd('moveDown')}>↓ Giù</button>
                <button className="btn sm" onClick={() => sendCmd('duplicate')}>⧉ Duplica</button>
                <button className="btn sm" onClick={() => sendCmd('selectParent')}>⌃ Genitore</button>
                <button className="btn sm danger" onClick={() => { sendCmd('remove'); setSelected(null); }}>🗑 Elimina</button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {panel === 'chat' && (
        <aside className="side-panel">
          <header>
            <h3>Modifica con un prompt</h3>
            <button className="btn sm ghost" onClick={() => setPanel(null)}>✕</button>
          </header>
          <div className="body">
            <div className="chat-log">
              {chatLog.length === 0 && (
                <div className="chat-msg ai">
                  Descrivi la modifica in linguaggio naturale: «rendi l’hero più scuro», «aggiungi una
                  sezione FAQ dopo i benefici», «CTA più grandi e arancioni»...
                </div>
              )}
              {chatLog.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
              ))}
              {revising && (
                <div className="chat-msg ai">
                  <span className="spinner" /> Sto riscrivendo la pagina… {Math.round(reviseProgress / 1024)} KB
                </div>
              )}
            </div>
            <textarea
              rows={3}
              placeholder="Cosa devo cambiare?"
              value={instruction}
              disabled={revising}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) revise();
              }}
            />
            <div className="row end" style={{ marginTop: 8 }}>
              <button className="btn primary sm" onClick={revise} disabled={revising || !instruction.trim()}>
                {revising ? 'In corso…' : 'Applica modifica'}
              </button>
            </div>
          </div>
        </aside>
      )}

      {panel === 'ghl' && (
        <GhlPanel
          getHtml={commitEdits}
          pageTitle={pageTitle}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
