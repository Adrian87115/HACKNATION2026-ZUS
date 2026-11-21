/**
 * Section (h) of the brief: risks of losing the right to benefits or of a lower benefit,
 * plus the special protection of pregnant employees (Kodeks pracy).
 *
 * Sources: task brief (ZUS) – sections H and I; ustawa zasiłkowa Art. 2a, Art. 4; engine parameters.
 */
import type { BenefitParams } from '../engine/index';

export type Employment = 'umowa-o-prace' | 'zlecenie' | 'dzialalnosc';
export type ContractType = 'nieokreslony' | 'okreslony' | 'probny';
export type YesNo = 'tak' | 'nie' | 'nie-wiem';

export type RiskAnswers = {
	employment: Employment;
	contractType: ContractType;
	insuranceStart: string; // YYYY-MM-DD or ''
	dueDate: string; // expected birth date, YYYY-MM-DD or ''
	baseRaised: YesNo; // pay / contribution base raised during pregnancy
	endsBeforeBirth: YesNo; // contract or business ends before the birth
	voluntaryInsurance: YesNo; // voluntary sickness insurance paid (mandate contract, business)
	debt: YesNo; // contribution arrears (business)
};

export const DEFAULT_ANSWERS: RiskAnswers = {
	employment: 'umowa-o-prace',
	contractType: 'nieokreslony',
	insuranceStart: '',
	dueDate: '',
	baseRaised: 'nie',
	endsBeforeBirth: 'nie',
	voluntaryInsurance: 'tak',
	debt: 'nie'
};

export type Severity = 'high' | 'medium' | 'info' | 'ok';

export type RiskItem = {
	id: string;
	severity: Severity;
	title: string;
	body: string;
	todo: string[];
	legal: string;
};

const DAY = 86_400_000;
const PREGNANCY_DAYS = 280;
const toTime = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : NaN);
const fmt = (t: number) =>
	new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Evaluate the answers. Ordered from the most serious risk. */
