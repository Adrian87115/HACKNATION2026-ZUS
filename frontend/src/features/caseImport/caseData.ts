/**
 * Case import: send the documents of a benefit case to the ZUSia service (Gemini reads them),
 * then turn the extracted data into calculator presets.
 * Mirrors python/case_schemas.py.
 */
import { ZUSIA_API } from '../../config/api';
import type { BenefitEngine, BasisInput } from '../../engine/index';
import type {
	MaternityPreset,
	ParentForm,
	ParentalRow,
	PaternityRow,
	PregnancyPreset
} from '../../pages/Calculators/BareCalculators';

/* ------------------------------------------------------------------ */
/*  Types (python/case_schemas.py)                                     */
/* ------------------------------------------------------------------ */

export type CaseDocument = { type: string; title: string | null; summary: string };
export type SalaryMonth = {
	month: string | null;
	gross_salary: number | null;
	contribution_basis: number | null;
	worked_less_than_half: boolean | null;
};
export type LeavePeriod = {
	type: 'maternity' | 'maternity_conditions' | 'supplementary_maternity' | 'parental' | 'paternity';
	parent: 'mother' | 'father' | 'unknown';
	start_date: string | null;
	end_date: string | null;
	work_fte: number | null;
};
export type IncapacityPeriod = { start_date: string | null; end_date: string | null; pregnancy_code_b: boolean | null };

export type CaseExtraction = {
	summary: string;
	documents: CaseDocument[];
	person_role: 'mother' | 'father' | 'unknown';
	employment_type: 'employee' | 'contract' | 'business' | 'other' | 'unknown';
	insurance_kind: 'mandatory' | 'voluntary' | 'unknown';
	sickness_insured: boolean | null;
	insurance_start_date: string | null;
	insurance_end_date: string | null;
	payer_over_20_insured: boolean | null;
	full_time: boolean | null;
	monthly_basis: number | null;
	salary_months: SalaryMonth[];
	quarterly_bonuses_last_4_quarters: number | null;
	annual_bonuses_last_year: number | null;
	contribution_debt: number | null;
	event: 'birth' | 'adoption' | 'foster' | 'pregnancy' | 'unknown';
	event_date: string | null;
	expected_birth_date: string | null;
	children_count: number | null;
	child_birth_date: string | null;
	za_zyciem: boolean | null;
	combined_application_within_21_days: boolean | null;
	leave_periods: LeavePeriod[];
	incapacity_periods: IncapacityPeriod[];
	employment_end_date: string | null;
	job_loss_reason: 'employer_insolvency' | 'unlawful_termination' | 'other' | null;
	zus_decision: { granted: boolean | null; benefit: string | null; amount: number | null; reason: string | null } | null;
	warnings: string[];
	/** Set when the documents were kept in object storage (MinIO / S3). */
	case_id?: string | null;
	files?: StoredFile[];
};

export type StoredFile = { id: string; name: string; size: number; content_type: string };

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */


export const ACCEPTED_FILE_TYPES = 'application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif';
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function extractCase(files: File[], signal?: AbortSignal): Promise<CaseExtraction> {
	const body = new FormData();
	files.forEach((f) => body.append('files', f, f.name));

	let res: Response;
	try {
		res = await fetch(`${ZUSIA_API}/cases/extract`, { method: 'POST', body, signal });
	} catch (err) {
		if ((err as Error).name === 'AbortError') throw err;
		throw new Error('Nie udało się połączyć z usługą odczytu dokumentów. Sprawdź połączenie i spróbuj ponownie.');
	}
	if (!res.ok) {
		// The service returns Polish, user-facing messages in `detail`; never show raw technical errors.
		const detail = await res
			.json()
			.then((j: { detail?: unknown }) => (typeof j.detail === 'string' ? j.detail : null))
			.catch(() => null);
		throw new Error(detail ?? 'Nie udało się odczytać dokumentów. Spróbuj ponownie za chwilę.');
	}
	return (await res.json()) as CaseExtraction;
}

/** URL of a stored source document (served by the ZUSia API from the private bucket). */
export const caseFileUrl = (caseId: string, fileId: string) =>
	`${ZUSIA_API}/cases/${encodeURIComponent(caseId)}/files/${encodeURIComponent(fileId)}`;

