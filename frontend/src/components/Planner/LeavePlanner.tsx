// src/components/Planner/LeavePlanner.tsx
// Interaktywny planer urlopów: klocki na osi czasu (Gantt), pula do rozdysponowania,
// dzielenie okresów na części, wybór sposobu wypłaty i planowanie „od końca”.
// Każda zmiana buduje nowy wsad do silnika – walidację przepisów robi planMaternity.
import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  CalendarClock,
  CircleX,
  Combine,
  Flag,
  Minus,
  Plus,
  Puzzle,
  RotateCcw,
  Scissors,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  planMaternity,
  type BenefitParams,
  type MaternityPlanInput,
  type MaternityPlanResult,
  type ParentRole,
  type PlanSegment,
} from "../../engine/index.js";
import {
  DAY_MS,
  ROLE_SHORT,
  SEGMENT_COLOR,
  SEGMENT_LABELS,
  SEGMENT_SHORT,
  fmtDate,
  fmtMonthShort,
  money,
  percent,
  toIso,
  toMs,
  vars,
} from "./planShared.js";

/* ------------------------------------------------------------------ */
/*  Model klocków                                                      */
/* ------------------------------------------------------------------ */

const WEEK_MS = 7 * DAY_MS;
const ROW_H = 44;
const BAR_H = 34;
const LANE_PAD = 8;
/** Ile px w pionie trzeba przeciągnąć klocek, by przeszedł do drugiego rodzica. */
const LANE_SWITCH_PX = 30;
const ROLES: ParentRole[] = ["primary", "secondary"];

type BarKind = "maternity" | "transfer" | "supplementary" | "parental" | "paternity";

interface Bar {
  id: string;
  kind: BarKind;
  /** Indeks części we wsadzie (parentalParts / paternity). */
  index: number;
  parent: ParentRole;
  type: PlanSegment["type"];
  /** Początek (ms, UTC) i koniec wyłączny (dzień po ostatnim dniu urlopu). */
  start: number;
  end: number;
  amount: number;
  payable: boolean;
  rates: number[];
}

interface Domain {
  start: number;
  end: number;
}

const isMovable = (bar: Bar) => bar.kind === "parental" || bar.kind === "paternity";

/** Łączy okresy z silnika w klocki (np. 9 tyg. drugiego rodzica płatne 70% + reszta 81,5% = jeden klocek). */
function buildBars(segments: PlanSegment[]): Bar[] {
  const map = new Map<string, Bar>();
  for (const s of segments) {
    let kind: BarKind;
    if (s.type === "parental") kind = "parental";
    else if (s.type === "paternity") kind = "paternity";
    else if (s.type === "supplementary_maternity") kind = "supplementary";
    else kind = s.parent === "primary" ? "maternity" : "transfer";
    const index = s.partIndex ?? 0;
    const id = `${kind}-${index}`;
    const start = toMs(s.startDate);
    const end = toMs(s.endDate) + DAY_MS;
    const existing = map.get(id);
    if (existing) {
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
      existing.amount += s.totalAmount;
      existing.payable = existing.payable && s.payable;
      if (!existing.rates.includes(s.rate)) existing.rates.push(s.rate);
    } else {
      map.set(id, {
        id,
        kind,
        index,
        parent: s.parent,
        type: s.type,
        start,
        end,
        amount: s.totalAmount,
        payable: s.payable,
        rates: [s.rate],
      });
    }
  }
  return [...map.values()];
}

/** Układa klocki w wierszach toru rodzica; nakładające się klocki tego samego rodzica to konflikt. */
function packLanes(bars: Bar[]) {
  const rowOf = new Map<string, number>();
  const rows: Record<ParentRole, number> = { primary: 1, secondary: 1 };
  const conflicts = new Set<string>();
  const conflictLanes = new Set<ParentRole>();
  for (const role of ROLES) {
    const lane = bars.filter((b) => b.parent === role).sort((a, b) => a.start - b.start);
    const ends: number[] = [];
    for (const bar of lane) {
      let row = ends.findIndex((end) => end <= bar.start);
      if (row === -1) {
        row = ends.length;
        ends.push(bar.end);
      } else {
        ends[row] = bar.end;
      }
      rowOf.set(bar.id, row);
    }
    rows[role] = Math.max(1, ends.length);
    for (let i = 0; i < lane.length; i++) {
      for (let j = i + 1; j < lane.length; j++) {
        if (lane[j].start < lane[i].end) {
          conflicts.add(lane[i].id);
          conflicts.add(lane[j].id);
          conflictLanes.add(role);
        }
      }
    }
  }
  return { rowOf, rows, conflicts, conflictLanes };
}

const monthStart = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
const nextMonth = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};
const addYearsMs = (ms: number, years: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate());
};

function computeDomain(bars: Bar[], eventMs: number, extraMs?: number): Domain {
  const extra = extraMs !== undefined && Number.isFinite(extraMs) ? [extraMs] : [];
  const start = monthStart(Math.min(eventMs, ...bars.map((b) => b.start)) - 7 * DAY_MS);
  const end = nextMonth(
    Math.max(eventMs + 365 * DAY_MS, ...bars.map((b) => b.end), ...extra) + 14 * DAY_MS,
  );
  return { start, end };
}

function fmtBarLength(bar: Bar): string {
  const days = Math.round((bar.end - bar.start) / DAY_MS);
  if (days < 7) return days === 1 ? "1 dzień" : `${days} dni`;
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  return rest === 0 ? `${weeks} tyg.` : `${weeks} tyg. ${rest} dn.`;
}

/** Szerokość elementu w px (do skali osi i gęstości podpisów miesięcy). */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/* ------------------------------------------------------------------ */
/*  Zmiany wsadu                                                       */
/* ------------------------------------------------------------------ */

interface ShiftOpts {
  origStart: number;
  parent: ParentRole;
  minStart: number;
  maxWeeks: number;
}

/** Przesunięcie (move) albo zmiana długości (resize) klocka o `delta` tygodni. */
function shiftBar(
  input: MaternityPlanInput,
  bar: Bar,
  mode: "move" | "resize",
  delta: number,
  opts: ShiftOpts,
): MaternityPlanInput {
  const newStart = toIso(Math.max(opts.minStart, opts.origStart + delta * WEEK_MS));
  const clampWeeks = (w: number) => Math.min(Math.max(1, w), Math.max(1, opts.maxWeeks));
  if (bar.kind === "parental") {
    const parts = [...(input.parentalParts ?? [])];
    const part = parts[bar.index];
    if (!part) return input;
    parts[bar.index] =
      mode === "move"
        ? { ...part, parent: opts.parent, startDate: newStart }
        : { ...part, weeks: clampWeeks(part.weeks + delta) };
    return { ...input, parentalParts: parts };
  }
  if (bar.kind === "paternity") {
    const parts = [...(input.paternity ?? [])];
    const part = parts[bar.index];
    if (!part) return input;
    parts[bar.index] =
      mode === "move"
        ? { ...part, startDate: newStart }
        : { ...part, weeks: clampWeeks(part.weeks + delta) };
    return { ...input, paternity: parts };
  }
  return input;
}

type Tone = "info" | "warn";

/** Najwcześniejszy start ≥ `from`, w którym okres `len` ms mieści się między zajętymi przedziałami i kończy przed `deadline`. */
function firstFreeSlot(busy: [number, number][], from: number, len: number, deadline: number): number | null {
  let t = from;
  for (const [a, b] of [...busy].sort((x, y) => x[0] - y[0])) {
    if (t + len <= a) break;
    if (b > t) t = b;
  }
  return t + len <= deadline ? t : null;
}

/**
 * Układa urlop ojcowski tak, żeby nie nakładał się na inne urlopy taty (np. urlop macierzyński przejęty
 * po zgonie matki). Najpierw szuka wolnego miejsca w ciągu 12 miesięcy; gdy go nie ma, stawia ojcowski
 * zaraz po urlopie macierzyńskim taty, a jego kolidujący urlop rodzicielski przesuwa za ojcowski.
 * Zwraca daty przesuniętych części (do komunikatu dla użytkownika).
 */
