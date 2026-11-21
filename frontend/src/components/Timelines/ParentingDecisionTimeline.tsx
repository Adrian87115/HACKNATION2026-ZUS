// src/components/Timelines/ParentingDecisionTimeline.tsx
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleX,
  ExternalLink,
  HeartHandshake,
  Info,
  Pencil,
  RotateCcw,
  TriangleExclamationPoint,
  Wallet,
} from "lucide-react";
import {
  PARENTING_DECISION_TREE,
  type DecisionNode,
} from "../../data/parentingDecisionTree.js";
import { Link } from "react-router-dom";
import { useBenefitEngine } from "../../hooks/useBenefitEngine.js";
import { AppRoutePaths } from "../../types/shared.js";
import { useCountUp } from "../../hooks/useCountUp.js";
import type {
  BenefitParams,
  MaternityPlanInput,
  MaternityPlanResult,
  ParentRole,
  PlanSegment,
} from "../../engine/index.js";
import { BasisCalculator } from "../BasisCalculator.js";
import { Collapse } from "../Animations/Collapse.js";

/* ------------------------------------------------------------------ */
/*  Słowniki                                                           */
/* ------------------------------------------------------------------ */

const ROLE_LABELS: Record<ParentRole, string> = {
  primary: "Matka / Rodzic 1",
  secondary: "Ojciec / Rodzic 2",
};

const ROLE_SHORT: Record<ParentRole, string> = {
  primary: "Rodzic 1",
  secondary: "Rodzic 2",
};

const SEGMENT_LABELS: Record<string, string> = {
  maternity: "Urlop macierzyński",
  maternity_conditions: "Urlop na warunkach macierzyńskiego",
  supplementary_maternity:
    "Uzupełniający urlop macierzyński (szpital/wcześniak)",
  parental: "Urlop rodzicielski",
  paternity: "Urlop ojcowski",
};

/** Kolor jest tylko dodatkiem – typ okresu zawsze jest też opisany tekstem. */
const SEGMENT_COLOR: Record<string, string> = {
  maternity: "#10b981",
  maternity_conditions: "#14b8a6",
  supplementary_maternity: "#8b5cf6",
  parental: "#0ea5e9",
  paternity: "#f59e0b",
};

/* ------------------------------------------------------------------ */
/*  Funkcje pomocnicze                                                 */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;

