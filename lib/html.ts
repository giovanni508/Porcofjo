/** Pulizia dell'output del modello: rimuove eventuali fence markdown e testo extra. */
export function cleanGeneratedHtml(raw: string): string {
  let html = raw.trim();
  html = html.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '');
  const start = html.search(/<!DOCTYPE/i);
  if (start > 0) html = html.slice(start);
  const end = html.toLowerCase().lastIndexOf('</html>');
  if (end !== -1) html = html.slice(0, end + '</html>'.length);
  return html.trim();
}

/** Estrae un eventuale errore segnalato in streaming dal server. */
export function extractStreamError(raw: string): string | null {
  const m = raw.match(/<!--LAMPO_ERROR:([\s\S]*?)-->/);
  return m ? m[1].trim() : null;
}

/** Scarica una stringa come file dal browser. */
export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'landing-page';
}
