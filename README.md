# ⚡ LAMPO — AI Landing Page Builder

Software web (utilizzabile anche da telefono) per creare **landing page all'avanguardia con l'intelligenza artificiale**, con copy rispettato alla lettera, editor visuale live, revisioni via prompt, export in un singolo file HTML e integrazione GoHighLevel.

## Funzionalità

- **Brief guidato**: prima di generare, il software chiede copy, palette colori (o carta bianca all'AI), logo (incorporato nell'HTML), preferenze tipografiche, mood, referenze, settore, obiettivo, lingua, immagini e note.
- **Copy sacro**: il copy caricato (incollato o da file `.txt`/`.md`) viene usato parola per parola, mai riscritto.
- **Complessità stilistica 1–5**: dal minimale essenziale (1) allo scroll-telling cinematografico con animazioni ed effetti speciali (5).
- **Design mai banale**: prompt di sistema con regole anti-"AI slop" (niente font abusati, niente gradienti viola, tipografia con personalità, micro-dettagli curati) e trend di design correnti.
- **Generazione live**: la pagina prende forma in diretta durante lo streaming.
- **Editor visuale (senza toccare il codice)**: clic per selezionare, doppio clic per modificare il testo inline, colori, dimensioni, allineamento, immagini, link, riordino/duplicazione/eliminazione elementi, undo.
- **Modifica via prompt**: descrivi la modifica in linguaggio naturale e l'AI riscrive la pagina mantenendo tutto il resto.
- **Output sempre responsive**: mobile-first da 320px a 4K, accessibile, performante, in **un unico file HTML** autonomo (CSS+JS inline, nessuna dipendenza esterna eccetto Google Fonts).
- **Export**: download del singolo `.html` o copia negli appunti.
- **GoHighLevel**: collega quanti sub-account vuoi con Private Integration Token (salvati solo nel browser), verifica la connessione, sfoglia funnel e pagine e pubblica con flusso guidato.

## Avvio

```bash
cp .env.example .env   # inserisci la tua ANTHROPIC_API_KEY
npm install
npm run dev            # http://localhost:3000
```

### Provider AI (a scelta, anche gratuiti)

Dal pannello **⚙️ AI** dell'interfaccia puoi scegliere il motore di generazione e inserire la relativa chiave (resta nel browser). In alternativa configura le chiavi come variabili d'ambiente sul server:

| Provider | Variabile | Costo | Chiave |
|---|---|---|---|
| Claude (Anthropic) — qualità massima | `ANTHROPIC_API_KEY` | a pagamento | platform.claude.com |
| Google Gemini | `GEMINI_API_KEY` | **gratis** (free tier) | aistudio.google.com/apikey |
| Groq (Llama) | `GROQ_API_KEY` | **gratis** (free tier) | console.groq.com/keys |
| OpenRouter (modelli `:free`) | `OPENROUTER_API_KEY` | **gratis** (modelli free) | openrouter.ai/keys |
| Endpoint custom compatibile OpenAI | `CUSTOM_AI_API_KEY` | dipende | — |

Il modello è personalizzabile per ogni provider (campo "Modello" nel pannello).

## Integrazione GoHighLevel

Per ogni sub-account crea una **Private Integration** (Impostazioni → Private Integrations) con scope *Funnels* e *Locations*, poi inserisci nel pannello GHL: nome, **Location ID** e **token** (`pit-...`). I token non lasciano mai il tuo browser: il server fa solo da proxy verso `services.leadconnectorhq.com`.

> **Nota sul caricamento diretto**: l'API pubblica di GoHighLevel (v2) permette di *leggere* funnel e pagine ma non espone ancora un endpoint per creare/aggiornare una pagina funnel con HTML custom. Il deploy avviene quindi con un flusso guidato (copia HTML → elemento *Custom JS/HTML* nel page builder GHL). L'architettura (`lib/ghl.ts`) è già pronta per il caricamento a un click appena GHL pubblicherà l'endpoint di scrittura.

## Architettura

```
app/
  page.tsx               UI principale (wizard → generazione → editor)
  api/generate/route.ts  Generazione streaming (Claude, claude-opus-4-8)
  api/revise/route.ts    Revisione via prompt (streaming)
  api/ghl/*              Proxy API GoHighLevel (verify / funnels / pages)
components/
  Wizard.tsx             Brief guidato in 5 step
  Editor.tsx             Anteprima, editing visuale, chat di revisione, export
  GhlPanel.tsx           Multi sub-account GHL e deploy
lib/
  prompts.ts             Prompt di sistema (regole copy, design, complessità 1–5)
  editor-runtime.ts      Script di editing iniettato nell'iframe (rimosso all'export)
  stream.ts              Streaming Claude → Response
  ghl.ts                 Client API GoHighLevel 2.0
```
