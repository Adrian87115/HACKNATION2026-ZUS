import { ArrowLeft, CircleCheck, LoaderCircle, MessageCircle, Printer, Send, TriangleExclamationPoint } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import {
	accountApi,
	type Account,
	type ApplicationInput,
	type ApplicationKind,
	type CertificateCopy,
	type CertificateDelivery,
	type SubmittedApplication,
	type ZamPeriod
} from '../../features/account/accountApi';
import { currentTitle, dueDate } from '../../features/account/accountToCase';
import { useAuth } from '../../features/account/AuthContext';
import { useChat } from '../../features/chat/ChatContext';
import { useFeatures } from '../../features/system/features';
import { useBenefitEngine } from '../../hooks/useBenefitEngine';
import { AppRoutePaths } from '../../types/shared';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const inputCls =
	'h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink shadow-xs transition ' +
	'placeholder:text-muted hover:border-muted/60 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15';

const DAY = 86_400_000;
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => toIso(new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY));
const plDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const KINDS: Record<ApplicationKind, { label: string; hint: string; to: string }> = {
	urlop_macierzynski: { label: 'Wniosek o urlop macierzyński', hint: 'do pracodawcy – także wniosek łączny z rodzicielskim', to: 'pracodawcy' },
	urlop_rodzicielski: { label: 'Wniosek o urlop rodzicielski', hint: 'do pracodawcy – co najmniej 21 dni przed', to: 'pracodawcy' },
	urlop_ojcowski: { label: 'Wniosek o urlop ojcowski', hint: 'do pracodawcy – co najmniej 7 dni przed', to: 'pracodawcy' },
	zam: { label: 'ZAM – wniosek o zasiłek macierzyński', hint: 'do ZUS przez PUE/eZUS', to: 'ZUS' },
	odpis_aktu_urodzenia: { label: 'Wniosek o odpis aktu urodzenia', hint: 'do urzędu stanu cywilnego przez gov.pl', to: 'urzędu stanu cywilnego' }
};
const COPIES: { value: CertificateCopy; label: string; hint: string }[] = [
	{ value: 'skrocony', label: 'Odpis skrócony', hint: 'Podstawowe dane dziecka i rodziców – wystarcza do ZUS i pracodawcy.' },
	{ value: 'zupelny', label: 'Odpis zupełny', hint: 'Pełna treść aktu z adnotacjami – np. do sądu lub za granicę.' }
];
const DELIVERIES: { value: CertificateDelivery; label: string }[] = [
	{ value: 'elektronicznie', label: 'Elektronicznie – do skrzynki na koncie gov.pl' },
	{ value: 'odbior_osobisty', label: 'Odbiór osobisty w urzędzie stanu cywilnego' }
];
const PERIODS: { value: ZamPeriod; label: string }[] = [
	{ value: 'macierzynski', label: 'Urlop macierzyński' },
	{ value: 'rodzicielski', label: 'Urlop rodzicielski' },
	{ value: 'ojcowski', label: 'Urlop ojcowski' }
];

/** Which applications make sense for this account (leave requests only with an employment contract). */
function availableKinds(account: Account): ApplicationKind[] {
	const employee = currentTitle(account)?.type === 'umowa_o_prace';
	const kinds: ApplicationKind[] = [];
	if (employee && account.role === 'mother') kinds.push('urlop_macierzynski');
	if (employee) kinds.push('urlop_rodzicielski');
	if (employee && account.role === 'father' && account.family.childBirthDate) kinds.push('urlop_ojcowski');
	kinds.push('zam');
	if (account.family.childBirthDate) kinds.push('odpis_aktu_urodzenia');
	return kinds;
}

type Draft = {
	startDate: string;
	weeks: number;
	combined: boolean;
	period: ZamPeriod;
	bankAccount: string;
	copyType: CertificateCopy;
	delivery: CertificateDelivery;
	confirmed: boolean;
};