export function evaluateRisks(a: RiskAnswers, p: Readonly<BenefitParams>, today = new Date()): RiskItem[] {
	const items: RiskItem[] = [];
	const employee = a.employment === 'umowa-o-prace';
	const start = toTime(a.insuranceStart);
	const due = toTime(a.dueDate);
	const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

	// 1. No sickness insurance on the day of birth
	if (!employee && a.voluntaryInsurance === 'nie') {
		items.push({
			id: 'no-voluntary',
			severity: 'high',
			title: 'Brak dobrowolnego ubezpieczenia chorobowego',
			body:
				a.employment === 'zlecenie'
					? 'Przy umowie zlecenia ubezpieczenie chorobowe jest dobrowolne. Bez niego nie przysługuje ani zasiłek chorobowy w ciąży, ani zasiłek macierzyński.'
					: 'Przy działalności ubezpieczenie chorobowe jest dobrowolne. Bez niego nie przysługuje ani zasiłek chorobowy w ciąży, ani zasiłek macierzyński.',
			todo: [
				a.employment === 'zlecenie'
					? 'Poproś zleceniodawcę o zgłoszenie Cię do dobrowolnego ubezpieczenia chorobowego.'
					: 'Zgłoś się do dobrowolnego ubezpieczenia chorobowego i opłacaj składki w terminie.',
				`Pamiętaj o okresie wyczekiwania: prawo do zasiłku chorobowego powstaje po ${p.SICKNESS_WAITING_DAYS_VOLUNTARY} dniach ubezpieczenia.`
			],
			legal: 'Ustawa zasiłkowa – Art. 4; brief ZUS, sekcja H pkt 3'
		});
	} else if (!employee && a.voluntaryInsurance === 'nie-wiem') {
		items.push({
			id: 'voluntary-unknown',
			severity: 'medium',
			title: 'Sprawdź, czy podlegasz ubezpieczeniu chorobowemu',
			body: 'Przy umowie zlecenia i działalności ubezpieczenie chorobowe jest dobrowolne – bez niego zasiłki nie przysługują.',
			todo: ['Sprawdź swoje ubezpieczenia na PUE/eZUS albo zapytaj zleceniodawcę lub biuro rachunkowe.'],
			legal: 'Brief ZUS, sekcja H pkt 3'
		});
	}

	if (a.endsBeforeBirth === 'tak') {
		if (employee && a.contractType !== 'nieokreslony') {
			items.push({
				id: 'contract-extended',
				severity: 'ok',
				title: 'Umowa może zostać przedłużona do dnia porodu',
				body: 'Umowa na czas określony albo na okres próbny dłuższy niż miesiąc, która skończyłaby się po upływie trzeciego miesiąca ciąży, z mocy prawa przedłuża się do dnia porodu. Dzięki temu w dniu porodu nadal masz ubezpieczenie.',
				todo: ['Przekaż pracodawcy zaświadczenie lekarskie potwierdzające ciążę.'],
				legal: 'Kodeks pracy – Art. 177 § 3; brief ZUS, sekcja I'
			});
		} else {
			items.push({
				id: 'ends-before-birth',
				severity: 'high',
				title: 'Brak ubezpieczenia w dniu porodu',
				body: employee
					? 'Jeśli umowa o pracę rozwiąże się przed porodem, w dniu porodu możesz nie podlegać ubezpieczeniu chorobowemu – wtedy zasiłek macierzyński nie przysługuje.'
					: 'Zakończenie umowy zlecenia albo działalności przed porodem oznacza wyrejestrowanie z ubezpieczenia chorobowego. Bez ubezpieczenia w dniu porodu zasiłek macierzyński nie przysługuje.',
				todo: [
					'Jeśli to możliwe, utrzymaj umowę lub działalność (i ubezpieczenie chorobowe) do dnia porodu.',
					'Wyjątek: przy utracie pracy w ciąży z powodu upadłości lub likwidacji pracodawcy przysługuje zasiłek w wysokości zasiłku macierzyńskiego.'
				],
				legal: 'Brief ZUS, sekcja H pkt 3; ustawa zasiłkowa – Art. 30 ust. 3'
			});
		}
	} else if (a.endsBeforeBirth === 'nie-wiem' && !employee) {
		items.push({
			id: 'ends-unknown',
			severity: 'medium',
			title: 'Sprawdź, do kiedy trwa umowa lub działalność',
			body: 'Ubezpieczenie musi trwać w dniu porodu. Zakończenie umowy lub działalności wcześniej oznacza brak zasiłku macierzyńskiego.',
			todo: ['Sprawdź datę końca umowy i nie zamykaj działalności przed porodem.'],
			legal: 'Brief ZUS, sekcja H pkt 3'
		});
	}

	// 2. Contribution arrears
	if (a.debt === 'tak') {
		const limit = Math.round(p.MIN_WAGE_2026_GROSS * p.DEBT_EXCLUSION_MIN_WAGE_RATIO * 100) / 100;
		items.push({
			id: 'debt',
			severity: 'high',
			title: 'Zaległości w składkach',
			body: `Jeśli w dniu powstania prawa do zasiłku zadłużenie składkowe przekracza ${limit.toLocaleString('pl-PL')} zł (1% płacy minimalnej), zasiłek nie jest wypłacany, dopóki nie spłacisz całego długu. Prawo do zasiłku przepada, jeśli nie spłacisz go w ciągu 6 miesięcy.`,
			todo: ['Sprawdź stan rozliczeń na PUE/eZUS.', 'Spłać zaległość jak najszybciej – możesz też wystąpić do ZUS o układ ratalny.'],
			legal: 'Ustawa zasiłkowa – Art. 2a'
		});
	} else if (a.debt === 'nie-wiem' && a.employment === 'dzialalnosc') {
		items.push({
			id: 'debt-unknown',
			severity: 'medium',
			title: 'Sprawdź, czy nie masz zaległości w składkach',
			body: 'Przy działalności nawet niewielka zaległość (powyżej 1% płacy minimalnej) wstrzymuje wypłatę zasiłku.',
			todo: ['Sprawdź stan rozliczeń na PUE/eZUS albo poproś ZUS o zaświadczenie o niezaleganiu.'],
			legal: 'Ustawa zasiłkowa – Art. 2a'
		});
	}

	// 3. Raising the base during pregnancy
	if (a.baseRaised === 'tak') {
		items.push({
			id: 'base-raised',
			severity: 'medium',
			title: 'Podwyższenie podstawy w czasie ciąży',
			body: 'ZUS może sprawdzić, czy podwyższenie wynagrodzenia lub podstawy składek w ciąży nie miało na celu wyłącznie uzyskania wyższego zasiłku. Jeśli tak uzna, ustali zasiłek od niższej podstawy.',
			todo: [
				'Zachowaj dokumenty, które uzasadniają podwyżkę (np. zmiana zakresu obowiązków, wyższe przychody firmy).',
				'Licz się z tym, że wypłata może się opóźnić na czas postępowania wyjaśniającego.'
			],
			legal: 'Brief ZUS, sekcja H pkt 2'
		});
	}

	// 4. Insurance started during pregnancy (sham contract check) + waiting period
	if (Number.isFinite(start) && Number.isFinite(due)) {
		const conception = due - PREGNANCY_DAYS * DAY;
		if (start >= conception) {
			items.push({
				id: 'sham',
				severity: 'medium',
				title: 'Ubezpieczenie zaczęło się w czasie ciąży',
				body: 'Zawarcie umowy lub założenie działalności w ciąży jest zgodne z prawem. ZUS może jednak sprawdzić, czy umowa nie została zawarta wyłącznie dla pozoru – tylko po to, żeby uzyskać zasiłek. Jeśli tak uzna, wyda decyzję o niepodleganiu ubezpieczeniu i zasiłki nie będą przysługiwać.',
				todo: [
					'Zadbaj, by praca była faktycznie wykonywana: umowa, zakres obowiązków, efekty pracy, korespondencja.',
					'Wynagrodzenie powinno odpowiadać rodzajowi pracy i stawkom rynkowym.'
				],
				legal: 'Brief ZUS, sekcja H pkt 1'
			});
		}
	}
	if (Number.isFinite(start)) {
		const waitingDays = employee ? p.SICKNESS_WAITING_DAYS_MANDATORY : p.SICKNESS_WAITING_DAYS_VOLUNTARY;
		const eligibleFrom = start + waitingDays * DAY;
		if (eligibleFrom > now) {
			items.push({
				id: 'waiting',
				severity: 'info',
				title: `Okres wyczekiwania – ${waitingDays} dni`,
				body: `Zasiłek chorobowy (np. na zwolnieniu w ciąży) przysługuje dopiero po ${waitingDays} dniach ${employee ? 'nieprzerwanego' : ''} ubezpieczenia – w Twoim przypadku od ${fmt(eligibleFrom)}. Do okresu wliczają się wcześniejsze okresy ubezpieczenia, jeśli przerwa nie przekroczyła 30 dni. Okres wyczekiwania nie dotyczy zasiłku macierzyńskiego.`,
				todo: [],
				legal: 'Ustawa zasiłkowa – Art. 4'
			});
		}
	}

	const order: Record<Severity, number> = { high: 0, medium: 1, info: 2, ok: 3 };
	return items.sort((x, y) => order[x.severity] - order[y.severity]);
}

