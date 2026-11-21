// src/components/Timelines/ParentingDecisionTimeline.tsx
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  PARENTING_DECISION_TREE,
  type DecisionNode,
} from "../../data/parentingDecisionTree.js";
import { useBenefitEngine } from "../../hooks/useBenefitEngine.js";
import type {
  BenefitParams,
  MaternityPlanInput,
  MaternityPlanResult,
  ParentRole,
  PlanSegment,
} from "../../engine/index.js";
import { BasisCalculator } from "../BasisCalculator.js";

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
  maternity: "#2563eb",
  maternity_conditions: "#2563eb",
  supplementary_maternity: "#7c3aed",
  parental: "#15803d",
  paternity: "#c2410c",
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
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="pt-step-head">
      <span className="pt-step-num" aria-hidden="true">
        {props.n}
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
        return (
          <div key={`${seg.type}-${seg.parent}-${i}`} className="pt-gantt-row">
            <div className="pt-gantt-label">
              {SEGMENT_LABELS[seg.type] ?? seg.type} · {ROLE_SHORT[seg.parent]}
            </div>
            <div className="pt-gantt-track">
              <div
                className={`pt-gantt-bar${seg.payable ? "" : " pt-gantt-bar-off"}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: SEGMENT_COLOR[seg.type] ?? "#475569",
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
      <div className="pt-error" role="alert">
        <strong>Nie udało się wyliczyć planu.</strong> {plan.message}
      </div>
    );
  }

  const { input, result } = plan;
  const familyTotal = result.totals.all;

  return (
    <>
      {result.errors.length > 0 && (
        <div className="pt-error" role="alert">
          <strong>W tym wariancie plan jest niezgodny z przepisami:</strong>
          <ul>
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {node.specialLegalNote && (
        <div className="pt-callout pt-callout-warn" role="note">
          <strong>Ważne w tej sytuacji</strong>
          <p>{node.specialLegalNote}</p>
        </div>
      )}

      {/* Podsumowanie dla rodziny i każdego rodzica */}
      <div className="pt-family-total" aria-live="polite">
        Szacowany zasiłek dla całej rodziny:{" "}
        <strong>{money(familyTotal)}</strong>
      </div>
      <div className="pt-parents">
        {(["primary", "secondary"] as ParentRole[]).map((role) => {
          const segs = result.segments.filter((s) => s.parent === role);
          const weeks = Number(
            segs.reduce((sum, s) => sum + s.leaveWeeks, 0).toFixed(1),
          );
          return (
            <div key={role} className="pt-parent">
              <div className="pt-parent-title">{ROLE_LABELS[role]}</div>
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
      <h3 className="pt-h3">Kiedy i ile? Harmonogram okresów</h3>
      <Gantt segments={result.segments} />
      <ol className="pt-segments">
        {result.segments.map((seg, idx) => {
          const why = rateExplanation(seg, input, params);
          return (
            <li
              key={`${seg.type}-${seg.parent}-${idx}`}
              className="pt-segment"
              style={{ borderLeftColor: SEGMENT_COLOR[seg.type] ?? "#475569" }}
            >
              <div className="pt-segment-main">
                <div className="pt-segment-title">
                  {SEGMENT_LABELS[seg.type] ?? seg.type}
                </div>
                <div className="pt-badge">{ROLE_LABELS[seg.parent]}</div>
                <div className="pt-segment-dates">
                  {fmtDate(seg.startDate)} → {fmtDate(seg.endDate)}
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
              <details className="pt-legal">
                <summary>Podstawa prawna</summary>
                <p>{seg.legalBasis}</p>
              </details>
            </li>
          );
        })}
      </ol>

      {result.warnings.length > 0 && (
        <div className="pt-callout pt-callout-warn" role="note">
          <strong>Zwróć uwagę</strong>
          <ul>
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {result.notes.length > 0 && (
        <div className="pt-callout pt-callout-info" role="note">
          <strong>Warto wiedzieć</strong>
          <ul>
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="pt-assumptions">
        <summary>Na jakich założeniach opiera się ten plan?</summary>
        <ul>
          {describeAssumptions(input).map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="pt-hint">
          To przykładowy podział urlopów dla wybranej sytuacji. Dokładne daty i
          podział ustalicie wspólnie z pracodawcami.
        </p>
      </details>

      {node.supportOrganizations && (
        <div className="pt-support">
          <h3 className="pt-h3">Gdzie szukać wsparcia</h3>
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
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
        />
        {!touched && (
          <div className="pt-callout pt-callout-info" role="note">
            Pokazujemy <strong>przykładowe dane</strong> – zmień je na swoje.
          </div>
        )}
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
        />

        {path.length > 1 && (
          <div className="pt-toolbar">
            <button
              type="button"
              className="pt-btn pt-btn-secondary"
              onClick={back}
            >
              ← Wróć o krok
            </button>
            <button type="button" className="pt-link-btn" onClick={reset}>
              Zacznij od nowa
            </button>
          </div>
        )}

        <ol className="pt-timeline">
          {path.slice(1).map((node, i) => {
            const index = i + 1;
            return (
              <li key={node.id} className="pt-tl-item">
                <span className="pt-dot pt-dot-done" aria-hidden="true">
                  ✓
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
                    Zmień
                  </button>
                </div>
              </li>
            );
          })}

          {currentNode.children && (
            <li className="pt-tl-item">
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
                  {currentNode.children.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      className="pt-option"
                      onClick={() => select(branch)}
                    >
                      <span className="pt-option-title">{branch.label}</span>
                      <span className="pt-option-desc">
                        {branch.shortDescription}
                      </span>
                      <span className="pt-option-who">
                        Dotyczy: {stripWho(branch.affectedWho)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )}
        </ol>
      </section>

      {/* Krok 3 – wynik */}
      <section className="pt-card pt-result" aria-labelledby="pt-result-h">
        {isLeaf && plan ? (
          <>
            <StepHead
              n={3}
              id="pt-result-h"
              title="Co Wam przysługuje?"
              sub={`Podsumowanie • dotyczy: ${stripWho(currentNode.affectedWho)}`}
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
          </>
        ) : (
          <StepHead
            n={3}
            id="pt-result-h"
            title="Zobacz, co Wam przysługuje"
            sub="Wynik pojawi się tutaj, gdy wybierzesz swoją sytuację w kroku 2."
          />
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Style (kontrast WCAG AA, pola dotykowe ≥ 44 px, widoczny focus)  */
/* ------------------------------------------------------------------ */

const CSS = `
.pt-root{--ink:#0f172a;--muted:#475569;--line:#cbd5e1;--accent:#1d4ed8;--accent-bg:#eff6ff;
  max-width:880px;margin:0 auto;padding:0 12px 40px;font-family:system-ui,sans-serif;color:var(--ink);font-size:16px;line-height:1.5}
.pt-root *{box-sizing:border-box}
.pt-h1{margin:16px 0 4px;font-size:26px}
.pt-h2{margin:0;font-size:19px}
.pt-h3{margin:20px 0 8px;font-size:17px}
.pt-intro-sub{margin:0 0 16px}
.pt-hint{font-size:14px;color:var(--muted)}
.pt-card{margin-bottom:20px;padding:20px;border:1px solid var(--line);border-radius:14px;background:#fff}
.pt-step-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}
.pt-step-num{flex:none;width:30px;height:30px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15px}
.pt-data-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:16px}
.pt-label{display:block;font-weight:600;margin-bottom:2px}
.pt-input-wrap{position:relative;margin-top:6px}
.pt-input-wrap input,.pt-date{width:100%;min-height:48px;padding:10px 40px 10px 12px;font:inherit;font-size:17px;border:1px solid #94a3b8;border-radius:8px;background:#fff;color:var(--ink);margin-top:6px}
.pt-input-wrap input{margin-top:0}
.pt-date{padding-right:12px}
.pt-suffix{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
.pt-invalid input{border:2px solid #991b1b}
.pt-field-error{color:#991b1b;font-size:14px;margin-top:4px}
.pt-callout{padding:12px 14px;border-radius:10px;margin:14px 0;font-size:15px}
.pt-callout p,.pt-callout ul{margin:6px 0 0}
.pt-callout ul{padding-left:20px}
.pt-callout-info{background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a}
.pt-callout-warn{background:#fffbeb;border:1px solid #fde68a;color:#78350f}
.pt-error{padding:12px 14px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;margin:14px 0}
.pt-error ul{margin:6px 0 0;padding-left:20px}
.pt-toolbar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.pt-timeline{list-style:none;margin:0;padding:0 0 0 18px;border-left:3px solid #93c5fd}
.pt-tl-item{position:relative;padding:0 0 22px 22px}
.pt-tl-item:last-child{padding-bottom:0}
.pt-dot{position:absolute;left:-34px;top:2px;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;border:3px solid #fff}
.pt-dot-done{background:#1d4ed8;color:#fff}
.pt-dot-current{background:#fff;border:4px solid #1d4ed8}
.pt-tl-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.pt-eyebrow{font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#0f766e}
.pt-chosen{font-weight:700;font-size:17px}
.pt-question{margin:2px 0 4px}
.pt-question-sub{margin:0 0 12px}
.pt-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.pt-option{display:flex;flex-direction:column;gap:6px;text-align:left;padding:16px;min-height:44px;border:1px solid var(--line);border-radius:12px;background:#fff;color:inherit;font:inherit;cursor:pointer}
.pt-option:hover{border-color:var(--accent);background:var(--accent-bg)}
.pt-option-title{font-weight:700;font-size:16px}
.pt-option-desc{font-size:14px;color:var(--muted)}
.pt-option-who{font-size:13px;color:#0f766e;font-weight:600}
.pt-btn{min-height:44px;padding:8px 16px;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;border:1px solid transparent}
.pt-btn-secondary{background:#fff;color:var(--accent);border-color:#93c5fd}
.pt-link-btn{background:none;border:none;padding:8px 4px;min-height:44px;font:inherit;font-weight:600;color:var(--accent);cursor:pointer;text-decoration:underline}
.pt-family-total{padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:18px;color:#14532d;margin:14px 0}
.pt-parents{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.pt-parent{padding:14px;border-radius:10px;background:#f1f5f9}
.pt-parent-title{font-weight:700}
.pt-dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:8px 0 0;font-size:15px}
.pt-dl dt{color:var(--muted)}
.pt-dl dd{margin:0;font-weight:700;text-align:right}
.pt-gantt{margin:8px 0 16px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0}
.pt-gantt-row{margin-bottom:8px}
.pt-gantt-label{font-size:12px;color:var(--muted);margin-bottom:2px}
.pt-gantt-track{position:relative;height:14px;background:#e2e8f0;border-radius:7px}
.pt-gantt-bar{position:absolute;top:0;bottom:0;border-radius:7px}
.pt-gantt-bar-off{opacity:.4}
.pt-gantt-axis{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:4px}
.pt-segments{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.pt-segment{display:grid;grid-template-columns:1fr auto;gap:8px 16px;padding:14px;border:1px solid var(--line);border-left-width:6px;border-radius:10px}
.pt-segment-title{font-weight:700}
.pt-badge{display:inline-block;margin:4px 0;padding:2px 10px;border-radius:999px;background:#dbeafe;color:#1e3a8a;font-size:12px;font-weight:600}
.pt-segment-dates{font-size:15px}
.pt-segment-money{text-align:right;max-width:280px}
.pt-rate{font-weight:700}
.pt-amount{font-size:18px;font-weight:800;margin-top:4px}
.pt-warn-inline{color:#92400e;font-size:14px;margin-top:4px}
.pt-legal{grid-column:1/-1;font-size:14px}
.pt-legal summary,.pt-assumptions summary{cursor:pointer;color:var(--accent);min-height:28px;width:fit-content}
.pt-legal p{margin:4px 0 0;color:var(--muted)}
.pt-assumptions{margin-top:16px;font-size:15px}
.pt-assumptions ul{margin:8px 0;padding-left:20px}
.pt-empathy{padding:12px 14px;border-radius:10px;background:#fdf2f8;border:1px solid #fbcfe8;color:#500724}
.pt-support{margin-top:20px;padding:16px;border-radius:12px;background:#fdf2f8;border:1px solid #fbcfe8}
.pt-support .pt-h3{margin-top:0;color:#831843}
.pt-support-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.pt-support-item{padding:12px;background:#fff;border-radius:8px}
.pt-support-name{font-weight:700}
.pt-support-contact{font-size:14px;font-weight:600;color:#9d174d;margin-top:4px}
.pt-disclaimer{margin:20px 0 0;font-size:13px;color:var(--muted)}
.pt-root button:focus-visible,.pt-root input:focus-visible,.pt-root summary:focus-visible,.pt-root a:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
.pt-root h2:focus,.pt-root h3:focus{outline:none}
@media (prefers-reduced-motion:no-preference){.pt-option,.pt-btn{transition:background .15s,border-color .15s}}
@media (max-width:560px){.pt-card{padding:16px}.pt-segment{grid-template-columns:1fr}.pt-segment-money{text-align:left;max-width:none}.pt-tl-row{flex-direction:column;gap:0}}
`;
