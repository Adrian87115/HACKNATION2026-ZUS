/** Simulated mObywatel sign-in and PUE/eZUS account data (backend/src/pue). */
import { BACKEND_API } from '../../config/api';

export type InsuranceTitle = {
	type: 'umowa_o_prace' | 'umowa_zlecenia' | 'dzialalnosc';
	payer: { name: string; nip: string; over20Insured: boolean };
	from: string;
	to: string | null;
	sickness: 'obowiazkowe' | 'dobrowolne' | 'brak';
	fullTime?: boolean;
};

export type Account = {
	id: string;
	role: 'mother' | 'father';
	person: { firstName: string; lastName: string; birthDate: string; peselMasked: string; city: string };
	insurance: InsuranceTitle[];
	contributionBases: { month: string; gross: number; sicknessBasis: number }[];
	debt: { amount: number; asOf: string };
	eZla: { number: string; from: string; to: string; pregnancyCodeB: boolean; issuer: string; status: 'aktywne' | 'zakonczone' }[];
	benefits: {
		type: 'zasilek_chorobowy' | 'wynagrodzenie_chorobowe' | 'zasilek_macierzynski';
		from: string;
		to: string;
		status: 'wyplacony' | 'w_trakcie' | 'oczekuje_na_dokumenty';
		amount: number | null;
		paidBy: 'zus' | 'platnik';
	}[];
	family: { expectedBirthDate: string | null; childBirthDate: string | null };
};

export type Persona = { id: string; label: string; description: string };

export type DebtCertificate = {
	number: string;
	issuedAt: string;
	asOf: string;
	status: 'brak_zaleglosci' | 'zaleglosc';
	amount: number;
	threshold: number;
	blocksBenefits: boolean;
	text: string;
};

export type ApplicationKind = 'urlop_macierzynski' | 'urlop_rodzicielski' | 'urlop_ojcowski' | 'zam';
export type ZamPeriod = 'macierzynski' | 'rodzicielski' | 'ojcowski';

export type ApplicationInput = {
	kind: ApplicationKind;
	startDate: string;
	weeks: number;
	combined?: boolean;
	period?: ZamPeriod;
	bankAccount?: string;
	confirmed: boolean;
};

export type SubmittedApplication = {
	id: string;
	number: string;
	kind: ApplicationKind;
	title: string;
	recipient: { type: 'pracodawca' | 'zus'; name: string };
	channel: string;
	submittedAt: string;
	status: 'doreczony' | 'przyjety';
	fields: { label: string; value: string }[];
	warnings: string[];
	upo: { number: string; digest: string } | null;
};

export class AccountApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
	const headers = new Headers(init.headers);
	if (token) headers.set('Authorization', `Bearer ${token}`);
	if (init.body) headers.set('Content-Type', 'application/json');
	let res: Response;
	try {
		res = await fetch(`${BACKEND_API}${path}`, { ...init, headers });
	} catch {
		throw new AccountApiError('Nie udało się połączyć z ZUS. Sprawdź połączenie i spróbuj ponownie.', 0);
	}
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
		const message =
			res.status < 500 && typeof body?.message === 'string'
				? body.message
				: res.status === 401
					? 'Sesja wygasła. Zaloguj się ponownie.'
					: 'Usługa jest chwilowo niedostępna. Spróbuj ponownie za chwilę.';
		throw new AccountApiError(message, res.status);
	}
	return (res.status === 204 ? undefined : await res.json()) as T;
}

export const accountApi = {
	personas: () => request<Persona[]>('/pue/personas'),
	login: (personaId: string) =>
		request<{ token: string; expiresAt: string }>('/pue/login', { method: 'POST', body: JSON.stringify({ personaId }) }),
	logout: (token: string) => request<void>('/pue/logout', { method: 'POST' }, token).catch(() => undefined),
	me: (token: string) => request<Account>('/pue/me', {}, token),
	debtCertificate: (token: string) => request<DebtCertificate>('/pue/me/debt-certificate', { method: 'POST' }, token),
	applications: (token: string) => request<SubmittedApplication[]>('/pue/me/applications', {}, token),
	submitApplication: (token: string, input: ApplicationInput) =>
		request<SubmittedApplication>('/pue/me/applications', { method: 'POST', body: JSON.stringify(input) }, token)
};
