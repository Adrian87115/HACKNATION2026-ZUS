/** Labels, grouping and units of engine parameters for the admin panel. Unknown keys land in „Pozostałe”. */

export type ParamKind = 'percent' | 'money' | 'weeks' | 'days' | 'day' | 'months' | 'years' | 'grams' | 'count' | 'year' | 'table';

export type ParamMeta = { key: string; label: string; hint?: string };
export type ParamGroup = { id: string; title: string; description: string; params: ParamMeta[] };

export const PARAM_GROUPS: ParamGroup[] = [
	{
		id: 'stawki',
		title: 'Stawki zasiłków',
		description: 'Procent podstawy wymiaru, od którego liczony jest zasiłek (Art. 11, 31 ustawy zasiłkowej).',
		params: [
			{ key: 'RATE_FULL', label: 'Urlop macierzyński, ojcowski i uzupełniający' },
			{ key: 'RATE_COMBINED_21_DAYS', label: 'Wniosek złożony do 21 dni po porodzie', hint: 'Jedna stawka za cały urlop macierzyński i rodzicielski.' },
			{ key: 'RATE_PARENTAL_70', label: 'Urlop rodzicielski' },
			{ key: 'RATE_SICKNESS_PREGNANCY', label: 'Zasiłek chorobowy w ciąży (kod „B”)' },
			{ key: 'RATE_SICKNESS_STANDARD', label: 'Zasiłek chorobowy bez kodu „B”' },
			{ key: 'RATE_REHABILITATION_PREGNANCY', label: 'Świadczenie rehabilitacyjne w ciąży' }
		]
	},
	{
		id: 'kwoty',
		title: 'Kwoty i wskaźniki',
		description: 'Wartości makroekonomiczne na dany rok – aktualizuj je przy zmianie przepisów.',
		params: [
			{ key: 'YEAR', label: 'Rok obowiązywania parametrów' },
			{ key: 'MIN_WAGE_2026_GROSS', label: 'Płaca minimalna brutto' },
			{
				key: 'MIN_FULL_TIME_BASIS_2026',
				label: 'Minimalna podstawa przy pełnym etacie',
				hint: 'Płaca minimalna pomniejszona o składki pracownika – zaktualizuj razem z płacą minimalną.'
			},
			{ key: 'SOCIAL_CONTRIBUTION_RATE', label: 'Składki pracownika odliczane od podstawy' },
			{ key: 'PARENTAL_BENEFIT_FLOOR_MONTHLY', label: 'Minimalny miesięczny zasiłek macierzyński', hint: 'Kwota świadczenia rodzicielskiego (Art. 31 ust. 3a).' },
			{ key: 'MAX_NON_EMPLOYEE_MONTHLY_CONTRIBUTION_BASIS_2026', label: 'Maks. podstawa składki – osoby niebędące pracownikami' },
			{ key: 'MAX_NON_EMPLOYEE_BENEFIT_BASIS_2026', label: 'Maks. podstawa zasiłku – osoby niebędące pracownikami' },
			{ key: 'DEBT_EXCLUSION_MIN_WAGE_RATIO', label: 'Dopuszczalne zadłużenie składkowe (część płacy minimalnej)', hint: 'Art. 2a.' },
			{ key: 'STATUTORY_MONTH_DAYS', label: 'Dni w miesiącu do stawki dziennej' },
			{ key: 'BASIS_MONTHS_COUNT', label: 'Liczba miesięcy do ustalenia podstawy' },
			{ key: 'MIN_MONTH_WORKED_RATIO', label: 'Minimalny przepracowany czas w miesiącu' }
		]
	},
	{
		id: 'macierzynski',
		title: 'Urlop macierzyński',
		description: 'Wymiar urlopu macierzyńskiego i jego szczególne przypadki (Art. 180–180¹ KP).',
		params: [
			{ key: 'MATERNITY_WEEKS_BY_CHILDREN', label: 'Wymiar urlopu według liczby dzieci urodzonych przy jednym porodzie' },
			{ key: 'MATERNITY_MAX_PRENATAL_WEEKS', label: 'Maks. część urlopu przed porodem' },
			{ key: 'MOTHER_MIN_POSTPARTUM_WEEKS_STANDARD', label: 'Część, którą matka wykorzystuje osobiście' },
			{ key: 'MOTHER_MIN_POSTPARTUM_WEEKS_SPECIAL', label: 'Część wykorzystywana osobiście – sytuacje szczególne' },
			{ key: 'COMBINED_APPLICATION_DEADLINE_DAYS', label: 'Termin na wniosek o stawkę łączną' },
			{ key: 'CHILD_LOSS_MATERNITY_WEEKS', label: 'Urlop po stracie dziecka' },
			{ key: 'CHILD_LOSS_MIN_DAYS_AFTER_DEATH', label: 'Minimalny okres od zgonu dziecka' }
		]
	},
	{
		id: 'uzupelniajacy',
		title: 'Uzupełniający urlop macierzyński',
		description: 'Wcześniaki i hospitalizacja noworodka (Art. 180² KP).',
		params: [
			{ key: 'PRETERM_EXTREME_GESTATION_WEEKS_LIMIT', label: 'Skrajne wcześniactwo – poród przed tygodniem ciąży' },
			{ key: 'PRETERM_EXTREME_WEIGHT_GRAMS_LIMIT', label: 'Skrajne wcześniactwo – masa urodzeniowa do' },
			{ key: 'PRETERM_EXTREME_MAX_WEEKS', label: 'Maks. urlop – skrajne wcześniactwo' },
			{ key: 'PRETERM_MODERATE_GESTATION_WEEKS_LIMIT', label: 'Wcześniactwo – poród przed tygodniem ciąży' },
			{ key: 'STANDARD_SUPPLEMENTARY_MAX_WEEKS', label: 'Maks. urlop – pozostałe przypadki' },
			{ key: 'TERM_HOSPITAL_MIN_CONSECUTIVE_DAYS', label: 'Minimalny pobyt w szpitalu' },
			{ key: 'TERM_HOSPITAL_WINDOW_START_DAY', label: 'Okno hospitalizacji – od dnia życia' },
			{ key: 'TERM_HOSPITAL_WINDOW_END_DAY', label: 'Okno hospitalizacji – do dnia życia' }
		]
	},
	{
		id: 'rodzicielski',
		title: 'Urlop rodzicielski',
		description: 'Wymiar, podział i łączenie z pracą (Art. 182¹a–182¹f KP).',
		params: [
			{ key: 'PARENTAL_WEEKS_SINGLE_CHILD', label: 'Wymiar – jedno dziecko' },
			{ key: 'PARENTAL_WEEKS_MULTIPLE_CHILDREN', label: 'Wymiar – więcej dzieci' },
			{ key: 'PARENTAL_WEEKS_SINGLE_CHILD_ZA_ZYCIEM', label: 'Wymiar – jedno dziecko, „Za życiem”' },
			{ key: 'PARENTAL_WEEKS_MULTIPLE_CHILDREN_ZA_ZYCIEM', label: 'Wymiar – więcej dzieci, „Za życiem”' },
			{ key: 'SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS', label: 'Część zarezerwowana dla każdego z rodziców' },
			{ key: 'PARENTAL_MAX_PARTS', label: 'Maks. liczba części' },
			{ key: 'PARENTAL_DEADLINE_CHILD_AGE_YEARS', label: 'Do końca roku, w którym dziecko kończy' },
			{ key: 'MAX_WORK_FTE_DURING_PARENTAL', label: 'Maks. wymiar pracy w trakcie urlopu' },
			{ key: 'MAX_EXTENDED_PARENTAL_WEEKS_SINGLE', label: 'Maks. wydłużony urlop – jedno dziecko' },
			{ key: 'MAX_EXTENDED_PARENTAL_WEEKS_MULTIPLE', label: 'Maks. wydłużony urlop – więcej dzieci' },
			{ key: 'MAX_EXTENDED_PARENTAL_WEEKS_SINGLE_ZA_ZYCIEM', label: 'Maks. wydłużony urlop – jedno dziecko, „Za życiem”' },
			{ key: 'MAX_EXTENDED_PARENTAL_WEEKS_MULTIPLE_ZA_ZYCIEM', label: 'Maks. wydłużony urlop – więcej dzieci, „Za życiem”' }
		]
	},
	{
		id: 'ojcowski',
		title: 'Urlop ojcowski',
		description: 'Art. 182³ KP.',
		params: [
			{ key: 'PATERNITY_TOTAL_WEEKS', label: 'Wymiar urlopu ojcowskiego' },
			{ key: 'PATERNITY_MAX_PARTS', label: 'Maks. liczba części' },
			{ key: 'PATERNITY_MIN_PART_WEEKS', label: 'Minimalna długość części' },
			{ key: 'PATERNITY_MAX_CHILD_AGE_MONTHS_BIRTH', label: 'Do ukończenia przez dziecko' },
			{ key: 'PATERNITY_MONTHS_FROM_ADOPTION_DECREE', label: 'Adopcja – od uprawomocnienia przysposobienia' },
			{ key: 'PATERNITY_MAX_CHILD_AGE_YEARS_ADOPTION', label: 'Adopcja – maks. wiek dziecka' }
		]
	},
	{
		id: 'adopcja',
		title: 'Adopcja i rodzina zastępcza',
		description: 'Urlop na warunkach urlopu macierzyńskiego (Art. 183 KP).',
		params: [
			{ key: 'ADOPTION_MAX_CHILD_AGE_YEARS', label: 'Przysposobienie – maks. wiek dziecka' },
			{ key: 'FOSTER_MAX_CHILD_AGE_YEARS', label: 'Rodzina zastępcza – maks. wiek dziecka' },
			{ key: 'FOSTER_DEFERRED_SCHOOL_MAX_CHILD_AGE_YEARS', label: 'Rodzina zastępcza – przy odroczonym obowiązku szkolnym' },
			{ key: 'ADOPTION_FOSTER_MIN_GUARANTEED_MATERNITY_WEEKS', label: 'Gwarantowany minimalny urlop' },
			{ key: 'PARENTAL_WEEKS_ADOPTION_FLOOR_CASE', label: 'Urlop rodzicielski – przypadek minimalny' },
			{ key: 'PARENTAL_WEEKS_ADOPTION_FLOOR_CASE_ZA_ZYCIEM', label: 'Urlop rodzicielski – przypadek minimalny, „Za życiem”' }
		]
	},
	{
		id: 'chorobowy',
		title: 'Zasiłek chorobowy w ciąży',
		description: 'Okres wyczekiwania, wynagrodzenie chorobowe i okres zasiłkowy (Art. 4, 8 ustawy, Art. 92 KP).',
		params: [
			{ key: 'SICKNESS_WAITING_DAYS_MANDATORY', label: 'Okres wyczekiwania – ubezpieczenie obowiązkowe' },
			{ key: 'SICKNESS_WAITING_DAYS_VOLUNTARY', label: 'Okres wyczekiwania – ubezpieczenie dobrowolne' },
			{ key: 'EMPLOYER_SICK_PAY_DAYS_PER_YEAR', label: 'Wynagrodzenie chorobowe od pracodawcy (w roku)' },
			{ key: 'EMPLOYER_SICK_PAY_DAYS_PER_YEAR_50_PLUS', label: 'Wynagrodzenie chorobowe – pracownik po 50. r.ż.' },
			{ key: 'SICKNESS_PERIOD_MAX_DAYS_PREGNANCY', label: 'Okres zasiłkowy w ciąży' },
			{ key: 'REHABILITATION_MAX_MONTHS', label: 'Maks. świadczenie rehabilitacyjne' }
		]
	}
];