function defaults(kind: ApplicationKind, account: Account, today: string): Draft {
	const birth = account.family.childBirthDate;
	const expected = dueDate(account);
	const base = { combined: false, bankAccount: '', copyType: 'skrocony' as const, delivery: 'elektronicznie' as const, confirmed: false };
	const period: ZamPeriod = account.role === 'father' ? (birth ? 'ojcowski' : 'rodzicielski') : 'macierzynski';
	switch (kind) {
		case 'urlop_macierzynski':
			return { ...base, startDate: birth ?? expected ?? today, weeks: 20, combined: true, period };
		case 'urlop_rodzicielski':
			return { ...base, startDate: birth ? addDays(birth, 20 * 7) : addDays(today, 21), weeks: 32, period };
		case 'urlop_ojcowski':
			return { ...base, startDate: addDays(today, 7), weeks: 2, period };
		case 'zam': {
			const start = period === 'ojcowski' ? addDays(today, 7) : (birth ?? expected ?? today);
			return { ...base, startDate: start, weeks: period === 'ojcowski' ? 2 : 20, period };
		}
		case 'odpis_aktu_urodzenia':
			return { ...base, startDate: '', weeks: 0, period };
	}
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
	const id = useId();
	return (
		<div className="space-y-1.5">
			<label htmlFor={id} className="block text-sm font-semibold text-ink">
				{label}
			</label>
			{children(id)}
			{hint && <p className="text-xs text-muted">{hint}</p>}
		</div>
	);
}

export default function SubmitApplication() {
	const { status, account } = useAuth();
	const location = useLocation();
	const { onlineApplications } = useFeatures();

	if (!onlineApplications) {
		return (
			<BaseLayout>
				<div className="mx-auto max-w-xl space-y-3 py-16 text-center">
					<h1 className="text-2xl font-bold tracking-tight text-ink">Składanie wniosków online jest chwilowo wyłączone</h1>
					<p className="text-muted">
						Wniosek możesz złożyć u pracodawcy, przez PUE/eZUS albo w placówce ZUS. Sprawdź, jakie dokumenty przygotować.
					</p>
					<Link to={AppRoutePaths.APPLICATIONS} className="inline-flex font-semibold text-brand-ink hover:underline hover:underline-offset-4">
						Jakie dokumenty złożyć i gdzie? →
					</Link>
				</div>
			</BaseLayout>
		);
	}

	if (status === 'loading') {
		return (
			<BaseLayout>
				<div className="flex flex-col items-center gap-3 py-24 text-muted" role="status">
					<LoaderCircle className="h-6 w-6 animate-spin" aria-hidden />
					Pobieram dane z ZUS…
				</div>
			</BaseLayout>
		);
	}
	if (status === 'anonymous' || !account) {
		return <Navigate to={AppRoutePaths.LOGIN} replace state={{ from: `${location.pathname}${location.search}` }} />;
	}
	return (
		<BaseLayout>
			<SubmitView account={account} />
		</BaseLayout>
	);
}

type Stage = 'form' | 'signing' | 'sent';

