// src/data/parentingDecisionTree.ts
import type { MaternityPlanInput } from "@zus/engine";
import {
  SUPPORT_ORGANIZATIONS,
  type SupportOrganization,
  type SupportTopic,
} from "./supportOrganizations";

export type { SupportOrganization };

/**
 * Organizacje wsparcia biorą się wyłącznie ze zweryfikowanej listy (data/supportOrganizations.ts) –
 * przewodnik i strona „Pomoc i wsparcie” pokazują te same, sprawdzone kontakty.
 */
function pickSupport(...names: string[]): SupportOrganization[] {
  return names.flatMap((name) => {
    const org = SUPPORT_ORGANIZATIONS.find((o) => o.name === name);
    if (!org) console.error(`Brak organizacji „${name}” w data/supportOrganizations.ts`);
    return org ? [org] : [];
  });
}

/** Data przesunięta o `years` lat (YYYY-MM-DD). */
const shiftYears = (iso: string, years: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
};

export interface DecisionNode {
  id: string;
  label: string;
  shortDescription: string;
  /** Informacja wyświetlana w kolejnym kroku: kogo dotyczył poprzedni wybór */
  affectedWho: string;
  /** Kolejne rozgałęzienia (jeśli brak – węzeł jest liściem końcowym) */
  children?: DecisionNode[];
  /** Buduje wsad do silnika dla węzła końcowego */
  buildPlanInput?: (
    baseDate: string,
    bases: { primary: number; secondary: number },
  ) => MaternityPlanInput;
  /** Dodatkowe zasoby wsparcia (np. przy stracie dziecka) – ze zweryfikowanej listy */
  supportOrganizations?: SupportOrganization[];
  /** Temat na stronie „Pomoc i wsparcie”, pod którym jest więcej organizacji */
  supportTopic?: SupportTopic;
  /** Empatyczny komunikat wyświetlany nad wynikiem w trybie wsparcia */
  supportMessage?: string;
  /** Dodatkowy komentarz prawny uzupełniający wynik silnika */
  specialLegalNote?: string;
}