export function kindOf(key: string): ParamKind {
	if (key === 'MATERNITY_WEEKS_BY_CHILDREN') return 'table';
	if (key === 'YEAR') return 'year';
	if (/^RATE_|_RATE$|_RATIO$|_FTE_/.test(key)) return 'percent';
	if (/GROSS|_BASIS_|FLOOR_MONTHLY/.test(key)) return 'money';
	if (/GRAMS/.test(key)) return 'grams';
	if (/WEEKS/.test(key)) return 'weeks';
	if (/_DAY$/.test(key)) return 'day';
	if (/DAYS/.test(key)) return 'days';
	if (/MONTHS/.test(key)) return 'months';
	if (/YEARS/.test(key)) return 'years';
	return 'count';
}

export const UNIT: Record<ParamKind, string> = {
	percent: '%',
	money: 'zł',
	weeks: 'tyg.',
	days: 'dni',
	day: 'dzień',
	months: 'mies.',
	years: 'lat',
	grams: 'g',
	count: '',
	year: '',
	table: 'tyg.'
};

/** Value shown in an input (percent as 0–100). */
export function toInput(key: string, value: unknown): string {
	if (typeof value !== 'number') return '';
	return kindOf(key) === 'percent' ? String(Math.round(value * 100 * 1000) / 1000) : String(value);
}

/** Value sent to the API (percent back to 0–1). NaN when not a number. */
export function fromInput(key: string, text: string): number {
	const n = Number(text.replace(',', '.').trim());
	if (text.trim() === '' || !Number.isFinite(n)) return Number.NaN;
	return kindOf(key) === 'percent' ? Math.round((n / 100) * 1e6) / 1e6 : n;
}

export function formatValue(key: string, value: unknown): string {
	if (value && typeof value === 'object') {
		return Object.entries(value as Record<string, number>)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
	}
	if (typeof value !== 'number') return String(value);
	const kind = kindOf(key);
	if (kind === 'percent') return `${(value * 100).toLocaleString('pl-PL', { maximumFractionDigits: 3 })}%`;
	if (kind === 'money') return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
	const unit = UNIT[kind];
	return unit ? `${value} ${unit}` : String(value);
}

export const labelOf = (key: string): string =>
	PARAM_GROUPS.flatMap((g) => g.params).find((p) => p.key === key)?.label ?? key;