function resolvePaternity(
  params: BenefitParams,
  input: MaternityPlanInput,
): { input: MaternityPlanInput; moved: string[] } {
  let next = input;
  const moved: string[] = [];
  const eventMs = toMs(input.eventDate);
  const anchor = input.event === "adoption" && input.adoptionDecreeDate ? toMs(input.adoptionDecreeDate) : eventMs;
  const deadline = addYearsMs(anchor, 1);
  for (let attempt = 0; attempt < 6; attempt++) {
    let result: MaternityPlanResult;
    try {
      result = planMaternity(params, next);
    } catch {
      return { input, moved: [] };
    }
    const iv = (sg: PlanSegment): [number, number] => [toMs(sg.startDate), toMs(sg.endDate) + DAY_MS];
    const dadBusy = result.segments.filter((sg) => sg.parent === "secondary" && sg.type !== "paternity");
    const pats = result.segments.filter((sg) => sg.type === "paternity");
    const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];
    const clash = pats.find((pt) => {
      const own = iv(pt);
      return (
        dadBusy.some((sg) => overlaps(own, iv(sg))) ||
        pats.some((o) => o !== pt && overlaps(own, iv(o)))
      );
    });
    if (!clash || clash.partIndex === undefined) return { input: next, moved };

    const i = clash.partIndex;
    const len = clash.days * DAY_MS;
    const busy = [
      ...dadBusy.map(iv),
      ...pats.filter((o) => o.partIndex !== i).map(iv),
    ];
    const paternityParts = [...(next.paternity ?? [])];
    let start = firstFreeSlot(busy, eventMs, len, deadline);
    let parentalParts = next.parentalParts;
    if (start === null) {
      // Brak miejsca w 1. roku: ojcowski zaraz po urlopie macierzyńskim taty, rodzicielski taty za nim.
      const chainEnd = Math.max(
        eventMs,
        ...dadBusy.filter((sg) => sg.type !== "parental").map((sg) => iv(sg)[1]),
      );
      start = chainEnd;
      const pEnd = start + len;
      const hit = dadBusy.find(
        (sg) => sg.type === "parental" && sg.partIndex !== undefined && overlaps([start!, pEnd], iv(sg)),
      );
      if (hit && hit.partIndex !== undefined) {
        parentalParts = (next.parentalParts ?? []).map((part, j) =>
          j === hit.partIndex ? { ...part, startDate: toIso(pEnd) } : part,
        );
      }
    }
    paternityParts[i] = { ...paternityParts[i], startDate: toIso(start) };
    next = { ...next, paternity: paternityParts, parentalParts };
    moved.push(toIso(start));
  }
  return { input: next, moved };
}

/** Plan „od końca”: urlop rodzicielski ułożony tak, by skończył się przed dniem powrotu do pracy. */
function planBackward(
  input: MaternityPlanInput,
  result: MaternityPlanResult,
  bars: Bar[],
  returnMs: number,
): { input?: MaternityPlanInput; message: string; tone: Tone } {
  const ent = result.entitlements;
  const chainEnd = Math.max(
    toMs(input.eventDate),
    ...bars
      .filter((b) => b.kind === "maternity" || b.kind === "transfer" || b.kind === "supplementary")
      .map((b) => b.end),
  );
  const lastDay = (ms: number) => fmtDate(toIso(ms - DAY_MS));

  if (ent.parentalWeeks === 0) {
    return {
      message: `W tej sytuacji urlop rodzicielski nie przysługuje – plan kończy się ${lastDay(chainEnd)}.`,
      tone: "warn",
    };
  }
  const weeksWanted = Math.floor((returnMs - chainEnd) / WEEK_MS);
  if (weeksWanted <= 0) {
    return {
      input: { ...input, parentalParts: [] },
      message: `Urlop macierzyński kończy się ${lastDay(chainEnd)}, więc przed tą datą nie zmieści się urlop rodzicielski – usunęliśmy go z planu. Jeśli matka chce wrócić wcześniej, po 14 tygodniach może przekazać resztę urlopu macierzyńskiego drugiemu rodzicowi.`,
      tone: "warn",
    };
  }

  const parts = input.parentalParts ?? [];
  const current: Record<ParentRole, number> = { primary: 0, secondary: 0 };
  parts.forEach((p) => (current[p.parent] += p.weeks));
  const motherDeceased = input.maternityTransfer?.circumstance === "death";
  const lead: ParentRole = motherDeceased || current.secondary > current.primary ? "secondary" : "primary";
  const other: ParentRole = lead === "primary" ? "secondary" : "primary";
  const per = ent.parentalWeeksPerParentMax;
  // Po zgonie matki z urlopu rodzicielskiego korzysta tylko ojciec – maks. jego część puli.
  const pool = motherDeceased ? per : ent.parentalWeeks;
  const total = Math.min(weeksWanted, pool);
  let otherWeeks = motherDeceased ? 0 : Math.min(current[other], total, per);
  const leadWeeks = Math.min(total - otherWeeks, per);
  otherWeeks = total - leadWeeks;

  const next = [
    { parent: lead, weeks: leadWeeks },
    { parent: other, weeks: otherWeeks },
  ].filter((p) => p.weeks > 0);
  const end = chainEnd + total * WEEK_MS;

  if (weeksWanted > pool) {
    return {
      input: { ...input, parentalParts: next },
      message: `Cała dostępna pula urlopu rodzicielskiego (${pool} tyg.) kończy się ${lastDay(end)} – przed wybraną datą. Do powrotu możecie skorzystać np. z urlopu wychowawczego (bezpłatnego, bez zasiłku).`,
      tone: "warn",
    };
  }
  return {
    input: { ...input, parentalParts: next },
    message: `Plan ułożony: ostatni dzień urlopu to ${lastDay(end)}.${
      end < returnMs
        ? " Urlop rodzicielski liczy się w pełnych tygodniach, dlatego kończy się kilka dni przed wybraną datą."
        : ""
    }`,
    tone: "info",
  };
}

/* ------------------------------------------------------------------ */
/*  Małe kontrolki                                                     */
/* ------------------------------------------------------------------ */