function SubmitView({ account }: { account: Account }) {
	const chat = useChat();
	const { token } = useAuth();
	const engine = useBenefitEngine();
	const params = engine.getParams();
	const [search, setSearch] = useSearchParams();
	const today = useMemo(() => toIso(new Date()), []);
	const kinds = useMemo(() => availableKinds(account), [account]);
	const requested = search.get('rodzaj') as ApplicationKind | null;
	const kind: ApplicationKind = requested && kinds.includes(requested) ? requested : kinds[0];

	const [draft, setDraft] = useState<Draft>(() => defaults(kind, account, today));
	const [stage, setStage] = useState<Stage>('form');
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<SubmittedApplication | null>(null);
	const [code] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));

	useEffect(() => {
		setDraft(defaults(kind, account, today));
		setError(null);
	}, [kind, account, today]);

	const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
	const title = currentTitle(account);
	const name = `${account.person.firstName} ${account.person.lastName}`;
	const employer = title?.payer.name ?? 'pracodawca';

	// Jeden rodzic: pula urlopu rodzicielskiego minus 9 tygodni przysługujących wyłącznie drugiemu (art. 182¹ᵃ § 4 KP).
	const parentalPerParent = params.PARENTAL_WEEKS_SINGLE_CHILD - params.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS;
	const maxWeeks =
		kind === 'urlop_ojcowski' || (kind === 'zam' && draft.period === 'ojcowski')
			? params.PATERNITY_TOTAL_WEEKS
			: kind === 'urlop_rodzicielski' || (kind === 'zam' && draft.period === 'rodzicielski')
				? parentalPerParent
				: params.MATERNITY_WEEKS_BY_CHILDREN[1];
	const isCertificate = kind === 'odpis_aktu_urodzenia';
	const endDate = draft.startDate && draft.weeks > 0 ? addDays(draft.startDate, draft.weeks * 7 - 1) : null;
	const toZus = kind === 'zam' && !(title?.type === 'umowa_o_prace' && title.payer.over20Insured);
	const sendTo = isCertificate ? 'urzędu stanu cywilnego' : kind === 'zam' && toZus ? 'ZUS' : 'pracodawcy';

	async function submit() {
		if (!token) return;
		setError(null);
		setStage('signing');
		const input: ApplicationInput = isCertificate
			? { kind, copyType: draft.copyType, delivery: draft.delivery, confirmed: draft.confirmed }
			: {
					kind,
					startDate: draft.startDate,
					weeks: draft.weeks,
					combined: kind === 'urlop_macierzynski' ? draft.combined : undefined,
					period: kind === 'zam' ? draft.period : undefined,
					bankAccount: kind === 'zam' ? draft.bankAccount : undefined,
					confirmed: draft.confirmed
				};
		try {
			// short pause so the mObywatel signature step is visible in the demo
			const [sent] = await Promise.all([accountApi.submitApplication(token, input), new Promise((r) => setTimeout(r, 1100))]);
			setResult(sent);
			setStage('sent');
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (err) {
			setError((err as Error).message);
			setStage('form');
		}
	}

	if (stage === 'sent' && result) {
		const another = () => {
			setResult(null);
			setStage('form');
			setDraft(defaults(kind, account, today));
		};
		return <Confirmation result={result} onAnother={another} />;
	}

	const letter = (
		<article className="space-y-4 text-sm leading-relaxed text-ink">
			<div className="flex justify-between gap-4 text-xs text-muted">
				<span>
					{name}
					<br />
					PESEL {account.person.peselMasked}
				</span>
				<span className="text-right">
					{account.person.city}, {plDate(today)}
				</span>
			</div>
			<p className="text-right font-medium">
				{isCertificate
					? `Kierownik Urzędu Stanu Cywilnego – ${account.person.city}`
					: kind === 'zam'
						? toZus
							? 'Zakład Ubezpieczeń Społecznych'
							: employer
						: employer}
			</p>
			<h3 className="text-center text-base font-bold">{KINDS[kind].label.replace('ZAM – w', 'W')}</h3>
			{kind === 'urlop_macierzynski' && (
				<p>
					Na podstawie art. 180 Kodeksu pracy wnoszę o udzielenie urlopu macierzyńskiego w wymiarze {draft.weeks} tyg.
					{draft.startDate && ` od dnia ${plDate(draft.startDate)}`}
					{draft.combined &&
						`, a bezpośrednio po nim urlopu rodzicielskiego w pełnym wymiarze ${params.PARENTAL_WEEKS_SINGLE_CHILD - params.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS} tyg. (wniosek łączny, art. 30a ustawy zasiłkowej)`}
					.
				</p>
			)}
			{kind === 'urlop_rodzicielski' && (
				<p>
					Na podstawie art. 182¹ᵃ Kodeksu pracy wnoszę o udzielenie urlopu rodzicielskiego w wymiarze {draft.weeks} tyg.
					{draft.startDate && endDate && ` w okresie od ${plDate(draft.startDate)} do ${plDate(endDate)}`}.
				</p>
			)}
			{kind === 'urlop_ojcowski' && (
				<p>
					Na podstawie art. 182³ Kodeksu pracy wnoszę o udzielenie urlopu ojcowskiego w wymiarze {draft.weeks} tyg.
					{draft.startDate && endDate && ` w okresie od ${plDate(draft.startDate)} do ${plDate(endDate)}`} w związku z urodzeniem
					dziecka {account.family.childBirthDate && `dnia ${plDate(account.family.childBirthDate)}`}.
				</p>
			)}
			{kind === 'zam' && (
				<p>
					Wnoszę o wypłatę zasiłku macierzyńskiego za okres {PERIODS.find((p) => p.value === draft.period)?.label.toLowerCase()}
					{draft.startDate && ` od ${plDate(draft.startDate)}`} ({draft.weeks} tyg.)
					{draft.bankAccount && ` na rachunek ${draft.bankAccount}`}.
				</p>
			)}
			{isCertificate && (
				<p>
					Wnoszę o wydanie {draft.copyType === 'zupelny' ? 'odpisu zupełnego' : 'odpisu skróconego'} aktu urodzenia mojego dziecka
					{account.family.childBirthDate && ` urodzonego dnia ${plDate(account.family.childBirthDate)}`}. Odpis proszę{' '}
					{draft.delivery === 'elektronicznie' ? 'przesłać na moje konto w serwisie gov.pl' : 'przygotować do odbioru osobistego w urzędzie'}.
				</p>
			)}
			<p className="text-muted">Oświadczam, że dane zawarte we wniosku są zgodne z prawdą.</p>
			<p className="text-right text-xs text-muted">podpisano w aplikacji mObywatel (symulacja)</p>
		</article>
	);

	return (
		<div className="space-y-6">
			<header className="enter space-y-2">
				<Link
					to={AppRoutePaths.ACCOUNT}
					className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink">
					<ArrowLeft className="h-4 w-4" aria-hidden />
					Moje konto
				</Link>
				<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Złóż wniosek online</h1>
				<p className="max-w-2xl text-muted">
					Wniosek uzupełniliśmy danymi z Twojego konta. Sprawdź daty, podpisz w mObywatelu i wyślij – potwierdzenie zobaczysz od razu, a
					wniosek trafi do historii w „Moim koncie”.
				</p>
				{chat.enabled && (
				<>
				<button
					type="button"
					onClick={() =>
						chat.ask('Sprawdź wniosek, który teraz wypełniam: czy przysługuje mi to, o co wnioskuję, czy daty i terminy są dobre i co jeszcze poprawić?')
					}
					className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline hover:underline-offset-4">
					<MessageCircle className="h-4 w-4" aria-hidden />
					Sprawdź wniosek z ZUSią
				</button>
				<p className="text-xs text-muted">ZUSia widzi wypełniany formularz i dane z Twojego konta, ale niczego za Ciebie nie zmienia ani nie wysyła.</p>
				</>
				)}
			</header>

			<p className="enter rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
				<span className="font-semibold">Wersja demonstracyjna.</span> Podpis i wysyłka są symulowane – wniosek nie trafia do prawdziwego
				pracodawcy, ZUS ani urzędu stanu cywilnego.
			</p>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<section className="enter space-y-5 rounded-lg border border-line bg-paper p-5 shadow-sm" style={{ animationDelay: '60ms' }}>
					<fieldset disabled={stage === 'signing'} className="space-y-5">
						<div>
							<p className="mb-2 text-sm font-semibold text-ink">Rodzaj wniosku</p>
							<div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
								{kinds.map((k) => (
									<button
										key={k}
										type="button"
										role="radio"
										aria-checked={k === kind}
										onClick={() => setSearch({ rodzaj: k }, { replace: true })}
										className={cx(
											'rounded-md border px-3 py-2.5 text-left transition',
											k === kind ? 'border-brand bg-brand-soft/60 ring-1 ring-brand' : 'border-line bg-paper hover:border-muted/60 hover:bg-hover'
										)}>
										<span className={cx('block text-sm font-semibold', k === kind ? 'text-brand-ink' : 'text-ink')}>{KINDS[k].label}</span>
										<span className="block text-xs text-muted">{KINDS[k].hint}</span>
									</button>
								))}
							</div>
							{!account.family.childBirthDate && (
								<p className="mt-2 text-xs text-muted">
									Wniosek o odpis aktu urodzenia pojawi się tutaj po zarejestrowaniu urodzenia dziecka w urzędzie stanu cywilnego.
								</p>
							)}
							{title?.type !== 'umowa_o_prace' && (
								<p className="mt-2 text-xs text-muted">
									Wnioski o urlop składa się do pracodawcy, więc dotyczą umowy o pracę. Przy umowie zlecenia i działalności wnioskujesz od razu
									o zasiłek w ZUS.
								</p>
							)}
						</div>

						{kind === 'zam' && (
							<Field label="Za jaki okres?">
								{(id) => (
									<select
										id={id}
										className={inputCls}
										value={draft.period}
										onChange={(e) => {
											const period = e.target.value as ZamPeriod;
											setDraft((d) => ({ ...d, period, weeks: period === 'ojcowski' ? 2 : period === 'rodzicielski' ? 32 : 20 }));
										}}>
										{PERIODS.map((p) => (
											<option key={p.value} value={p.value}>
												{p.label}
											</option>
										))}
									</select>
								)}
							</Field>
						)}

						{isCertificate && (
							<>
								<div>
									<p className="mb-2 text-sm font-semibold text-ink">Rodzaj odpisu</p>
									<div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
										{COPIES.map((c) => (
											<button
												key={c.value}
												type="button"
												role="radio"
												aria-checked={draft.copyType === c.value}
												onClick={() => set('copyType', c.value)}
												className={cx(
													'rounded-md border px-3 py-2.5 text-left transition',
													draft.copyType === c.value
														? 'border-brand bg-brand-soft/60 ring-1 ring-brand'
														: 'border-line bg-paper hover:border-muted/60 hover:bg-hover'
												)}>
												<span className={cx('block text-sm font-semibold', draft.copyType === c.value ? 'text-brand-ink' : 'text-ink')}>
													{c.label}
												</span>
												<span className="block text-xs text-muted">{c.hint}</span>
											</button>
										))}
									</div>
								</div>
								<Field label="Jak chcesz odebrać odpis?">
									{(id) => (
										<select
											id={id}
											className={inputCls}
											value={draft.delivery}
											onChange={(e) => set('delivery', e.target.value as CertificateDelivery)}>
											{DELIVERIES.map((d) => (
												<option key={d.value} value={d.value}>
													{d.label}
												</option>
											))}
										</select>
									)}
								</Field>
							</>
						)}

						{!isCertificate && (
							<div className="grid gap-4 sm:grid-cols-2">
								<Field label="Od kiedy" hint={kind === 'urlop_macierzynski' ? `Najwcześniej ${params.MATERNITY_MAX_PRENATAL_WEEKS} tyg. przed porodem.` : undefined}>
									{(id) => (
										<input id={id} type="date" className={inputCls} value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
									)}
								</Field>
								<Field label="Liczba tygodni" hint={endDate ? `do ${plDate(endDate)} (maks. ${maxWeeks} tyg.)` : `maks. ${maxWeeks} tyg.`}>
									{(id) => (
										<input
											id={id}
											type="number"
											min={1}
											max={maxWeeks}
											className={inputCls}
											value={draft.weeks || ''}
											onChange={(e) => set('weeks', Math.max(0, Math.min(maxWeeks, Number(e.target.value) || 0)))}
										/>
									)}
								</Field>
							</div>
						)}

						{kind === 'urlop_macierzynski' && (
							<label className="flex cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-2.5 transition hover:bg-hover">
								<input
									type="checkbox"
									checked={draft.combined}
									onChange={(e) => set('combined', e.target.checked)}
									className="mt-1 accent-(--brand)"
								/>
								<span className="text-sm">
									<span className="block font-semibold text-ink">Od razu wnioskuję też o urlop rodzicielski</span>
									<span className="block text-muted">
										Wniosek łączny złożony do {params.COMBINED_APPLICATION_DEADLINE_DAYS} dni po porodzie – zasiłek{' '}
										{(params.RATE_COMBINED_21_DAYS * 100).toLocaleString('pl-PL')}% za cały okres zamiast 100% + 70%.
									</span>
								</span>
							</label>
						)}

						{kind === 'zam' && (
							<Field label="Numer rachunku do wypłaty" hint="26 cyfr – sprawdzamy sumę kontrolną, tak jak ZUS.">
								{(id) => (
									<input
										id={id}
										inputMode="numeric"
										autoComplete="off"
										placeholder="00 0000 0000 0000 0000 0000 0000"
										className={cx(inputCls, 'font-mono')}
										value={draft.bankAccount}
										onChange={(e) => set('bankAccount', e.target.value)}
									/>
								)}
							</Field>
						)}

						<label className="flex cursor-pointer items-start gap-3 text-sm">
							<input
								type="checkbox"
								checked={draft.confirmed}
								onChange={(e) => set('confirmed', e.target.checked)}
								className="mt-1 accent-(--brand)"
							/>
							<span className="text-ink">Oświadczam, że dane we wniosku są zgodne z prawdą.</span>
						</label>
					</fieldset>

					{error && (
						<p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
							{error}
						</p>
					)}

					{stage === 'signing' ? (
						<div className="rounded-md border border-line bg-surface p-4 text-center" role="status">
							<p className="text-sm text-muted">Potwierdź podpis w aplikacji mObywatel. Kod weryfikacyjny:</p>
							<p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-ink">{code}</p>
							<p className="mt-2 inline-flex items-center gap-2 text-sm text-muted">
								<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
								Podpisuję i wysyłam do {sendTo}…
							</p>
						</div>
					) : (
						<button
							type="button"
							onClick={() => void submit()}
							disabled={!draft.confirmed || (!isCertificate && (!draft.startDate || draft.weeks < 1))}
							className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60">
							<Send className="h-4 w-4" aria-hidden />
							Podpisz w mObywatelu i wyślij do {sendTo}
						</button>
					)}
				</section>

				<section className="enter lg:sticky lg:top-24" style={{ animationDelay: '120ms' }} aria-label="Podgląd wniosku">
					<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Podgląd wniosku</p>
					<div className="rounded-lg border border-line bg-paper p-6 shadow-sm">{letter}</div>
				</section>
			</div>
		</div>
	);
}

