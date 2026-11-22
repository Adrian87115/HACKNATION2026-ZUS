/**
 * What ZUSia gets with each message besides the question (used for that one answer, never saved):
 *  - the signed-in user's own PUE/eZUS data (no data of other people – the app only has this one account),
 *  - what the user currently sees on screen, including the values typed into a form.
 * The full PESEL and bank account numbers are never included.
 */
import type { Account } from '../account/accountApi';
import { dueDate, isPregnant } from '../account/accountToCase';

const TITLE = { umowa_o_prace: 'umowa o pracę', umowa_zlecenia: 'umowa zlecenia', dzialalnosc: 'działalność gospodarcza' } as const;
const BENEFIT = {
	zasilek_chorobowy: 'zasiłek chorobowy',
	wynagrodzenie_chorobowe: 'wynagrodzenie chorobowe',
	zasilek_macierzynski: 'zasiłek macierzyński'
} as const;
const CHANGE: Record<Account['circumstances']['employmentChange'], string> = {
	brak: 'bez zmian',
	nowa_umowa_o_prace: 'zaczyna nową umowę o pracę',
	umowa_zlecenia: 'przechodzi na umowę zlecenia',
	dzialalnosc: 'zakłada działalność gospodarczą',
	koniec_umowy_na_czas_okreslony: 'kończy się umowa na czas określony',
	likwidacja_pracodawcy: 'upadłość lub likwidacja pracodawcy',
	wypowiedzenie: 'otrzymał(a) wypowiedzenie'
};

const zl = (n: number) => `${n.toFixed(2)} zł`;
const MAX_SCREEN_CHARS = 9000;

export function accountContext(account: Account, debtThreshold: number): string {
	const lines = [
		`Konto (dane z PUE/eZUS, symulacja) – ${account.person.firstName}, ${account.role === 'mother' ? 'matka' : 'ojciec'}, ${account.person.city}.`,
		'Tytuły ubezpieczenia:',
		...account.insurance.map(
			(t) =>
				`- ${TITLE[t.type]}: ${t.payer.name}, od ${t.from} do ${t.to ?? 'bezterminowo'}, ubezpieczenie chorobowe: ${t.sickness}` +
				(t.type === 'dzialalnosc' ? '' : `, płatnik ${t.payer.over20Insured ? 'zgłasza ponad 20 osób (wypłaca zasiłki sam)' : 'zgłasza do 20 osób (zasiłki wypłaca ZUS)'}`) +
				(t.fullTime === false ? ', niepełny etat' : '')
		),
		`Przychody/podstawy składki chorobowej (12 mies.): ${account.contributionBases.map((m) => `${m.month}: ${zl(m.sicknessBasis || m.gross)}`).join('; ')}.`,
		`Zaległość w składkach na ${account.debt.asOf}: ${zl(account.debt.amount)} (wypłatę wstrzymuje zaległość powyżej ${zl(debtThreshold)} – art. 2a).`,
		account.eZla.length
			? `Zwolnienia e-ZLA: ${account.eZla.map((z) => `${z.from}–${z.to}${z.pregnancyCodeB ? ' z kodem „B” (ciąża)' : ''}, ${z.status}`).join('; ')}.`
			: 'Zwolnienia e-ZLA: brak.',
		account.benefits.length
			? `Świadczenia: ${account.benefits.map((b) => `${BENEFIT[b.type]} ${b.from}–${b.to}, ${b.status}${b.amount != null ? `, ${zl(b.amount)}` : ''}, wypłaca ${b.paidBy === 'zus' ? 'ZUS' : 'płatnik'}`).join('; ')}.`
			: 'Świadczenia: brak.',
		`Rodzina: ${isPregnant(account) ? `w ciąży, przewidywana data porodu ${dueDate(account)}` : 'brak informacji o ciąży'}` +
			(account.family.childBirthDate ? `; dziecko urodzone ${account.family.childBirthDate}` : '') +
			'.'
	];

	const c = account.circumstances;
	if (c?.updatedAt) {
		lines.push(
			'Okoliczności podane przez użytkownika (deklaracja, nie dane z ZUS):',
			`- przewidywana data porodu: ${c.expectedBirthDate ?? 'jak na koncie'}; liczba dzieci z jednego porodu: ${c.expectedChildren}`,
			`- sytuacja zawodowa: ${CHANGE[c.employmentChange]}${c.employmentChangeDate ? ` (${c.employmentChangeDate})` : ''}`,
			...(c.notes ? [`- uwagi: ${c.notes}`] : [])
		);
	}
	return lines.join('\n');
}

const squash = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

function fieldLabel(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
	const fromLabel = el.labels?.[0]?.innerText;
	const fromAria = el.getAttribute('aria-label') ?? (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby')!)?.innerText);
	return squash(fromLabel || fromAria || el.getAttribute('placeholder') || el.name || 'pole').slice(0, 120);
}

function fieldValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string | null {
	if (el instanceof HTMLInputElement) {
		if (el.type === 'hidden' || el.type === 'file' || el.type === 'password') return null;
		if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'zaznaczone' : el.type === 'radio' ? null : 'niezaznaczone';
		// bank account numbers are masked – ZUSia only needs to know whether one was typed
		if (/konto|rachun|iban/i.test(fieldLabel(el)) && el.value) return `wpisano (…${el.value.replace(/\s/g, '').slice(-4)})`;
	}
	if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.text ?? el.value;
	return el.value || '(puste)';
}

/** The page content the user sees right now: headings, text, chosen options and typed values. */
export function screenContext(): string {
	const main = document.querySelector('main');
	if (!main) return '';
	const text = squash(main.innerText).slice(0, MAX_SCREEN_CHARS);

	const fields: string[] = [];
	main.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el) => {
		if (fields.length >= 60 || el.disabled || el.closest('[aria-hidden="true"]')) return;
		const value = fieldValue(el);
		if (value !== null) fields.push(`- ${fieldLabel(el)}: ${value}`);
	});
	// toggle buttons used as radio groups / switches
	main.querySelectorAll<HTMLElement>('[role="radio"][aria-checked="true"], [role="switch"]').forEach((el) => {
		if (fields.length >= 80) return;
		const label = squash(el.getAttribute('aria-label') || el.innerText).slice(0, 120);
		if (label) fields.push(`- ${label}: ${el.getAttribute('role') === 'switch' ? (el.getAttribute('aria-checked') === 'true' ? 'włączone' : 'wyłączone') : 'wybrane'}`);
	});

	return [
		`Ekran: „${document.title}” (${window.location.pathname}${window.location.search})`,
		fields.length ? `Pola formularza i wybrane opcje:\n${fields.join('\n')}` : '',
		`Treść widoczna na stronie:\n${text}`
	]
		.filter(Boolean)
		.join('\n\n');
}
