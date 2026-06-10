'use client';

import { useRef, useState } from 'react';
import Wizard from '@/components/Wizard';
import Editor from '@/components/Editor';
import { cleanGeneratedHtml, extractStreamError } from '@/lib/html';
import type { Brief } from '@/lib/types';

type Phase = 'wizard' | 'generating' | 'editor';

export default function Home() {
  const [phase, setPhase] = useState<Phase>('wizard');
  const [html, setHtml] = useState('');
  const [pageTitle, setPageTitle] = useState('landing-page');
  const [genBytes, setGenBytes] = useState(0);
  const [genPreview, setGenPreview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function generate(brief: Brief) {
    setPhase('generating');
    setError(null);
    setGenBytes(0);
    setGenPreview('');
    setPageTitle(brief.copy.split('\n').find((l) => l.trim())?.trim().slice(0, 60) || 'landing-page');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Errore ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = '';
      let lastPreview = 0;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        setGenBytes(raw.length);
        const now = Date.now();
        if (now - lastPreview > 700) {
          lastPreview = now;
          setGenPreview(cleanGeneratedHtml(raw));
        }
      }

      const streamErr = extractStreamError(raw);
      if (streamErr) throw new Error(streamErr);

      const finalHtml = cleanGeneratedHtml(raw);
      if (!/<html/i.test(finalHtml)) {
        throw new Error('Il modello non ha restituito una pagina HTML valida. Riprova.');
      }
      setHtml(finalHtml);
      setPhase('editor');
    } catch (err) {
      if (controller.signal.aborted) {
        setPhase('wizard');
        return;
      }
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
      setPhase('wizard');
    } finally {
      abortRef.current = null;
    }
  }

  function restart() {
    if (confirm('Vuoi creare una nuova landing page? (la pagina corrente resta scaricabile solo se la esporti prima)')) {
      setHtml('');
      setPhase('wizard');
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="bolt">⚡</span> LAMPO <small>· AI Landing Page Builder</small>
        </div>
        <div className="spacer" />
      </div>

      {phase === 'wizard' && (
        <>
          {error && (
            <div className="container" style={{ paddingBottom: 0 }}>
              <div className="alert error">{error}</div>
            </div>
          )}
          <Wizard onGenerate={generate} />
        </>
      )}

      {phase === 'generating' && (
        <div className="container genwrap">
          <div className="gen-status">
            <span className="pulse" />
            <span>
              L’AI sta progettando la tua landing page… puoi guardarla prendere forma in diretta.
            </span>
          </div>
          <div className="gen-bytes">{(genBytes / 1024).toFixed(1)} KB generati</div>
          <iframe
            className="gen-frame"
            title="Anteprima generazione"
            sandbox="allow-same-origin"
            srcDoc={genPreview || '<body style="font-family:sans-serif;color:#888;display:grid;place-items:center;height:100vh;margin:0"><p>In attesa dei primi byte…</p></body>'}
          />
          <div className="row">
            <button
              className="btn danger"
              onClick={() => abortRef.current?.abort()}
            >
              Annulla generazione
            </button>
          </div>
        </div>
      )}

      {phase === 'editor' && html && (
        <Editor initialHtml={html} pageTitle={pageTitle} onRestart={restart} />
      )}
    </div>
  );
}