export const PARENTING_DECISION_TREE: DecisionNode = {
  id: "root",
  label: "Sytuacja rodzinna",
  shortDescription:
    "Wybierz etap lub okoliczność związaną z pojawieniem się dziecka w rodzinie.",
  affectedWho: "Oboje rodzice / opiekunowie",
  children: [
    {
      id: "standard-birth",
      label: "Poród standardowy",
      shortDescription:
        "Urodzenie jednego dziecka w terminie, bez powikłań medycznych.",
      affectedWho:
        "Dotyczy: Matki (urlop macierzyński) oraz Obojga rodziców (urlop rodzicielski i ojcowski)",
      buildPlanInput: (eventDate, bases) => ({
        event: "birth",
        eventDate,
        childBirthDate: eventDate,
        childrenCount: 1,
        combinedApplicationWithin21Days: true,
        parents: {
          primary: { monthlyBasis: bases.primary },
          secondary: { monthlyBasis: bases.secondary },
        },
        parentalParts: [
          { parent: "primary", weeks: 32 },
          { parent: "secondary", weeks: 9 },
        ],
        paternity: [{ weeks: 2, startDate: eventDate }],
      }),
    },
    {
      id: "prenatal-leave",
      label: "Przed porodem (urlop prenatalny)",
      shortDescription:
        "Rozpoczęcie urlopu macierzyńskiego jeszcze przed planowaną datą porodu (maks. 6 tygodni).",
      affectedWho:
        "Dotyczy: Wyłącznie Matki (przesuwa start jej urlopu, nie wydłuża łącznej puli)",
      specialLegalNote:
        "Art. 180 § 2 KP: przed przewidywaną datą porodu można wykorzystać do 6 tygodni urlopu macierzyńskiego. Po porodzie przysługuje pozostała część z 20 tygodni.",
      buildPlanInput: (eventDate, bases) => ({
        event: "birth",
        eventDate,
        childrenCount: 1,
        prenatalWeeks: 4,
        combinedApplicationWithin21Days: true,
        parents: {
          primary: { monthlyBasis: bases.primary },
          secondary: { monthlyBasis: bases.secondary },
        },
        parentalParts: [
          { parent: "primary", weeks: 32 },
          { parent: "secondary", weeks: 9 },
        ],
        paternity: [{ weeks: 2, startDate: eventDate }],
      }),
    },
    {
      id: "special-cases",
      label: "Przypadki szczególne",
      shortDescription:
        "Wcześniactwo, adopcja, rodzina zastępcza, choroba lub zgon matki, strata dziecka.",
      affectedWho:
        "Dotyczy: Rodziny w sytuacji wymagającej indywidualnych reguł Kodeksu pracy",
      children: [
        {
          id: "preterm-hospital",
          label: "Wcześniak lub pobyt dziecka w szpitalu",
          shortDescription:
            "Poród przedwczesny (< 37 tyg. / niska masa) lub dłuższa hospitalizacja po porodzie.",
          affectedWho:
            "Dotyczy: Rodzica kończącego urlop macierzyński (dodatkowe tygodnie 100% płatne)",
          buildPlanInput: (eventDate, bases) => ({
            event: "birth",
            eventDate,
            childrenCount: 1,
            supplementary: {
              gestationWeeks: 27,
              birthWeightGrams: 950,
              hospitalizationDays: 42, // 6 rozpoczętych tygodni -> +6 tyg. uzupełniającego urlopu
            },
            combinedApplicationWithin21Days: true,
            parents: {
              primary: { monthlyBasis: bases.primary },
              secondary: { monthlyBasis: bases.secondary },
            },
            parentalParts: [
              { parent: "primary", weeks: 32 },
              { parent: "secondary", weeks: 9 },
            ],
            // Urlop ojcowski nie zależy od wcześniactwa – przysługuje jak przy każdym porodzie.
            paternity: [{ weeks: 2, startDate: eventDate }],
          }),
          supportMessage:
            "Wiemy, że przedwczesny poród lub pobyt dziecka w szpitalu to dla rodziców ogromne obciążenie. Poniżej znajdziecie miejsca, w których możecie uzyskać wsparcie, oraz informacje o urlopie.",
          supportOrganizations: pickSupport(
            "Fundacja Wcześniak Rodzice–Rodzicom",
            "Koalicja dla Wcześniaka",
            "Fundacja Ernesta",
          ),
          supportTopic: "wczesniak",
        },
        {
          id: "adoption",
          label: "Adopcja (przysposobienie)",
          shortDescription:
            "Przyjęcie dziecka na wychowanie i wystąpienie do sądu opiekuńczego.",
          affectedWho:
            "Dotyczy: Rodziców adopcyjnych (urlop na warunkach macierzyńskiego + rodzicielski + ojcowski)",
          buildPlanInput: (eventDate, bases) => ({
            event: "adoption",
            eventDate,
            childBirthDate: eventDate,
            adoptionDecreeDate: eventDate,
            childrenCount: 1,
            combinedApplicationWithin21Days: true,
            parents: {
              primary: { monthlyBasis: bases.primary },
              secondary: { monthlyBasis: bases.secondary },
            },
            parentalParts: [
              { parent: "primary", weeks: 32 },
              { parent: "secondary", weeks: 9 },
            ],
            paternity: [{ weeks: 2, startDate: eventDate }],
          }),
        },
        {
          id: "foster",
          label: "Rodzina zastępcza (niezawodowa)",
          shortDescription:
            "Przyjęcie dziecka na wychowanie jako rodzina zastępcza niezawodowa.",
          affectedWho:
            "Dotyczy: Opiekunów zastępczych (urlop na warunkach macierzyńskiego + rodzicielski)",
          specialLegalNote:
            "Art. 183 KP: rodzinie zastępczej niezawodowej przysługuje urlop na warunkach urlopu macierzyńskiego, jeśli dziecko ma do 7 lat (do 10 lat przy odroczonym obowiązku szkolnym), oraz urlop rodzicielski. Urlop ojcowski rodzinie zastępczej nie przysługuje.",
          buildPlanInput: (eventDate, bases) => ({
            event: "foster",
            eventDate,
            // Przykład: dziecko w wieku 2 lat w dniu przyjęcia do rodziny.
            childBirthDate: shiftYears(eventDate, -2),
            childrenCount: 1,
            combinedApplicationWithin21Days: true,
            parents: {
              primary: { monthlyBasis: bases.primary },
              secondary: { monthlyBasis: bases.secondary },
            },
            parentalParts: [
              { parent: "primary", weeks: 32 },
              { parent: "secondary", weeks: 9 },
            ],
          }),
        },
        {
          id: "mother-death",
          label: "Zgon matki",
          shortDescription:
            "Ojciec przejmuje pozostałą część urlopu macierzyńskiego od dnia po zgonie matki i korzysta z urlopu rodzicielskiego.",
          affectedWho:
            "Dotyczy: Ojca / drugiego rodzica (przejmuje urlop macierzyński po matce i urlop rodzicielski)",
          specialLegalNote:
            "Art. 180 KP: w razie zgonu matki w czasie urlopu macierzyńskiego ojciec ma prawo do pozostałej części tego urlopu – od dnia następującego po dniu zgonu, bez wymogu wykorzystania przez matkę 14 (ani 8) tygodni. Art. 182^1g KP: ojcu przysługuje też cała niewykorzystana część urlopu rodzicielskiego – część przysługująca matce nie przepada. Ojciec zachowuje własne prawo do urlopu ojcowskiego.",
          buildPlanInput: (eventDate, bases) => ({
            event: "birth",
            eventDate,
            childrenCount: 1,
            // Przykład: zgon 4 tygodnie po porodzie – datę zgonu można zmienić w planerze.
            maternityTransfer: {
              weeks: 16,
              circumstance: "death",
            },
            parents: {
              primary: { monthlyBasis: bases.primary },
              secondary: { monthlyBasis: bases.secondary },
            },
            // Po zgonie matki ojciec może wykorzystać całą pulę urlopu rodzicielskiego (art. 182^1g KP).
            parentalParts: [{ parent: "secondary", weeks: 41 }],
            // Urlop ojcowski to samodzielne prawo ojca – przysługuje także po zgonie matki.
            paternity: [{ weeks: 2, startDate: eventDate }],
          }),
          supportMessage:
            "Bardzo nam przykro z powodu Waszej straty. Poniżej znajdziecie miejsca, w których możecie uzyskać wsparcie, oraz informacje o przejęciu urlopu.",
          supportOrganizations: pickSupport(
            "Fundacja Nagle Sami – Telefon Wsparcia",
            "Centrum Wsparcia dla osób w stanie kryzysu psychicznego",
            "Fundacja Dajemy Dzieciom Siłę – telefon dla rodziców",
          ),
          supportTopic: "kryzys",
        },
        {
          id: "mother-incapacity",
          label: "Hospitalizacja matki lub niezdolność do samodzielnej egzystencji",
          shortDescription:
            "Matka wykorzystuje co najmniej 8 tygodni urlopu macierzyńskiego, resztę może przejąć ojciec.",
          affectedWho:
            "Dotyczy: Ojca / drugiego rodzica (przejmuje część urlopu macierzyńskiego) oraz Matki",
          specialLegalNote:
            "Art. 180 KP: jeśli matka przebywa w szpitalu lub innym zakładzie leczniczym, co uniemożliwia jej opiekę nad dzieckiem, albo ma orzeczenie o niezdolności do samodzielnej egzystencji, ojciec może przejąć urlop macierzyński po wykorzystaniu przez matkę 8 tygodni po porodzie – na czas pobytu matki w szpitalu albo na pozostałą część urlopu.",
          buildPlanInput: (eventDate, bases) => ({
            event: "birth",
            eventDate,
            childrenCount: 1,
            maternityTransfer: {
              weeks: 12,
              circumstance: "special",
            },
            parents: {
              primary: { monthlyBasis: bases.primary },
              secondary: { monthlyBasis: bases.secondary },
            },
            parentalParts: [{ parent: "secondary", weeks: 32 }],
            // Urlop ojcowski to samodzielne prawo ojca – przysługuje także w czasie hospitalizacji matki.
            paternity: [{ weeks: 2, startDate: eventDate }],
          }),
          supportMessage:
            "Wiemy, że choroba lub pobyt mamy w szpitalu to dla całej rodziny trudny czas. Poniżej znajdziecie miejsca, w których możecie uzyskać wsparcie, oraz informacje o przejęciu urlopu.",
          supportOrganizations: pickSupport(
            "Centrum Wsparcia dla osób w stanie kryzysu psychicznego",
            "Rzecznik Praw Pacjenta",
          ),
          supportTopic: "kryzys",
        },
        {
          id: "child-loss",
          label: "Urodzenie martwego dziecka lub zgon dziecka",
          shortDescription:
            "Skrócony wymiar urlopu macierzyńskiego oraz wsparcie psychologiczne i prawne dla rodziny.",
          affectedWho:
            "Dotyczy: Matki (8 tygodni urlopu macierzyńskiego po porodzie, min. 7 dni od zgonu)",
          specialLegalNote:
            "Art. 180^1 KP: w razie urodzenia martwego dziecka lub zgonu dziecka przed upływem 8 tygodni życia, matce przysługuje 8 tygodni urlopu macierzyńskiego po porodzie (nie krócej niż 7 dni od dnia zgonu). Urlop rodzicielski nie przysługuje.",
          supportMessage:
            "Bardzo nam przykro z powodu Waszej straty. Poniżej znajdziecie miejsca, w których możecie uzyskać wsparcie, oraz informacje o urlopie.",
          buildPlanInput: (eventDate, bases) => ({
            event: "birth",
            eventDate,
            childrenCount: 1,
            childLoss: {
              survivingChildren: 0,
            },
            parents: {
              primary: { monthlyBasis: bases.primary },
              secondary: { monthlyBasis: bases.secondary },
            },
          }),
          supportOrganizations: pickSupport(
            "Fundacja Nagle Sami – Telefon Wsparcia",
            "Fundacja Ernesta",
            "Fundacja Rodzić po Ludzku",
            "Rzecznik Praw Pacjenta",
          ),
          supportTopic: "strata",
        },
      ],
    },
  ],
};
