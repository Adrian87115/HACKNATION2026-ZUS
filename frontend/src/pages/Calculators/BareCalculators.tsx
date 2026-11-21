"use client";

/**
 * Bare-bone calculator forms (no funnels, just inputs) for the benefit engine.
 *  - MaternityCalculator  -> points b, c, d, e, j  (engine.planMaternity)
 *  - PregnancyCalculator  -> point a               (engine.calculatePregnancyBenefits)
 *
 * The engine runs directly in the browser. Adjust the import path to wherever the
 * engine folder lives (needs index.ts, params.ts, benefits2026.ts, maternityConstants.ts,
 * amounts.ts, leaveDurations.ts, basis.ts, pregnancyBenefits.ts, maternityPlanner.ts, utils.ts).
 * If you prefer the REST API, replace the `engine.*` calls with fetch('/engine/maternity' | '/engine/pregnancy').
 */
import { useMemo, useState } from "react";
import {
  BenefitEngine,
  type MaternityPlanInput,
  type MaternityPlanResult,
  type ParentalPartInput,
  type PregnancyBenefitInput,
  type PregnancyBenefitResult,
} from "../../engine/index";

// ---------- tiny input helpers ----------
const num = (v: string): number | undefined =>
  v === "" ? undefined : Number(v);
const str = (v: string): string | undefined => (v === "" ? undefined : v);

type FieldProps<T> = { label: string; value: T; onChange: (v: T) => void };