const money = (n: number) =>
  `${n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

const percent = (rate: number) =>
  `${(rate * 100).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

function fmtDuration(days: number): string {
  const weeks = days / 7;
  return Number.isInteger(weeks)
    ? `${weeks} tyg. (${days} dni)`
    : `${days} dni`;
}

/** Dane w drzewku zaczynają się od „Dotyczy:” – etykietę dodajemy w widoku. */
const stripWho = (s: string) => s.replace(/^Dotyczy:\s*/i, "");

/** "7 500,50" -> 7500.5; pusty lub niepoprawny tekst -> NaN. */
function parseMoney(text: string): number {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

const sameRate = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** CSS custom properties (stagger index, segment color) for inline styles. */
const vars = (v: Record<string, string | number>) =>
  v as unknown as React.CSSProperties;

/** Prosty język: dlaczego akurat taka stawka. */
function rateExplanation(
  seg: PlanSegment,
  input: MaternityPlanInput,
  p: BenefitParams,
): string {
  if (sameRate(seg.rate, p.RATE_FULL)) return "pełna stawka";
  if (sameRate(seg.rate, p.RATE_COMBINED_21_DAYS)) {
    return "podwyższona stawka, bo wniosek o zasiłek złożono w ciągu 21 dni od porodu lub przyjęcia dziecka";
  }
  if (seg.type === "parental" && sameRate(seg.rate, p.RATE_PARENTAL_70)) {
    return input.combinedApplicationWithin21Days && seg.parent === "secondary"
      ? "stawka dla 9 tygodni urlopu rodzicielskiego przysługujących wyłącznie drugiemu rodzicowi"
      : "standardowa stawka za urlop rodzicielski";
  }
  return "";
}

/** Założenia, które drzewko przyjęło za użytkownika – nic nie jest ukryte. */
function describeAssumptions(input: MaternityPlanInput): string[] {
  const list: string[] = [];
  list.push(
    input.childrenCount === 1
      ? "jedno dziecko"
      : `liczba dzieci: ${input.childrenCount}`,
  );
  if (input.childBirthDate)
    list.push(`dziecko urodzone ${fmtDate(input.childBirthDate)}`);
  list.push(
    input.combinedApplicationWithin21Days
      ? "wniosek o zasiłek za urlop macierzyński i rodzicielski złożony w ciągu 21 dni"
      : "brak wspólnego wniosku w ciągu 21 dni",
  );
  if (input.prenatalWeeks)
    list.push(`${input.prenatalWeeks} tyg. urlopu przed porodem`);
  input.parentalParts?.forEach((part) =>
    list.push(
      `urlop rodzicielski – ${ROLE_SHORT[part.parent]}: ${part.weeks} tyg.`,
    ),
  );
  const paternityWeeks =
    input.paternity?.reduce((sum, x) => sum + x.weeks, 0) ?? 0;
  if (paternityWeeks > 0) list.push(`urlop ojcowski: ${paternityWeeks} tyg.`);
  return list;
}

type PlanState =
  | { kind: "error"; message: string }
  | { kind: "ok"; input: MaternityPlanInput; result: MaternityPlanResult };

/* ------------------------------------------------------------------ */
/*  Małe komponenty                                                    */
/* ------------------------------------------------------------------ */

function StepHead(props: {
  n: number;
  id: string;
  title: string;
  sub?: string;
  state?: "idle" | "active" | "done";
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const state = props.state ?? "idle";
  return (
    <div className="pt-step-head">
      <span className={`pt-step-num pt-step-${state}`} aria-hidden="true">
        {state === "done" ? <Check size={18} strokeWidth={3} /> : props.n}
      </span>
      <div>
        <h2
          id={props.id}
          className="pt-h2"
          tabIndex={-1}
          ref={props.headingRef}
        >
          {props.title}
        </h2>
        {props.sub && <div className="pt-hint">{props.sub}</div>}
      </div>
    </div>
  );
}

/** Rozwijana sekcja z animacją wysokości. */
function Disclosure(props: {
  summary: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={props.className}>
      <button
        type="button"
        className="pt-disc-btn"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown size={16} className="pt-disc-chev" aria-hidden />
        {props.summary}
      </button>
      <Collapse open={open} id={id}>
        <div className="pt-disc-body">{props.children}</div>
      </Collapse>
    </div>
  );
}

/** Pole kwoty: wolno wpisywać "7 500,50"; poprawna wartość trafia od razu do planu. */
function MoneyInput(props: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(props.value).replace(".", ","));
  const [focused, setFocused] = useState(false);
  const invalid = Number.isNaN(parseMoney(draft));

  useEffect(() => {
    if (!focused) setDraft(String(props.value).replace(".", ","));
  }, [props.value, focused]);

  return (
    <div className="pt-field">
      <label htmlFor={id} className="pt-label">
        {props.label}
      </label>
      {props.hint && (
        <div id={`${id}-hint`} className="pt-hint">
          {props.hint}
        </div>
      )}
      <div className={`pt-input-wrap${invalid ? " pt-invalid" : ""}`}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          aria-invalid={invalid}
          aria-describedby={
            `${props.hint ? `${id}-hint ` : ""}${invalid ? `${id}-err` : ""}`.trim() ||
            undefined
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parseMoney(e.target.value);
            if (!Number.isNaN(parsed)) props.onChange(parsed);
          }}
        />
        <span className="pt-suffix" aria-hidden="true">
          zł
        </span>
      </div>
      {invalid && (
        <div id={`${id}-err`} className="pt-field-error" role="alert">
          Wpisz kwotę cyframi, np. 7500 lub 7500,50. Do czasu poprawy liczymy z{" "}
          {money(props.value)}.
        </div>
      )}
    </div>
  );
}

/** Wykres osi czasu – okresy mogą się nakładać (np. urlop ojcowski), więc każdy ma własny wiersz. */
function Gantt({ segments }: { segments: PlanSegment[] }) {
  if (segments.length === 0) return null;
  const toMs = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const min = Math.min(...segments.map((s) => toMs(s.startDate)));
  const max = Math.max(...segments.map((s) => toMs(s.endDate))) + DAY_MS;
  const span = Math.max(max - min, DAY_MS);

  return (
    <div className="pt-gantt" aria-hidden="true">
      {segments.map((seg, i) => {
        const left = ((toMs(seg.startDate) - min) / span) * 100;
        const width = Math.max(
          ((toMs(seg.endDate) + DAY_MS - toMs(seg.startDate)) / span) * 100,
          1.5,
        );
        const color = SEGMENT_COLOR[seg.type] ?? "#64748b";
        return (
          <div key={`${seg.type}-${seg.parent}-${i}`} className="pt-gantt-row">
            <div className="pt-gantt-label">
              <span className="pt-gantt-dot" style={{ background: color }} />
              {SEGMENT_LABELS[seg.type] ?? seg.type} · {ROLE_SHORT[seg.parent]}
            </div>
            <div className="pt-gantt-track">
              <div
                className={`pt-gantt-bar${seg.payable ? "" : " pt-gantt-bar-off"}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: color,
                  ...vars({ "--i": i }),
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-gantt-axis">
        <span>{fmtDate(new Date(min).toISOString().slice(0, 10))}</span>
        <span>
          {fmtDate(new Date(max - DAY_MS).toISOString().slice(0, 10))}
        </span>
      </div>
    </div>
  );
}

function FamilyTotal({ value }: { value: number }) {
  const animated = useCountUp(value);
  return (
    <div className="pt-family-total">
      <div className="pt-family-total-label">
        <Wallet size={18} aria-hidden />
        Szacowany zasiłek dla całej rodziny
      </div>
      <div className="pt-family-total-value" aria-hidden="true">
        {money(animated)}
      </div>
      {/* Czytniki ekranu dostają od razu wartość końcową, bez „odliczania”. */}
      <span className="pt-sr-only" aria-live="polite">
        Szacowany zasiłek dla całej rodziny: {money(value)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wynik                                                              */
/* ------------------------------------------------------------------ */

function ResultBody(props: {
  plan: PlanState;
  node: DecisionNode;
  params: BenefitParams;
}) {
  const { plan, node, params } = props;

  if (plan.kind === "error") {
    return (
      <div className="pt-callout pt-callout-err" role="alert">
        <CircleX size={18} className="pt-callout-icon" aria-hidden />
        <div>
          <strong>Nie udało się wyliczyć planu.</strong> {plan.message}
        </div>
      </div>
    );
  }

  const { input, result } = plan;

  return (
    <>
      {result.errors.length > 0 && (
        <div className="pt-callout pt-callout-err" role="alert">
          <CircleX size={18} className="pt-callout-icon" aria-hidden />
          <div>
            <strong>W tym wariancie plan jest niezgodny z przepisami:</strong>
            <ul>
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {node.specialLegalNote && (
        <div className="pt-callout pt-callout-warn" role="note">
          <TriangleExclamationPoint
            size={18}
            className="pt-callout-icon"
            aria-hidden
          />
          <div>
            <strong>Ważne w tej sytuacji</strong>
            <p>{node.specialLegalNote}</p>
          </div>
        </div>
      )}

      {/* Podsumowanie dla rodziny i każdego rodzica */}
      <FamilyTotal value={result.totals.all} />
      <div className="pt-parents">
        {(["primary", "secondary"] as ParentRole[]).map((role, i) => {
          const segs = result.segments.filter((s) => s.parent === role);
          const weeks = Number(
            segs.reduce((sum, s) => sum + s.leaveWeeks, 0).toFixed(1),
          );
          return (
            <div key={role} className="pt-parent" style={vars({ "--i": i })}>
              <div className="pt-parent-title">{ROLE_LABELS[role]}
              </div>
              {segs.length === 0 ? (
                <div className="pt-hint">
                  W tym wariancie nie ma okresów dla tego rodzica.
                </div>
              ) : (
                <dl className="pt-dl">
                  <dt>Czas urlopów</dt>
                  <dd>{weeks} tyg.</dd>
                  <dt>Szacowany zasiłek</dt>
                  <dd>{money(result.totals[role])}</dd>
                </dl>
              )}
            </div>
          );
        })}
      </div>

      {/* Oś czasu */}
      <h3 className="pt-h3">
        <CalendarDays size={18} aria-hidden /> Kiedy i ile? Harmonogram okresów
      </h3>
      <Gantt segments={result.segments} />
      <ol className="pt-segments">
        {result.segments.map((seg, idx) => {
          const why = rateExplanation(seg, input, params);
          return (
            <li
              key={`${seg.type}-${seg.parent}-${idx}`}
              className="pt-segment"
              style={vars({
                "--i": idx,
                "--seg": SEGMENT_COLOR[seg.type] ?? "#64748b",
              })}
            >
              <div className="pt-segment-main">
                <div className="pt-segment-title">
                  {SEGMENT_LABELS[seg.type] ?? seg.type}
                </div>
                <div className="pt-badge">{ROLE_LABELS[seg.parent]}</div>
                <div className="pt-segment-dates">
                  {fmtDate(seg.startDate)}
                  <ArrowRight size={14} aria-label="do" />
                  {fmtDate(seg.endDate)}
                </div>
                <div className="pt-hint">
                  {fmtDuration(seg.days)}
                  {seg.workFte > 0 && " • wydłużony, bo łączony z pracą"}
                </div>
              </div>
              <div className="pt-segment-money">
                <div className="pt-rate">{percent(seg.rate)} podstawy</div>
                {why && <div className="pt-hint">{why}</div>}
                {seg.payable ? (
                  <>
                    <div className="pt-amount">{money(seg.totalAmount)}</div>
                    <div className="pt-hint">
                      za cały okres • {money(seg.monthlyAmount)} miesięcznie
                    </div>
                  </>
                ) : (
                  <div className="pt-warn-inline">
                    Zasiłek nie będzie wypłacany
                    {seg.notPayableReason ? `: ${seg.notPayableReason}` : "."}
                  </div>
                )}
              </div>
              <Disclosure summary="Podstawa prawna" className="pt-legal">
                <p>{seg.legalBasis}</p>
              </Disclosure>
            </li>
          );
        })}
      </ol>

      {result.warnings.length > 0 && (
        <div className="pt-callout pt-callout-warn" role="note">
          <TriangleExclamationPoint
            size={18}
            className="pt-callout-icon"
            aria-hidden
          />
          <div>
            <strong>Zwróć uwagę</strong>
            <ul>
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {result.notes.length > 0 && (
        <div className="pt-callout pt-callout-info" role="note">
          <Info size={18} className="pt-callout-icon" aria-hidden />
          <div>
            <strong>Warto wiedzieć</strong>
            <ul>
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Disclosure
        summary="Na jakich założeniach opiera się ten plan?"
        className="pt-assumptions"
      >
        <ul>
          {describeAssumptions(input).map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="pt-hint">
          To przykładowy podział urlopów dla wybranej sytuacji. Dokładne daty i
          podział ustalicie wspólnie z pracodawcami.
        </p>
      </Disclosure>

      {node.supportOrganizations && (
        <div className="pt-support">
          <h3 className="pt-h3">
            <HeartHandshake size={18} aria-hidden /> Gdzie szukać wsparcia
          </h3>
          <p>
            Poza urlopem możecie skorzystać z bezpłatnej pomocy psychologicznej
            i prawnej:
          </p>
          <ul className="pt-support-list">
            {node.supportOrganizations.map((org) => (
              <li key={org.name} className="pt-support-item">
                <div className="pt-support-name">{org.name}</div>
                <div className="pt-hint">{org.description}</div>
                <div className="pt-support-contact">
                  {org.contact} •{" "}
                  <a href={org.url} target="_blank" rel="noopener noreferrer">
                    {org.url.replace(/^https?:\/\//, "")}
                    <ExternalLink size={13} aria-hidden />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        to={`${AppRoutePaths.APPLICATIONS}?swiadczenie=${node.id === "adoption" ? "adopcja" : "macierzynski"}`}
        className="pt-docs-link"
      >
        Jakie dokumenty złożyć i gdzie?
        <ArrowRight size={16} aria-hidden />
      </Link>

      <p className="pt-disclaimer">
        Wyliczenie ma charakter orientacyjny i nie zastępuje decyzji ZUS.
        Ostateczną kwotę zasiłku ustala ZUS na podstawie Waszych dokumentów.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Główny komponent                                                   */
/* ------------------------------------------------------------------ */

export function ParentingDecisionTimeline() {
  const engine = useBenefitEngine();
  const params = engine.getParams();

  const [path, setPath] = useState<DecisionNode[]>([PARENTING_DECISION_TREE]);
  const [eventDate, setEventDate] = useState("2026-05-15");
  const [primaryBasis, setPrimaryBasis] = useState(6000);
  const [secondaryBasis, setSecondaryBasis] = useState(8500);
  const [touched, setTouched] = useState(false);

  const currentNode = path[path.length - 1];
  const isLeaf = Boolean(currentNode.buildPlanInput);

  const plan: PlanState | null = useMemo(() => {
    if (!currentNode.buildPlanInput) return null;
    if (!eventDate) {
      return {
        kind: "error",
        message:
          "Wpisz datę porodu lub przyjęcia dziecka (krok 1), aby zobaczyć wyliczenie.",
      };
    }
    try {
      const input = currentNode.buildPlanInput(eventDate, {
        primary: primaryBasis,
        secondary: secondaryBasis,
      });
      return { kind: "ok", input, result: engine.planMaternity(input) };
    } catch (err) {
      return {
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Sprawdź wpisane dane i spróbuj ponownie.",
      };
    }
  }, [currentNode, eventDate, primaryBasis, secondaryBasis, engine]);

  /* Fokus: po wyborze przenosimy go na nowy krok albo na wynik (czytniki ekranu, klawiatura). */
  const stepRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    (isLeaf ? resultRef : stepRef).current?.focus();
  }, [currentNode.id, isLeaf]);

  const changePrimary = (v: number) => {
    setTouched(true);
    setPrimaryBasis(v);
  };
  const changeSecondary = (v: number) => {
    setTouched(true);
    setSecondaryBasis(v);
  };

  const select = (branch: DecisionNode) => setPath((prev) => [...prev, branch]);
  const jumpTo = (index: number) => setPath((prev) => prev.slice(0, index + 1));
  const back = () =>
    setPath((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const reset = () => setPath([PARENTING_DECISION_TREE]);

  return (
    <div className="pt-root">
      <style>{CSS}</style>

      <header className="pt-intro">
        <p className="pt-pill">Przewodnik rodzica</p>
        <h1 className="pt-h1">Planer urlopów i zasiłków dla rodziców</h1>
        <p className="pt-hint pt-intro-sub">
          Trzy proste kroki: podaj dane, wybierz swoją sytuację i zobacz, co Wam
          przysługuje.
        </p>
      </header>

      {/* Krok 1 – dane */}
      <section className="pt-card" aria-labelledby="pt-data-h">
        <StepHead
          n={1}
          id="pt-data-h"
          title="Podaj dane do obliczeń"
          sub="Zmiana któregokolwiek pola od razu aktualizuje plan poniżej."
          state={touched ? "done" : "active"}
        />
        <Collapse open={!touched}>
          <div className="pt-callout pt-callout-info" role="note">
            <Info size={18} className="pt-callout-icon" aria-hidden />
            <div>
              Pokazujemy <strong>przykładowe dane</strong> – zmień je na swoje.
            </div>
          </div>
        </Collapse>
        <div className="pt-data-grid">
          <div className="pt-field">
            <label htmlFor="pt-date" className="pt-label">
              Data porodu lub przyjęcia dziecka
            </label>
            <div className="pt-hint">
              Jeśli dziecko jeszcze się nie urodziło, wpisz planowaną datę.
            </div>
            <input
              id="pt-date"
              type="date"
              className="pt-date"
              value={eventDate}
              onChange={(e) => {
                setTouched(true);
                setEventDate(e.target.value);
              }}
            />
          </div>
          <MoneyInput
            label="Podstawa zasiłku – Rodzic 1 (miesięcznie)"
            hint="Nie znasz jej? Użyj kalkulatora poniżej."
            value={primaryBasis}
            onChange={changePrimary}
          />
          <MoneyInput
            label="Podstawa zasiłku – Rodzic 2 (miesięcznie)"
            hint="Zostaw przykładową, jeśli drugi rodzic nie będzie pobierał zasiłku."
            value={secondaryBasis}
            onChange={changeSecondary}
          />
        </div>

        <BasisCalculator
          engine={engine}
          primaryBasis={primaryBasis}
          secondaryBasis={secondaryBasis}
          onChangePrimaryBasis={changePrimary}
          onChangeSecondaryBasis={changeSecondary}
          defaultOpen={false}
        />
      </section>

      {/* Krok 2 – drzewko decyzyjne jako oś czasu wyborów */}
      <section className="pt-card" aria-labelledby="pt-choice-h">
        <StepHead
          n={2}
          id="pt-choice-h"
          title="Wybierz swoją sytuację"
          sub="Odpowiadaj krok po kroku. W każdej chwili możesz wrócić i zmienić wybór."
          state={isLeaf ? "done" : "active"}
        />

        <Collapse open={path.length > 1}>
          <div className="pt-toolbar">
            <button type="button" className="pt-btn" onClick={back}>
              <ArrowLeft size={16} aria-hidden /> Wróć o krok
            </button>
            <button type="button" className="pt-link-btn" onClick={reset}>
              <RotateCcw size={15} aria-hidden /> Zacznij od nowa
            </button>
          </div>
        </Collapse>

        <ol className="pt-timeline">
          {path.slice(1).map((node, i) => {
            const index = i + 1;
            return (
              <li key={node.id} className="pt-tl-item pt-tl-item-done">
                <span className="pt-dot pt-dot-done" aria-hidden="true">
                  <Check size={15} strokeWidth={3} />
                </span>
                <div className="pt-tl-row">
                  <div>
                    <div className="pt-eyebrow">Wybrano</div>
                    <div className="pt-chosen">{node.label}</div>
                    <div className="pt-hint">
                      Dotyczy: {stripWho(node.affectedWho)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pt-link-btn"
                    onClick={() => jumpTo(index - 1)}
                    aria-label={`Zmień wybór: ${node.label}`}
                  >
                    <Pencil size={14} aria-hidden /> Zmień
                  </button>
                </div>
              </li>
            );
          })}

          {currentNode.children && (
            <li key={currentNode.id} className="pt-tl-item">
              <span className="pt-dot pt-dot-current" aria-hidden="true" />
              <div>
                <div className="pt-eyebrow">{currentNode.label}</div>
                <h3 className="pt-h3 pt-question" tabIndex={-1} ref={stepRef}>
                  Co najlepiej opisuje Waszą sytuację?
                </h3>
                <p className="pt-hint pt-question-sub">
                  {currentNode.shortDescription}
                </p>
                <div
                  className="pt-options"
                  role="group"
                  aria-label="Dostępne opcje"
                >
                  {currentNode.children.map((branch, i) => (
                    <button
                      key={branch.id}
                      type="button"
                      className="pt-option"
                      style={vars({ "--i": i })}
                      onClick={() => select(branch)}
                    >
                      <span className="pt-option-title">{branch.label}</span>
                      <span className="pt-option-desc">
                        {branch.shortDescription}
                      </span>
                      <span className="pt-option-who">
                        Dotyczy: {stripWho(branch.affectedWho)}
                      </span>
                      <ArrowRight
                        size={18}
                        className="pt-option-arrow"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )}
        </ol>
      </section>

      {/* Krok 3 – wynik */}
      <section
        className={`pt-card pt-result${isLeaf ? " pt-result-active" : ""}`}
        aria-labelledby="pt-result-h"
      >
        {isLeaf && plan ? (
          <div key={currentNode.id} className="pt-result-body">
            <StepHead
              n={3}
              id="pt-result-h"
              title="Co Wam przysługuje?"
              sub={`Podsumowanie • dotyczy: ${stripWho(currentNode.affectedWho)}`}
              state="active"
              headingRef={resultRef}
            />
            {currentNode.supportOrganizations && (
              <p className="pt-empathy">
                Bardzo nam przykro z powodu Waszej straty. Poniżej znajdziecie
                informacje o urlopie oraz o miejscach, w których możecie uzyskać
                wsparcie.
              </p>
            )}
            <ResultBody plan={plan} node={currentNode} params={params} />
          </div>
        ) : (
          <>
            <StepHead
              n={3}
              id="pt-result-h"
              title="Zobacz, co Wam przysługuje"
              sub="Wynik pojawi się tutaj, gdy wybierzesz swoją sytuację w kroku 2."
            />
            <div className="pt-placeholder" aria-hidden="true">
              <div className="pt-skel pt-skel-lg" />
              <div className="pt-skel-row">
                <div className="pt-skel" />
                <div className="pt-skel" />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Style – tokeny motywu z index.css (jasny/ciemny/wysoki kontrast),  */
/*  pola dotykowe ≥ 44 px, widoczny focus, animacje z poszanowaniem    */
/*  ustawienia „ogranicz ruch”.                                        */
/* ------------------------------------------------------------------ */

const CSS = `
.pt-root{
  --pt-ease:cubic-bezier(.2,.8,.2,1);
  --pt-info-bg:#eff6ff;--pt-info-line:#bfdbfe;--pt-info-ink:#1e3a8a;
  --pt-warn-bg:#fffbeb;--pt-warn-line:#fde68a;--pt-warn-ink:#78350f;
  --pt-err-bg:#fef2f2;--pt-err-line:#fecaca;--pt-err-ink:#991b1b;
  --pt-care-bg:#fdf2f8;--pt-care-line:#fbcfe8;--pt-care-ink:#831843;
  --pt-shadow:0 1px 2px rgb(15 23 42/.04),0 10px 30px -14px rgb(15 23 42/.12);
  padding:0 0 40px;color:var(--ink);font-size:16px;line-height:1.5}
:root[data-theme='dark'] .pt-root{
  --pt-info-bg:#0c1e3a;--pt-info-line:#1e3a8a;--pt-info-ink:#bfdbfe;
  --pt-warn-bg:#2a1d06;--pt-warn-line:#78350f;--pt-warn-ink:#fde68a;
  --pt-err-bg:#2b0d0d;--pt-err-line:#7f1d1d;--pt-err-ink:#fecaca;
  --pt-care-bg:#2a0f1e;--pt-care-line:#831843;--pt-care-ink:#fbcfe8;
  --pt-shadow:0 1px 2px rgb(0 0 0/.3),0 10px 30px -14px rgb(0 0 0/.6)}
.pt-root *{box-sizing:border-box}
.pt-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* Nagłówek */
.pt-intro{margin:4px 0 24px;animation:enter var(--enter-duration) var(--ease-enter) backwards}
.pt-pill{margin:0;color:var(--brand-ink);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.pt-h1{margin:12px 0 6px;font-size:clamp(26px,4vw,36px);font-weight:700;letter-spacing:-.02em;line-height:1.15}
.pt-h2{margin:0;font-size:19px;font-weight:600;letter-spacing:-.01em}
.pt-h3{display:flex;align-items:center;gap:8px;margin:28px 0 12px;font-size:16px;font-weight:600}
.pt-intro-sub{margin:0;font-size:16px}
.pt-hint{font-size:14px;color:var(--muted)}

/* Karty kroków */
.pt-card{margin-bottom:20px;padding:24px;border:1px solid var(--line);border-radius:10px;background:var(--paper);box-shadow:var(--pt-shadow);animation:enter var(--enter-duration) var(--ease-enter) backwards}
.pt-root>section:nth-of-type(2){animation-delay:.08s}
.pt-root>section:nth-of-type(3){animation-delay:.16s}
.pt-result{transition:border-color .4s,box-shadow .4s}
.pt-result-active{border-color:color-mix(in srgb,var(--brand) 45%,var(--line))}
.pt-step-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:20px}
.pt-step-num{flex:none;width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;transition:background .3s,color .3s,transform .3s var(--pt-ease)}
.pt-step-idle{background:var(--hover);color:var(--muted)}
.pt-step-active{background:var(--brand);color:#fff;box-shadow:0 6px 16px -6px color-mix(in srgb,var(--brand) 70%,transparent)}
.pt-step-done{background:var(--brand-soft);color:var(--brand-ink);animation:pt-pop .4s cubic-bezier(.34,1.56,.64,1)}

/* Pola */
.pt-data-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin:4px 0 20px}
.pt-field{display:flex;flex-direction:column}
.pt-field>.pt-hint{margin-bottom:8px}
.pt-label{display:block;font-weight:600;font-size:15px;margin-bottom:2px}
.pt-input-wrap{position:relative;margin-top:auto}
.pt-input-wrap input,.pt-date{width:100%;min-height:48px;padding:10px 44px 10px 14px;font:inherit;font-size:16px;font-variant-numeric:tabular-nums;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);transition:border-color .15s,box-shadow .15s}
.pt-date{margin-top:auto;padding-right:14px}
.pt-input-wrap input:hover,.pt-date:hover{border-color:var(--muted)}
.pt-input-wrap input:focus-visible,.pt-date:focus-visible{outline:none;border-color:var(--brand);box-shadow:0 0 0 4px color-mix(in srgb,var(--brand) 20%,transparent)}
.pt-suffix{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;font-weight:500;pointer-events:none}
.pt-invalid input{border-color:var(--pt-err-ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--pt-err-ink) 15%,transparent)}
.pt-field-error{color:var(--pt-err-ink);font-size:14px;margin-top:6px;animation:enter var(--enter-duration) var(--ease-enter) backwards}

/* Komunikaty */
.pt-callout{display:flex;gap:10px;align-items:flex-start;padding:12px 16px;border-radius:8px;margin:0 0 16px;font-size:15px;border:1px solid;animation:enter var(--enter-duration) var(--ease-enter) backwards}
.pt-callout-icon{flex:none;margin-top:2px}
.pt-callout p,.pt-callout ul{margin:6px 0 0}
.pt-callout ul{padding-left:20px}
.pt-callout-info{background:var(--pt-info-bg);border-color:var(--pt-info-line);color:var(--pt-info-ink)}
.pt-callout-warn{background:var(--pt-warn-bg);border-color:var(--pt-warn-line);color:var(--pt-warn-ink)}
.pt-callout-err{background:var(--pt-err-bg);border-color:var(--pt-err-line);color:var(--pt-err-ink)}
.pt-result-body .pt-callout{margin:16px 0}

/* Przyciski */
.pt-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-bottom:16px}
.pt-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 16px;border-radius:6px;font:inherit;font-size:15px;font-weight:600;cursor:pointer;border:1px solid var(--line);background:var(--paper);color:var(--ink);transition:background .15s,border-color .15s,transform .15s}
.pt-btn:hover{background:var(--hover);border-color:var(--muted)}
.pt-btn:hover svg{transform:translateX(-2px)}
.pt-btn svg{transition:transform .2s var(--pt-ease)}
.pt-btn:active,.pt-link-btn:active{transform:scale(.97)}
.pt-link-btn{display:inline-flex;align-items:center;gap:6px;flex:none;background:none;border:none;padding:8px 12px;min-height:44px;border-radius:6px;font:inherit;font-size:15px;font-weight:600;color:var(--brand-ink);cursor:pointer;transition:background .15s,transform .15s}
.pt-link-btn:hover{background:var(--brand-soft)}

/* Oś wyborów */
.pt-timeline{list-style:none;margin:0;padding:0}
.pt-tl-item{position:relative;padding:0 0 16px 44px;animation:enter var(--enter-duration) var(--ease-enter) backwards}
.pt-tl-item::before{content:"";position:absolute;left:13px;top:36px;bottom:4px;width:2px;border-radius:2px;background:var(--line)}
.pt-tl-item-done::before{background:var(--brand);animation:pt-grow-y .5s var(--pt-ease) backwards;transform-origin:top}
.pt-tl-item:last-child{padding-bottom:0}
.pt-tl-item:last-child::before{display:none}
.pt-dot{position:absolute;left:0;top:4px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.pt-dot-done{background:var(--brand);color:#fff;animation:pt-pop .4s cubic-bezier(.34,1.56,.64,1) backwards}
.pt-dot-current{background:var(--paper);border:3px solid var(--brand);animation:pt-pulse 2.2s ease-out infinite}
.pt-tl-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 8px 12px 16px;border-radius:8px;background:var(--surface);border:1px solid var(--line)}
.pt-eyebrow{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--brand-ink)}
.pt-chosen{font-weight:600;font-size:16px}
.pt-question{margin:4px 0 4px;font-size:18px}
.pt-question-sub{margin:0 0 16px}
.pt-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.pt-option{position:relative;display:flex;flex-direction:column;gap:6px;text-align:left;padding:18px 48px 18px 18px;min-height:44px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:inherit;font:inherit;cursor:pointer;
  transition:transform .25s var(--pt-ease),border-color .2s,box-shadow .25s,background .2s;
  animation:enter var(--enter-duration) var(--ease-enter) backwards;animation-delay:calc(var(--i,0) * var(--enter-stagger) + 80ms)}
.pt-option:hover{transform:translateY(-3px);border-color:var(--brand);background:color-mix(in srgb,var(--brand-soft) 45%,var(--paper));box-shadow:0 14px 28px -16px color-mix(in srgb,var(--brand) 60%,transparent)}
.pt-option:active{transform:translateY(-1px) scale(.99)}
.pt-option-title{font-weight:600;font-size:16px}
.pt-option-desc{font-size:14px;color:var(--muted)}
.pt-option-who{font-size:13px;color:var(--brand-ink);font-weight:600}
.pt-option-arrow{position:absolute;right:16px;top:18px;color:var(--muted);transition:transform .25s var(--pt-ease),color .2s}
.pt-option:hover .pt-option-arrow{transform:translateX(4px);color:var(--brand-ink)}

/* Wynik */
.pt-result-body{animation:enter var(--enter-duration) var(--ease-enter) backwards}
.pt-placeholder{display:grid;gap:12px}
.pt-skel-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pt-skel{height:72px;border-radius:8px;background:linear-gradient(90deg,var(--hover) 0%,var(--surface) 50%,var(--hover) 100%);background-size:200% 100%;animation:pt-shimmer 1.8s linear infinite}
.pt-skel-lg{height:76px}
.pt-family-total{position:relative;overflow:hidden;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:22px 24px;border-radius:10px;margin:0 0 12px;color:#fff;
  background:linear-gradient(135deg,var(--brand) 0%,var(--brand-strong) 100%);box-shadow:0 16px 32px -18px color-mix(in srgb,var(--brand) 80%,transparent);animation:enter var(--enter-duration) var(--ease-enter) backwards}
.pt-family-total::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgb(255 255 255/.18) 50%,transparent 70%);transform:translateX(-100%);animation:pt-sheen 1.4s .3s var(--pt-ease) backwards;pointer-events:none}
.pt-family-total-label{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:500;opacity:.92}
.pt-family-total-value{font-size:clamp(26px,4.5vw,36px);font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.pt-parents{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.pt-parent{padding:16px 18px;border-radius:8px;background:var(--surface);border:1px solid var(--line);animation:enter var(--enter-duration) var(--ease-enter) backwards;animation-delay:calc(var(--i,0) * var(--enter-stagger) + 120ms)}
.pt-parent-title{display:flex;align-items:center;gap:10px;font-weight:600}
.pt-dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:12px 0 0;font-size:15px}
.pt-dl dt{color:var(--muted)}
.pt-dl dd{margin:0;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}

/* Gantt */
.pt-gantt{margin:0 0 16px;padding:16px 18px;background:var(--surface);border-radius:8px;border:1px solid var(--line)}
.pt-gantt-row+.pt-gantt-row{margin-top:12px}
.pt-gantt-label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-bottom:6px}
.pt-gantt-dot{width:8px;height:8px;border-radius:2px;flex:none}
.pt-gantt-track{position:relative;height:10px;background:var(--line);border-radius:3px;overflow:hidden}
.pt-gantt-bar{position:absolute;top:0;bottom:0;border-radius:3px;transform-origin:left center;transition:left .45s var(--pt-ease),width .45s var(--pt-ease);animation:pt-grow-x .8s var(--pt-ease) backwards;animation-delay:calc(var(--i,0) * 90ms + 200ms)}
.pt-gantt-bar-off{opacity:.35}
.pt-gantt-axis{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:10px}

/* Okresy */
.pt-segments{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.pt-segment{position:relative;display:grid;grid-template-columns:1fr auto;gap:8px 16px;padding:16px 18px 10px;border:1px solid var(--line);border-radius:8px;background:var(--paper);overflow:hidden;
  transition:box-shadow .25s,transform .25s var(--pt-ease),border-color .25s;animation:enter var(--enter-duration) var(--ease-enter) backwards;animation-delay:calc(var(--i,0) * var(--enter-stagger) + 250ms)}
.pt-segment:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--seg) 45%,var(--line));box-shadow:0 12px 24px -18px color-mix(in srgb,var(--seg) 80%,transparent)}
.pt-segment-title{display:flex;align-items:center;gap:8px;font-weight:600}
.pt-segment-title::before{content:"";flex:none;width:10px;height:10px;border-radius:2px;background:var(--seg)}
.pt-badge{display:inline-flex;margin:6px 0;padding:2px 8px;border-radius:4px;background:color-mix(in srgb,var(--seg) 16%,var(--paper));color:var(--ink);font-size:12px;font-weight:600}
.pt-segment-dates{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:15px}
.pt-segment-dates svg{color:var(--muted)}
.pt-segment-money{text-align:right;max-width:280px}
.pt-rate{font-weight:600;font-size:14px;color:var(--muted)}
.pt-amount{font-size:20px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.pt-warn-inline{color:var(--pt-warn-ink);font-size:14px;margin-top:4px}
.pt-legal{grid-column:1/-1;font-size:14px;border-top:1px dashed var(--line);margin-top:4px}
.pt-legal p{margin:0 0 6px;color:var(--muted)}

/* Rozwijane sekcje */
.pt-disc-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:8px 0;min-height:36px;font:inherit;font-size:14px;font-weight:600;color:var(--brand-ink);cursor:pointer}
.pt-disc-btn:hover{text-decoration:underline;text-underline-offset:3px}
.pt-disc-chev{transition:transform .3s var(--pt-ease)}
.pt-disc-btn[aria-expanded="true"] .pt-disc-chev{transform:rotate(180deg)}
.pt-disc-body{padding:2px 0 4px 22px}
.pt-assumptions{margin-top:16px;padding:6px 16px;border-radius:8px;background:var(--surface);border:1px solid var(--line);font-size:15px}
.pt-assumptions ul{margin:0 0 8px;padding-left:20px}
.pt-assumptions .pt-hint{margin:0 0 8px}