/** Delete a case's stored documents. Best effort – the bucket also expires them automatically. */
export async function deleteCase(caseId: string): Promise<void> {
	try {
		await fetch(`${ZUSIA_API}/cases/${encodeURIComponent(caseId)}`, { method: 'DELETE' });
	} catch {
		/* offline – documents expire via the bucket lifecycle rule */
	}
}

/* ------------------------------------------------------------------ */
/*  Analysis → calculator presets                                     */
/* ------------------------------------------------------------------ */

export type InsuranceStatus = 'insured' | 'not_insured' | 'unknown';
export type CalculatorTarget = 'maternity' | 'pregnancy';

export type CaseAnalysis = {
	insurance: { status: InsuranceStatus; reasons: string[] };
	basis: { monthly: number; source: 'salary' | 'stated'; months: number; rules: string[] } | null;
	target: CalculatorTarget;
	maternity: Partial<MaternityPreset>;
	pregnancy: Partial<PregnancyPreset>;
	/** Data the user should fill in by hand before trusting the result. */
	missing: string[];
};

const DAY_MS = 86_400_000;
const parse = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : NaN);
const daysBetween = (from: string, to: string) => Math.round((parse(to) - parse(from)) / DAY_MS);
const fmtDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const valid = (iso: string | null | undefined): iso is string => Number.isFinite(parse(iso));

function computeBasis(x: CaseExtraction, engine: BenefitEngine): CaseAnalysis['basis'] {
	const months = [...x.salary_months]
		.sort((a, b) => (a.month ?? '').localeCompare(b.month ?? ''))
		.slice(-12);
	const business = x.employment_type === 'business';
	const values = months
		.map((m) => ({ amount: business ? (m.contribution_basis ?? m.gross_salary) : (m.gross_salary ?? m.contribution_basis), half: m.worked_less_than_half }))
		.filter((m): m is { amount: number; half: boolean | null } => typeof m.amount === 'number' && m.amount >= 0);

	if (values.length > 0) {
		try {
			const input: BasisInput = business
				? {
						kind: 'non_employee',
						months: values.map((v) => ({ contributionBasis: v.amount, workedLessThanHalf: v.half ?? undefined }))
					}
				: {
						kind: 'employee',
						months: values.map((v) => ({ grossSalary: v.amount, workedLessThanHalf: v.half ?? undefined })),
						quarterlyBonusesLast4Quarters: x.quarterly_bonuses_last_4_quarters ?? undefined,
						annualBonusesLastYear: x.annual_bonuses_last_year ?? undefined,
						// The minimum-wage floor (Art. 45) only applies to full-time employees.
						fullTime: x.employment_type === 'employee' ? (x.full_time ?? true) : false
					};
			const r = engine.calculateBasis(input);
			return { monthly: r.monthlyBasis, source: 'salary', months: r.monthsCounted, rules: r.appliedRules };
		} catch {
			/* fall back to a stated basis below */
		}
	}
	if (typeof x.monthly_basis === 'number' && x.monthly_basis > 0) {
		return { monthly: x.monthly_basis, source: 'stated', months: 0, rules: ['Podstawa wymiaru podana wprost w dokumentach.'] };
	}
	return null;
}

function insuranceStatus(x: CaseExtraction, keyDate: string | null): CaseAnalysis['insurance'] {
	const reasons: string[] = [];
	if (x.sickness_insured === false) {
		reasons.push('Dokumenty wskazują, że osoba nie podlega ubezpieczeniu chorobowemu.');
		return { status: 'not_insured', reasons };
	}
	if (keyDate && valid(x.insurance_start_date) && parse(keyDate) < parse(x.insurance_start_date)) {
		reasons.push(`Ubezpieczenie zaczęło się ${fmtDate(x.insurance_start_date)} – po dniu ${fmtDate(keyDate)}.`);
		return { status: 'not_insured', reasons };
	}
	if (keyDate && valid(x.insurance_end_date) && parse(keyDate) > parse(x.insurance_end_date)) {
		reasons.push(`Ubezpieczenie ustało ${fmtDate(x.insurance_end_date)} – przed dniem ${fmtDate(keyDate)}.`);
		return { status: 'not_insured', reasons };
	}
	if (x.sickness_insured === true) {
		reasons.push(
			valid(x.insurance_start_date)
				? `Podlega ubezpieczeniu chorobowemu od ${fmtDate(x.insurance_start_date)}.`
				: 'Dokumenty potwierdzają ubezpieczenie chorobowe.'
		);
		if ((x.contribution_debt ?? 0) > 0) reasons.push('Uwaga: w dokumentach jest zadłużenie składkowe – może wstrzymać wypłatę zasiłku.');
		return { status: 'insured', reasons };
	}
	reasons.push('W dokumentach nie ma potwierdzenia ubezpieczenia chorobowego (np. poświadczenia z ZUS).');
	return { status: 'unknown', reasons };
}

