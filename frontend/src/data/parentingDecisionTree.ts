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
      }),
    },
    {
      id: "special-cases",
      label: "Przypadki szczególne",
      shortDescription:
        "Wcześniactwo, hospitalizacja, adopcja lub zdarzenia losowe (zgon dziecka lub matki).",
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
          }),
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
          id: "mother-incapacity-or-death",
          label: "Zgon matki, hospitalizacja lub niezdolność do egzystencji",
          shortDescription:
            "Przejęcie niewykorzystanej części urlopu macierzyńskiego przez ojca lub innego członka rodziny.",
          affectedWho:
            "Dotyczy: Ojca / drugiego rodzica (przejmuje pulę urlopu macierzyńskiego po matce)",
          specialLegalNote:
            "Art. 180 § 6–13 KP: w razie pobytu matki w szpitalu lub orzeczenia o niezdolności do samodzielnej egzystencji ojciec może przejąć urlop po 8 tygodniach od porodu. W przypadku zgonu matki ojciec nabywa prawo do pozostałej części urlopu macierzyńskiego natychmiast od dnia jej śmierci.",
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
          }),
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
              name: "Fundacja Ernesta",
              description:
                "Bezpłatna pomoc psychologiczna, prawna i grupy wsparcia dla rodziców po stracie dziecka.",
              contact: "kontakt@fundacjaernesta.pl",
              url: "https://fundacjaernesta.pl",
            },
            {
              name: "Fundacja Nagle Sami",
              description:
                "Telefon wsparcia dla osób w żałobie oraz indywidualne konsultacje terapeutyczne.",
              contact: "Tel. 800 108 108 (pon.–pt. 14:00–20:00)",
              url: "https://naglesami.org.pl",
            },
            {
              name: "Portal Poronienie.pl / Hospicja Perinatalne",
              description:
                "Praktyczny przewodnik po formalnościach w USC, ZUS (zasiłek pogrzebowy) oraz prawach pacjenta.",
              contact: "Infolinia Rzecznika Praw Pacjenta: 800 190 590",
              url: "https://www.poronienie.pl",
            },
          ],
        },
      ],
    },
  ],
};
