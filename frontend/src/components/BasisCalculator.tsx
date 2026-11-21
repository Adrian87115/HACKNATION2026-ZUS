// src/components/BasisCalculator.tsx
import React, { useId, useMemo, useState } from "react";
import type { BasisInput, BenefitEngine, ParentRole } from "../engine/index.js";

/* ------------------------------------------------------------------ */
/*  Typy i stałe                                                       */
/* ------------------------------------------------------------------ */

interface BasisCalculatorProps {
  engine: BenefitEngine;
  primaryBasis: number;
  secondaryBasis: number;
  onChangePrimaryBasis: (value: number) => void;
  onChangeSecondaryBasis: (value: number) => void;
  /** Czy kalkulator ma być na starcie rozwinięty (domyślnie tak). */
  defaultOpen?: boolean;
}

type WorkKind = "employee" | "non_employee";

/** Pola tekstowe trzymamy jako string – użytkownik może wpisywać "7 500,50". */
interface FormState {
  kind: WorkKind;
  amount: string;
  fullTime: boolean;
  quarterlyBonuses: string;
  annualBonuses: string;
  continuePreviousBenefit: boolean;
  previousBasis: string;
}

const EMPTY_FORM: FormState = {
  kind: "employee",
  amount: "",
  fullTime: true,
  quarterlyBonuses: "",
  annualBonuses: "",
  continuePreviousBenefit: false,
  previousBasis: "",
};

const ROLE_LABEL: Record<ParentRole, { title: string; subtitle: string }> = {
  primary: { title: "Rodzic 1", subtitle: "matka / pierwszy opiekun" },
  secondary: { title: "Rodzic 2", subtitle: "ojciec / drugi opiekun" },
};

/* ------------------------------------------------------------------ */
/*  Pomocnicze funkcje                                                 */
/* ------------------------------------------------------------------ */

