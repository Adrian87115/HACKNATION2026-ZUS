/**
 * Turn PUE/eZUS account data into the same shape as an imported case, so the existing case analysis
 * (benefit base from the engine, insurance check, calculator presets) can prefill the calculators.
 */
import type { CaseExtraction } from '../caseImport/caseData';
import type { Account, InsuranceTitle } from './accountApi';

const EMPLOYMENT: Record<InsuranceTitle['type'], CaseExtraction['employment_type']> = {
	umowa_o_prace: 'employee',
	umowa_zlecenia: 'contract',
	dzialalnosc: 'business'
};

/** The title that is active today (or the most recent one). */
export function currentTitle(account: Account, today = new Date().toISOString().slice(0, 10)): InsuranceTitle | null {
	const active = account.insurance.filter((t) => t.from <= today && (!t.to || t.to >= today));
	return active[0] ?? [...account.insurance].sort((a, b) => b.from.localeCompare(a.from))[0] ?? null;
}

export function accountToCase(account: Account): CaseExtraction {
	const title = currentTitle(account);
	const business = title?.type === 'dzialalnosc';
	const pregnant = Boolean(account.family.expectedBirthDate && !account.family.childBirthDate);

	return {
		summary: `Dane z konta PUE/eZUS (symulacja): ${account.person.firstName} ${account.person.lastName}.`,
		documents: [],
		person_role: account.role,
		employment_type: title ? EMPLOYMENT[title.type] : 'unknown',
		insurance_kind: !title ? 'unknown' : title.sickness === 'obowiazkowe' ? 'mandatory' : title.sickness === 'dobrowolne' ? 'voluntary' : 'unknown',
		sickness_insured: title ? title.sickness !== 'brak' : null,
		insurance_start_date: title?.from ?? null,
		insurance_end_date: title?.to ?? null,
		payer_over_20_insured: title?.payer.over20Insured ?? null,
		full_time: title?.fullTime ?? null,
		monthly_basis: null,
		salary_months: account.contributionBases.map((m) => ({
			month: m.month,
			gross_salary: business ? null : m.gross,
			contribution_basis: business ? m.sicknessBasis : null,
			worked_less_than_half: null
		})),
		quarterly_bonuses_last_4_quarters: null,
		annual_bonuses_last_year: null,
		contribution_debt: account.debt.amount,
		event: pregnant ? 'pregnancy' : account.family.childBirthDate ? 'birth' : 'unknown',
		event_date: account.family.childBirthDate,
		expected_birth_date: account.family.expectedBirthDate,
		children_count: 1,
		child_birth_date: null,
		za_zyciem: null,
		combined_application_within_21_days: null,
		leave_periods: [],
		incapacity_periods: account.eZla.map((z) => ({ start_date: z.from, end_date: z.to, pregnancy_code_b: z.pregnancyCodeB })),
		employment_end_date: null,
		job_loss_reason: null,
		zus_decision: null,
		warnings: []
	};
}
