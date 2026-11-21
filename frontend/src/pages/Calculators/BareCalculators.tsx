/**
 * Benefit calculators (engine runs in the browser).
 *  - MaternityCalculator  -> points b, c, d, e, j  (engine.planMaternity)
 *  - PregnancyCalculator  -> point a               (engine.calculatePregnancyBenefits)
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Calculator,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CircleX,
  Code,
  Info,
  Plus,
  Trash,
  TriangleExclamationPoint,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import CaseImport from "../../features/caseImport/CaseImport";
import type {
  CalculatorTarget,
  CaseAnalysis,
} from "../../features/caseImport/caseData";
import {
  BenefitEngine,
  type MaternityPlanInput,
  type MaternityPlanResult,
  type ParentalPartInput,
  type PregnancyBenefitInput,
  type PregnancyBenefitResult,
} from "../../engine/index";

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */
const num = (v: string): number | undefined =>
  v === "" ? undefined : Number(v);
const str = (v: string): string | undefined => (v === "" ? undefined : v);

const fmtMoney = (n: number) =>
  n.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
const fmtDate = (s?: string) =>
  s
    ? new Date(`${s}T00:00:00`).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const fmtPct = (r: number) =>
  `${(r * 100).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function run<I, R>(fn: (i: I) => R, input: I): { result?: R; error?: string } {
  try {
    return { result: fn(input) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/* ================================================================== */
/*  UI primitives                                                      */
/* ================================================================== */
const inputCls =
  "h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink shadow-xs transition " +
  "placeholder:text-muted hover:border-muted/60 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15";

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  suffix,
  min,
  max,
  step = "any",
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step={step}
            min={min}
            max={max}
            placeholder={placeholder}
            className={cx(inputCls, "tabular-nums", suffix && "pr-14")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted">
              {suffix}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}

function DateField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          type="date"
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="relative">
          <select
            id={id}
            className={cx(inputCls, "appearance-none pr-9")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
        </div>
      )}
    </Field>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex w-full flex-wrap gap-1 rounded-md border border-line bg-surface p-0.5"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cx(
                "min-w-fit flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "bg-paper text-brand-ink shadow-sm ring-1 ring-line"
                  : "text-muted hover:bg-hover hover:text-ink",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        )}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cx(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

function SwitchList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line">{children}</div>;
}

function Card({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  /** When provided, the card gets an on/off switch and hides its body when off. */
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  children?: ReactNode;
}) {
  const toggleable = enabled !== undefined && onToggle;
  const open = !toggleable || enabled;
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-paper shadow-sm">
      <header className="flex items-start gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          {description && (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          )}
        </div>
        {toggleable && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={title}
            onClick={() => onToggle(!enabled)}
            className={cx(
              "relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
              enabled ? "bg-brand" : "bg-line",
            )}
          >
            <span
              className={cx(
                "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                enabled ? "translate-x-5.5" : "translate-x-0.5",
              )}
            />
          </button>
        )}
      </header>
      {open && children && (
        <div className="border-t border-line px-5 py-4">{children}</div>
      )}
    </section>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-4 sm:grid-cols-2">{children}</div>
);

function SubPanel({
  title,
  enabled,
  onToggle,
  description,
  children,
}: {
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-md border px-4 transition",
        enabled ? "border-brand/40 bg-brand-soft/40" : "border-line",
      )}
    >
      <Switch
        label={title}
        description={description}
        checked={enabled}
        onChange={onToggle}
      />
      {enabled && <div className="pb-4 pt-1">{children}</div>}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-muted transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-300"
    >
      {children}
    </button>
  );
}

function AddButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-4 py-2.5 text-sm font-medium text-muted transition hover:border-brand hover:bg-brand-soft/50 hover:text-brand-ink disabled:pointer-events-none disabled:opacity-50"
    >
      <Plus className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

/* ================================================================== */
/*  Results                                                            */
/* ================================================================== */
type Tone = "error" | "warning" | "info";
const toneCls: Record<Tone, string> = {
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
};
const toneIcon: Record<Tone, ReactNode> = {
  error: <CircleX className="h-4 w-4" aria-hidden />,
  warning: <TriangleExclamationPoint className="h-4 w-4" aria-hidden />,
  info: <Info className="h-4 w-4" aria-hidden />,
};
const toneTitle: Record<Tone, string> = {
  error: "Błędy",
  warning: "Ostrzeżenia",
  info: "Informacje",
};

function Alert({ tone, items }: { tone: Tone; items: string[] }) {
  if (!items.length) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("rounded-md border px-4 py-3 text-sm", toneCls[tone])}
    >
      <div className="mb-1 flex items-center gap-2 font-semibold">
        {toneIcon[tone]}
        {toneTitle[tone]}
      </div>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-md border p-4",
        emphasis
          ? "border-transparent bg-brand text-white"
          : "border-line bg-surface",
      )}
    >
      <div
        className={cx(
          "text-xs font-medium uppercase tracking-wide",
          emphasis ? "text-white/80" : "text-muted",
        )}
      >
        {label}
      </div>
      <div
        className={cx(
          "mt-1 font-semibold tabular-nums",
          emphasis ? "text-2xl" : "text-lg text-ink",
        )}
      >
        {value}
      </div>
      {sub && (
        <div
          className={cx(
            "mt-0.5 text-xs",
            emphasis ? "text-white/80" : "text-muted",
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function Progress({
  label,
  value,
  max,
  caption,
}: {
  label: string;
  value: number;
  max: number;
  caption: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">{caption}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-sm bg-line"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-sm bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type SegmentView = {
  type: string;
  label: string;
  color: string;
  who?: string;
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  dailyAmount: number;
  monthlyAmount?: number;
  totalAmount: number;
  payable: boolean;
  notPayableReason?: string;
  legalBasis: string;
  extra?: string;
};

function Timeline({ segments }: { segments: SegmentView[] }) {
  const total = segments.reduce((s, x) => s + x.days, 0);
  if (!total) return null;
  const legend = Array.from(
    new Map(segments.map((s) => [s.type, s])).values(),
  );
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-sm">
        {segments.map((s, i) => (
          <div
            key={i}
            title={`${s.label}: ${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`}
            className={cx(s.color, !s.payable && "opacity-35")}
            style={{ flexGrow: s.days, flexBasis: 0, minWidth: 4 }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {legend.map((s) => (
          <span
            key={s.type}
            className="inline-flex items-center gap-1.5 text-xs text-muted"
          >
            <span className={cx("h-2 w-2 rounded-full", s.color)} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SegmentList({ segments }: { segments: SegmentView[] }) {
  return (
    <ol className="space-y-2">
      {segments.map((s, i) => (
        <li
          key={i}
          className={cx(
            "rounded-md border border-line bg-paper p-3",
            !s.payable && "bg-surface",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", s.color)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-ink">
                  {s.label}
                </span>
                {s.who && (
                  <span className="rounded bg-hover px-1.5 py-0.5 text-xs font-medium text-muted">
                    {s.who}
                  </span>
                )}
                {!s.payable && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
                    niewypłacane
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {fmtDate(s.startDate)} – {fmtDate(s.endDate)} · {s.days} dni
                {s.extra && <> · {s.extra}</>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums text-ink">
                {fmtMoney(s.totalAmount)}
              </div>
              <div className="text-xs tabular-nums text-muted">
                {fmtPct(s.rate)}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-5.5 text-xs text-muted">
            {s.monthlyAmount !== undefined && (
              <span>
                Miesięcznie:{" "}
                <b className="font-medium tabular-nums text-ink">
                  {fmtMoney(s.monthlyAmount)}
                </b>
              </span>
            )}
            <span>
              Dziennie:{" "}
              <b className="font-medium tabular-nums text-ink">
                {fmtMoney(s.dailyAmount)}
              </b>
            </span>
          </div>
          {s.notPayableReason && (
            <p className="mt-2 pl-5.5 text-xs text-red-700 dark:text-red-300">
              {s.notPayableReason}
            </p>
          )}
          <p className="mt-1 pl-5.5 text-[11px] text-muted/80">
            {s.legalBasis}
          </p>
        </li>
      ))}
    </ol>
  );
}

function TechDetails({ input, result }: { input: unknown; result?: unknown }) {
  return (
    <details className="group rounded-md border border-line bg-paper">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted hover:text-ink">
        <Code className="h-4 w-4" aria-hidden />
        Dane techniczne
        <ChevronDown
          className="ml-auto h-4 w-4 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-3 border-t border-line p-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Wejście
          </div>
          <pre className="max-h-64 overflow-auto rounded-md bg-surface p-3 text-xs">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
        {result !== undefined && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Wynik
            </div>
            <pre className="max-h-64 overflow-auto rounded-md bg-surface p-3 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

function ResultsPanel({
  hasResult,
  runId,
  children,
}: {
  hasResult: boolean;
  /** Changes on every calculation so the results animate in again. */
  runId: number;
  children?: ReactNode;
}) {
  return (
    <aside
      className="enter space-y-4 lg:sticky lg:top-6"
      style={{ animationDelay: "110ms" }}
    >
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-strong focus-visible:ring-4 focus-visible:ring-brand/25 active:scale-[0.99]"
      >
        <Calculator className="h-5 w-5" aria-hidden />
        {hasResult ? "Przelicz ponownie" : "Oblicz"}
      </button>
      {hasResult ? (
        <div key={runId} className="enter-stagger space-y-4">
          {children}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-line bg-paper px-6 py-8 text-center">
          <h3 className="text-base font-semibold text-ink">
            Tu pojawi się wynik
          </h3>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Uzupełnij dane po lewej stronie i kliknij „Oblicz”, aby zobaczyć
            harmonogram i kwoty świadczeń.
          </p>
        </div>
      )}
    </aside>
  );
}

function ResultCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-line bg-paper p-5 shadow-sm">
      {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
      {children}
    </section>
  );
}

/* ================================================================== */
/*  MATERNITY  (b, c, d, e, j)                                         */
/* ================================================================== */
type ParentRoleStr = "primary" | "secondary";
export type ParentForm = {
  basis: string;
  insured: boolean;
  isEmployee: boolean;
  debt: string;
};
export type ParentalRow = {
  parent: ParentRoleStr;
  weeks: string;
  fte: string;
  start: string;
};
export type PaternityRow = { weeks: string; start: string };

/** Initial values for the calculators (e.g. read from an imported case). All fields optional. */
export type MaternityPreset = {
  event: MaternityPlanInput["event"];
  eventDate: string;
  children: string;
  zaZyciem: boolean;
  combined: boolean;
  childBirthDate: string;
  decreeDate: string;
  p1: ParentForm;
  hasP2: boolean;
  p2: ParentForm;
  prenatal: string;
  hasTransfer: boolean;
  transfer: { weeks: string; circumstance: "standard" | "special" };
  paternity: PaternityRow[];
  parental: ParentalRow[];
};

export type PregnancyPreset = {
  basis: string;
  kind: "mandatory" | "voluntary";
  isEmployee: boolean;
  insured: boolean;
  debt: string;
  over20: boolean;
  insStart: string;
  birth: string;
  hasInc: boolean;
  incStart: string;
  incEnd: string;
  codeB: boolean;
  hasJob: boolean;
  jobEnd: string;
  jobReason: "employer_insolvency" | "unlawful_termination";
};

type CalculatorProps<P> = {
  preset?: Partial<P>;
  /** Calculate immediately on mount (used after importing a case). */
  autoRun?: boolean;
};

/** Run the calculation once on mount when requested. */
function useAutoRun(autoRun: boolean | undefined, runNow: () => void) {
  const ran = useRef(false);
  useEffect(() => {
    if (!autoRun || ran.current) return;
    ran.current = true;
    runNow();
    // runNow reads the initial (preset) state – only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);
}

const PARENT_LABEL: Record<ParentRoleStr, string> = {
  primary: "Rodzic 1",
  secondary: "Rodzic 2",
};
const PARENT_OPTIONS: { value: ParentRoleStr; label: string }[] = [
  { value: "primary", label: "Rodzic 1" },
  { value: "secondary", label: "Rodzic 2" },
];

const MATERNITY_SEGMENT: Record<string, { label: string; color: string }> = {
  maternity: { label: "Urlop macierzyński", color: "bg-emerald-500" },
  maternity_conditions: {
    label: "Urlop na warunkach macierzyńskiego",
    color: "bg-teal-500",
  },
  supplementary_maternity: {
    label: "Uzupełniający urlop macierzyński",
    color: "bg-lime-500",
  },
  parental: { label: "Urlop rodzicielski", color: "bg-sky-500" },
  paternity: { label: "Urlop ojcowski", color: "bg-violet-500" },
};

export function MaternityCalculator({
  preset,
  autoRun,
}: CalculatorProps<MaternityPreset> = {}) {
  const engine = useMemo(() => new BenefitEngine(), []);

  const [event, setEvent] = useState<MaternityPlanInput["event"]>(
    preset?.event ?? "birth",
  );
  const [eventDate, setEventDate] = useState(preset?.eventDate ?? "2026-03-01");
  const [children, setChildren] = useState(preset?.children ?? "1");
  const [zaZyciem, setZaZyciem] = useState(preset?.zaZyciem ?? false);
  const [combined, setCombined] = useState(preset?.combined ?? false);

  const [childBirthDate, setChildBirthDate] = useState(
    preset?.childBirthDate ?? "",
  );
  const [deferredSchool, setDeferredSchool] = useState(false);
  const [decreeDate, setDecreeDate] = useState(preset?.decreeDate ?? "");

  const [p1, setP1] = useState<ParentForm>(
    preset?.p1 ?? { basis: "6000", insured: true, isEmployee: true, debt: "0" },
  );
  const [hasP2, setHasP2] = useState(preset?.hasP2 ?? true);
  const [p2, setP2] = useState<ParentForm>(
    preset?.p2 ?? { basis: "9000", insured: true, isEmployee: true, debt: "0" },
  );

  const [prenatal, setPrenatal] = useState(preset?.prenatal ?? "0");
  const [hasLoss, setHasLoss] = useState(false);
  const [lossDate, setLossDate] = useState("");
  const [lossSurv, setLossSurv] = useState("0");
  const [hasSupp, setHasSupp] = useState(false);
  const [supp, setSupp] = useState({
    gest: "26",
    weight: "900",
    days: "50",
    startDay: "",
    parent: "",
  });
  const [hasTransfer, setHasTransfer] = useState(preset?.hasTransfer ?? false);
  const [transfer, setTransfer] = useState<{
    weeks: string;
    circumstance: "standard" | "special";
  }>(preset?.transfer ?? { weeks: "6", circumstance: "standard" });

  const [paternity, setPaternity] = useState<PaternityRow[]>(
    preset?.paternity ?? [],
  );
  const [parental, setParental] = useState<ParentalRow[]>(
    preset?.parental ?? [
      { parent: "primary", weeks: "32", fte: "0", start: "" },
      { parent: "secondary", weeks: "9", fte: "0", start: "" },
    ],
  );

  const [out, setOut] = useState<ReturnType<typeof compute> | null>(null);
  const [runId, setRunId] = useState(0);

  const isBirth = event === "birth";

  useAutoRun(autoRun, () => {
    setOut(compute());
    setRunId((n) => n + 1);
  });

  function compute() {
    const parentOf = (f: ParentForm) => ({
      monthlyBasis: Number(f.basis),
      insured: f.insured,
      isEmployee: f.isEmployee,
      contributionDebt: num(f.debt),
    });
    const input: MaternityPlanInput = {
      event,
      eventDate,
      childrenCount: Number(children),
      zaZyciem,
      combinedApplicationWithin21Days: combined,
      ...(isBirth
        ? { prenatalWeeks: num(prenatal) }
        : {
            childBirthDate: str(childBirthDate),
            deferredSchoolObligation: deferredSchool,
            adoptionDecreeDate: str(decreeDate),
          }),
      parents: {
        primary: parentOf(p1),
        ...(hasP2 ? { secondary: parentOf(p2) } : {}),
      },
    };
    if (hasLoss)
      input.childLoss = {
        dateOfDeath: str(lossDate),
        survivingChildren: Number(lossSurv),
      };
    if (hasSupp) {
      input.supplementary = {
        gestationWeeks: Number(supp.gest),
        birthWeightGrams: Number(supp.weight),
        hospitalizationDays: Number(supp.days),
        hospitalizationStartDay: num(supp.startDay),
        parent: str(supp.parent) as ParentRoleStr | undefined,
      };
    }
    if (hasTransfer && hasP2) {
      input.maternityTransfer = {
        weeks: Number(transfer.weeks),
        circumstance: transfer.circumstance,
      };
    }
    if (paternity.length)
      input.paternity = paternity.map((r) => ({
        weeks: Number(r.weeks),
        startDate: str(r.start),
      }));
    if (parental.length) {
      input.parentalParts = parental.map(
        (r): ParentalPartInput => ({
          parent: r.parent,
          weeks: Number(r.weeks),
          workFte: num(r.fte),
          startDate: str(r.start),
        }),
      );
    }
    const clean = JSON.parse(JSON.stringify(input)) as MaternityPlanInput; // drop undefined
    return {
      input: clean,
      ...run((i: MaternityPlanInput) => engine.planMaternity(i), clean),
    };
  }

  const setRow = <T,>(
    rows: T[],
    set: (r: T[]) => void,
    i: number,
    patch: Partial<T>,
  ) => set(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setOut(compute());
        setRunId((n) => n + 1);
      }}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]"
    >
      <div
        className="enter-stagger space-y-4"
        style={{ "--enter-offset": "100ms" } as CSSProperties}
      >
        <Card
          title="Zdarzenie"
          description="Narodziny dziecka albo przyjęcie go na wychowanie."
        >
          <div className="space-y-4">
            <Segmented
              label="Rodzaj zdarzenia"
              value={event}
              onChange={setEvent}
              options={[
                { value: "birth", label: "Urodzenie" },
                { value: "adoption", label: "Adopcja" },
                { value: "foster", label: "Rodzina zastępcza" },
              ]}
            />
            <Grid>
              <DateField
                label={isBirth ? "Data porodu" : "Data przyjęcia dziecka"}
                value={eventDate}
                onChange={setEventDate}
              />
              <NumberField
                label="Liczba dzieci"
                hint="Urodzonych przy jednym porodzie / przyjętych jednocześnie"
                value={children}
                onChange={setChildren}
                min={1}
                step="1"
              />
            </Grid>
            <SwitchList>
              <Switch
                label="Zaświadczenie „Za życiem”"
                description="Wydłuża urlop rodzicielski (art. 182¹a § 2 KP)."
                checked={zaZyciem}
                onChange={setZaZyciem}
              />
              <Switch
                label="Wniosek złożony do 21 dni po porodzie"
                description="Jedna stawka 81,5% za urlop macierzyński i rodzicielski."
                checked={combined}
                onChange={setCombined}
              />
            </SwitchList>
          </div>
        </Card>

        {!isBirth && (
          <Card
            title={event === "adoption" ? "Adopcja" : "Rodzina zastępcza"}
            description="Dane wymagane do ustalenia długości urlopu na warunkach macierzyńskiego."
          >
            <div className="space-y-4">
              <Grid>
                <DateField
                  label="Data urodzenia dziecka"
                  value={childBirthDate}
                  onChange={setChildBirthDate}
                />
                {event === "adoption" && (
                  <DateField
                    label="Data uprawomocnienia przysposobienia"
                    value={decreeDate}
                    onChange={setDecreeDate}
                  />
                )}
              </Grid>
              <SwitchList>
                <Switch
                  label="Odroczony obowiązek szkolny"
                  checked={deferredSchool}
                  onChange={setDeferredSchool}
                />
              </SwitchList>
            </div>
          </Card>
        )}

        <Card
          title="Rodzic 1"
          description={
            isBirth ? "Matka dziecka" : "Rodzic, który przyjął dziecko"
          }
        >
          <ParentFields value={p1} onChange={setP1} />
        </Card>

        <Card
          title="Rodzic 2"
          description="Ojciec / drugi rodzic dziecka"
          enabled={hasP2}
          onToggle={setHasP2}
        >
          <ParentFields value={p2} onChange={setP2} />
        </Card>

        <Card
          title="Urlop macierzyński – szczególne sytuacje"
        >
          <div className="space-y-3">
            {isBirth && (
              <NumberField
                label="Tygodnie wykorzystane przed porodem"
                hint="Maksymalnie 6 tygodni"
                value={prenatal}
                onChange={setPrenatal}
                min={0}
                max={6}
                step="1"
                suffix="tyg."
              />
            )}
            <SubPanel
              title="Utrata dziecka"
              description="Urodzenie martwego dziecka lub zgon dziecka."
              enabled={hasLoss}
              onToggle={setHasLoss}
            >
              <Grid>
                <DateField
                  label="Data zgonu"
                  hint="Puste = urodzenie martwego dziecka"
                  value={lossDate}
                  onChange={setLossDate}
                />
                <NumberField
                  label="Liczba żyjących dzieci"
                  value={lossSurv}
                  onChange={setLossSurv}
                  min={0}
                  step="1"
                />
              </Grid>
            </SubPanel>
            <SubPanel
              title="Uzupełniający urlop macierzyński"
              description="Wcześniactwo lub hospitalizacja noworodka."
              enabled={hasSupp}
              onToggle={setHasSupp}
            >
              <Grid>
                <NumberField
                  label="Tydzień ciąży przy porodzie"
                  value={supp.gest}
                  onChange={(v) => setSupp({ ...supp, gest: v })}
                  suffix="tyg."
                />
                <NumberField
                  label="Masa urodzeniowa"
                  value={supp.weight}
                  onChange={(v) => setSupp({ ...supp, weight: v })}
                  suffix="g"
                />
                <NumberField
                  label="Dni hospitalizacji"
                  value={supp.days}
                  onChange={(v) => setSupp({ ...supp, days: v })}
                  suffix="dni"
                />
                <NumberField
                  label="Dzień życia – początek hospitalizacji"
                  value={supp.startDay}
                  onChange={(v) => setSupp({ ...supp, startDay: v })}
                  placeholder="opcjonalnie"
                />
                <SelectField
                  label="Kto korzysta"
                  value={supp.parent}
                  onChange={(v) => setSupp({ ...supp, parent: v })}
                  options={[
                    { value: "", label: "Automatycznie" },
                    ...PARENT_OPTIONS,
                  ]}
                />
              </Grid>
            </SubPanel>
          </div>
        </Card>

        {hasP2 && (
          <Card
            title="Przejęcie urlopu macierzyńskiego"
            description="Część urlopu macierzyńskiego wykorzystuje rodzic 2."
            enabled={hasTransfer}
            onToggle={setHasTransfer}
          >
            <div className="space-y-4">
              <Segmented
                label="Okoliczności"
                value={transfer.circumstance}
                onChange={(v) => setTransfer({ ...transfer, circumstance: v })}
                options={[
                  { value: "standard", label: "Standardowe (po 14 tyg.)" },
                  { value: "special", label: "Szczególne (po 8 tyg.)" },
                ]}
              />
              <NumberField
                label="Liczba przejmowanych tygodni"
                value={transfer.weeks}
                onChange={(v) => setTransfer({ ...transfer, weeks: v })}
                suffix="tyg."
              />
            </div>
          </Card>
        )}

        <Card
          title="Urlop ojcowski"
          description="Maksymalnie 2 części, każda co najmniej 1 tydzień."
        >
          <div className="space-y-3">
            {paternity.map((r, i) => (
              <div
                key={i}
                className="flex items-end gap-3 rounded-md border border-line bg-surface/60 p-3"
              >
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <NumberField
                    label={`Część ${i + 1} – długość`}
                    value={r.weeks}
                    onChange={(v) =>
                      setRow(paternity, setPaternity, i, { weeks: v })
                    }
                    suffix="tyg."
                  />
                  <DateField
                    label="Początek (opcjonalnie)"
                    value={r.start}
                    onChange={(v) =>
                      setRow(paternity, setPaternity, i, { start: v })
                    }
                  />
                </div>
                <IconButton
                  label="Usuń część"
                  onClick={() =>
                    setPaternity(paternity.filter((_, j) => j !== i))
                  }
                >
                  <Trash className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
            <AddButton
              disabled={paternity.length >= 2}
              onClick={() =>
                setPaternity([...paternity, { weeks: "2", start: "" }])
              }
            >
              Dodaj część urlopu ojcowskiego
            </AddButton>
          </div>
        </Card>

        <Card
          title="Urlop rodzicielski"
          description="Do 5 części w kolejności wykorzystania. Praca w trakcie urlopu do 0,5 etatu."
        >
          <div className="space-y-3">
            {parental.map((r, i) => (
              <div
                key={i}
                className="space-y-3 rounded-md border border-line bg-surface/60 p-3"
              >
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Segmented
                      label={`Część ${i + 1}`}
                      value={r.parent}
                      onChange={(v) =>
                        setRow(parental, setParental, i, { parent: v })
                      }
                      options={PARENT_OPTIONS}
                    />
                  </div>
                  <IconButton
                    label="Usuń część"
                    onClick={() =>
                      setParental(parental.filter((_, j) => j !== i))
                    }
                  >
                    <Trash className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField
                    label="Długość"
                    value={r.weeks}
                    onChange={(v) =>
                      setRow(parental, setParental, i, { weeks: v })
                    }
                    suffix="tyg."
                  />
                  <NumberField
                    label="Wymiar pracy"
                    value={r.fte}
                    onChange={(v) =>
                      setRow(parental, setParental, i, { fte: v })
                    }
                    min={0}
                    max={0.5}
                    step="0.05"
                    suffix="etatu"
                  />
                  <DateField
                    label="Początek"
                    value={r.start}
                    onChange={(v) =>
                      setRow(parental, setParental, i, { start: v })
                    }
                  />
                </div>
              </div>
            ))}
            <AddButton
              disabled={parental.length >= 5}
              onClick={() =>
                setParental([
                  ...parental,
                  { parent: "primary", weeks: "10", fte: "0", start: "" },
                ])
              }
            >
              Dodaj część urlopu rodzicielskiego
            </AddButton>
          </div>
        </Card>
      </div>

      <ResultsPanel hasResult={!!out} runId={runId}>
        {out && <MaternityResults {...out} />}
      </ResultsPanel>
    </form>
  );
}

function MaternityResults({
  input,
  result,
  error,
}: {
  input: MaternityPlanInput;
  result?: MaternityPlanResult;
  error?: string;
}) {
  const segments: SegmentView[] = (result?.segments ?? []).map((s) => ({
    ...s,
    label: MATERNITY_SEGMENT[s.type]?.label ?? s.type,
    color: MATERNITY_SEGMENT[s.type]?.color ?? "bg-slate-400",
    who: PARENT_LABEL[s.parent],
    extra: s.workFte ? `praca ${s.workFte} etatu` : undefined,
  }));
  return (
    <>
      {error && <Alert tone="error" items={[error]} />}
      {result && (
        <>
          <ResultCard>
            <Stat
              emphasis
              label="Łącznie do wypłaty"
              value={fmtMoney(result.totals.all)}
              sub={`${segments.reduce((a, s) => a + s.days, 0)} dni świadczeń`}
            />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Rodzic 1" value={fmtMoney(result.totals.primary)} />
              <Stat
                label="Rodzic 2"
                value={fmtMoney(result.totals.secondary)}
              />
            </div>
          </ResultCard>

          <Alert tone="error" items={result.errors} />
          <Alert tone="warning" items={result.warnings} />
          <Alert tone="info" items={result.notes} />

          <ResultCard title="Uprawnienia">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Macierzyński", `${result.entitlements.maternityWeeks} tyg.`],
                [
                  "Uzupełniający",
                  `${result.entitlements.supplementaryWeeks} tyg.`,
                ],
                ["Rodzicielski", `${result.entitlements.parentalWeeks} tyg.`],
                ["Ojcowski", `${result.entitlements.paternityWeeks} tyg.`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md bg-surface px-3 py-2">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-semibold tabular-nums text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <Progress
              label="Wykorzystanie urlopu rodzicielskiego"
              value={
                result.parentalUsage.primaryWeeks +
                result.parentalUsage.secondaryWeeks
              }
              max={result.entitlements.parentalWeeks}
              caption={`pozostało ${result.parentalUsage.remainingWeeks} tyg.`}
            />
          </ResultCard>

          {segments.length > 0 && (
            <ResultCard title="Harmonogram">
              <Timeline segments={segments} />
              <SegmentList segments={segments} />
            </ResultCard>
          )}
        </>
      )}
      <TechDetails input={input} result={result} />
    </>
  );
}

function ParentFields({
  value,
  onChange,
}: {
  value: ParentForm;
  onChange: (v: ParentForm) => void;
}) {
  return (
    <div className="space-y-3">
      <Grid>
        <NumberField
          label="Podstawa wymiaru zasiłku"
          hint="Średnie miesięczne wynagrodzenie brutto po odliczeniu składek"
          value={value.basis}
          onChange={(v) => onChange({ ...value, basis: v })}
          min={0}
          suffix="zł/mies."
        />
        <NumberField
          label="Zadłużenie składkowe"
          hint="Dotyczy m.in. przedsiębiorców"
          value={value.debt}
          onChange={(v) => onChange({ ...value, debt: v })}
          min={0}
          suffix="zł"
        />
      </Grid>
      <SwitchList>
        <Switch
          label="Ubezpieczenie chorobowe"
          description="Podlega ubezpieczeniu w dniu porodu / przyjęcia dziecka."
          checked={value.insured}
          onChange={(v) => onChange({ ...value, insured: v })}
        />
        <Switch
          label="Pracownik (umowa o pracę)"
          description="Tylko pracownik może łączyć urlop rodzicielski z pracą."
          checked={value.isEmployee}
          onChange={(v) => onChange({ ...value, isEmployee: v })}
        />
      </SwitchList>
    </div>
  );
}

/* ================================================================== */
/*  PREGNANCY  (a)                                                     */
/* ================================================================== */
const PREGNANCY_SEGMENT: Record<string, { label: string; color: string }> = {
  waiting_period: { label: "Okres wyczekiwania", color: "bg-slate-400" },
  employer_sick_pay: {
    label: "Wynagrodzenie chorobowe",
    color: "bg-amber-500",
  },
  sickness: { label: "Zasiłek chorobowy", color: "bg-sky-500" },
  period_exhausted: {
    label: "Wyczerpany okres zasiłkowy",
    color: "bg-rose-500",
  },
  maternity_level: {
    label: "Zasiłek w wysokości macierzyńskiego",
    color: "bg-emerald-500",
  },
};
const PAID_BY: Record<string, string> = {
  employer: "Pracodawca",
  payer: "Płatnik",
  zus: "ZUS",
};

export function PregnancyCalculator({
  preset,
  autoRun,
}: CalculatorProps<PregnancyPreset> = {}) {
  const engine = useMemo(() => new BenefitEngine(), []);

  const [basis, setBasis] = useState(preset?.basis ?? "6000");
  const [kind, setKind] = useState<"mandatory" | "voluntary">(
    preset?.kind ?? "mandatory",
  );
  const [isEmployee, setIsEmployee] = useState(preset?.isEmployee ?? true);
  const [insured, setInsured] = useState(preset?.insured ?? true);
  const [debt, setDebt] = useState(preset?.debt ?? "0");
  const [age50, setAge50] = useState(false);
  const [over20, setOver20] = useState(preset?.over20 ?? false);

  const [insStart, setInsStart] = useState(preset?.insStart ?? "2025-01-01");
  const [prevIns, setPrevIns] = useState("0");
  const [waitExempt, setWaitExempt] = useState(false);
  const [empUsed, setEmpUsed] = useState("0");
  const [prevInc, setPrevInc] = useState("0");

  const [birth, setBirth] = useState(preset?.birth ?? "");

  const [hasInc, setHasInc] = useState(preset?.hasInc ?? true);
  const [incStart, setIncStart] = useState(preset?.incStart ?? "2026-03-01");
  const [incEnd, setIncEnd] = useState(preset?.incEnd ?? "2026-04-30");
  const [codeB, setCodeB] = useState(preset?.codeB ?? true);

  const [hasJob, setHasJob] = useState(preset?.hasJob ?? false);
  const [jobEnd, setJobEnd] = useState(preset?.jobEnd ?? "");
  const [jobReason, setJobReason] = useState<
    "employer_insolvency" | "unlawful_termination"
  >(preset?.jobReason ?? "employer_insolvency");

  const [out, setOut] = useState<ReturnType<typeof compute> | null>(null);
  const [runId, setRunId] = useState(0);

  useAutoRun(autoRun, () => {
    setOut(compute());
    setRunId((n) => n + 1);
  });

  function compute() {
    const input: PregnancyBenefitInput = {
      monthlyBasis: Number(basis),
      insuranceKind: kind,
      isEmployee,
      insured,
      contributionDebt: num(debt),
      insuranceStartDate: insStart,
      previousInsuranceDays: num(prevIns),
      waitingPeriodExempt: waitExempt,
      employeeAge50Plus: age50,
      employerSickDaysUsedThisYear: num(empUsed),
      previousIncapacityDaysInPregnancy: num(prevInc),
      payerOver20Insured: over20,
      expectedBirthDate: str(birth),
    };
    if (hasInc)
      input.incapacity = {
        startDate: incStart,
        endDate: incEnd,
        pregnancyCodeB: codeB,
      };
    if (hasJob) {
      input.jobLoss = { employmentEndDate: jobEnd, reason: jobReason };
    }
    const clean = JSON.parse(JSON.stringify(input)) as PregnancyBenefitInput;
    return {
      input: clean,
      ...run(
        (i: PregnancyBenefitInput) => engine.calculatePregnancyBenefits(i),
        clean,
      ),
    };
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setOut(compute());
        setRunId((n) => n + 1);
      }}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]"
    >
      <div
        className="enter-stagger space-y-4"
        style={{ "--enter-offset": "100ms" } as CSSProperties}
      >
        <Card
          title="Osoba ubezpieczona"
        >
          <div className="space-y-4">
            <Segmented
              label="Rodzaj ubezpieczenia chorobowego"
              value={kind}
              onChange={setKind}
              options={[
                { value: "mandatory", label: "Obowiązkowe (np. etat)" },
                { value: "voluntary", label: "Dobrowolne (zlecenie, firma)" },
              ]}
            />
            <Grid>
              <NumberField
                label="Podstawa wymiaru zasiłku"
                value={basis}
                onChange={setBasis}
                min={0}
                suffix="zł/mies."
              />
              <NumberField
                label="Zadłużenie składkowe"
                value={debt}
                onChange={setDebt}
                min={0}
                suffix="zł"
              />
            </Grid>
            <SwitchList>
              <Switch
                label="Ubezpieczenie chorobowe"
                description="Podlega ubezpieczeniu w dniu powstania niezdolności do pracy."
                checked={insured}
                onChange={setInsured}
              />
              <Switch
                label="Pracownik"
                description="Przez pierwsze dni w roku płaci pracodawca."
                checked={isEmployee}
                onChange={setIsEmployee}
              />
              <Switch
                label="Ukończone 50 lat"
                description="Pracodawca płaci 14 dni zamiast 33."
                checked={age50}
                onChange={setAge50}
              />
              <Switch
                label="Płatnik zgłasza ponad 20 osób"
                description="Zasiłek wypłaca płatnik zamiast ZUS."
                checked={over20}
                onChange={setOver20}
              />
            </SwitchList>
          </div>
        </Card>

        <Card
          title="Historia ubezpieczenia"
        >
          <div className="space-y-4">
            <Grid>
              <DateField
                label="Data objęcia ubezpieczeniem"
                value={insStart}
                onChange={setInsStart}
              />
              <NumberField
                label="Wcześniejsze dni ubezpieczenia"
                hint="Wliczane do okresu wyczekiwania"
                value={prevIns}
                onChange={setPrevIns}
                min={0}
                suffix="dni"
              />
              <NumberField
                label="Dni wynagrodzenia chorobowego w tym roku"
                value={empUsed}
                onChange={setEmpUsed}
                min={0}
                suffix="dni"
              />
              <NumberField
                label="Wcześniejsze dni niezdolności w tej ciąży"
                value={prevInc}
                onChange={setPrevInc}
                min={0}
                suffix="dni"
              />
              <DateField
                label="Przewidywana data porodu"
                hint="Od porodu przysługuje zasiłek macierzyński"
                value={birth}
                onChange={setBirth}
              />
            </Grid>
            <SwitchList>
              <Switch
                label="Zwolnienie z okresu wyczekiwania"
                description="Np. absolwent lub ≥ 10 lat ubezpieczenia obowiązkowego."
                checked={waitExempt}
                onChange={setWaitExempt}
              />
            </SwitchList>
          </div>
        </Card>

        <Card
          title="Zwolnienie lekarskie (e-ZLA)"
          enabled={hasInc}
          onToggle={setHasInc}
        >
          <div className="space-y-4">
            <Grid>
              <DateField
                label="Od"
                value={incStart}
                onChange={setIncStart}
              />
              <DateField label="Do" value={incEnd} onChange={setIncEnd} />
            </Grid>
            <SwitchList>
              <Switch
                label="Kod „B” (ciąża)"
                description="Zasiłek 100% zamiast 80%."
                checked={codeB}
                onChange={setCodeB}
              />
            </SwitchList>
          </div>
        </Card>

        <Card
          title="Utrata pracy w ciąży"
          enabled={hasJob}
          onToggle={setHasJob}
        >
          <div className="space-y-4">
            <DateField
              label="Data rozwiązania umowy"
              value={jobEnd}
              onChange={setJobEnd}
            />
            <Segmented
              label="Przyczyna"
              value={jobReason}
              onChange={setJobReason}
              options={[
                {
                  value: "employer_insolvency",
                  label: "Upadłość / likwidacja pracodawcy",
                },
                {
                  value: "unlawful_termination",
                  label: "Niezgodne z prawem zwolnienie",
                },
              ]}
            />
          </div>
        </Card>
      </div>

      <ResultsPanel hasResult={!!out} runId={runId}>
        {out && <PregnancyResults {...out} />}
      </ResultsPanel>
    </form>
  );
}

function PregnancyResults({
  input,
  result,
  error,
}: {
  input: PregnancyBenefitInput;
  result?: PregnancyBenefitResult;
  error?: string;
}) {
  const segments: SegmentView[] = (result?.segments ?? []).map((s) => ({
    ...s,
    label: PREGNANCY_SEGMENT[s.type]?.label ?? s.type,
    color: PREGNANCY_SEGMENT[s.type]?.color ?? "bg-slate-400",
    who: s.paidBy ? PAID_BY[s.paidBy] : undefined,
  }));
  return (
    <>
      {error && <Alert tone="error" items={[error]} />}
      {result && (
        <>
          <ResultCard>
            <div
              className={cx(
                "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium",
                result.entitled
                  ? "bg-brand-soft text-brand-ink"
                  : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
              )}
            >
              {result.entitled ? (
                <CircleCheck className="h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <CircleX className="h-5 w-5 shrink-0" aria-hidden />
              )}
              <span>
                {result.entitled
                  ? "Świadczenie przysługuje"
                  : "Świadczenie nie przysługuje"}
                {result.entitlementFromDate && (
                  <span className="block text-xs font-normal opacity-80">
                    Prawo od {fmtDate(result.entitlementFromDate)}
                  </span>
                )}
              </span>
            </div>
            <Stat
              emphasis
              label="Łącznie"
              value={fmtMoney(result.totals.all)}
              sub={`Podstawa dzienna ${fmtMoney(result.dailyBasis)}`}
            />
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Pracodawca"
                value={fmtMoney(result.totals.employer)}
              />
              <Stat label="Zasiłek" value={fmtMoney(result.totals.benefit)} />
            </div>
            <Progress
              label="Okres zasiłkowy"
              value={result.sicknessPeriod.usedDays}
              max={result.sicknessPeriod.maxDays}
              caption={`${result.sicknessPeriod.usedDays} / ${result.sicknessPeriod.maxDays} dni`}
            />
            {result.sicknessPeriod.exhaustedOn && (
              <p className="text-xs text-muted">
                Wyczerpany {fmtDate(result.sicknessPeriod.exhaustedOn)}
              </p>
            )}
          </ResultCard>

          <Alert tone="error" items={result.errors} />
          <Alert tone="warning" items={result.warnings} />
          <Alert tone="info" items={result.notes} />

          {segments.length > 0 && (
            <ResultCard title="Harmonogram">
              <Timeline segments={segments} />
              <SegmentList segments={segments} />
            </ResultCard>
          )}
        </>
      )}
      <TechDetails input={input} result={result} />
    </>
  );
}

/* ================================================================== */
/*  Default export: both calculators with tabs                         */
/* ================================================================== */
type Tab = "maternity" | "pregnancy";
const TABS: { id: Tab; label: string; sub: string }[] = [
  {
    id: "maternity",
    label: "Urlopy rodzicielskie",
    sub: "Macierzyński, ojcowski i rodzicielski",
  },
  {
    id: "pregnancy",
    label: "Świadczenia w ciąży",
    sub: "Zasiłek chorobowy i wynagrodzenie chorobowe",
  },
];

export default function BareCalculators() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab =
    searchParams.get("tab") === "pregnancy" ? "pregnancy" : "maternity";
  const setTab = (next: Tab) =>
    setSearchParams({ tab: next }, { replace: true });
  const active = TABS.find((t) => t.id === tab)!;

  // Data from an imported case: the matching calculator is re-mounted with it and calculates immediately.
  const [applied, setApplied] = useState<{
    id: number;
    name: string;
    target: Tab;
    maternity: Partial<MaternityPreset>;
    pregnancy: Partial<PregnancyPreset>;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function applyCase(analysis: CaseAnalysis, target: CalculatorTarget, name: string) {
    setApplied({
      id: Date.now(),
      name,
      target,
      maternity: analysis.maternity,
      pregnancy: analysis.pregnancy,
    });
    setTab(target);
    requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  const fromCase = applied && applied.target === tab ? applied : null;

  return (
    <div className="space-y-6">
      <header className="enter space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">
          Kalkulatory świadczeń 2026
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Oblicz swoje świadczenia
        </h1>
        <p className="max-w-2xl text-muted">
          Zaplanuj urlopy związane z rodzicielstwem i sprawdź wysokość
          zasiłków. Wyniki mają charakter informacyjny.
        </p>
      </header>

      <div className="enter" style={{ animationDelay: "60ms" }}>
        <CaseImport onApply={applyCase} />
      </div>

      <div
        ref={panelRef}
        className="enter scroll-mt-24"
        style={{ animationDelay: "100ms" }}
      >
        <div
          role="tablist"
          aria-label="Rodzaj kalkulatora"
          className="flex gap-6 overflow-x-auto border-b border-line"
        >
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                id={`calc-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="calc-panel"
                onClick={() => setTab(t.id)}
                className={cx(
                  "-mb-px whitespace-nowrap border-b-2 px-0.5 pb-3 pt-1 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-brand text-ink"
                    : "border-transparent text-muted hover:border-line hover:text-ink",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">{active.sub}</p>
      </div>

      <div
        id="calc-panel"
        role="tabpanel"
        aria-labelledby={`calc-tab-${tab}`}
        className="space-y-4"
      >
        {fromCase && (
          <div className="enter flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand/40 bg-brand-soft px-4 py-3 text-sm text-brand-ink">
            <p>
              Kalkulator uzupełniony danymi ze sprawy{" "}
              <span className="font-semibold">„{fromCase.name}”</span>. Sprawdź
              pola i w razie potrzeby je popraw.
            </p>
            <button
              type="button"
              onClick={() => setApplied(null)}
              className="rounded-md border border-brand/40 bg-paper px-3 py-1.5 font-semibold transition hover:bg-hover"
            >
              Wyczyść dane sprawy
            </button>
          </div>
        )}
        {tab === "maternity" ? (
          <MaternityCalculator
            key={fromCase ? `case-${fromCase.id}` : "default"}
            preset={fromCase?.maternity}
            autoRun={Boolean(fromCase)}
          />
        ) : (
          <PregnancyCalculator
            key={fromCase ? `case-${fromCase.id}` : "default"}
            preset={fromCase?.pregnancy}
            autoRun={Boolean(fromCase)}
          />
        )}
      </div>
    </div>
  );
}