/* Wsparcie */
.pt-empathy{padding:14px 16px;border-radius:8px;background:var(--pt-care-bg);border:1px solid var(--pt-care-line);color:var(--pt-care-ink);margin:0 0 16px}
.pt-support{margin-top:20px;padding:18px;border-radius:8px;background:var(--pt-care-bg);border:1px solid var(--pt-care-line)}
.pt-support .pt-h3{margin-top:0;color:var(--pt-care-ink)}
.pt-support>p{margin:0 0 12px}
.pt-support-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.pt-support-item{padding:14px;background:var(--paper);border-radius:6px;border:1px solid var(--pt-care-line);transition:transform .2s var(--pt-ease)}
.pt-support-item:hover{transform:translateX(2px)}
.pt-support-name{font-weight:600}
.pt-support-contact{font-size:14px;font-weight:600;color:var(--pt-care-ink);margin-top:6px}
.pt-support-contact a{display:inline-flex;align-items:center;gap:4px;color:inherit}
.pt-docs-link{display:inline-flex;align-items:center;gap:6px;margin-top:20px;font-weight:600;color:var(--brand-ink);text-decoration:none}
.pt-docs-link:hover{text-decoration:underline;text-underline-offset:4px}
.pt-docs-link svg{transition:transform .2s var(--pt-ease)}
.pt-docs-link:hover svg{transform:translateX(3px)}
.pt-disclaimer{margin:24px 0 0;font-size:13px;color:var(--muted)}

/* Fokus */
.pt-root button:focus-visible,.pt-root summary:focus-visible,.pt-root a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.pt-root h2:focus,.pt-root h3:focus{outline:none}

/* Animacje */
@keyframes pt-pop{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes pt-grow-x{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes pt-grow-y{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes pt-sheen{to{transform:translateX(100%)}}
@keyframes pt-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes pt-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--brand) 45%,transparent)}70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}


@media (max-width:560px){
  .pt-card{padding:18px;border-radius:10px}
  .pt-segment{grid-template-columns:1fr}
  .pt-segment-money{text-align:left;max-width:none}
  .pt-tl-row{flex-direction:column;align-items:flex-start;gap:4px}
  .pt-family-total{padding:18px}
}
`;