/** Static overview: what can make you lose the benefit or get a lower one (brief, section H). */
export const RISK_OVERVIEW = [
	{
		title: 'Umowa lub działalność „dla pozoru”',
		body: 'Jeśli ZUS uzna, że umowę zawarto albo działalność założono wyłącznie po to, by uzyskać zasiłek, wyda decyzję o niepodleganiu ubezpieczeniom. Bez ubezpieczenia chorobowego zasiłki nie przysługują.'
	},
	{
		title: 'Podwyższenie podstawy w ciąży',
		body: 'Wyraźne podniesienie wynagrodzenia lub podstawy składek w czasie ciąży, tylko po to, by dostać wyższy zasiłek, może skończyć się decyzją ZUS o niższej podstawie wymiaru.'
	},
	{
		title: 'Brak ubezpieczenia w dniu porodu',
		body: 'Niezgłoszenie się do dobrowolnego ubezpieczenia chorobowego, rozwiązanie umowy o pracę albo zakończenie zlecenia czy działalności przed porodem oznacza brak zasiłku macierzyńskiego.'
	},
	{
		title: 'Zaległości w składkach',
		body: 'Zadłużenie powyżej 1% płacy minimalnej w dniu powstania prawa do zasiłku wstrzymuje wypłatę do czasu spłaty. Dotyczy to zwłaszcza osób prowadzących działalność.'
	}
];

/** Kodeks pracy – special protection of pregnant employees and employees on parental leaves (brief, section I). */
export const EMPLOYEE_PROTECTION = [
	'W ciąży i w czasie urlopów związanych z rodzicielstwem – a także od dnia złożenia wniosku o taki urlop – pracodawca nie może przygotowywać wypowiedzenia ani wypowiedzieć lub rozwiązać umowy o pracę.',
	'Wyjątek: rozwiązanie umowy bez wypowiedzenia z winy pracownika, za zgodą reprezentującej go organizacji związkowej.',
	'Umowa na czas określony albo na okres próbny dłuższy niż miesiąc, która skończyłaby się po upływie trzeciego miesiąca ciąży, przedłuża się do dnia porodu.',
	'Ta ochrona nie obejmuje osób, które nie są pracownikami – np. pracujących na umowie zlecenia czy prowadzących działalność.'
];
