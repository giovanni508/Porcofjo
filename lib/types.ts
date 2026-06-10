export type Complexity = 1 | 2 | 3 | 4 | 5;

export interface Brief {
  /** Copy fornito dall'utente — da rispettare alla lettera */
  copy: string;
  /** Lingua della pagina generata */
  language: string;
  /** Settore / tipo di business */
  sector: string;
  /** Obiettivo della pagina (lead, vendita, prenotazione...) */
  goal: string;
  /** 'ai' = palette decisa dall'AI, 'custom' = colori forniti */
  paletteMode: 'ai' | 'custom';
  palette: string[];
  /** Logo come data-URL (incorporato nell'HTML finale) */
  logoDataUrl?: string;
  fontPreference?: string;
  complexity: Complexity;
  mood?: string;
  /** Referenze: URL o descrizioni di siti/stili da cui ispirarsi */
  references?: string;
  /** URL di immagini da usare nella pagina */
  imageUrls?: string[];
  notes?: string;
}

export interface GhlAccount {
  id: string;
  name: string;
  locationId: string;
  /** Private Integration Token del sub-account (salvato solo nel browser) */
  token: string;
}

export interface GhlFunnel {
  _id: string;
  name: string;
  steps?: { id: string; name: string; url?: string }[];
}

export interface GhlPage {
  _id: string;
  name: string;
  stepId?: string;
  url?: string;
}
