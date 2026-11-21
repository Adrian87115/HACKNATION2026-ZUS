// src/components/Planner/planShared.ts
// Słowniki i formatowanie wspólne dla przewodnika rodzica i planera urlopów.
import type React from "react";
import type { ParentRole } from "@zus/engine";

export const ROLE_LABELS: Record<ParentRole, string> = {
  primary: "Matka / Rodzic 1",
  secondary: "Ojciec / Rodzic 2",
};

export const ROLE_SHORT: Record<ParentRole, string> = {
  primary: "Rodzic 1",
  secondary: "Rodzic 2",
};

export const SEGMENT_LABELS: Record<string, string> = {
  maternity: "Urlop macierzyński",
  maternity_conditions: "Urlop na warunkach macierzyńskiego",
  supplementary_maternity:
    "Uzupełniający urlop macierzyński (szpital/wcześniak)",
  parental: "Urlop rodzicielski",
  paternity: "Urlop ojcowski",
};

/** Krótkie nazwy mieszczące się na klockach osi czasu. */
export const SEGMENT_SHORT: Record<string, string> = {
  maternity: "Macierzyński",
  maternity_conditions: "Na warunkach macierz.",
  supplementary_maternity: "Uzupełniający",
  parental: "Rodzicielski",
  paternity: "Ojcowski",
};

/** Kolor jest tylko dodatkiem – typ okresu zawsze jest też opisany tekstem. */
export const SEGMENT_COLOR: Record<string, string> = {
  maternity: "#10b981",
  maternity_conditions: "#14b8a6",
  supplementary_maternity: "#8b5cf6",
  parental: "#0ea5e9",
  paternity: "#f59e0b",
};

export const DAY_MS = 24 * 60 * 60 * 1000;

export const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/*
 * Formattery Intl tworzymy raz – toLocaleString/toLocaleDateString z opcjami budują nowy formatter
 * przy każdym wywołaniu, a planer formatuje dziesiątki dat i kwot na render.
 */
const MONEY_FMT = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DECIMAL_FMT = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_SHORT_FMT = new Intl.DateTimeFormat("pl-PL", {
  month: "short",
  timeZone: "UTC",
});

export const money = (n: number) => `${MONEY_FMT.format(n)} zł`;

export const percent = (rate: number) => `${DECIMAL_FMT.format(rate * 100)}%`;

export const fmtDecimal = (n: number) => DECIMAL_FMT.format(n);

export const fmtDate = (iso: string) =>
  DATE_FMT.format(new Date(`${iso}T00:00:00Z`));

/** Skrócona nazwa miesiąca dla znacznika czasu w ms (UTC), np. „sty”. */
export const fmtMonthShort = (ms: number) => MONTH_SHORT_FMT.format(ms);

/** CSS custom properties (stagger index, segment color) for inline styles. */
export const vars = (v: Record<string, string | number>) =>
  v as unknown as React.CSSProperties;