function Confirmation({ result, onAnother }: { result: SubmittedApplication; onAnother: () => void }) {
	const sentAt = new Date(result.submittedAt).toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' });
	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<header className="enter space-y-2 text-center">
				<CircleCheck className="mx-auto h-10 w-10 text-brand" aria-hidden />
				<h1 className="text-3xl font-bold tracking-tight text-ink">Wniosek wysłany</h1>
				<p className="text-muted">
					{result.recipient.type === 'zus'
						? 'ZUS przyjął wniosek. Urzędowe poświadczenie odbioru (UPO) znajdziesz poniżej i w „Moim koncie”.'
						: result.recipient.type === 'usc'
							? 'Urząd stanu cywilnego przyjął wniosek. Urzędowe poświadczenie przedłożenia (UPP) znajdziesz poniżej i w „Moim koncie”.'
							: `Wniosek został doręczony do: ${result.recipient.name}.`}
				</p>
			</header>

			<section className="enter rounded-lg border border-line bg-paper shadow-sm" style={{ animationDelay: '60ms' }}>
				<div className="border-b border-line px-5 py-3">
					<p className="font-semibold text-ink">{result.title}</p>
					<p className="text-sm text-muted">
						Nr {result.number} · {sentAt} · {result.channel}
					</p>
				</div>
				<dl className="divide-y divide-line px-5">
					{result.fields.map((f) => (
						<div key={f.label} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[12rem_1fr]">
							<dt className="text-muted">{f.label}</dt>
							<dd className="text-ink">{f.value}</dd>
						</div>
					))}
					<div className="grid gap-1 py-2.5 text-sm sm:grid-cols-[12rem_1fr]">
						<dt className="text-muted">Odbiorca</dt>
						<dd className="text-ink">{result.recipient.name}</dd>
					</div>
					{result.upo && (
						<div className="grid gap-1 py-2.5 text-sm sm:grid-cols-[12rem_1fr]">
							<dt className="text-muted">{result.recipient.type === 'usc' ? 'UPP' : 'UPO'}</dt>
							<dd className="text-ink">
								{result.upo.number}
								<span className="block break-all font-mono text-xs text-muted">skrót dokumentu: {result.upo.digest}</span>
							</dd>
						</div>
					)}
				</dl>
			</section>

			{result.warnings.length > 0 && (
				<section
					className="enter rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
					style={{ animationDelay: '120ms' }}>
					<p className="flex items-center gap-2 font-semibold">
						<TriangleExclamationPoint className="h-4 w-4" aria-hidden />
						Zwróć uwagę
					</p>
					<ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
						{result.warnings.map((w) => (
							<li key={w}>{w}</li>
						))}
					</ul>
				</section>
			)}

			<div className="flex flex-wrap justify-center gap-3">
				<button
					type="button"
					onClick={() => window.print()}
					className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-hover">
					<Printer className="h-4 w-4" aria-hidden />
					Drukuj potwierdzenie
				</button>
				<button
					type="button"
					onClick={onAnother}
					className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-hover">
					Złóż kolejny wniosek
				</button>
				<Link
					to={AppRoutePaths.ACCOUNT}
					className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong">
					Wróć do „Mojego konta”
				</Link>
			</div>
		</div>
	);
}
