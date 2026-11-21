// src/data/parentingDecisionTree.ts
import type { MaternityPlanInput } from "../engine/index.js";

export interface SupportOrganization {
  name: string;
  description: string;
  contact: string;
  url: string;
}

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
  /** Dodatkowe zasoby wsparcia (np. przy stracie dziecka) */
  supportOrganizations?: SupportOrganization[];
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
        "Wcześniactwo, adopcja, choroba lub zgon matki, strata dziecka.",
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
          supportOrganizations: [
            {
              name: "Fundacja „Wcześniak – Rodzice – Rodzicom”",
              description:
                "Informacje, poradniki i wsparcie dla rodziców wcześniaków – od pobytu na oddziale neonatologicznym po opiekę w domu.",
              contact: "Kontakt przez stronę fundacji",
              url: "https://www.wczesniak.pl",
            },
            {
              name: "Fundacja Rodzić po Ludzku",
              description:
                "Prawa rodzących i noworodków w szpitalu, pomoc w trudnych sytuacjach okołoporodowych.",
              contact: "Kontakt przez stronę fundacji",
              url: "https://rodzicpoludzku.pl",
            },
            {
              name: "Rzecznik Praw Pacjenta",
              description:
                "Bezpłatna informacja o prawach pacjenta – także o prawie rodziców do obecności przy hospitalizowanym dziecku.",
              contact: "Infolinia: 800 190 590",
              url: "https://www.gov.pl/web/rpp",
            },
          ],
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
          id: "mother-death",
          label: "Zgon matki",
          shortDescription:
            "Ojciec przejmuje pozostałą część urlopu macierzyńskiego od dnia po zgonie matki i korzysta z urlopu rodzicielskiego.",
          affectedWho:
            "Dotyczy: Ojca / drugiego rodzica (przejmuje urlop macierzyński po matce i urlop rodzicielski)",
          specialLegalNote:
            "Art. 180 KP: w razie zgonu matki w czasie urlopu macierzyńskiego ojciec ma prawo do pozostałej części tego urlopu – od dnia następującego po dniu zgonu, bez wymogu wykorzystania przez matkę 14 (ani 8) tygodni. Ojciec zachowuje też własne prawo do urlopu ojcowskiego.",
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
            parentalParts: [{ parent: "secondary", weeks: 32 }],
            // Urlop ojcowski to samodzielne prawo ojca – przysługuje także po zgonie matki.
            paternity: [{ weeks: 2, startDate: eventDate }],
          }),
          supportMessage:
            "Bardzo nam przykro z powodu Waszej straty. Poniżej znajdziecie miejsca, w których możecie uzyskać wsparcie, oraz informacje o przejęciu urlopu.",
          supportOrganizations: [
            {
              name: "Fundacja Nagle Sami",
              description:
                "Telefon wsparcia dla osób w żałobie oraz indywidualne konsultacje terapeutyczne.",
              contact: "Tel. 800 108 108 (pon.–pt. 14:00–20:00)",
              url: "https://naglesami.org.pl",
            },
            {
              name: "Tumbo Pomaga (Fundacja Hospicyjna)",
              description:
                "Bezpłatne wsparcie dla dzieci i nastolatków w żałobie po śmierci rodzica oraz ich opiekunów.",
              contact: "Kontakt przez stronę programu",
              url: "https://tumbopomaga.pl",
            },
            {
              name: "Centrum Wsparcia dla Osób w Stanie Kryzysu Psychicznego (Fundacja ITAKA)",
              description:
                "Całodobowa, bezpłatna pomoc psychologiczna w sytuacji kryzysu.",
              contact: "Tel. 800 70 2222 (całodobowo)",
              url: "https://centrumwsparcia.pl",
            },
          ],
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
          supportOrganizations: [
            {
              name: "Centrum Wsparcia dla Osób w Stanie Kryzysu Psychicznego (Fundacja ITAKA)",
              description:
                "Całodobowa, bezpłatna pomoc psychologiczna – także przy ciężkiej chorobie lub hospitalizacji bliskiej osoby.",
              contact: "Tel. 800 70 2222 (całodobowo)",
              url: "https://centrumwsparcia.pl",
            },
            {
              name: "Rzecznik Praw Pacjenta",
              description:
                "Bezpłatna informacja o prawach pacjenta w szpitalu – także o kontakcie z noworodkiem i opiece nad nim.",
              contact: "Infolinia: 800 190 590",
              url: "https://www.gov.pl/web/rpp",
            },
          ],
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
          supportOrganizations: [
            {
              name: "Fundacja Nagle Sami – Telefon Wsparcia",
              description:
                "Bezpłatny telefon i konsultacje dla osób w żałobie, także po stracie dziecka.",
              contact: "Tel. 800 108 108",
              url: "https://naglesami.org.pl",
            },
            {
              name: "Fundacja Rodzić po Ludzku",
              description:
                "Prawa pacjentki przy porodzie i po stracie dziecka – bezpłatne porady prawne i wzory pism.",
              contact: "Formularz porady prawnej na stronie fundacji",
              url: "https://rodzicpoludzku.pl/twoje-prawa/uzyskaj-porade-prawna/",
            },
            {
              name: "Rzecznik Praw Pacjenta",
              description:
                "Bezpłatna infolinia w sprawach praw pacjentki, także opieki po stracie dziecka.",
              contact: "Tel. 800 190 590 (w dni robocze)",
              url: "https://www.gov.pl/web/rpp",
            },
          ],
        },
      ],
    },
  ],
};
