'use client';

import { useEffect, useState } from 'react';
import type { GhlAccount, GhlFunnel, GhlPage } from '@/lib/types';
import { downloadFile, slugify } from '@/lib/html';

const ACCOUNTS_KEY = 'lampo:ghl-accounts';

export default function GhlPanel({
  getHtml,
  pageTitle,
  onClose,
}: {
  getHtml: () => Promise<string>;
  pageTitle: string;
  onClose: () => void;
}) {
  const [accounts, setAccounts] = useState<GhlAccount[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', locationId: '', token: '' });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [funnels, setFunnels] = useState<GhlFunnel[] | null>(null);
  const [activeFunnel, setActiveFunnel] = useState<GhlFunnel | null>(null);
  const [pages, setPages] = useState<GhlPage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACCOUNTS_KEY);
      if (saved) setAccounts(JSON.parse(saved));
    } catch { /* storage non disponibile */ }
  }, []);

  function persist(list: GhlAccount[]) {
    setAccounts(list);
    try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); } catch { /* quota */ }
  }

  const active = accounts.find((a) => a.id === activeId) ?? null;

  async function addAccount() {
    setError(null);
    if (!draft.name.trim() || !draft.locationId.trim() || !draft.token.trim()) {
      setError('Compila nome, Location ID e token.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/ghl/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: draft.token.trim(), locationId: draft.locationId.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Verifica fallita');
      const acc: GhlAccount = {
        id: Math.random().toString(36).slice(2),
        name: j.location?.name || draft.name.trim(),
        locationId: draft.locationId.trim(),
        token: draft.token.trim(),
      };
      persist([...accounts, acc]);
      setDraft({ name: '', locationId: '', token: '' });
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di verifica');
    } finally {
      setBusy(false);
    }
  }

  async function openAccount(acc: GhlAccount) {
    setActiveId(acc.id);
    setFunnels(null);
    setActiveFunnel(null);
    setPages(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/ghl/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: acc.token, locationId: acc.locationId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Impossibile leggere i funnel');
      setFunnels(j.funnels as GhlFunnel[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore GHL');
    } finally {
      setBusy(false);
    }
  }

  async function openFunnel(funnel: GhlFunnel) {
    if (!active) return;
    setActiveFunnel(funnel);
    setPages(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/ghl/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: active.token, locationId: active.locationId, funnelId: funnel._id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Impossibile leggere le pagine');
      setPages(j.pages as GhlPage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore GHL');
    } finally {
      setBusy(false);
    }
  }

  async function copyHtml() {
    const html = await getHtml();
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      downloadFile(html, `${slugify(pageTitle)}.html`);
    }
  }

  return (
    <aside className="side-panel">
      <header>
        <h3>🚀 Deploy su GoHighLevel</h3>
        <button className="btn sm ghost" onClick={onClose}>✕</button>
      </header>
      <div className="body">
        {error && <div className="alert error">{error}</div>}

        {!active && (
          <>
            <p className="hint" style={{ marginTop: 0 }}>
              Collega i tuoi sub-account con un <b>Private Integration Token</b> (Impostazioni →
              Integrazioni private del sub-account, con scope <i>Funnels</i> e <i>Locations</i>).
              I token restano solo in questo browser.
            </p>

            {accounts.map((a) => (
              <div className="ghl-account" key={a.id}>
                <div className="row between">
                  <div>
                    <b>{a.name}</b>
                    <div className="meta">{a.locationId}</div>
                  </div>
                  <div className="row">
                    <button className="btn sm" onClick={() => openAccount(a)}>Apri</button>
                    <button className="btn sm danger" onClick={() => persist(accounts.filter((x) => x.id !== a.id))}>×</button>
                  </div>
                </div>
              </div>
            ))}

            {adding ? (
              <div className="card" style={{ marginTop: 10 }}>
                <label className="field">
                  <span>Nome sub-account</span>
                  <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Es. Cliente Rossi" />
                </label>
                <label className="field">
                  <span>Location ID</span>
                  <input type="text" value={draft.locationId} onChange={(e) => setDraft({ ...draft, locationId: e.target.value })} placeholder="Es. ve9EPM428h8vShlRW1KT" />
                </label>
                <label className="field">
                  <span>Private Integration Token</span>
                  <input type="text" value={draft.token} onChange={(e) => setDraft({ ...draft, token: e.target.value })} placeholder="pit-..." />
                </label>
                <div className="row end" style={{ marginTop: 10 }}>
                  <button className="btn sm ghost" onClick={() => setAdding(false)}>Annulla</button>
                  <button className="btn sm primary" onClick={addAccount} disabled={busy}>
                    {busy ? 'Verifico…' : 'Verifica e salva'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn sm" onClick={() => setAdding(true)} style={{ marginTop: 6 }}>
                + Collega sub-account
              </button>
            )}
          </>
        )}

        {active && (
          <>
            <div className="row between" style={{ marginBottom: 10 }}>
              <b>{active.name}</b>
              <button className="btn sm ghost" onClick={() => { setActiveId(null); setFunnels(null); setActiveFunnel(null); setPages(null); }}>
                ← Account
              </button>
            </div>

            {busy && <p className="hint"><span className="spinner" /> Carico…</p>}

            {!activeFunnel && funnels && (
              <>
                <p className="hint" style={{ marginTop: 0 }}>Scegli il funnel di destinazione:</p>
                {funnels.length === 0 && <div className="alert">Nessun funnel trovato in questo sub-account.</div>}
                {funnels.map((f) => (
                  <div className="list-item" key={f._id} onClick={() => openFunnel(f)}>
                    <span className="name">{f.name}</span>
                    <span className="sub">{f.steps?.length ?? 0} step</span>
                  </div>
                ))}
              </>
            )}

            {activeFunnel && (
              <>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span className="name" style={{ fontWeight: 700 }}>{activeFunnel.name}</span>
                  <button className="btn sm ghost" onClick={() => { setActiveFunnel(null); setPages(null); }}>← Funnel</button>
                </div>

                {pages && pages.length > 0 && (
                  <>
                    <p className="hint">Pagine esistenti nel funnel:</p>
                    {pages.map((p) => (
                      <div className="list-item" key={p._id} style={{ cursor: 'default' }}>
                        <span className="name">{p.name}</span>
                        {p.url && <span className="sub">{p.url}</span>}
                      </div>
                    ))}
                  </>
                )}

                <div className="alert ok" style={{ marginTop: 14 }}>
                  <b>Pubblica la pagina in 30 secondi.</b><br />
                  L’API pubblica di GoHighLevel oggi consente di <i>leggere</i> i funnel ma non di
                  caricare l’HTML di una pagina via API. Procedi così:
                  <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                    <li>Premi <b>«Copia HTML»</b> qui sotto.</li>
                    <li>In GHL apri il funnel <b>{activeFunnel.name}</b> → aggiungi/apri uno step → <b>Edit page</b>.</li>
                    <li>Trascina un elemento <b>Custom JS/HTML</b> (full-width) e incolla tutto.</li>
                    <li>Salva e pubblica. Fatto ⚡</li>
                  </ol>
                  Appena GHL esporrà l’endpoint di scrittura, il caricamento diventerà a un click.
                </div>

                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn primary sm" onClick={copyHtml}>
                    {copied ? '✓ Copiato!' : '📋 Copia HTML'}
                  </button>
                  <button
                    className="btn sm"
                    onClick={async () => downloadFile(await getHtml(), `${slugify(pageTitle)}.html`)}
                  >
                    ⬇️ Scarica .html
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
