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

/** Categories and their sections – the structure of the knowledge base view. */
export const LIBRARY_CATEGORIES = {
  prawo: {
    label: 'Przepisy prawne',
    description: 'Ustawy i rozporządzenia o zasiłkach i uprawnieniach rodziców – teksty z Dziennika Ustaw.',
    kind: 'akt_prawny',
    sections: { ustawy: 'Ustawy', rozporzadzenia: 'Rozporządzenia' },
  },
  formularze: {
    label: 'Wnioski i zaświadczenia ZUS',
    description: 'Oficjalne wzory formularzy ZUS do zasiłku macierzyńskiego, chorobowego i świadczeń w ciąży.',
    kind: 'formularz',
    sections: { wnioski: 'Wnioski', zaswiadczenia: 'Zaświadczenia', oswiadczenia: 'Oświadczenia' },
  },
  poradniki: {
    label: 'Poradniki',
    description: 'Przewodniki ZUS, ministerstwa i Państwowej Inspekcji Pracy.',
    kind: 'poradnik',
    sections: { instytucje: 'Poradniki instytucji' },
  },
} as const;
export type LibraryCategory = keyof typeof LIBRARY_CATEGORIES;

/** Local copy of the document served by the app (frontend/public/dokumenty). */
export type LibraryFile = { path: string; size: number; pages: number | null; sha256: string; downloadedAt: string; source: string };

export type LibraryVersion = {
  /** e.g. "Dz.U. 2026 poz. 854" or a form edition */
  version: string;
  label: string;
  validFrom: string | null;
  url: string;
  /** What changed compared with the previous version (plain language). */
  changes: string;
  addedAt: string;
  file?: LibraryFile | null;
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
  category: LibraryCategory;
  section: string;
  status: LibraryStatus;
  pageUrl: string;
  /** Newest first – the first one is the current version. */
  versions: LibraryVersion[];
  amendments: LibraryAmendment[];
  withdrawn: { at: string; reason: string; replacedBy: string | null } | null;
};
