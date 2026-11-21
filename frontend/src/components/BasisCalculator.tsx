// src/components/BasisCalculator.tsx
import React, { useId, useMemo, useState } from "react";
import { Check, ChevronDown, TriangleExclamationPoint, Undo2 } from "lucide-react";
import type { BasisInput, BenefitEngine, ParentRole } from "../engine/index.js";
import { Collapse } from "./Animations/Collapse.js";

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
        <div className="bc-header-text">
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
          {isOpen ? "Zwiń kalkulator" : "Rozwiń kalkulator"}
          <ChevronDown size={16} className="bc-chev" aria-hidden />
        </button>
      </header>

      <Collapse open={isOpen} id="bc-body">
        <div className="bc-body">
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
                <ChevronDown size={16} className="bc-chev" aria-hidden />
                Dodatkowe sytuacje: premie, poprzedni zasiłek
                {extrasCount > 0 && (
                  <span className="bc-badge">{extrasCount} uzupełnione</span>
                )}
              </button>
              <Collapse open={showExtras} id="bc-extras-body">
                <div className="bc-extras-body">
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
              </Collapse>
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
                  <div className="bc-result-value" key={calc.monthly}>
                    {money(calc.monthly)}
                  </div>
                  <div className="bc-hint">
                    To kwota, od której ZUS wylicza zasiłek – nie sam zasiłek.
                    Procent podstawy i ostateczne kwoty pokażemy w planie
                    poniżej, gdy wybierzesz swoją sytuację.
                  </div>

                  {calc.warning && (
                    <div className="bc-warning" role="note">
                      <TriangleExclamationPoint size={16} aria-hidden />
                      <span>{calc.warning}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="bc-link-btn"
                    onClick={() => setShowRules((v) => !v)}
                    aria-expanded={showRules}
                    aria-controls="bc-rules"
                  >
                    <ChevronDown size={16} className="bc-chev" aria-hidden />
                    Jak to obliczyliśmy?
                  </button>
                  <Collapse open={showRules} id="bc-rules">
                    <div className="bc-rules">
                      <ul>
                        {calc.rules.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                      <div className="bc-hint">
                        Stawka dzienna (1/30 podstawy): {money(calc.daily)}.
                      </div>
                    </div>
                  </Collapse>

                  <div className="bc-actions">
                    <button
                      type="button"
                      className="bc-btn bc-btn-primary"
                      onClick={apply}
                      disabled={alreadyApplied}
                    >
                      {alreadyApplied && <Check size={18} aria-hidden />}
                      {alreadyApplied
                        ? `Ta kwota jest już w planie (${ROLE_LABEL[activeRole].title})`
                        : `Użyj tej kwoty w planie dla: ${ROLE_LABEL[activeRole].title}`}
                    </button>
                  </div>
                </>
              )}

              {applied && (
                <div className="bc-success" role="status">
                  <span>
                    <Check size={16} aria-hidden /> Zapisano {money(applied.value)} w planie dla:{" "}
                    {ROLE_LABEL[applied.role].title}. Oś czasu została
                    zaktualizowana.
                  </span>
                  <button type="button" className="bc-link-btn" onClick={undo}>
                    <Undo2 size={15} aria-hidden /> Cofnij
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Collapse>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Style (dostępność: kontrast, focus, duże pola dotykowe ≥ 44 px)   */
/* ------------------------------------------------------------------ */

const CSS = `
.bc-root{--bc-ease:cubic-bezier(.2,.8,.2,1);
  --bc-ok:#166534;--bc-ok-bg:#f0fdf4;--bc-ok-line:#bbf7d0;--bc-warn:#92400e;--bc-warn-bg:#fffbeb;--bc-warn-line:#fde68a;--bc-err:#991b1b;--bc-err-bg:#fef2f2;--bc-err-line:#fecaca;
  margin-bottom:4px;border:1px solid var(--line);border-radius:10px;background:var(--paper);overflow:hidden;
  color:var(--ink);font-size:16px;line-height:1.5;transition:box-shadow .3s,border-color .3s}
:root[data-theme='dark'] .bc-root{--bc-ok:#bbf7d0;--bc-ok-bg:#0d2418;--bc-ok-line:#166534;--bc-warn:#fde68a;--bc-warn-bg:#2a1d06;--bc-warn-line:#78350f;--bc-err:#fecaca;--bc-err-bg:#2b0d0d;--bc-err-line:#7f1d1d}
.bc-root:has(.bc-header button[aria-expanded="true"]){border-color:color-mix(in srgb,var(--brand) 40%,var(--line));box-shadow:0 12px 28px -20px color-mix(in srgb,var(--brand) 70%,transparent)}
.bc-root *{box-sizing:border-box}
.bc-header{display:flex;align-items:center;flex-wrap:wrap;gap:14px;padding:16px 18px;background:linear-gradient(135deg,var(--brand-soft),color-mix(in srgb,var(--brand-soft) 30%,var(--paper)))}
.bc-header-text{flex:1;min-width:220px}
.bc-title{margin:0;font-size:17px;font-weight:600;color:var(--ink)}
.bc-header-sub{margin:2px 0 0}
.bc-body{padding:20px;border-top:1px solid var(--line)}
.bc-hint{font-size:14px;color:var(--muted)}
.bc-label{display:block;font-weight:600;font-size:15px;margin-bottom:2px}
.bc-optional{font-weight:400;color:var(--muted)}
.bc-step-heading{display:flex;gap:12px;align-items:center;margin:28px 0 12px}
.bc-body>.bc-step-heading:first-child{margin-top:0}
.bc-step-num{flex:none;width:28px;height:28px;border-radius:6px;background:var(--brand-soft);color:var(--brand-ink);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px}
.bc-step-title{margin:0;font-size:16px;font-weight:600}
.bc-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.bc-tab{display:flex;flex-direction:column;gap:2px;text-align:left;padding:14px 16px;min-height:44px;border-radius:8px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font:inherit;color:inherit;transition:background .2s,border-color .2s,box-shadow .2s,transform .2s var(--bc-ease)}
.bc-tab:hover{border-color:var(--muted);transform:translateY(-1px)}
.bc-tab-active,.bc-tab-active:hover{border-color:var(--brand);background:color-mix(in srgb,var(--brand-soft) 60%,var(--paper));box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 15%,transparent)}
.bc-tab-title{font-weight:600}
.bc-tab-sub{font-size:13px;color:var(--muted)}
.bc-tab-saved{font-size:13px;margin-top:4px;font-variant-numeric:tabular-nums}
.bc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.bc-card{position:relative;display:flex;flex-direction:column;gap:2px;padding:14px 16px 14px 46px;border:1px solid var(--line);border-radius:8px;cursor:pointer;min-height:44px;background:var(--paper);transition:background .2s,border-color .2s,box-shadow .2s}
.bc-card:hover{border-color:var(--muted)}
.bc-card input{position:absolute;left:16px;top:17px;width:18px;height:18px;margin:0;accent-color:var(--brand)}
.bc-card-checked,.bc-card-checked:hover{border-color:var(--brand);background:color-mix(in srgb,var(--brand-soft) 60%,var(--paper));box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 15%,transparent)}
.bc-card-title{font-weight:600}
.bc-card-desc{font-size:14px;color:var(--muted)}
.bc-field{margin-bottom:16px}
.bc-input-wrap{position:relative;margin-top:8px;max-width:320px}
.bc-input-wrap input{width:100%;min-height:48px;padding:10px 44px 10px 14px;font:inherit;font-size:17px;font-variant-numeric:tabular-nums;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);transition:border-color .15s,box-shadow .15s}
.bc-input-wrap input:hover{border-color:var(--muted)}
.bc-input-wrap input:focus-visible{outline:none;border-color:var(--brand);box-shadow:0 0 0 4px color-mix(in srgb,var(--brand) 20%,transparent)}
.bc-suffix{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none}
.bc-invalid input{border-color:var(--bc-err);box-shadow:0 0 0 3px color-mix(in srgb,var(--bc-err) 15%,transparent)}
.bc-field-error{color:var(--bc-err);font-size:14px;margin-top:6px;animation:enter var(--enter-duration) var(--ease-enter) backwards}
.bc-help{margin-top:6px;font-size:14px}
.bc-help summary{cursor:pointer;color:var(--brand-ink);font-weight:600;width:fit-content;min-height:24px}
.bc-help[open] p{animation:enter var(--enter-duration) var(--ease-enter) backwards}
.bc-help p{margin:6px 0 0;padding:10px 12px;background:var(--surface);border-radius:6px;color:var(--muted)}
.bc-fieldset{border:none;margin:0 0 8px;padding:0}
.bc-segment{display:inline-flex;gap:4px;margin-top:8px;padding:4px;border:1px solid var(--line);border-radius:6px;background:var(--surface)}
.bc-seg{display:flex;align-items:center;padding:0 16px;min-height:40px;border-radius:6px;cursor:pointer;color:var(--muted);font-weight:500;transition:background .2s,color .2s,box-shadow .2s}
.bc-seg:hover{color:var(--ink)}
.bc-seg input{position:absolute;opacity:0;pointer-events:none}
.bc-seg-checked{background:var(--paper);color:var(--brand-ink);font-weight:600;box-shadow:0 1px 3px rgb(15 23 42/.12),0 0 0 1px var(--line)}
.bc-seg:focus-within{outline:3px solid var(--focus);outline-offset:1px}
.bc-extras{margin:12px 0 4px}
.bc-extras-body{margin-top:6px;padding:16px;border:1px dashed var(--line);border-radius:8px;background:var(--surface)}
.bc-check{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.bc-check input{width:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--brand)}
.bc-badge{margin-left:8px;padding:1px 6px;border-radius:4px;background:var(--brand-soft);color:var(--brand-ink);font-size:12px;animation:bc-pop .3s cubic-bezier(.34,1.56,.64,1) backwards}
.bc-info{padding:10px 14px;margin-bottom:12px;background:var(--brand-soft);color:var(--brand-ink);border-radius:6px;font-size:14px}
.bc-result{margin-top:24px;padding:20px;border-radius:8px;background:var(--surface);border:1px solid var(--line)}
.bc-result-empty{color:var(--muted)}
.bc-result-label{font-size:14px;color:var(--muted)}
.bc-result-value{font-size:34px;font-weight:700;line-height:1.2;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--brand-ink);animation:enter var(--enter-duration) var(--ease-enter) backwards}
.bc-rules ul{margin:0;padding:0;list-style:none}
.bc-rules{margin:2px 0 0;padding:12px 14px;background:var(--paper);border-radius:6px;border:1px solid var(--line);font-size:14px;color:var(--muted)}
.bc-rules li{padding:3px 0}
.bc-warning{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding:10px 14px;border-radius:6px;background:var(--bc-warn-bg);border:1px solid var(--bc-warn-line);color:var(--bc-warn);font-size:14px;animation:enter var(--enter-duration) var(--ease-enter) backwards}
.bc-warning svg{flex:none;margin-top:2px}
.bc-error{padding:10px 14px;border-radius:6px;background:var(--bc-err-bg);border:1px solid var(--bc-err-line);color:var(--bc-err);animation:enter var(--enter-duration) var(--ease-enter) backwards}
.bc-success{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;padding:8px 8px 8px 14px;border-radius:6px;background:var(--bc-ok-bg);border:1px solid var(--bc-ok-line);color:var(--bc-ok);animation:enter var(--enter-duration) var(--ease-enter) backwards}
.bc-success>span{display:inline-flex;align-items:center;gap:6px}
.bc-success .bc-link-btn{color:var(--bc-ok);padding:8px 12px}
.bc-actions{margin-top:16px}
.bc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:10px 18px;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;border:1px solid transparent;transition:background .2s,border-color .2s,transform .15s,box-shadow .2s}
.bc-btn:active:not(:disabled){transform:scale(.98)}
.bc-btn-primary{background:var(--brand);color:#fff;width:100%;box-shadow:0 8px 20px -12px color-mix(in srgb,var(--brand) 80%,transparent)}
.bc-btn-primary:hover:not(:disabled){background:var(--brand-strong)}
.bc-btn-primary:disabled{background:var(--brand-soft);color:var(--brand-ink);box-shadow:none;cursor:default}
.bc-btn-secondary{background:var(--paper);color:var(--brand-ink);border-color:var(--line);min-height:44px}
.bc-btn-secondary:hover{border-color:var(--brand)}
.bc-chev{transition:transform .3s var(--bc-ease)}
[aria-expanded="true"]>.bc-chev{transform:rotate(180deg)}
.bc-link-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:8px 0;min-height:44px;font:inherit;font-weight:600;color:var(--brand-ink);cursor:pointer;text-align:left;border-radius:6px}
.bc-link-btn:hover{text-decoration:underline;text-underline-offset:3px}
.bc-root button:focus-visible,.bc-root input:focus-visible:not(.bc-input-wrap input),.bc-root summary:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.bc-card:focus-within,.bc-card-checked:focus-within{outline:3px solid var(--focus);outline-offset:2px}
@keyframes bc-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@media (max-width:480px){.bc-body{padding:16px}.bc-result-value{font-size:28px}.bc-header .bc-btn{width:100%}}
`;