const Label = ({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) => (
  <label style={{ display: "inline-block", margin: "3px 14px 3px 0" }}>
    {text} {children}
  </label>
);
const Num = ({ label, value, onChange }: FieldProps<string>) => (
  <Label text={label}>
    <input
      type="number"
      step="any"
      style={{ width: 90 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </Label>
);
const DateIn = ({ label, value, onChange }: FieldProps<string>) => (
  <Label text={label}>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </Label>
);
const Chk = ({ label, value, onChange }: FieldProps<boolean>) => (
  <label style={{ display: "inline-block", margin: "3px 14px 3px 0" }}>
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
    />{" "}
    {label}
  </label>
);
const Sel = ({
  label,
  value,
  onChange,
  options,
}: FieldProps<string> & { options: string[] }) => (
  <Label text={label}>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </Label>
);
const Box = ({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) => (
  <fieldset style={{ margin: "8px 0", padding: "8px 12px" }}>
    <legend style={{ fontWeight: 600 }}>{title}</legend>
    {children}
  </fieldset>
);

// ---------- generic result view ----------
type AnyResult = {
  errors: string[];
  warnings: string[];
  notes: string[];
  segments: object[];
  totals: object;
  entitlements?: object;
  parentalUsage?: object;
  sicknessPeriod?: object;
  entitled?: boolean;
  entitlementFromDate?: string;
};

function Messages({ items, color }: { items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <ul style={{ color }}>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function ResultView({
  input,
  result,
  error,
}: {
  input: unknown;
  result?: AnyResult;
  error?: string;
}) {
  const th: React.CSSProperties = {
    border: "1px solid #aaa",
    padding: "2px 6px",
    fontSize: 12,
  };
  return (
    <div>
      {error && (
        <p style={{ color: "#b00" }}>
          <b>EngineInputError:</b> {error}
        </p>
      )}
      {result && (
        <>
          <Messages items={result.errors} color="#b00" />
          <Messages items={result.warnings} color="#a60" />
          <Messages items={result.notes} color="#05a" />
          {result.entitled !== undefined && (
            <p>
              <b>entitled:</b> {String(result.entitled)} &nbsp;{" "}
              <b>entitlementFromDate:</b> {result.entitlementFromDate}
            </p>
          )}
          {result.entitlements && (
            <pre>{JSON.stringify(result.entitlements, null, 1)}</pre>
          )}
          {result.parentalUsage && (
            <pre>{JSON.stringify(result.parentalUsage)}</pre>
          )}
          {result.sicknessPeriod && (
            <pre>{JSON.stringify(result.sicknessPeriod)}</pre>
          )}
          {result.segments.length > 0 && (
            <table style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {Object.keys(result.segments[0])
                    .filter((k) => k !== "legalBasis")
                    .map((k) => (
                      <th key={k} style={th}>
                        {k}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {result.segments.map((s, i) => (
                  <tr key={i}>
                    {Object.entries(s)
                      .filter(([k]) => k !== "legalBasis")
                      .map(([k, v]) => (
                        <td key={k} style={th}>
                          {String(v ?? "")}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p>
            <b>totals</b>
          </p>
          <pre>{JSON.stringify(result.totals)}</pre>
        </>
      )}
      <details>
        <summary>input sent to engine</summary>
        <pre>{JSON.stringify(input, null, 2)}</pre>
      </details>
      {result && (
        <details>
          <summary>raw result</summary>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

function run<I, R>(fn: (i: I) => R, input: I): { result?: R; error?: string } {
  try {
    return { result: fn(input) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// =====================================================================
// MATERNITY  (b, c, d, e, j)
// =====================================================================
type ParentForm = {
  basis: string;
  insured: boolean;
  isEmployee: boolean;
  debt: string;
};
type ParentalRow = {
  parent: string;
  weeks: string;
  fte: string;
  start: string;
};
type PaternityRow = { weeks: string; start: string };

export function MaternityCalculator() {
  const engine = useMemo(() => new BenefitEngine(), []);

  const [event, setEvent] = useState("birth");
  const [eventDate, setEventDate] = useState("2026-03-01");
  const [children, setChildren] = useState("1");
  const [zaZyciem, setZaZyciem] = useState(false);
  const [combined, setCombined] = useState(false);

  const [childBirthDate, setChildBirthDate] = useState("");
  const [deferredSchool, setDeferredSchool] = useState(false);
  const [decreeDate, setDecreeDate] = useState("");

  const [p1, setP1] = useState<ParentForm>({
    basis: "6000",
    insured: true,
    isEmployee: true,
    debt: "0",
  });
  const [hasP2, setHasP2] = useState(true);
  const [p2, setP2] = useState<ParentForm>({
    basis: "9000",
    insured: true,
    isEmployee: true,
    debt: "0",
  });

  const [prenatal, setPrenatal] = useState("0");
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
  const [hasTransfer, setHasTransfer] = useState(false);
  const [transfer, setTransfer] = useState({
    weeks: "6",
    circumstance: "standard",
  });

  const [paternity, setPaternity] = useState<PaternityRow[]>([]);
  const [parental, setParental] = useState<ParentalRow[]>([
    { parent: "primary", weeks: "32", fte: "0", start: "" },
    { parent: "secondary", weeks: "9", fte: "0", start: "" },
  ]);

  const [out, setOut] = useState<ReturnType<typeof compute> | null>(null);

  function compute() {
    const parentOf = (f: ParentForm) => ({
      monthlyBasis: Number(f.basis),
      insured: f.insured,
      isEmployee: f.isEmployee,
      contributionDebt: num(f.debt),
    });
    const input: MaternityPlanInput = {
      event: event as MaternityPlanInput["event"],
      eventDate,
      childrenCount: Number(children),
      zaZyciem,
      combinedApplicationWithin21Days: combined,
      childBirthDate: str(childBirthDate),
      deferredSchoolObligation: deferredSchool,
      adoptionDecreeDate: str(decreeDate),
      prenatalWeeks: num(prenatal),
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
        parent: str(supp.parent) as "primary" | "secondary" | undefined,
      };
    }
    if (hasTransfer) {
      input.maternityTransfer = {
        weeks: Number(transfer.weeks),
        circumstance: transfer.circumstance as "standard" | "special",
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
          parent: r.parent as "primary" | "secondary",
          weeks: Number(r.weeks),
          workFte: num(r.fte),
          startDate: str(r.start),
        }),
      );
    }
    const clean = JSON.parse(JSON.stringify(input)) as MaternityPlanInput; // drop undefined
    return {
      input: clean,
      ...run(
        (i: MaternityPlanInput) =>
          engine.planMaternity(i) as MaternityPlanResult,
        clean,
      ),
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
      }}
    >
      <Box title="Event">
        <Sel
          label="event"
          value={event}
          onChange={setEvent}
          options={["birth", "adoption", "foster"]}
        />
        <DateIn
          label="eventDate (birth / placement)"
          value={eventDate}
          onChange={setEventDate}
        />
        <Num label="childrenCount" value={children} onChange={setChildren} />
        <Chk label="zaZyciem" value={zaZyciem} onChange={setZaZyciem} />
        <Chk
          label="combinedApplicationWithin21Days"
          value={combined}
          onChange={setCombined}
        />
      </Box>

      <Box title="Adoption / foster only">
        <DateIn
          label="childBirthDate"
          value={childBirthDate}
          onChange={setChildBirthDate}
        />
        <Chk
          label="deferredSchoolObligation"
          value={deferredSchool}
          onChange={setDeferredSchool}
        />
        <DateIn
          label="adoptionDecreeDate"
          value={decreeDate}
          onChange={setDecreeDate}
        />
      </Box>

      <Box title="Parent 1 (primary: mother / adopting parent)">
        <ParentFields value={p1} onChange={setP1} />
      </Box>

      <Box
        title={
          <Chk
            label="Parent 2 (secondary: father / other parent)"
            value={hasP2}
            onChange={setHasP2}
          />
        }
      >
        {hasP2 && <ParentFields value={p2} onChange={setP2} />}
      </Box>

      <Box title="Maternity leave options (birth)">
        <Num
          label="prenatalWeeks (0-6)"
          value={prenatal}
          onChange={setPrenatal}
        />
        <div>
          <Chk label="childLoss" value={hasLoss} onChange={setHasLoss} />
          {hasLoss && (
            <>
              <DateIn
                label="dateOfDeath (empty = stillbirth)"
                value={lossDate}
                onChange={setLossDate}
              />
              <Num
                label="survivingChildren"
                value={lossSurv}
                onChange={setLossSurv}
              />
            </>
          )}
        </div>
        <div>
          <Chk
            label="supplementary leave"
            value={hasSupp}
            onChange={setHasSupp}
          />
          {hasSupp && (
            <>
              <Num
                label="gestationWeeks"
                value={supp.gest}
                onChange={(v) => setSupp({ ...supp, gest: v })}
              />
              <Num
                label="birthWeightGrams"
                value={supp.weight}
                onChange={(v) => setSupp({ ...supp, weight: v })}
              />
              <Num
                label="hospitalizationDays"
                value={supp.days}
                onChange={(v) => setSupp({ ...supp, days: v })}
              />
              <Num
                label="hospitalizationStartDay"
                value={supp.startDay}
                onChange={(v) => setSupp({ ...supp, startDay: v })}
              />
              <Sel
                label="parent"
                value={supp.parent}
                onChange={(v) => setSupp({ ...supp, parent: v })}
                options={["", "primary", "secondary"]}
              />
            </>
          )}
        </div>
      </Box>

      <Box
        title={
          <Chk
            label="Maternity transfer to parent 2"
            value={hasTransfer}
            onChange={setHasTransfer}
          />
        }
      >
        {hasTransfer && (
          <>
            <Num
              label="weeks"
              value={transfer.weeks}
              onChange={(v) => setTransfer({ ...transfer, weeks: v })}
            />
            <Sel
              label="circumstance"
              value={transfer.circumstance}
              onChange={(v) => setTransfer({ ...transfer, circumstance: v })}
              options={["standard", "special"]}
            />
          </>
        )}
      </Box>

      <Box title="Paternity leave parts (parent 2)">
        {paternity.map((r, i) => (
          <div key={i}>
            <Num
              label="weeks"
              value={r.weeks}
              onChange={(v) => setRow(paternity, setPaternity, i, { weeks: v })}
            />
            <DateIn
              label="startDate"
              value={r.start}
              onChange={(v) => setRow(paternity, setPaternity, i, { start: v })}
            />
            <button
              type="button"
              onClick={() => setPaternity(paternity.filter((_, j) => j !== i))}
            >
              remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPaternity([...paternity, { weeks: "2", start: "" }])
          }
        >
          + part
        </button>
      </Box>

      <Box title="Parental leave parts (max 5)">
        {parental.map((r, i) => (
          <div key={i}>
            <Sel
              label="parent"
              value={r.parent}
              onChange={(v) => setRow(parental, setParental, i, { parent: v })}
              options={["primary", "secondary"]}
            />
            <Num
              label="weeks"
              value={r.weeks}
              onChange={(v) => setRow(parental, setParental, i, { weeks: v })}
            />
            <Num
              label="workFte (0-0.5)"
              value={r.fte}
              onChange={(v) => setRow(parental, setParental, i, { fte: v })}
            />
            <DateIn
              label="startDate"
              value={r.start}
              onChange={(v) => setRow(parental, setParental, i, { start: v })}
            />
            <button
              type="button"
              onClick={() => setParental(parental.filter((_, j) => j !== i))}
            >
              remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setParental([
              ...parental,
              { parent: "primary", weeks: "10", fte: "0", start: "" },
            ])
          }
        >
          + part
        </button>
      </Box>

      <button type="submit">Calculate</button>
      {out && (
        <ResultView
          input={out.input}
          result={out.result as AnyResult | undefined}
          error={out.error}
        />
      )}
    </form>
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
    <>
      <Num
        label="monthlyBasis"
        value={value.basis}
        onChange={(v) => onChange({ ...value, basis: v })}
      />
      <Chk
        label="insured"
        value={value.insured}
        onChange={(v) => onChange({ ...value, insured: v })}
      />
      <Chk
        label="isEmployee"
        value={value.isEmployee}
        onChange={(v) => onChange({ ...value, isEmployee: v })}
      />
      <Num
        label="contributionDebt"
        value={value.debt}
        onChange={(v) => onChange({ ...value, debt: v })}
      />
    </>
  );
}

// =====================================================================
// PREGNANCY  (a)
// =====================================================================
export function PregnancyCalculator() {
  const engine = useMemo(() => new BenefitEngine(), []);

  const [basis, setBasis] = useState("6000");
  const [kind, setKind] = useState("mandatory");
  const [isEmployee, setIsEmployee] = useState(true);
  const [insured, setInsured] = useState(true);
  const [debt, setDebt] = useState("0");
  const [age50, setAge50] = useState(false);
  const [over20, setOver20] = useState(false);

  const [insStart, setInsStart] = useState("2025-01-01");
  const [prevIns, setPrevIns] = useState("0");
  const [waitExempt, setWaitExempt] = useState(false);
  const [empUsed, setEmpUsed] = useState("0");
  const [prevInc, setPrevInc] = useState("0");

  const [birth, setBirth] = useState("");

  const [hasInc, setHasInc] = useState(true);
  const [incStart, setIncStart] = useState("2026-03-01");
  const [incEnd, setIncEnd] = useState("2026-04-30");
  const [codeB, setCodeB] = useState(true);

  const [hasJob, setHasJob] = useState(false);
  const [jobEnd, setJobEnd] = useState("");
  const [jobReason, setJobReason] = useState("employer_insolvency");

  const [out, setOut] = useState<ReturnType<typeof compute> | null>(null);

  function compute() {
    const input: PregnancyBenefitInput = {
      monthlyBasis: Number(basis),
      insuranceKind: kind as "mandatory" | "voluntary",
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
      input.jobLoss = {
        employmentEndDate: jobEnd,
        reason: jobReason as "employer_insolvency" | "unlawful_termination",
      };
    }
    const clean = JSON.parse(JSON.stringify(input)) as PregnancyBenefitInput;
    return {
      input: clean,
      ...run(
        (i: PregnancyBenefitInput) =>
          engine.calculatePregnancyBenefits(i) as PregnancyBenefitResult,
        clean,
      ),
    };
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setOut(compute());
      }}
    >
      <Box title="Insured person">
        <Num label="monthlyBasis" value={basis} onChange={setBasis} />
        <Sel
          label="insuranceKind"
          value={kind}
          onChange={setKind}
          options={["mandatory", "voluntary"]}
        />
        <Chk label="isEmployee" value={isEmployee} onChange={setIsEmployee} />
        <Chk label="insured" value={insured} onChange={setInsured} />
        <Num label="contributionDebt" value={debt} onChange={setDebt} />
        <Chk label="employeeAge50Plus" value={age50} onChange={setAge50} />
        <Chk label="payerOver20Insured" value={over20} onChange={setOver20} />
      </Box>

      <Box title="Insurance history">
        <DateIn
          label="insuranceStartDate"
          value={insStart}
          onChange={setInsStart}
        />
        <Num
          label="previousInsuranceDays"
          value={prevIns}
          onChange={setPrevIns}
        />
        <Chk
          label="waitingPeriodExempt"
          value={waitExempt}
          onChange={setWaitExempt}
        />
        <Num
          label="employerSickDaysUsedThisYear"
          value={empUsed}
          onChange={setEmpUsed}
        />
        <Num
          label="previousIncapacityDaysInPregnancy"
          value={prevInc}
          onChange={setPrevInc}
        />
      </Box>

      <Box title="Dates">
        <DateIn label="expectedBirthDate" value={birth} onChange={setBirth} />
      </Box>

      <Box
        title={
          <Chk label="e-ZLA incapacity" value={hasInc} onChange={setHasInc} />
        }
      >
        {hasInc && (
          <>
            <DateIn label="startDate" value={incStart} onChange={setIncStart} />
            <DateIn label="endDate" value={incEnd} onChange={setIncEnd} />
            <Chk label="pregnancyCodeB" value={codeB} onChange={setCodeB} />
          </>
        )}
      </Box>

      <Box
        title={
          <Chk
            label="Job loss during pregnancy"
            value={hasJob}
            onChange={setHasJob}
          />
        }
      >
        {hasJob && (
          <>
            <DateIn
              label="employmentEndDate"
              value={jobEnd}
              onChange={setJobEnd}
            />
            <Sel
              label="reason"
              value={jobReason}
              onChange={setJobReason}
              options={["employer_insolvency", "unlawful_termination"]}
            />
          </>
        )}
      </Box>

      <button type="submit">Calculate</button>
      {out && (
        <ResultView
          input={out.input}
          result={out.result as AnyResult | undefined}
          error={out.error}
        />
      )}
    </form>
  );
}

// =====================================================================
// Default export: both calculators with tabs
// =====================================================================
export default function BareCalculators() {
  const [tab, setTab] = useState<"maternity" | "pregnancy">("maternity");
  return (
    <div
      style={{
        font: "14px/1.4 system-ui, sans-serif",
        maxWidth: 1100,
        margin: 12,
      }}
    >
      <nav>
        <button
          type="button"
          style={{ fontWeight: tab === "maternity" ? 700 : 400 }}
          onClick={() => setTab("maternity")}
        >
          Maternity (b, c, d, e, j)
        </button>
        <button
          type="button"
          style={{ fontWeight: tab === "pregnancy" ? 700 : 400 }}
          onClick={() => setTab("pregnancy")}
        >
          Pregnancy (a)
        </button>
      </nav>
      {tab === "maternity" ? <MaternityCalculator /> : <PregnancyCalculator />}
    </div>
  );
}