const weeksOf = (p: { start_date: string | null; end_date: string | null }) =>
	valid(p.start_date) && valid(p.end_date) ? Math.max(1, Math.round((daysBetween(p.start_date, p.end_date) + 1) / 7)) : null;

export function analyzeCase(x: CaseExtraction, engine: BenefitEngine): CaseAnalysis {
	const params = engine.getParams();
	const missing: string[] = [];
	const basis = computeBasis(x, engine);
	if (!basis) missing.push('Podstawa wymiaru zasiłku – w dokumentach brak wynagrodzeń ani podstawy.');

	const firstMaternity = x.leave_periods.find((l) => l.type === 'maternity' && valid(l.start_date));
	const eventDate = [x.event_date, x.expected_birth_date, firstMaternity?.start_date].find(valid) ?? null;
	const firstIncapacity = x.incapacity_periods.find((p) => valid(p.start_date));

	const target: CalculatorTarget =
		x.event === 'pregnancy' || (x.incapacity_periods.length > 0 && x.leave_periods.length === 0 && !valid(x.event_date))
			? 'pregnancy'
			: 'maternity';

	const keyDate = target === 'pregnancy' ? (firstIncapacity?.start_date ?? eventDate) : eventDate;
	const insurance = insuranceStatus(x, valid(keyDate) ? keyDate : null);

	const person: ParentForm = {
		basis: basis ? String(basis.monthly) : '',
		insured: insurance.status !== 'not_insured',
		isEmployee: x.employment_type === 'employee' || x.employment_type === 'unknown',
		debt: String(x.contribution_debt ?? 0)
	};
	const isFather = x.person_role === 'father';
	const roleOf = (p: LeavePeriod['parent']): 'primary' | 'secondary' =>
		p === 'father' || (p === 'unknown' && isFather) ? 'secondary' : 'primary';

	/* --- urlopy rodzicielskie ---------------------------------------- */
	const maternity: Partial<MaternityPreset> = {
		event: x.event === 'adoption' || x.event === 'foster' ? x.event : 'birth',
		eventDate: eventDate ?? undefined,
		children: x.children_count ? String(x.children_count) : undefined,
		zaZyciem: x.za_zyciem ?? undefined,
		combined: x.combined_application_within_21_days ?? undefined,
		childBirthDate: x.child_birth_date ?? undefined
	};
	if (isFather) {
		maternity.hasP2 = true;
		maternity.p2 = person;
		missing.push('Dane matki (rodzic 1) – dokumenty dotyczą ojca, więc podstawę matki trzeba wpisać ręcznie.');
	} else {
		maternity.p1 = person;
	}

	if (firstMaternity && eventDate && parse(firstMaternity.start_date) < parse(eventDate)) {
		maternity.prenatal = String(Math.min(6, Math.ceil(daysBetween(firstMaternity.start_date!, eventDate) / 7)));
	}

	const fatherMaternity = x.leave_periods.find((l) => l.type === 'maternity' && l.parent === 'father');
	if (fatherMaternity) {
		maternity.hasP2 = true;
		maternity.hasTransfer = true;
		maternity.transfer = { weeks: String(weeksOf(fatherMaternity) ?? 6), circumstance: 'standard' };
	}

	const parental: ParentalRow[] = x.leave_periods
		.filter((l) => l.type === 'parental')
		.map((l) => {
			const fte = Math.min(0.5, Math.max(0, l.work_fte ?? 0));
			const calendarWeeks = weeksOf(l) ?? 1;
			// Combining leave with work stretches it; the pool is consumed by the non-working part only.
			return {
				parent: roleOf(l.parent),
				weeks: String(Math.max(1, Math.round(calendarWeeks * (1 - fte)))),
				fte: String(fte),
				start: l.start_date ?? ''
			};
		});
	const paternity: PaternityRow[] = x.leave_periods
		.filter((l) => l.type === 'paternity')
		.map((l) => ({ weeks: String(weeksOf(l) ?? 2), start: l.start_date ?? '' }));

	if (x.leave_periods.length > 0) {
		maternity.parental = parental;
		maternity.paternity = paternity;
		if (parental.some((p) => p.parent === 'secondary') || paternity.length > 0) maternity.hasP2 = true;
	} else {
		// No leave plan in the documents → show the full entitlement for the person in the case.
		const multiple = (x.children_count ?? 1) > 1;
		const pool = x.za_zyciem
			? multiple
				? params.PARENTAL_WEEKS_MULTIPLE_CHILDREN_ZA_ZYCIEM
				: params.PARENTAL_WEEKS_SINGLE_CHILD_ZA_ZYCIEM
			: multiple
				? params.PARENTAL_WEEKS_MULTIPLE_CHILDREN
				: params.PARENTAL_WEEKS_SINGLE_CHILD;
		maternity.parental = [
			{
				parent: isFather ? 'secondary' : 'primary',
				weeks: String(pool - params.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS),
				fte: '0',
				start: ''
			}
		];
		maternity.paternity = [];
		if (!isFather) maternity.hasP2 = false;
	}
	if (target === 'maternity' && !eventDate) missing.push('Data porodu albo przyjęcia dziecka.');

	/* --- świadczenia w ciąży ----------------------------------------- */
	const incStart = x.incapacity_periods.map((p) => p.start_date).filter(valid).sort()[0];
	const incEnd = x.incapacity_periods.map((p) => p.end_date).filter(valid).sort().at(-1);
	const kind: PregnancyPreset['kind'] =
		x.insurance_kind !== 'unknown' ? x.insurance_kind : x.employment_type === 'employee' ? 'mandatory' : 'voluntary';
	const jobLoss = x.job_loss_reason === 'employer_insolvency' || x.job_loss_reason === 'unlawful_termination';

	const pregnancy: Partial<PregnancyPreset> = {
		basis: person.basis || undefined,
		kind,
		isEmployee: x.employment_type === 'employee',
		insured: insurance.status !== 'not_insured',
		debt: person.debt,
		over20: x.payer_over_20_insured ?? undefined,
		insStart: x.insurance_start_date ?? undefined,
		birth: [x.expected_birth_date, x.event_date].find(valid) ?? undefined,
		hasInc: Boolean(incStart && incEnd),
		incStart,
		incEnd,
		codeB: x.incapacity_periods.some((p) => p.pregnancy_code_b === true) || x.incapacity_periods.every((p) => p.pregnancy_code_b == null),
		hasJob: jobLoss && valid(x.employment_end_date),
		jobEnd: x.employment_end_date ?? undefined,
		jobReason: jobLoss ? (x.job_loss_reason as PregnancyPreset['jobReason']) : undefined
	};
	if (target === 'pregnancy') {
		if (!valid(x.insurance_start_date)) missing.push('Data objęcia ubezpieczeniem chorobowym.');
		if (!incStart && !pregnancy.hasJob) missing.push('Okres zwolnienia lekarskiego (e-ZLA).');
	}

	return { insurance, basis, target, maternity, pregnancy, missing };
}

/* ------------------------------------------------------------------ */
/*  Recent cases (this browser only)                                   */
/* ------------------------------------------------------------------ */

export type StoredCase = { id: string; name: string; createdAt: string; extraction: CaseExtraction };
const STORAGE_KEY = 'zusia.cases';
const MAX_STORED = 8;

export function loadStoredCases(): StoredCase[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as StoredCase[]) : [];
	} catch {
		return [];
	}
}

export function saveStoredCases(cases: StoredCase[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(cases.slice(0, MAX_STORED)));
	} catch {
		/* storage unavailable (private mode) – recent cases simply aren't remembered */
	}
}

export function caseName(files: File[]): string {
	if (files.length === 1) return files[0].name.replace(/\.[^.]+$/, '');
	const n = files.length - 1;
	const few = n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14);
	return `${files[0].name.replace(/\.[^.]+$/, '')} + ${n} ${n === 1 ? 'plik' : few ? 'pliki' : 'plików'}`;
}