/** "7 500,50" -> 7500.5; pusty lub niepoprawny tekst -> null. */
function parseMoney(text: string): number | null {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

const money = (n: number) =>
  `${n.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł`;

type CalcState =
  | { status: "empty"; message: string }
  | { status: "error"; message: string }
  | {
      status: "ok";
      monthly: number;
      daily: number;
      rules: string[];
      warning?: string;
    };

/* ------------------------------------------------------------------ */
/*  Małe komponenty                                                    */
/* ------------------------------------------------------------------ */

function MoneyField(props: {
  label: string;
  hint?: string;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  const id = useId();
  const parsed = parseMoney(props.value);
  const invalid = Number.isNaN(parsed);
  return (
    <div className="bc-field">
      <label htmlFor={id} className="bc-label">
        {props.label}
        {props.optional && <span className="bc-optional"> (opcjonalnie)</span>}
      </label>
      {props.hint && (
        <div id={`${id}-hint`} className="bc-hint">
          {props.hint}
        </div>
      )}
      <div className={`bc-input-wrap${invalid ? " bc-invalid" : ""}`}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={
            `${props.hint ? `${id}-hint ` : ""}${invalid ? `${id}-err` : ""}`.trim() ||
            undefined
          }
        />
        <span className="bc-suffix" aria-hidden="true">
          zł
        </span>
      </div>
      {invalid && (
        <div id={`${id}-err`} className="bc-field-error" role="alert">
          Wpisz samą kwotę cyframi, np. 7500 lub 7500,50.
        </div>
      )}
      {props.help && (
        <details className="bc-help">
          <summary>Gdzie znajdę tę kwotę?</summary>
          <p>{props.help}</p>
        </details>
      )}
    </div>
  );
}

function StepHeading(props: { n: number; title: string; sub?: string }) {
  return (
    <div className="bc-step-heading">
      <span className="bc-step-num" aria-hidden="true">
        {props.n}
      </span>
      <div>
        <h3 className="bc-step-title">{props.title}</h3>
        {props.sub && <div className="bc-hint">{props.sub}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Główny komponent                                                   */
/* ------------------------------------------------------------------ */

export function BasisCalculator({
  engine,
  primaryBasis,
  secondaryBasis,
  onChangePrimaryBasis,
  onChangeSecondaryBasis,
  defaultOpen = true,
}: BasisCalculatorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeRole, setActiveRole] = useState<ParentRole>("primary");
  const [forms, setForms] = useState<Record<ParentRole, FormState>>({
    primary: { ...EMPTY_FORM },
    secondary: { ...EMPTY_FORM },
  });
  const [showExtras, setShowExtras] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [applied, setApplied] = useState<{
    role: ParentRole;
    previous: number;
    value: number;
  } | null>(null);

  const form = forms[activeRole];
  const params = engine.getParams();
  const savedFor = (role: ParentRole) =>
    role === "primary" ? primaryBasis : secondaryBasis;
  const setBasisFor = (role: ParentRole, v: number) =>
    role === "primary" ? onChangePrimaryBasis(v) : onChangeSecondaryBasis(v);

  const updateForm = (patch: Partial<FormState>) => {
    setForms((prev) => ({
      ...prev,
      [activeRole]: { ...prev[activeRole], ...patch },
    }));
    setApplied(null);
  };

  /* ---------------------------- obliczenia ---------------------------- */
  const calc: CalcState = useMemo(() => {
    const amountText = form.continuePreviousBenefit
      ? form.previousBasis
      : form.amount;
    const amount = parseMoney(amountText);

    if (amount === null) {
      return {
        status: "empty",
        message: form.continuePreviousBenefit
          ? "Wpisz podstawę poprzedniego zasiłku, a pokażemy wynik."
          : "Wpisz kwotę wynagrodzenia, a wynik pojawi się tutaj.",
      };
    }
    if (Number.isNaN(amount)) {
      return {
        status: "error",
        message: "Sprawdź wpisaną kwotę – powinna składać się tylko z cyfr.",
      };
    }

    const quarterly = parseMoney(form.quarterlyBonuses);
    const annual = parseMoney(form.annualBonuses);
    if (Number.isNaN(quarterly) || Number.isNaN(annual)) {
      return {
        status: "error",
        message: "Sprawdź kwoty premii – powinny składać się tylko z cyfr.",
      };
    }

    try {
      let input: BasisInput;
      if (form.continuePreviousBenefit) {
        input =
          form.kind === "employee"
            ? {
                kind: "employee",
                months: [],
                gapShorterThanOneMonth: true,
                previousBasis: amount,
              }
            : {
                kind: "non_employee",
                months: [],
                gapShorterThanOneMonth: true,
                previousBasis: amount,
              };
      } else if (form.kind === "employee") {
        input = {
          kind: "employee",
          months: Array.from({ length: 12 }, () => ({ grossSalary: amount })),
          quarterlyBonusesLast4Quarters: quarterly ?? 0,
          annualBonusesLastYear: annual ?? 0,
          fullTime: form.fullTime,
        };
      } else {
        input = {
          kind: "non_employee",
          months: Array.from({ length: 12 }, () => ({
            contributionBasis: amount,
          })),
        };
      }
      const r = engine.calculateBasis(input);

      let warning: string | undefined;
      if (
        !form.continuePreviousBenefit &&
        form.kind === "employee" &&
        form.fullTime &&
        amount > 0 &&
        amount < params.MIN_WAGE_2026_GROSS
      ) {
        warning = `Wpisana kwota jest niższa niż płaca minimalna brutto (${money(
          params.MIN_WAGE_2026_GROSS,
        )}). Upewnij się, że to kwota brutto, a nie „na rękę”.`;
      }
      return {
        status: "ok",
        monthly: r.monthlyBasis,
        daily: r.dailyBasis,
        rules: r.appliedRules,
        warning,
      };
    } catch (err) {
      return {
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Nie udało się obliczyć podstawy. Sprawdź wpisane dane.",
      };
    }
  }, [engine, form, params]);

  const alreadyApplied =
    calc.status === "ok" &&
    Math.abs(savedFor(activeRole) - calc.monthly) < 0.005;

  const apply = () => {
    if (calc.status !== "ok") return;
    setApplied({
      role: activeRole,
      previous: savedFor(activeRole),
      value: calc.monthly,
    });
    setBasisFor(activeRole, calc.monthly);
  };

  const undo = () => {
    if (!applied) return;
    setBasisFor(applied.role, applied.previous);
    setApplied(null);
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveRole((r) => (r === "primary" ? "secondary" : "primary"));
      setApplied(null);
    }
  };

  const extrasCount =
    (form.quarterlyBonuses.trim() ? 1 : 0) +
    (form.annualBonuses.trim() ? 1 : 0) +
    (form.continuePreviousBenefit ? 1 : 0);

  /* ------------------------------ widok ------------------------------- */
  return (
    <section className="bc-root" aria-labelledby="bc-title">
      <style>{CSS}</style>

      <header className="bc-header">
        <div>
          <h2 id="bc-title" className="bc-title">
            Nie znasz swojej podstawy zasiłku? Policzymy ją za Ciebie
          </h2>
          <p className="bc-hint bc-header-sub">
            To opcjonalny krok. Wystarczy wpisać wynagrodzenie – resztą zajmiemy
            się my. Zajmie to około minuty.
          </p>
        </div>
        <button
          type="button"
          className="bc-btn bc-btn-secondary"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-controls="bc-body"
        >
          {isOpen ? "Zwiń kalkulator ▲" : "Rozwiń kalkulator ▼"}
        </button>
      </header>

      {isOpen && (
        <div id="bc-body" className="bc-body">
          {/* Krok 1 – dla kogo */}
          <StepHeading
            n={1}
            title="Dla kogo liczymy?"
            sub="Każdy rodzic ma własną podstawę. Możesz policzyć obie."
          />
          <div
            className="bc-tabs"
            role="tablist"
            aria-label="Wybór rodzica"
            onKeyDown={onTabKey}
          >
            {(["primary", "secondary"] as ParentRole[]).map((role) => {
              const active = role === activeRole;
              return (
                <button
                  key={role}
                  id={`bc-tab-${role}`}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls="bc-panel"
                  tabIndex={active ? 0 : -1}
                  className={`bc-tab${active ? " bc-tab-active" : ""}`}
                  onClick={() => {
                    setActiveRole(role);
                    setApplied(null);
                  }}
                >
                  <span className="bc-tab-title">{ROLE_LABEL[role].title}</span>
                  <span className="bc-tab-sub">
                    {ROLE_LABEL[role].subtitle}
                  </span>
                  <span className="bc-tab-saved">
                    W planie: <strong>{money(savedFor(role))}</strong>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="bc-panel"
            role="tabpanel"
            aria-labelledby={`bc-tab-${activeRole}`}
          >
            {/* Krok 2 – forma zatrudnienia */}
            <StepHeading n={2} title="Jak pracujesz?" />
            <div
              className="bc-cards"
              role="radiogroup"
              aria-label="Forma zatrudnienia"
            >
              {(
                [
                  {
                    value: "employee",
                    title: "Umowa o pracę",
                    desc: "Pracuję na etacie u pracodawcy.",
                  },
                  {
                    value: "non_employee",
                    title: "Działalność lub zlecenie",
                    desc: "Mam firmę (B2B) albo umowę zlecenia z opłacaną składką chorobową.",
                  },
                ] as { value: WorkKind; title: string; desc: string }[]
              ).map((opt) => {
                const checked = form.kind === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`bc-card${checked ? " bc-card-checked" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`kind-${activeRole}`}
                      value={opt.value}
                      checked={checked}
                      onChange={() => updateForm({ kind: opt.value })}
                    />
                    <span className="bc-card-title">{opt.title}</span>
                    <span className="bc-card-desc">{opt.desc}</span>
                  </label>
                );
              })}
            </div>

            {/* Krok 3 – kwota */}
            <StepHeading n={3} title="Ile zarabiasz?" />
            {form.continuePreviousBenefit ? (
              <>
                <div className="bc-info" role="note">
                  Wybrano opcję „poprzedni zasiłek” – przeniesiemy podstawę z
                  tamtego zasiłku. Aby liczyć od wynagrodzenia, odznacz ją w
                  sekcji „Dodatkowe sytuacje” poniżej.
                </div>
                <MoneyField
                  label="Podstawa poprzedniego zasiłku (miesięcznie)"
                  hint="To kwota, od której liczono np. L4 w ciąży."
                  help="Znajdziesz ją na zaświadczeniu z ZUS o wypłaconym zasiłku albo zapytaj w dziale kadr."
                  value={form.previousBasis}
                  onChange={(v) => updateForm({ previousBasis: v })}
                  placeholder="np. 5 200"
                />
              </>
            ) : form.kind === "employee" ? (
              <>
                <MoneyField
                  label="Średnie miesięczne wynagrodzenie brutto z ostatnich 12 miesięcy"
                  hint="„Brutto” to kwota przed odliczeniem podatku i składek. Jeśli zarobki się zmieniają, wpisz średnią."
                  help="Na pasku wypłaty szukaj pozycji „Wynagrodzenie brutto” lub „Razem przychód”. Pasek dostaniesz też w dziale kadr lub płac."
                  value={form.amount}
                  onChange={(v) => updateForm({ amount: v })}
                  placeholder="np. 7 500"
                />
                <fieldset className="bc-fieldset">
                  <legend className="bc-label">
                    Czy pracujesz na pełny etat?
                  </legend>
                  <div className="bc-segment" role="radiogroup">
                    {[
                      { v: true, t: "Tak, pełny etat" },
                      { v: false, t: "Nie, część etatu" },
                    ].map((o) => (
                      <label
                        key={String(o.v)}
                        className={`bc-seg${form.fullTime === o.v ? " bc-seg-checked" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`fulltime-${activeRole}`}
                          checked={form.fullTime === o.v}
                          onChange={() => updateForm({ fullTime: o.v })}
                        />
                        {o.t}
                      </label>
                    ))}
                  </div>
                  {form.fullTime && (
                    <div className="bc-hint">
                      Przy pełnym etacie podstawa nie spadnie poniżej{" "}
                      {money(params.MIN_FULL_TIME_BASIS_2026)}.
                    </div>
                  )}
                </fieldset>
              </>
            ) : (
              <MoneyField
                label="Średnia miesięczna kwota, od której opłacasz składkę chorobową (z 12 miesięcy)"
                hint="Przy działalności to zwykle zadeklarowana podstawa składek, przy zleceniu – kwota z umowy."
                help="Znajdziesz ją w deklaracji rozliczeniowej ZUS (np. DRA) lub zapytaj osobę prowadzącą księgowość."
                value={form.amount}
                onChange={(v) => updateForm({ amount: v })}
                placeholder="np. 9 000"
              />
            )}

            {/* Dodatkowe sytuacje – progressive disclosure */}
            <div className="bc-extras">
              <button
                type="button"
                className="bc-link-btn"
                onClick={() => setShowExtras((v) => !v)}
                aria-expanded={showExtras}
                aria-controls="bc-extras-body"
              >
                {showExtras ? "▾" : "▸"} Dodatkowe sytuacje: premie, poprzedni
                zasiłek
                {extrasCount > 0 && (
                  <span className="bc-badge">{extrasCount} uzupełnione</span>
                )}
              </button>
              {showExtras && (
                <div id="bc-extras-body" className="bc-extras-body">
                  {form.kind === "employee" &&
                    !form.continuePreviousBenefit && (
                      <>
                        <MoneyField
                          optional
                          label="Premie kwartalne – łącznie z ostatnich 4 kwartałów (brutto)"
                          value={form.quarterlyBonuses}
                          onChange={(v) => updateForm({ quarterlyBonuses: v })}
                          placeholder="0"
                        />
                        <MoneyField
                          optional
                          label="Premia lub nagroda roczna za poprzedni rok (brutto)"
                          value={form.annualBonuses}
                          onChange={(v) => updateForm({ annualBonuses: v })}
                          placeholder="0"
                        />
                      </>
                    )}
                  <label className="bc-check">
                    <input
                      type="checkbox"
                      checked={form.continuePreviousBenefit}
                      onChange={(e) =>
                        updateForm({
                          continuePreviousBenefit: e.target.checked,
                        })
                      }
                    />
                    <span>
                      Poprzedni zasiłek (np. L4 w ciąży) skończył się mniej niż
                      miesiąc kalendarzowy przed urodzeniem dziecka
                      <span className="bc-hint">
                        {" "}
                        – wtedy ZUS zwykle przenosi dotychczasową podstawę.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Wynik */}
            <div className="bc-result" aria-live="polite">
              {calc.status === "empty" && (
                <div className="bc-result-empty">{calc.message}</div>
              )}

              {calc.status === "error" && (
                <div className="bc-error" role="alert">
                  <strong>Coś jest nie tak.</strong> {calc.message}
                </div>
              )}

              {calc.status === "ok" && (
                <>
                  <div className="bc-result-label">
                    Twoja podstawa zasiłku (miesięcznie)
                  </div>
                  <div className="bc-result-value">{money(calc.monthly)}</div>
                  <div className="bc-hint">
                    To kwota, od której ZUS wylicza zasiłek – nie sam zasiłek.
                    Procent podstawy i ostateczne kwoty pokażemy w planie
                    poniżej, gdy wybierzesz swoją sytuację.
                  </div>

                  {calc.warning && (
                    <div className="bc-warning" role="note">
                      ⚠ {calc.warning}
                    </div>
                  )}

                  <button
                    type="button"
                    className="bc-link-btn"
                    onClick={() => setShowRules((v) => !v)}
                    aria-expanded={showRules}
                    aria-controls="bc-rules"
                  >
                    {showRules ? "▾" : "▸"} Jak to obliczyliśmy?
                  </button>
                  {showRules && (
                    <div id="bc-rules" className="bc-rules">
                      <ul>
                        {calc.rules.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                      <div className="bc-hint">
                        Stawka dzienna (1/30 podstawy): {money(calc.daily)}.
                      </div>
                    </div>
                  )}

                  <div className="bc-actions">
                    <button
                      type="button"
                      className="bc-btn bc-btn-primary"
                      onClick={apply}
                      disabled={alreadyApplied}
                    >
                      {alreadyApplied
                        ? `✓ Ta kwota jest już w planie (${ROLE_LABEL[activeRole].title})`
                        : `Użyj tej kwoty w planie dla: ${ROLE_LABEL[activeRole].title}`}
                    </button>
                  </div>
                </>
              )}

              {applied && (
                <div className="bc-success" role="status">
                  <span>
                    ✓ Zapisano {money(applied.value)} w planie dla:{" "}
                    {ROLE_LABEL[applied.role].title}. Oś czasu została
                    zaktualizowana.
                  </span>
                  <button type="button" className="bc-link-btn" onClick={undo}>
                    Cofnij
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Style (dostępność: kontrast, focus, duże pola dotykowe ≥ 44 px)   */
/* ------------------------------------------------------------------ */

const CSS = `
.bc-root{--bc-ink:#0f172a;--bc-muted:#475569;--bc-line:#cbd5e1;--bc-accent:#1d4ed8;--bc-accent-bg:#eff6ff;
  --bc-ok:#166534;--bc-ok-bg:#f0fdf4;--bc-warn:#92400e;--bc-warn-bg:#fffbeb;--bc-err:#991b1b;--bc-err-bg:#fef2f2;
  margin-bottom:24px;border:1px solid var(--bc-line);border-radius:14px;background:#fff;overflow:hidden;
  color:var(--bc-ink);font-size:16px;line-height:1.5}
.bc-root *{box-sizing:border-box}
.bc-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:16px 20px;background:var(--bc-accent-bg);border-bottom:1px solid #dbeafe}
.bc-title{margin:0;font-size:18px;color:#1e3a8a}
.bc-header-sub{margin:4px 0 0}
.bc-body{padding:20px}
.bc-hint{font-size:14px;color:var(--bc-muted)}
.bc-label{display:block;font-weight:600;margin-bottom:2px}
.bc-optional{font-weight:400;color:var(--bc-muted)}
.bc-step-heading{display:flex;gap:12px;align-items:flex-start;margin:24px 0 10px}
.bc-body>.bc-step-heading:first-child{margin-top:0}
.bc-step-num{flex:none;width:28px;height:28px;border-radius:50%;background:var(--bc-accent);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px}
.bc-step-title{margin:0;font-size:17px}
.bc-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.bc-tab{display:flex;flex-direction:column;gap:2px;text-align:left;padding:12px 14px;min-height:44px;border-radius:10px;border:1px solid var(--bc-line);background:#f8fafc;cursor:pointer;font:inherit;color:inherit}
.bc-tab-active{border:2px solid var(--bc-accent);background:var(--bc-accent-bg);padding:11px 13px}
.bc-tab-title{font-weight:700}
.bc-tab-sub{font-size:13px;color:var(--bc-muted)}
.bc-tab-saved{font-size:13px;margin-top:4px}
.bc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.bc-card{position:relative;display:flex;flex-direction:column;gap:2px;padding:12px 14px 12px 44px;border:1px solid var(--bc-line);border-radius:10px;cursor:pointer;min-height:44px}
.bc-card input{position:absolute;left:14px;top:16px;width:20px;height:20px;margin:0}
.bc-card-checked{border:2px solid var(--bc-accent);background:var(--bc-accent-bg);padding:11px 13px 11px 43px}
.bc-card-title{font-weight:700}
.bc-card-desc{font-size:14px;color:var(--bc-muted)}
.bc-field{margin-bottom:16px}
.bc-input-wrap{position:relative;margin-top:6px;max-width:320px}
.bc-input-wrap input{width:100%;min-height:48px;padding:10px 40px 10px 12px;font:inherit;font-size:18px;border:1px solid #94a3b8;border-radius:8px;background:#fff;color:var(--bc-ink)}
.bc-suffix{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--bc-muted);pointer-events:none}
.bc-invalid input{border:2px solid var(--bc-err)}
.bc-field-error{color:var(--bc-err);font-size:14px;margin-top:4px}
.bc-help{margin-top:6px;font-size:14px}
.bc-help summary{cursor:pointer;color:var(--bc-accent);width:fit-content;min-height:24px}
.bc-help p{margin:6px 0 0;padding:8px 12px;background:#f8fafc;border-radius:8px;color:var(--bc-muted)}
.bc-fieldset{border:none;margin:0 0 8px;padding:0}
.bc-segment{display:inline-flex;margin-top:6px;border:1px solid #94a3b8;border-radius:8px;overflow:hidden}
.bc-seg{display:flex;align-items:center;padding:0 16px;min-height:44px;cursor:pointer;background:#fff}
.bc-seg+.bc-seg{border-left:1px solid #94a3b8}
.bc-seg input{position:absolute;opacity:0;pointer-events:none}
.bc-seg-checked{background:var(--bc-accent);color:#fff;font-weight:600}
.bc-seg:focus-within{outline:3px solid #f59e0b;outline-offset:-3px}
.bc-extras{margin:12px 0 4px}
.bc-extras-body{margin-top:10px;padding:14px;border:1px dashed var(--bc-line);border-radius:10px}
.bc-check{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.bc-check input{width:22px;height:22px;margin:2px 0 0;flex:none}
.bc-badge{margin-left:8px;padding:1px 8px;border-radius:999px;background:#dbeafe;color:#1e3a8a;font-size:12px}
.bc-info{padding:10px 12px;margin-bottom:12px;background:var(--bc-accent-bg);border-radius:8px;font-size:14px}
.bc-result{margin-top:24px;padding:18px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0}
.bc-result-empty{color:var(--bc-muted)}
.bc-result-label{font-size:14px;color:var(--bc-muted)}
.bc-result-value{font-size:32px;font-weight:800;line-height:1.2}
.bc-rules ul{margin:0;padding:0;list-style:none}
.bc-rules{margin:8px 0 0;padding:10px 12px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;font-size:14px;color:var(--bc-muted)}
.bc-rules li{padding:3px 0}
.bc-warning{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--bc-warn-bg);color:var(--bc-warn);font-size:14px}
.bc-error{padding:10px 12px;border-radius:8px;background:var(--bc-err-bg);color:var(--bc-err)}
.bc-success{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--bc-ok-bg);color:var(--bc-ok)}
.bc-actions{margin-top:14px}
.bc-btn{min-height:48px;padding:10px 18px;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;border:1px solid transparent}
.bc-btn-primary{background:var(--bc-accent);color:#fff;width:100%}
.bc-btn-primary:disabled{background:#e2e8f0;color:#334155;cursor:default}
.bc-btn-secondary{background:#fff;color:var(--bc-accent);border-color:#93c5fd;min-height:44px}
.bc-link-btn{background:none;border:none;padding:8px 0;min-height:44px;font:inherit;font-weight:600;color:var(--bc-accent);cursor:pointer;text-align:left}
.bc-root button:focus-visible,.bc-root input:focus-visible,.bc-root summary:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
.bc-card:focus-within,.bc-card-checked:focus-within{outline:3px solid #f59e0b;outline-offset:2px}
@media (prefers-reduced-motion:no-preference){.bc-btn,.bc-tab,.bc-card{transition:background .15s,border-color .15s}}
@media (max-width:480px){.bc-body{padding:14px}.bc-result-value{font-size:28px}}
`;