function Stepper(props: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const { label, hint, value, min, max, unit = "tyg.", onChange } = props;
  return (
    <div className="lp-field">
      <div className="pt-label" id={id}>
        {label}
      </div>
      {hint && <div className="pt-hint">{hint}</div>}
      <div className="lp-stepper" role="group" aria-labelledby={id}>
        <button
          type="button"
          className="lp-step-btn"
          aria-label={`${label}: mniej`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={16} aria-hidden />
        </button>
        <output className="lp-step-val" aria-live="polite">
          {value} {unit}
        </output>
        <button
          type="button"
          className="lp-step-btn"
          aria-label={`${label}: więcej`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Komponent                                                          */
/* ------------------------------------------------------------------ */

interface DragState {
  id: string;
  kind: BarKind;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  /** Pozycja klocka (px) w chwili chwycenia – do płynnego podążania za kursorem. */
  origLeft: number;
  origTop: number;
  pxPerDay: number;
  origInput: MaternityPlanInput;
  origStart: number;
  origParent: ParentRole;
  parent: ParentRole;
  delta: number;
  maxWeeks: number;
  /** Zamrożona skala osi – klocki nie „uciekają” spod kursora w trakcie przeciągania. */
  domain: Domain;
}

export interface LeavePlannerProps {
  input: MaternityPlanInput;
  result: MaternityPlanResult;
  params: BenefitParams;
  /** Czy użytkownik zmienił przykładowy plan. */
  edited: boolean;
  onChange: (next: MaternityPlanInput) => void;
  onReset: () => void;
}

export function LeavePlanner({
  input: committedInput,
  result: committedResult,
  params,
  edited,
  onChange,
  onReset,
}: LeavePlannerProps) {
  const uid = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const trackWidth = useWidth(trackRef);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  /*
   * Podgląd w trakcie przeciągania: silnik liczy plan lokalnie, a reszta strony (podsumowanie,
   * lista okresów, kalkulator podstawy) przelicza się dopiero po upuszczeniu klocka.
   */
  const [preview, setPreview] = useState<MaternityPlanInput | null>(null);
  const previewResult = useMemo(() => {
    if (!preview) return null;
    try {
      return planMaternity(params, preview);
    } catch {
      return null;
    }
  }, [preview, params]);
  const input = preview ?? committedInput;
  const result = previewResult ?? committedResult;
  const [returnDate, setReturnDate] = useState("");
  const [backward, setBackward] = useState<{ message: string; tone: Tone } | null>(null);
  /** Komunikat o automatycznym przesunięciu urlopu ojcowskiego (żeby plan nie miał kolizji). */
  const [autoNote, setAutoNote] = useState<string | null>(null);

  const eventMs = toMs(input.eventDate);
  const isBirth = input.event === "birth";
  const bars = useMemo(() => buildBars(result.segments), [result.segments]);
  const layout = useMemo(() => packLanes(bars), [bars]);
  const returnMs = returnDate ? toMs(returnDate) : undefined;
  const liveDomain = useMemo(() => computeDomain(bars, eventMs, returnMs), [bars, eventMs, returnMs]);
  const domain = drag?.domain ?? liveDomain;
  const span = domain.end - domain.start;
  const pos = (ms: number) => ((ms - domain.start) / span) * 100;

  /* --- Uprawnienia i pula --- */
  const ent = result.entitlements;
  const parts = input.parentalParts ?? [];
  const paternity = input.paternity ?? [];
  const used: Record<ParentRole, number> = {
    primary: result.parentalUsage.primaryWeeks,
    secondary: result.parentalUsage.secondaryWeeks,
  };
  const remaining = result.parentalUsage.remainingWeeks;
  /** Zgon matki: jej urlop kończy się w dniu zgonu, z urlopu rodzicielskiego korzysta tylko tata. */
  const motherDeceased = input.maternityTransfer?.circumstance === "death";
  const avail = (role: ParentRole) =>
    motherDeceased && role === "primary"
      ? 0
      : Math.max(0, Math.min(ent.parentalWeeksPerParentMax - used[role], remaining));
  const paternityUsed = paternity.reduce((s, p) => s + p.weeks, 0);
  const paternityLeft = Math.max(0, ent.paternityWeeks - paternityUsed);
  const childLost = !!input.childLoss && input.childLoss.survivingChildren === 0;
  const canPaternity =
    input.event !== "foster" && ent.paternityWeeks > 0 && !!input.parents.secondary && !childLost;
  const canTransfer =
    input.event !== "foster" && !input.childLoss && !!input.parents.secondary && !motherDeceased;
  const minPostpartum =
    input.maternityTransfer?.circumstance === "special"
      ? params.MOTHER_MIN_POSTPARTUM_WEEKS_SPECIAL
      : params.MOTHER_MIN_POSTPARTUM_WEEKS_STANDARD;
  const prenatal = input.prenatalWeeks ?? 0;
  const transfer = input.maternityTransfer?.weeks ?? 0;
  const maxTransfer = Math.max(0, Math.floor(ent.maternityWeeks - prenatal - minPostpartum));
  // Data zgonu = ostatni dzień urlopu mamy; tata przejmuje resztę od następnego dnia.
  const motherStartMs = eventMs - prenatal * WEEK_MS;
  const maternityDaysTotal = Math.round(ent.maternityDays);
  const deathIso = motherDeceased
    ? toIso(motherStartMs + (maternityDaysTotal - Math.round(transfer * 7) - 1) * DAY_MS)
    : "";
  /** Zmiana planu, po której urlop ojcowski sam omija inne urlopy taty. */
  const changeResolved = (next: MaternityPlanInput) => {
    const r = resolvePaternity(params, next);
    onChange(r.input);
    setAutoNote(
      r.moved.length > 0
        ? `Urlop ojcowski przesunęliśmy na ${fmtDate(r.moved[r.moved.length - 1])}, żeby nie nakładał się na inne urlopy taty.`
        : null,
    );
  };
  const setDeathDate = (iso: string) => {
    const motherDays = Math.min(
      maternityDaysTotal - 1,
      Math.max(1, Math.round((toMs(iso) - motherStartMs) / DAY_MS) + 1),
    );
    changeResolved({
      ...input,
      maternityTransfer: { circumstance: "death", weeks: (maternityDaysTotal - motherDays) / 7 },
    });
  };
  const maxPrenatal = Math.max(
    0,
    Math.min(params.MATERNITY_MAX_PRENATAL_WEEKS, Math.floor(ent.maternityWeeks - transfer - minPostpartum)),
  );
  const parentalFull = parts.length >= params.PARENTAL_MAX_PARTS;
  const paternityFull = paternity.length >= params.PATERNITY_MAX_PARTS;

  const maxWeeksFor = (bar: Bar) =>
    bar.kind === "parental"
      ? (parts[bar.index]?.weeks ?? 0) + avail(bar.parent)
      : (paternity[bar.index]?.weeks ?? 0) + paternityLeft;

  const weeksOf = (bar: Bar) =>
    bar.kind === "parental"
      ? (parts[bar.index]?.weeks ?? 0)
      : bar.kind === "paternity"
        ? (paternity[bar.index]?.weeks ?? 0)
        : 0;

  const canSplit = (bar: Bar) =>
    weeksOf(bar) >= 2 &&
    ((bar.kind === "parental" && !parentalFull) || (bar.kind === "paternity" && !paternityFull));

  /** Liczba tygodni pierwszej części przy cięciu w punkcie `clientX` (min. 1 tydzień z każdej strony). */
  const splitWeeksAt = (bar: Bar, clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const weeks = weeksOf(bar);
    const fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    return Math.min(weeks - 1, Math.max(1, Math.round(fraction * weeks)));
  };

  /** Następna część tego samego rodzica, która zaczyna się dokładnie po tej – można je połączyć. */
  const mergeTarget = (bar: Bar): Bar | null => {
    if (!isMovable(bar)) return null;
    const next = bars.find((b) => b.kind === bar.kind && b.index === bar.index + 1);
    if (!next || next.parent !== bar.parent || next.start !== bar.end) return null;
    if (bar.kind === "parental" && (parts[bar.index]?.workFte ?? 0) !== (parts[next.index]?.workFte ?? 0)) {
      return null;
    }
    return next;
  };

  /* --- Sposób wypłaty: porównanie 81,5% z 100% + 70% (tylko dla zatwierdzonego planu) --- */
  const combined = !!committedInput.combinedApplicationWithin21Days;
  const altTotal = useMemo(() => {
    try {
      return planMaternity(params, {
        ...committedInput,
        combinedApplicationWithin21Days: !combined,
      }).totals.all;
    } catch {
      return null;
    }
  }, [params, committedInput, combined]);
  const totalCombined = combined ? committedResult.totals.all : altTotal;
  const totalSplit = combined ? altTotal : committedResult.totals.all;

  /* --- Błędy --- */
  const overlapErrors = [...layout.conflictLanes].map(
    (role) =>
      `${ROLE_SHORT[role]}: dwa okresy nakładają się na siebie – jedna osoba nie może korzystać z nich jednocześnie. Przesuń jeden z klocków.`,
  );
  const allErrors = [...result.errors, ...overlapErrors];

  /* --- Geometria torów --- */
  const laneH = (role: ParentRole) => LANE_PAD * 2 + layout.rows[role] * ROW_H - (ROW_H - BAR_H);
  const laneTop = (role: ParentRole) => (role === "primary" ? 0 : laneH("primary"));
  const trackHeight = laneH("primary") + laneH("secondary");
  /*
   * Zmiana rodzica zależy wyłącznie od przesunięcia w pionie od miejsca chwycenia (z progiem),
   * a nie od geometrii torów – ta zmienia się, gdy klocek przeskakuje, co wcześniej powodowało
   * błyskawiczne przełączanie mama ↔ tata.
   */
  const laneFor = (d: DragState, clientY: number): ParentRole => {
    const dy = clientY - d.startY;
    if (d.origParent === "primary") return dy > LANE_SWITCH_PX ? "secondary" : "primary";
    return dy < -LANE_SWITCH_PX ? "primary" : "secondary";
  };

  /* --- Przeciąganie (mysz, rysik i dotyk) --- */
  const barEls = useRef(new Map<string, HTMLButtonElement>());
  const dragRef = useRef<DragState | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const lastDraggedId = useRef<string | null>(null);

  /**
   * Klocek podąża za kursorem płynnie (transform poza Reactem, bez renderu na każdy ruch myszy),
   * a jego właściwa pozycja i przerywany cień pokazują miejsce po przyciągnięciu do tygodni.
   */
  const applyFollow = () => {
    const d = dragRef.current;
    if (!d) {
      const prev = lastDraggedId.current && barEls.current.get(lastDraggedId.current);
      if (prev) prev.style.transform = "";
      lastDraggedId.current = null;
      return;
    }
    const el = barEls.current.get(d.id);
    if (!el || d.mode !== "move") return;
    const p = pointerRef.current;
    const rx = p.x - d.startX - (el.offsetLeft - d.origLeft);
    const rawY = p.y - d.startY - (el.offsetTop - d.origTop);
    const ry = d.kind === "parental" ? Math.max(-ROW_H, Math.min(ROW_H, rawY)) : 0;
    el.style.transform = `translate(${rx}px, ${ry}px)`;
  };
  useLayoutEffect(applyFollow);

  const startDrag = (e: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>, bar: Bar, mode: "move" | "resize") => {
    if (e.button !== 0 || !isMovable(bar) || !trackWidth) return;
    const el = barEls.current.get(bar.id);
    if (!el) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(bar.id);
    pointerRef.current = { x: e.clientX, y: e.clientY };
    const d: DragState = {
      id: bar.id,
      kind: bar.kind,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: el.offsetLeft,
      origTop: el.offsetTop,
      pxPerDay: trackWidth / (span / DAY_MS),
      origInput: input,
      origStart: bar.start,
      origParent: bar.parent,
      parent: bar.parent,
      delta: 0,
      maxWeeks: maxWeeksFor(bar),
      domain,
    };
    dragRef.current = d;
    lastDraggedId.current = bar.id;
    setDrag(d);
  };

  const moveDrag = (e: React.PointerEvent<HTMLElement>, bar: Bar) => {
    const d = dragRef.current;
    if (!d || d.id !== bar.id) return;
    pointerRef.current = { x: e.clientX, y: e.clientY };
    applyFollow();
    const delta = Math.round((e.clientX - d.startX) / d.pxPerDay / 7);
    const parent =
      d.mode === "move" && bar.kind === "parental" && !motherDeceased ? laneFor(d, e.clientY) : d.parent;
    if (delta === d.delta && parent === d.parent) return;
    const next = { ...d, delta, parent };
    dragRef.current = next;
    setDrag(next);
    setPreview(
      shiftBar(d.origInput, bar, d.mode, delta, {
        origStart: d.origStart,
        parent,
        minStart: eventMs,
        maxWeeks: d.maxWeeks,
      }),
    );
  };

  /** Upuszczenie klocka zatwierdza podgląd – dopiero wtedy przelicza się reszta strony. */
  const endDrag = () => {
    if (!dragRef.current) return;
    if (preview) onChange(preview);
    dragRef.current = null;
    setPreview(null);
    setDrag(null);
  };
  const cancelDrag = () => {
    dragRef.current = null;
    setPreview(null);
    setDrag(null);
  };

  const onBarKey = (e: React.KeyboardEvent, bar: Bar) => {
    if (!isMovable(bar)) return;
    if (bar.kind === "parental" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      if (motherDeceased) return;
      const parent: ParentRole = e.key === "ArrowUp" ? "primary" : "secondary";
      if (parent !== bar.parent) patchParental(bar.index, { parent });
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setSelectedId(bar.id);
    onChange(
      shiftBar(input, bar, e.shiftKey ? "resize" : "move", e.key === "ArrowRight" ? 1 : -1, {
        origStart: bar.start,
        parent: bar.parent,
        minStart: eventMs,
        maxWeeks: maxWeeksFor(bar),
      }),
    );
  };

  /** Linia cięcia na wybranym klocku podąża za kursorem (CSS var, bez renderu Reacta). */
  const trackCut = (e: React.MouseEvent<HTMLButtonElement>, bar: Bar) => {
    if (dragRef.current || selectedId !== bar.id || !canSplit(bar)) return;
    const first = splitWeeksAt(bar, e.clientX, e.currentTarget);
    const weeks = weeksOf(bar);
    const w = e.currentTarget.clientWidth;
    e.currentTarget.style.setProperty("--cut", `${(first / weeks) * w}px`);
  };

  /* --- Akcje puli i panelu --- */
  const addParental = (role: ParentRole) => {
    const weeks = avail(role);
    if (weeks <= 0 || parentalFull) return;
    onChange({ ...input, parentalParts: [...parts, { parent: role, weeks }] });
    setSelectedId(`parental-${parts.length}`);
  };
  const addPaternity = () => {
    if (paternityLeft <= 0 || paternityFull) return;
    changeResolved({ ...input, paternity: [...paternity, { weeks: paternityLeft }] });
    setSelectedId(`paternity-${paternity.length}`);
  };
  const patchParental = (i: number, patch: Partial<(typeof parts)[number]>) =>
    onChange({ ...input, parentalParts: parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const patchPaternity = (i: number, patch: Partial<(typeof paternity)[number]>) =>
    onChange({ ...input, paternity: paternity.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const removeBar = (bar: Bar) => {
    if (bar.kind === "parental") onChange({ ...input, parentalParts: parts.filter((_, j) => j !== bar.index) });
    if (bar.kind === "paternity") onChange({ ...input, paternity: paternity.filter((_, j) => j !== bar.index) });
    setSelectedId(null);
  };
  /**
   * Dzieli okres na dwie części (domyślnie w połowie, przy dwukliku – w miejscu kliknięcia).
   * Druga część zaczyna się zaraz po pierwszej, jest od razu wybrana i można ją przeciągnąć.
   */
  const splitBar = (bar: Bar, firstWeeks?: number) => {
    if (!canSplit(bar)) return;
    const i = bar.index;
    const weeks = weeksOf(bar);
    const first = Math.min(weeks - 1, Math.max(1, firstWeeks ?? Math.ceil(weeks / 2)));
    if (bar.kind === "parental") {
      const part = parts[i];
      const next = [...parts];
      next.splice(i, 1, { ...part, weeks: first }, { ...part, weeks: weeks - first, startDate: undefined });
      onChange({ ...input, parentalParts: next });
      setSelectedId(`parental-${i + 1}`);
    } else {
      const part = paternity[i];
      const next = [...paternity];
      next.splice(i, 1, { ...part, weeks: first }, { weeks: weeks - first });
      onChange({ ...input, paternity: next });
      setSelectedId(`paternity-${i + 1}`);
    }
  };

  /** Łączy część z następną, przylegającą częścią tego samego rodzica (odwrotność podziału). */
  const mergeBar = (bar: Bar) => {
    const target = mergeTarget(bar);
    if (!target) return;
    const i = bar.index;
    if (bar.kind === "parental") {
      const next = parts.filter((_, j) => j !== i + 1);
      next[i] = { ...parts[i], weeks: parts[i].weeks + parts[i + 1].weeks };
      onChange({ ...input, parentalParts: next });
    } else {
      const next = paternity.filter((_, j) => j !== i + 1);
      next[i] = { ...paternity[i], weeks: paternity[i].weeks + paternity[i + 1].weeks };
      onChange({ ...input, paternity: next });
    }
    setSelectedId(bar.id);
  };

  const resetAll = () => {
    setReturnDate("");
    setBackward(null);
    setSelectedId(null);
    setAutoNote(null);
    onReset();
  };
  const clearBackward = () => {
    setReturnDate("");
    setBackward(null);
  };
  const setTransfer = (weeks: number) =>
    changeResolved({
      ...input,
      maternityTransfer: { ...(input.maternityTransfer ?? {}), weeks },
    });

  const applyBackward = () => {
    if (returnMs === undefined || !Number.isFinite(returnMs)) return;
    const r = planBackward(input, result, bars, returnMs);
    if (r.input) onChange(r.input);
    setSelectedId(null);
    setBackward({ message: r.message, tone: r.tone });
  };

  /* --- Oś: miesiące i znaczniki --- */
  const months: number[] = [];
  for (let m = domain.start; m < domain.end; m = nextMonth(m)) months.push(m);
  const pxPerMonth = trackWidth > 0 ? trackWidth / months.length : 80;
  const tickStep = [1, 2, 3, 4, 6, 12].find((s) => s * pxPerMonth >= 52) ?? 12;
  const markers: { ms: number; label: string; kind: "event" | "return" | "birthday" }[] = [
    { ms: eventMs, label: isBirth ? "Poród" : "Przyjęcie", kind: "event" },
  ];
  if (isBirth) markers.push({ ms: addYearsMs(eventMs, 1), label: "1. urodziny", kind: "birthday" });
  if (returnMs !== undefined && Number.isFinite(returnMs)) {
    markers.push({ ms: returnMs, label: "Powrót", kind: "return" });
  }

  const selected = bars.find((b) => b.id === selectedId) ?? null;
  const eventWord = isBirth ? "porodzie" : "przyjęciu dziecka";
  const poolChips: { key: string; label: string; color: string; onClick: () => void }[] = [];
  if (ent.parentalWeeks > 0 && !parentalFull) {
    for (const role of ROLES) {
      const weeks = avail(role);
      if (weeks > 0) {
        poolChips.push({
          key: role,
          label: `Rodzicielski · ${ROLE_SHORT[role]} · ${weeks} tyg.`,
          color: SEGMENT_COLOR.parental,
          onClick: () => addParental(role),
        });
      }
    }
  }
  if (canPaternity && paternityLeft > 0 && !paternityFull) {
    poolChips.push({
      key: "paternity",
      label: `Ojcowski · ${ROLE_SHORT.secondary} · ${paternityLeft} tyg.`,
      color: SEGMENT_COLOR.paternity,
      onClick: addPaternity,
    });
  }

  /* Pasek akcji tuż pod osią – bez przewijania do panelu edycji. */
  const otherParent: ParentRole | null =
    selected?.kind === "parental" && !motherDeceased
      ? selected.parent === "primary"
        ? "secondary"
        : "primary"
      : null;
  const selectedMerge = selected ? mergeTarget(selected) : null;
  const actionBar =
    selected && isMovable(selected) ? (
      <div className="lp-actionbar" role="toolbar" aria-label="Akcje wybranego okresu">
        <span className="lp-actionbar-title" style={vars({ "--seg": SEGMENT_COLOR[selected.type] ?? "#64748b" })}>
          {SEGMENT_SHORT[selected.type]} · {selected.parent === "primary" ? "Mama" : "Tata"} · {fmtBarLength(selected)}
        </span>
        <button
          type="button"
          className="lp-act"
          disabled={!canSplit(selected)}
          title={
            canSplit(selected)
              ? "Albo kliknij dwukrotnie klocek w miejscu cięcia"
              : selected.kind === "parental" && parentalFull
                ? `Maks. ${params.PARENTAL_MAX_PARTS} części urlopu rodzicielskiego`
                : "Za krótki okres, aby go podzielić"
          }
          onClick={() => splitBar(selected)}
        >
          <Scissors size={15} aria-hidden /> Podziel
        </button>
        {selectedMerge && (
          <button type="button" className="lp-act" onClick={() => mergeBar(selected)}>
            <Combine size={15} aria-hidden /> Połącz z następną
          </button>
        )}
        {otherParent && (
          <button
            type="button"
            className="lp-act"
            onClick={() => patchParental(selected.index, { parent: otherParent })}
          >
            <ArrowLeftRight size={15} aria-hidden /> Przenieś do: {otherParent === "primary" ? "Mama" : "Tata"}
          </button>
        )}
        <button type="button" className="lp-act lp-act-danger" onClick={() => removeBar(selected)}>
          <Trash2 size={15} aria-hidden /> Usuń
        </button>
      </div>
    ) : null;

  /* Cień miejsca docelowego i daty w trakcie przeciągania. */
  const dragged = drag ? (bars.find((b) => b.id === drag.id) ?? null) : null;

  return (
    <section className="lp" aria-labelledby={`${uid}-h`}>
      <div className="lp-head">
        <h3 className="pt-h3" id={`${uid}-h`}>
          <Puzzle size={18} aria-hidden /> Ułóż swój plan urlopów
        </h3>
        {edited && (
          <button type="button" className="pt-link-btn" onClick={resetAll}>
            <RotateCcw size={15} aria-hidden /> Przywróć przykładowy plan
          </button>
        )}
      </div>

      {/* Sposób wypłaty */}
      {ent.parentalWeeks > 0 && (
        <fieldset className="lp-pay">
          <legend className="pt-label">Sposób wypłaty zasiłku</legend>
          <div className="lp-pay-grid">
            <label className={`lp-pay-opt${combined ? " is-on" : ""}`}>
              <input
                type="radio"
                name={`${uid}-pay`}
                checked={combined}
                onChange={() => onChange({ ...input, combinedApplicationWithin21Days: true })}
              />
              <span className="lp-pay-title">81,5% przez cały okres</span>
              <span className="lp-pay-total">{totalCombined !== null ? money(totalCombined) : "—"}</span>
            </label>
            <label className={`lp-pay-opt${!combined ? " is-on" : ""}`}>
              <input
                type="radio"
                name={`${uid}-pay`}
                checked={!combined}
                onChange={() => onChange({ ...input, combinedApplicationWithin21Days: false })}
              />
              <span className="lp-pay-title">100%, potem 70%</span>
              <span className="lp-pay-total">{totalSplit !== null ? money(totalSplit) : "—"}</span>
            </label>
          </div>
          <p className="pt-hint lp-pay-hint">
            {combined
              ? `Wymaga wniosku o zasiłek za cały urlop macierzyński i rodzicielski złożonego do 21 dni po ${eventWord}. Kwota jest równa co miesiąc.`
              : "100% za urlop macierzyński, 70% za rodzicielski – więcej na początku, mniej później."}
          </p>
        </fieldset>
      )}

      {/* Pula do rozdysponowania */}
      <div className="lp-toolbar">
        {poolChips.length > 0 ? (
          <>
            <span className="lp-toolbar-label">Dodaj okres:</span>
            {poolChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="lp-chip"
                style={vars({ "--seg": chip.color })}
                onClick={chip.onClick}
              >
                <Plus size={16} aria-hidden /> {chip.label}
              </button>
            ))}
          </>
        ) : (
          <span className="pt-hint">
            {ent.parentalWeeks > 0
              ? "Wszystkie tygodnie są już w planie. Skróć albo usuń okres, aby zwolnić miejsce."
              : "W tej sytuacji urlop rodzicielski nie przysługuje."}
          </span>
        )}
      </div>
      {ent.parentalWeeks > 0 && (
        <p className="pt-hint lp-rules">
          {motherDeceased ? (
            <>
              Rodzicielski: po zgonie mamy korzysta z niego tylko tata – w planie {used.secondary} z{" "}
              {ent.parentalWeeksPerParentMax} tyg. · części {parts.length}/{params.PARENTAL_MAX_PARTS}
            </>
          ) : (
            <>
              Rodzicielski: w planie {ent.parentalWeeks - remaining} z {ent.parentalWeeks} tyg. · po{" "}
              {params.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS} tyg. tylko dla każdego rodzica · części {parts.length}/
              {params.PARENTAL_MAX_PARTS}
            </>
          )}
        </p>
      )}

      {allErrors.length > 0 && (
        <div className="pt-callout pt-callout-err" role="alert">
          <CircleX size={18} className="pt-callout-icon" aria-hidden />
          <div>
            <strong>W tym wariancie plan jest niezgodny z przepisami:</strong>
            <ul>
              {allErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Oś czasu – na wąskich ekranach przewijana w bok we własnym kontenerze */}
      <div className="lp-chart-scroll">
      <div className="lp-chart">
        <div className="lp-corner" aria-hidden="true" />
        <div className="lp-ticks" aria-hidden="true">
          {months.map((m, i) =>
            i % tickStep === 0 ? (
              <span key={m} className="lp-tick" style={{ left: `${pos(m)}%` }}>
                {fmtMonthShort(m)}
                {(i === 0 || new Date(m).getUTCMonth() < tickStep) && ` ’${String(new Date(m).getUTCFullYear()).slice(2)}`}
              </span>
            ) : null,
          )}
          {markers.map((mk) => (
            <span key={mk.kind} className={`lp-flag lp-flag-${mk.kind}`} style={{ left: `${pos(mk.ms)}%` }}>
              {mk.label}
            </span>
          ))}
        </div>

        <div className="lp-lane-labels">
          {ROLES.map((role) => (
            <div key={role} className="lp-lane-label" style={{ height: laneH(role) }}>
              <span>{role === "primary" ? "Mama" : "Tata"}</span>
              <small>{ROLE_SHORT[role]}</small>
            </div>
          ))}
        </div>

        <div ref={trackRef} className="lp-track" style={{ height: trackHeight }}>
          {ROLES.map((role) => (
            <div
              key={role}
              className={`lp-lane-bg${drag?.mode === "move" && drag.parent === role ? " is-target" : ""}`}
              style={{ top: laneTop(role), height: laneH(role) }}
            />
          ))}
          {months.map((m, i) => (
            <div
              key={m}
              className={`lp-gridline${i % tickStep === 0 ? " is-major" : ""}`}
              style={{ left: `${pos(m)}%` }}
            />
          ))}
          {markers.map((mk) => (
            <div key={mk.kind} className={`lp-marker lp-marker-${mk.kind}`} style={{ left: `${pos(mk.ms)}%` }} />
          ))}
          {bars.map((bar, i) => {
            const movable = isMovable(bar);
            const top = laneTop(bar.parent) + LANE_PAD + (layout.rowOf.get(bar.id) ?? 0) * ROW_H;
            const cls = [
              "lp-bar",
              movable && "is-movable",
              selectedId === bar.id && "is-selected",
              selectedId === bar.id && canSplit(bar) && "can-split",
              drag?.id === bar.id && "is-dragging",
              layout.conflicts.has(bar.id) && "is-conflict",
              !bar.payable && "is-off",
            ]
              .filter(Boolean)
              .join(" ");
            const range = `${fmtDate(toIso(bar.start))} – ${fmtDate(toIso(bar.end - DAY_MS))}`;
            return (
              <button
                key={bar.id}
                ref={(el) => {
                  if (el) barEls.current.set(bar.id, el);
                  else barEls.current.delete(bar.id);
                }}
                type="button"
                className={cls}
                style={{
                  left: `${pos(bar.start)}%`,
                  width: `${Math.max(pos(bar.end) - pos(bar.start), 0.6)}%`,
                  top,
                  height: BAR_H,
                  ...vars({ "--seg": SEGMENT_COLOR[bar.type] ?? "#64748b", "--i": i }),
                }}
                aria-pressed={selectedId === bar.id}
                aria-label={`${SEGMENT_LABELS[bar.type] ?? bar.type}, ${ROLE_SHORT[bar.parent]}, ${range}.${
                  movable
                    ? ` Strzałki w bok: przesuń o tydzień, Shift i strzałki: zmień długość.${
                        bar.kind === "parental" ? " Strzałki w górę i w dół: mama lub tata." : ""
                      }`
                    : ""
                }`}
                title={`${SEGMENT_LABELS[bar.type] ?? bar.type} · ${range}${
                  movable ? " · przeciągnij, aby przesunąć; dwuklik dzieli w tym miejscu" : ""
                }`}
                onClick={() => setSelectedId(bar.id)}
                onDoubleClick={(e) => splitBar(bar, splitWeeksAt(bar, e.clientX, e.currentTarget))}
                onMouseMove={(e) => trackCut(e, bar)}
                onKeyDown={(e) => onBarKey(e, bar)}
                onPointerDown={(e) => startDrag(e, bar, "move")}
                onPointerMove={(e) => moveDrag(e, bar)}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
              >
                <span className="lp-bar-text">
                  <span className="lp-bar-name">{SEGMENT_SHORT[bar.type] ?? bar.type}</span>
                  <span className="lp-bar-len">{fmtBarLength(bar)}</span>
                </span>
                {movable && (
                  <span
                    className="lp-handle"
                    aria-hidden="true"
                    onPointerDown={(e) => startDrag(e, bar, "resize")}
                  />
                )}
              </button>
            );
          })}
          {dragged && (
            <>
              <div
                className="lp-ghost"
                aria-hidden="true"
                style={{
                  left: `${pos(dragged.start)}%`,
                  width: `${Math.max(pos(dragged.end) - pos(dragged.start), 0.6)}%`,
                  top: laneTop(dragged.parent) + LANE_PAD + (layout.rowOf.get(dragged.id) ?? 0) * ROW_H,
                  height: BAR_H,
                  ...vars({ "--seg": SEGMENT_COLOR[dragged.type] ?? "#64748b" }),
                }}
              />
              <div
                className="lp-drag-tip"
                aria-hidden="true"
                style={{
                  left: `${pos(dragged.start)}%`,
                  top: laneTop(dragged.parent) + LANE_PAD + (layout.rowOf.get(dragged.id) ?? 0) * ROW_H - 26,
                }}
              >
                {dragged.parent === "primary" ? "Mama" : "Tata"} · {fmtDate(toIso(dragged.start))} –{" "}
                {fmtDate(toIso(dragged.end - DAY_MS))} · {fmtBarLength(dragged)}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
      {actionBar ?? (
        <p className="pt-hint lp-help">
          Przeciągnij klocek, aby zmienić termin (w górę lub w dół – zmiana rodzica); prawą krawędzią zmienisz
          długość. Kliknij klocek, aby go edytować, podzielić lub połączyć.
          <span className="lp-help-mobile"> Oś możesz przewijać palcem w bok.</span>
        </p>
      )}

      {/* Panel edycji wybranego klocka */}
      <div className="lp-panel">
        <span className="pt-sr-only" aria-live="polite">
          {selected
            ? `${SEGMENT_LABELS[selected.type]}, ${ROLE_SHORT[selected.parent]}: ${fmtDate(
                toIso(selected.start),
              )} – ${fmtDate(toIso(selected.end - DAY_MS))}, ${money(selected.amount)}`
            : ""}
        </span>
        {!selected ? (
          <p className="pt-hint lp-empty">Wybierz klocek na osi, aby zobaczyć szczegóły i go zmienić.</p>
        ) : (
          <>
            <div className="lp-insp-head" style={vars({ "--seg": SEGMENT_COLOR[selected.type] ?? "#64748b" })}>
              <div>
                <div className="lp-insp-title">{SEGMENT_LABELS[selected.type]}</div>
                <div className="pt-hint">
                  {ROLE_SHORT[selected.parent]} · {fmtDate(toIso(selected.start))} –{" "}
                  {fmtDate(toIso(selected.end - DAY_MS))} · {fmtBarLength(selected)}
                </div>
              </div>
              <div className="lp-insp-money">
                <div className="lp-insp-amount">{money(selected.amount)}</div>
                <div className="pt-hint">{selected.rates.map(percent).join(" / ")} podstawy</div>
              </div>
            </div>

            <div className="lp-controls">
              {selected.kind === "maternity" && (
                <>
                  {isBirth && !input.childLoss && (
                    <Stepper
                      label="Tygodnie przed porodem"
                      hint={`Maks. ${params.MATERNITY_MAX_PRENATAL_WEEKS} tyg. – nie wydłużają urlopu.`}
                      value={prenatal}
                      min={0}
                      max={Math.max(prenatal, maxPrenatal)}
                      onChange={(w) => onChange({ ...input, prenatalWeeks: w })}
                    />
                  )}
                  {canTransfer && (
                    <Stepper
                      label="Przekaż tacie"
                      hint={`Mama wykorzystuje min. ${minPostpartum} tyg. po porodzie.`}
                      value={transfer}
                      min={0}
                      max={Math.max(transfer, maxTransfer)}
                      onChange={setTransfer}
                    />
                  )}
                  {input.childLoss && (
                    <p className="pt-hint">
                      Wymiar urlopu wynika z przepisów o urodzeniu martwego dziecka lub zgonie dziecka – nie
                      można go zmienić.
                    </p>
                  )}
                  {motherDeceased && (
                    <div className="lp-field">
                      <label className="pt-label" htmlFor={`${uid}-death`}>
                        Data zgonu mamy
                      </label>
                      <input
                        id={`${uid}-death`}
                        type="date"
                        className="pt-date"
                        min={toIso(motherStartMs)}
                        max={toIso(motherStartMs + (maternityDaysTotal - 2) * DAY_MS)}
                        value={deathIso}
                        onChange={(e) => e.target.value && setDeathDate(e.target.value)}
                      />
                      <div className="pt-hint">
                        Zasiłek za dni do zgonu włącznie należy się mamie, a tata przejmuje pozostałą część urlopu
                        od następnego dnia.
                      </div>
                      {autoNote && <div className="pt-hint lp-auto-note">{autoNote}</div>}
                    </div>
                  )}
                </>
              )}

              {selected.kind === "transfer" && motherDeceased && (
                <>
                  {(
                    <div className="lp-field">
                      <label className="pt-label" htmlFor={`${uid}-death`}>
                        Data zgonu mamy
                      </label>
                      <input
                        id={`${uid}-death`}
                        type="date"
                        className="pt-date"
                        min={toIso(motherStartMs)}
                        max={toIso(motherStartMs + (maternityDaysTotal - 2) * DAY_MS)}
                        value={deathIso}
                        onChange={(e) => e.target.value && setDeathDate(e.target.value)}
                      />
                      <div className="pt-hint">
                        Zasiłek za dni do zgonu włącznie należy się mamie, a tata przejmuje pozostałą część urlopu
                        od następnego dnia.
                      </div>
                      {autoNote && <div className="pt-hint lp-auto-note">{autoNote}</div>}
                    </div>
                  )}
                </>
              )}

              {autoNote && !motherDeceased && (selected.kind === "transfer" || selected.kind === "maternity") && (
                <div className="pt-hint lp-auto-note">{autoNote}</div>
              )}

              {selected.kind === "transfer" && !motherDeceased && (
                <Stepper
                  label="Tygodnie przejęte od mamy"
                  hint={`Zaczynają się zaraz po urlopie mamy (min. ${minPostpartum} tyg.).`}
                  value={transfer}
                  min={0}
                  max={Math.max(transfer, maxTransfer)}
                  onChange={setTransfer}
                />
              )}

              {selected.kind === "supplementary" && (
                <p className="pt-hint">
                  Wymiar zależy od tygodnia ciąży, masy urodzeniowej i czasu pobytu dziecka w szpitalu. Urlop
                  przysługuje jednorazowo, zaraz po urlopie macierzyńskim.
                </p>
              )}

              {selected.kind === "parental" &&
                (() => {
                  const i = selected.index;
                  const part = parts[i];
                  if (!part) return null;
                  const isEmployee = input.parents[part.parent]?.isEmployee !== false;
                  return (
                    <>
                      <fieldset className="lp-field">
                        <legend className="pt-label">Kto korzysta</legend>
                        <div className="lp-seg-row">
                          {ROLES.map((role) => (
                            <label key={role} className="lp-seg-opt">
                              <input
                                type="radio"
                                name={`${uid}-parent`}
                                checked={part.parent === role}
                                disabled={motherDeceased && role === "primary"}
                                onChange={() => patchParental(i, { parent: role })}
                              />
                              <span>{role === "primary" ? "Mama" : "Tata"}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <Stepper
                        label="Długość"
                        value={part.weeks}
                        min={1}
                        max={Math.max(part.weeks, maxWeeksFor(selected))}
                        onChange={(w) => patchParental(i, { weeks: w })}
                      />
                      <div className="lp-field">
                        <label className="pt-label" htmlFor={`${uid}-pstart`}>
                          Początek
                        </label>
                        <input
                          id={`${uid}-pstart`}
                          type="date"
                          className="pt-date"
                          min={input.eventDate}
                          value={toIso(selected.start)}
                          onChange={(e) =>
                            e.target.value &&
                            patchParental(i, { startDate: toIso(Math.max(eventMs, toMs(e.target.value))) })
                          }
                        />
                        {part.startDate && (
                          <button
                            type="button"
                            className="pt-link-btn lp-inline-btn"
                            onClick={() => patchParental(i, { startDate: undefined })}
                          >
                            <Undo2 size={15} aria-hidden /> Zaraz po poprzednim okresie
                          </button>
                        )}
                      </div>
                      {isEmployee && (
                        <div className="lp-field">
                          <label className="pt-label" htmlFor={`${uid}-fte`}>
                            Praca w trakcie urlopu
                          </label>
                          <select
                            id={`${uid}-fte`}
                            className="pt-date lp-select"
                            value={String(part.workFte ?? 0)}
                            onChange={(e) => patchParental(i, { workFte: Number(e.target.value) })}
                          >
                            <option value="0">Nie pracuję</option>
                            <option value="0.25">1/4 etatu</option>
                            <option value="0.5">1/2 etatu</option>
                          </select>
                          <div className="pt-hint">Urlop wydłuża się, a zasiłek maleje proporcjonalnie.</div>
                        </div>
                      )}
                    </>
                  );
                })()}

              {selected.kind === "paternity" &&
                (() => {
                  const i = selected.index;
                  const part = paternity[i];
                  if (!part) return null;
                  return (
                    <>
                      <Stepper
                        label="Długość"
                        hint={`Łącznie maks. ${params.PATERNITY_TOTAL_WEEKS} tyg., w ${params.PATERNITY_MAX_PARTS} częściach.`}
                        value={part.weeks}
                        min={params.PATERNITY_MIN_PART_WEEKS}
                        max={Math.max(part.weeks, maxWeeksFor(selected))}
                        onChange={(w) => patchPaternity(i, { weeks: w })}
                      />
                      <div className="lp-field">
                        <label className="pt-label" htmlFor={`${uid}-ostart`}>
                          Początek
                        </label>
                        <input
                          id={`${uid}-ostart`}
                          type="date"
                          className="pt-date"
                          min={input.eventDate}
                          value={toIso(selected.start)}
                          onChange={(e) =>
                            e.target.value &&
                            patchPaternity(i, { startDate: toIso(Math.max(eventMs, toMs(e.target.value))) })
                          }
                        />
                        <div className="pt-hint">
                          {isBirth
                            ? "Do ukończenia przez dziecko 12 miesięcy."
                            : "W ciągu 12 miesięcy od uprawomocnienia przysposobienia."}
                        </div>
                      </div>
                    </>
                  );
                })()}
            </div>
          </>
        )}
      </div>

      {/* Plan od końca */}
      {ent.parentalWeeks > 0 && (
        <div className="lp-panel lp-backward">
          <div className="lp-backward-text">
            <h4 className="lp-h4">
              <Flag size={16} aria-hidden /> Plan od końca
            </h4>
            <p className="pt-hint">
              Podaj dzień powrotu do pracy – ułożymy urlop rodzicielski tak, aby skończył się tuż przed nim.
            </p>
          </div>
          <div className="lp-backward-row">
            <input
              type="date"
              className="pt-date"
              aria-label="Dzień powrotu do pracy"
              min={input.eventDate}
              value={returnDate}
              onChange={(e) => {
                setReturnDate(e.target.value);
                setBackward(null);
              }}
            />
            <button type="button" className="pt-btn lp-primary" disabled={!returnDate} onClick={applyBackward}>
              <CalendarClock size={16} aria-hidden /> Ułóż plan
            </button>
            {returnDate && (
              <button type="button" className="pt-btn" onClick={clearBackward}>
                <X size={16} aria-hidden /> Wyczyść
              </button>
            )}
          </div>
          {backward && (
            <div className={`pt-callout pt-callout-${backward.tone}`} role="status">
              <div>{backward.message}</div>
            </div>
          )}
        </div>
      )}

      <style>{LP_CSS}</style>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Style – korzystają z tokenów motywu i klas przewodnika (pt-*)      */
/* ------------------------------------------------------------------ */

const LP_CSS = `
.lp{margin:28px 0 8px}
.lp-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:4px 12px;margin-bottom:12px}
.lp-head .pt-h3{margin:0}

/* Sposób wypłaty */
.lp-pay{border:none;margin:0 0 16px;padding:0;min-width:0}
.lp-pay legend{margin-bottom:8px}
.lp-pay-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.lp-pay-opt{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:2px 12px;min-height:48px;padding:10px 14px 10px 42px;border:1px solid var(--line);border-radius:8px;background:var(--paper);cursor:pointer;transition:border-color .2s,background .2s,box-shadow .2s}
.lp-pay-opt input{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;margin:0;accent-color:var(--brand);cursor:pointer}
.lp-pay-opt:hover{border-color:var(--muted)}
.lp-pay-opt.is-on{border-color:var(--brand);background:color-mix(in srgb,var(--brand-soft) 50%,var(--paper));box-shadow:inset 0 0 0 1px var(--brand)}
.lp-pay-opt:has(input:focus-visible){outline:3px solid var(--focus);outline-offset:2px}
.lp-pay-title{font-weight:600;font-size:15px}
.lp-pay-total{font-weight:700;font-size:15px;font-variant-numeric:tabular-nums}
.lp-pay-hint{margin:6px 0 0}

/* Pula */
.lp-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 6px}
.lp-toolbar-label{font-size:14px;font-weight:600}
.lp-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:6px 12px 6px 8px;border-radius:6px;border:1px solid color-mix(in srgb,var(--seg) 55%,var(--line));border-left:4px solid var(--seg);background:color-mix(in srgb,var(--seg) 12%,var(--paper));color:var(--ink);font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:transform .15s var(--pt-ease),box-shadow .2s}
.lp-chip:hover{transform:translateY(-2px);box-shadow:0 10px 18px -12px var(--seg)}
.lp-chip:active{transform:scale(.97)}
.lp-rules{margin:0 0 12px;font-size:13px}

/* Oś */
.lp-chart-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface);overscroll-behavior-x:contain}
.lp-chart{display:grid;grid-template-columns:64px minmax(0,1fr);padding:8px 14px 10px 0}
.lp-corner,.lp-lane-labels{position:sticky;left:0;z-index:5;background:var(--surface)}
.lp-help-mobile{display:none}
.lp-ticks{position:relative;height:42px}
.lp-tick{position:absolute;top:2px;padding-left:4px;font-size:12px;color:var(--muted);white-space:nowrap}
.lp-flag{position:absolute;bottom:4px;transform:translateX(-50%);padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;line-height:1.4;white-space:nowrap;background:var(--brand);color:#fff;z-index:1}
.lp-flag-birthday{background:var(--paper);color:var(--muted);border:1px solid var(--line)}
.lp-flag-return{background:#be123c}
.lp-lane-labels{display:flex;flex-direction:column}
.lp-lane-label{display:flex;flex-direction:column;justify-content:center;padding:0 8px 0 14px;border-top:1px solid var(--line);font-size:14px;font-weight:600;line-height:1.2}
.lp-lane-label small{font-size:11px;font-weight:500;color:var(--muted)}
.lp-track{position:relative;touch-action:pan-y;contain:layout style}
.lp-lane-bg{position:absolute;left:0;right:0;border-top:1px solid var(--line);transition:background .2s}
.lp-lane-bg.is-target{background:color-mix(in srgb,var(--brand-soft) 70%,transparent)}
.lp-gridline{position:absolute;top:0;bottom:0;width:1px;background:color-mix(in srgb,var(--line) 45%,transparent)}
.lp-gridline.is-major{background:var(--line)}
.lp-marker{position:absolute;top:0;bottom:0;border-left:2px dashed var(--brand);pointer-events:none;z-index:1}
.lp-marker-birthday{border-left-color:var(--muted);opacity:.5}
.lp-marker-return{border-left-color:#be123c}
.lp-bar{position:absolute;z-index:2;display:flex;align-items:center;margin:0;padding:0 12px 0 8px;border-radius:6px;border:1px solid color-mix(in srgb,var(--seg) 65%,var(--line));border-left:4px solid var(--seg);background:color-mix(in srgb,var(--seg) 22%,var(--paper));color:var(--ink);font:inherit;font-size:13px;font-weight:600;text-align:left;overflow:hidden;cursor:pointer;user-select:none;-webkit-user-select:none;container-type:inline-size;
  transition:left .3s var(--pt-ease),width .3s var(--pt-ease),top .3s var(--pt-ease),transform .22s var(--pt-ease),box-shadow .2s;
  animation:enter var(--enter-duration) var(--ease-enter) backwards;animation-delay:calc(var(--i,0) * 60ms + 150ms)}
.lp-bar.is-movable{cursor:grab;touch-action:none}
.lp-bar:hover{box-shadow:0 8px 16px -10px var(--seg)}
.lp-bar.is-selected{z-index:3;box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--seg)}
.lp-bar.is-dragging{z-index:4;cursor:grabbing;opacity:.92;box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--seg),0 18px 28px -14px var(--seg);transition:width .1s linear,box-shadow .2s}
.lp-bar.is-conflict{border-color:var(--pt-err-ink);border-style:dashed;border-left-style:solid}
.lp-bar.is-off{opacity:.55;background-image:repeating-linear-gradient(45deg,transparent 0 6px,color-mix(in srgb,var(--ink) 9%,transparent) 6px 12px)}
.lp-bar-text{display:flex;gap:6px;min-width:0;overflow:hidden;white-space:nowrap;pointer-events:none}
.lp-bar-name{overflow:hidden;text-overflow:ellipsis}
.lp-bar-len{flex:none;font-weight:500;color:color-mix(in srgb,var(--ink) 75%,transparent)}
@container (max-width:150px){.lp-bar-name{display:none}.lp-bar-len{font-weight:600;color:var(--ink)}}
@container (max-width:46px){.lp-bar-text{display:none}}
.lp-handle{position:absolute;top:0;right:0;bottom:0;width:14px;display:flex;align-items:center;justify-content:center;cursor:ew-resize;touch-action:none}
.lp-handle::after{content:"";width:3px;height:14px;border-radius:2px;background:color-mix(in srgb,var(--seg) 70%,var(--ink));opacity:.7}
.lp-help{margin:8px 0 14px;font-size:13px}

/* Przeciąganie: cień miejsca docelowego, daty, linia cięcia */
.lp-ghost{position:absolute;z-index:1;border:2px dashed var(--seg);border-radius:6px;background:color-mix(in srgb,var(--seg) 10%,transparent);pointer-events:none;transition:left .12s var(--pt-ease),width .12s var(--pt-ease),top .15s var(--pt-ease)}
.lp-drag-tip{position:absolute;z-index:6;padding:2px 8px;border-radius:4px;background:var(--ink);color:var(--paper);font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;box-shadow:0 6px 14px -8px rgb(0 0 0/.5);transition:left .12s var(--pt-ease),top .15s var(--pt-ease)}
.lp-bar.can-split{cursor:copy}
.lp-bar.can-split.is-movable{cursor:grab}
.lp-bar.can-split:hover::before{content:"";position:absolute;top:4px;bottom:4px;left:var(--cut,50%);border-left:2px dashed color-mix(in srgb,var(--seg) 60%,var(--ink));pointer-events:none}
.lp-bar.is-dragging::before{display:none}

/* Pasek akcji wybranego klocka */
.lp-actionbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 14px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--paper);animation:enter var(--enter-duration) var(--ease-enter) backwards}
.lp-actionbar-title{display:inline-flex;align-items:center;gap:8px;padding:0 8px 0 4px;font-size:14px;font-weight:600;margin-right:auto}
.lp-actionbar-title::before{content:"";width:10px;height:10px;border-radius:2px;background:var(--seg)}
.lp-act{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,transform .1s}
.lp-act:hover:not(:disabled){background:var(--hover);border-color:var(--muted)}
.lp-act:active:not(:disabled){transform:scale(.97)}
.lp-act:disabled{opacity:.45;cursor:not-allowed}
.lp-act-danger{color:var(--pt-err-ink)}
.lp-act-danger:hover:not(:disabled){background:var(--pt-err-bg);border-color:var(--pt-err-line)}

/* Panele */
.lp-panel{margin:0 0 12px;padding:16px 18px;border:1px solid var(--line);border-radius:8px;background:var(--paper)}
.lp-h4{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-size:15px;font-weight:600}
.lp-empty{margin:0}
.lp-insp-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px dashed var(--line)}
.lp-insp-title{display:flex;align-items:center;gap:8px;font-weight:600}
.lp-insp-title::before{content:"";flex:none;width:10px;height:10px;border-radius:2px;background:var(--seg)}
.lp-insp-money{text-align:right}
.lp-insp-amount{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.lp-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px 20px;align-items:start}
.lp-field{display:flex;flex-direction:column;gap:4px;min-width:0;margin:0;padding:0;border:none}
.lp-field .pt-date{margin-top:2px}
.lp-stepper{display:inline-flex;align-items:center;width:max-content;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.lp-step-btn{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:none;background:var(--paper);color:var(--ink);cursor:pointer;transition:background .15s}
.lp-step-btn:hover:not(:disabled){background:var(--hover)}
.lp-step-btn:disabled{opacity:.4;cursor:not-allowed}
.lp-step-val{min-width:84px;line-height:44px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;border-left:1px solid var(--line);border-right:1px solid var(--line)}
.lp-seg-row{display:inline-flex;width:max-content;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.lp-seg-opt{position:relative;display:flex;align-items:center;min-height:44px;padding:0 18px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s,color .15s}
.lp-seg-opt+.lp-seg-opt{border-left:1px solid var(--line)}
.lp-seg-opt input{position:absolute;opacity:0;pointer-events:none}
.lp-seg-opt:hover{background:var(--hover)}
.lp-seg-opt:has(input:checked){background:var(--brand);color:#fff}
.lp-seg-opt:has(input:disabled){opacity:.4;cursor:not-allowed;background:none}
.lp-seg-opt:has(input:focus-visible){outline:3px solid var(--focus);outline-offset:-3px}
.lp-auto-note{margin-top:6px;padding:8px 10px;border-radius:6px;background:var(--pt-info-bg);border:1px solid var(--pt-info-line);color:var(--pt-info-ink)}
.lp-inline-btn{align-self:flex-start;padding-left:0}
.lp-select{padding-right:14px;cursor:pointer}
.lp-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
.lp .pt-btn:hover svg{transform:none}
.lp .pt-btn:disabled{opacity:.5;cursor:not-allowed}
.lp-danger{color:var(--pt-err-ink)}
.lp-danger:hover{background:var(--pt-err-bg);border-color:var(--pt-err-line)}
.lp-primary{background:var(--brand);border-color:var(--brand);color:#fff}
.lp-primary:hover:not(:disabled){background:var(--brand-strong);border-color:var(--brand-strong)}
.lp-backward{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}
.lp-backward-text{flex:1 1 260px}
.lp-backward-text .pt-hint{margin:0}
.lp-backward-row{display:flex;flex-wrap:wrap;gap:8px;flex:1 1 300px}
.lp-backward-row .pt-date{flex:1 1 160px;width:auto;margin:0}
.lp-backward .pt-callout{flex-basis:100%;margin:0}

@media (max-width:640px){
  .lp-chart{min-width:620px}
  .lp-help-mobile{display:inline}
}
@media (max-width:560px){
  .lp-chart{grid-template-columns:52px minmax(0,1fr);padding-right:8px}
  .lp-lane-label{padding-left:8px;font-size:13px}
  .lp-lane-label small{display:none}
  .lp-panel{padding:14px}
  .lp-insp-money{text-align:left}
  .lp-pay-opt{padding-right:12px}
}
@media (prefers-reduced-motion:reduce){
  .lp-bar,.lp-chip{transition:none;animation:none}
}
`;
