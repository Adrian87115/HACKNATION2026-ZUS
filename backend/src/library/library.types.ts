/** Document library: official ZUS forms, legal acts and guides, with their version history. */

export type LibraryKind = 'formularz' | 'akt_prawny' | 'poradnik';
export type LibraryStatus = 'obowiazujacy' | 'wycofany';

export const LIBRARY_TOPICS = {
  ciaza: 'Ciąża i zwolnienia lekarskie',
  macierzynski: 'Urlop i zasiłek macierzyński',
  rodzicielski: 'Urlop rodzicielski i ojcowski',
  adopcja: 'Adopcja i rodzina zastępcza',
  skladki: 'Ubezpieczenie, składki i zaświadczenia',
} as const;
export type LibraryTopic = keyof typeof LIBRARY_TOPICS;

export type LibraryVersion = {
  /** e.g. "Dz.U. 2026 poz. 854" or a form edition */
  version: string;
  label: string;
  validFrom: string | null;
  url: string;
  /** What changed compared with the previous version (plain language). */
  changes: string;
  addedAt: string;
};

/** An act that changed a legal act (from the Sejm ELI API). */
export type LibraryAmendment = { date: string; title: string; source: string; url: string };

export type LibraryDocument = {
  id: string;
  kind: LibraryKind;
  code: string | null;
  title: string;
  fullTitle: string;
  description: string;
  topics: string[];
  status: LibraryStatus;
  pageUrl: string;
  /** Newest first – the first one is the current version. */
  versions: LibraryVersion[];
  amendments: LibraryAmendment[];
  withdrawn: { at: string; reason: string; replacedBy: string | null } | null;
};
