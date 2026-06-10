import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_SIZE = 15 * 1024 * 1024; // 15MB

/** Estrae il testo del copy da file Word (.docx) o PDF. */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Invio file non valido' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Nessun file ricevuto' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'File troppo grande (max 15MB)' }, { status: 413 });
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text = '';

    if (name.endsWith('.docx') || file.type.includes('officedocument.wordprocessingml')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy().catch(() => {});
      }
    } else if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
      text = buffer.toString('utf-8');
    } else if (name.endsWith('.doc')) {
      return Response.json(
        { error: 'Il vecchio formato .doc non è supportato: salva il file come .docx e ricaricalo.' },
        { status: 415 },
      );
    } else {
      return Response.json({ error: 'Formato non supportato. Usa .docx, .pdf, .txt o .md.' }, { status: 415 });
    }

    // Normalizza spazi e righe vuote multiple mantenendo la struttura del copy;
    // rimuove i separatori di pagina inseriti da pdf-parse ("-- 1 of 3 --")
    text = text
      .replace(/\r\n?/g, '\n')
      .replace(/^--\s*\d+\s*of\s*\d+\s*--$/gm, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text) {
      return Response.json(
        { error: 'Non ho trovato testo nel file (è una scansione/immagine? Serve un PDF con testo selezionabile).' },
        { status: 422 },
      );
    }

    return Response.json({ text });
  } catch (err) {
    return Response.json(
      { error: `Impossibile leggere il file: ${err instanceof Error ? err.message : 'errore sconosciuto'}` },
      { status: 500 },
    );
  }
}
