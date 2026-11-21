import { ArrowRight, Calculator, FileText, LoaderCircle, MessageCircle, Printer, ShieldBan, ShieldCheck, ShieldEllipsis } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { accountApi, type Account as AccountData, type DebtCertificate } from '../../features/account/accountApi';
import { accountToCase, currentTitle } from '../../features/account/accountToCase';
import { useAuth } from '../../features/account/AuthContext';
import { analyzeCase, type CalculatorTarget } from '../../features/caseImport/caseData';
import { useChat } from '../../features/chat/ChatContext';
import { useBenefitEngine } from '../../hooks/useBenefitEngine';
import { AppRoutePaths } from '../../types/shared';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const money = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
const date = (iso: string | null) =>
	iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'bezterminowo';
const month = (ym: string) =>
	new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const TITLE: Record<AccountData['insurance'][number]['type'], string> = {
	umowa_o_prace: 'Umowa o pracę',
	umowa_zlecenia: 'Umowa zlecenia',
	dzialalnosc: 'Działalność gospodarcza'
};
const SICKNESS: Record<AccountData['insurance'][number]['sickness'], string> = {
	obowiazkowe: 'obowiązkowe',
	dobrowolne: 'dobrowolne',
	brak: 'brak ubezpieczenia chorobowego'
};
const BENEFIT: Record<AccountData['benefits'][number]['type'], string> = {
	zasilek_chorobowy: 'Zasiłek chorobowy',
	wynagrodzenie_chorobowe: 'Wynagrodzenie chorobowe',
	zasilek_macierzynski: 'Zasiłek macierzyński'
};
const BENEFIT_STATUS: Record<AccountData['benefits'][number]['status'], string> = {
	wyplacony: 'wypłacony',
	w_trakcie: 'w trakcie',
	oczekuje_na_dokumenty: 'czeka na dokumenty'
};

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
	return (
		<section className="rounded-lg border border-line bg-paper shadow-sm">
			<header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
				<h2 className="font-semibold text-ink">{title}</h2>
				{action}
			</header>
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}

export default function Account() {
	const { status, account } = useAuth();
	const location = useLocation();

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
	if (status === 'anonymous' || !account) return <Navigate to={AppRoutePaths.LOGIN} replace state={{ from: location.pathname }} />;

	return (
		<BaseLayout>
			<AccountView account={account} />
		</BaseLayout>
	);
}

function AccountView({ account }: { account: AccountData }) {
	const engine = useBenefitEngine();
	const navigate = useNavigate();
	const chat = useChat();
	const { token } = useAuth();
	const [certificate, setCertificate] = useState<DebtCertificate | null>(null);
	const [certError, setCertError] = useState<string | null>(null);
	const [issuing, setIssuing] = useState(false);

	const extraction = useMemo(() => accountToCase(account), [account]);
	const analysis = useMemo(() => analyzeCase(extraction, engine), [extraction, engine]);
	const title = currentTitle(account);
	const pregnant = Boolean(account.family.expectedBirthDate && !account.family.childBirthDate);
	const threshold = Math.round(engine.getParams().MIN_WAGE_2026_GROSS * engine.getParams().DEBT_EXCLUSION_MIN_WAGE_RATIO * 100) / 100;
	const debtBlocks = account.debt.amount > threshold;
	const name = `${account.person.firstName} ${account.person.lastName}`;

	function openCalculator(target: CalculatorTarget) {
		navigate(`${AppRoutePaths.CALCULATORS}?tab=${target}`, {
			state: { casePreset: { name: `Moje konto – ${name}`, analysis, target } }
		});
	}

	async function issueCertificate() {
		if (!token) return;
		setIssuing(true);
		setCertError(null);
		try {
			setCertificate(await accountApi.debtCertificate(token));
		} catch (err) {
			setCertError((err as Error).message);
		} finally {
			setIssuing(false);
		}
	}

	const insured = analysis.insurance.status;
	const InsIcon = insured === 'insured' ? ShieldCheck : insured === 'not_insured' ? ShieldBan : ShieldEllipsis;

	return (
		<div className="space-y-6">
			<header className="enter flex flex-wrap items-end justify-between gap-4">
				<div className="space-y-1">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Moje konto · dane z PUE/eZUS (symulacja)</p>
					<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Dzień dobry, {account.person.firstName}</h1>
					<p className="text-sm text-muted">
						PESEL {account.person.peselMasked} · {account.person.city}
						{pregnant && ` · przewidywana data porodu: ${date(account.family.expectedBirthDate)}`}
						{account.family.childBirthDate && ` · dziecko urodzone ${date(account.family.childBirthDate)}`}
					</p>
				</div>
				<button
					type="button"
					onClick={() => chat.setOpen(true)}
					className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink transition hover:bg-hover">
					<MessageCircle className="h-4 w-4" aria-hidden />
					Zapytaj ZUSię o swoje dane
				</button>
			</header>

			{/* Summary */}
			<div className="enter-stagger grid gap-4 md:grid-cols-3">
				<div
					className={cx(
						'rounded-lg border p-5',
						insured === 'insured'
							? 'border-brand/40 bg-brand-soft text-brand-ink'
							: insured === 'not_insured'
								? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100'
								: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'
					)}>
					<p className="flex items-center gap-2 text-sm font-semibold">
						<InsIcon className="h-4 w-4" aria-hidden />
						Ubezpieczenie chorobowe
					</p>
					<p className="mt-2 text-lg font-bold">
						{insured === 'insured' ? 'Podlegasz' : insured === 'not_insured' ? 'Nie podlegasz' : 'Do sprawdzenia'}
					</p>
					<p className="mt-1 text-sm">{title ? `${TITLE[title.type]} · ${SICKNESS[title.sickness]}` : 'Brak tytułu ubezpieczenia'}</p>
				</div>
				<div className="rounded-lg border border-line bg-paper p-5">
					<p className="text-sm font-semibold text-muted">Podstawa wymiaru zasiłku</p>
					<p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{analysis.basis ? money(analysis.basis.monthly) : '—'}</p>
					<p className="mt-1 text-sm text-muted">
						{analysis.basis ? `wyliczona z ${analysis.basis.months} mies. zgłoszonych do ZUS` : 'brak danych o przychodach'}
					</p>
				</div>
				<div
					className={cx(
						'rounded-lg border p-5',
						debtBlocks ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100' : 'border-line bg-paper'
					)}>
					<p className={cx('text-sm font-semibold', !debtBlocks && 'text-muted')}>Zaległości w składkach</p>
					<p className={cx('mt-2 text-2xl font-bold tracking-tight tabular-nums', !debtBlocks && 'text-ink')}>{money(account.debt.amount)}</p>
					<p className={cx('mt-1 text-sm', !debtBlocks && 'text-muted')}>
						{debtBlocks ? 'Wstrzymuje wypłatę zasiłku do czasu spłaty' : `stan na ${date(account.debt.asOf)}`}
					</p>
				</div>
			</div>

			{/* Use the data */}
			<Section title="Wykorzystaj swoje dane">
				<p className="text-sm text-muted">Uzupełnimy kalkulator danymi z Twojego konta – bez przepisywania.</p>
				<div className="mt-3 flex flex-wrap gap-3">
					{pregnant && (
						<button
							type="button"
							onClick={() => openCalculator('pregnancy')}
							className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong">
							<Calculator className="h-4 w-4" aria-hidden />
							Oblicz świadczenia w ciąży
						</button>
					)}
					<button
						type="button"
						onClick={() => openCalculator('maternity')}
						className={cx(
							'inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition',
							pregnant ? 'border border-line bg-paper text-ink hover:bg-hover' : 'bg-brand text-white hover:bg-brand-strong'
						)}>
						<Calculator className="h-4 w-4" aria-hidden />
						Zaplanuj urlopy i zasiłek macierzyński
					</button>
					{(insured !== 'insured' || debtBlocks) && (
						<Link
							to={AppRoutePaths.RISKS}
							className="inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-semibold text-brand-ink hover:underline hover:underline-offset-4">
							Co to oznacza dla zasiłku?
							<ArrowRight className="h-4 w-4" aria-hidden />
						</Link>
					)}
				</div>
				{analysis.insurance.reasons.length > 0 && (
					<ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-muted">
						{analysis.insurance.reasons.map((r) => (
							<li key={r}>{r}</li>
						))}
					</ul>
				)}
			</Section>

			<div className="grid items-start gap-6 lg:grid-cols-2">
				<Section title="Ubezpieczenia">
					<ul className="space-y-3">
						{account.insurance.map((t) => (
							<li key={`${t.type}-${t.from}`} className="text-sm">
								<p className="font-semibold text-ink">{TITLE[t.type]}</p>
								<p className="text-muted">
									{t.payer.name} · NIP {t.payer.nip}
								</p>
								<p className="text-muted">
									od {date(t.from)} do {date(t.to)} · ubezpieczenie chorobowe: {SICKNESS[t.sickness]}
								</p>
								{t.type !== 'dzialalnosc' && (
									<p className="text-muted">
										Zasiłki wypłaca: {t.payer.over20Insured ? 'płatnik (ponad 20 ubezpieczonych)' : 'ZUS'}
									</p>
								)}
							</li>
						))}
					</ul>
				</Section>

				<Section
					title="Stan rozliczeń"
					action={
						<button
							type="button"
							onClick={() => void issueCertificate()}
							disabled={issuing}
							className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-hover disabled:opacity-60">
							{issuing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
							Wystaw zaświadczenie
						</button>
					}>
					<p className="text-sm text-muted">
						Zaległość z tytułu składek na dzień {date(account.debt.asOf)}:{' '}
						<span className="font-semibold text-ink">{money(account.debt.amount)}</span>. Wypłatę zasiłku wstrzymuje zaległość powyżej{' '}
						{money(threshold)} (1% płacy minimalnej).
					</p>
					{certError && (
						<p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
							{certError}
						</p>
					)}
					{certificate && (
						<div className="enter mt-4 rounded-md border border-line bg-surface p-4 text-sm">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted">Zaświadczenie (symulacja)</p>
							<p className="mt-1 font-semibold text-ink">Nr {certificate.number}</p>
							<p className="text-xs text-muted">
								Wystawiono {new Date(certificate.issuedAt).toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' })}
							</p>
							<p className="mt-3 text-ink">{certificate.text}</p>
							{certificate.blocksBenefits && (
								<p className="mt-2 font-medium text-red-700 dark:text-red-300">
									Zaległość przekracza {money(certificate.threshold)} – zasiłek nie zostanie wypłacony do czasu spłaty całości.
								</p>
							)}
							<button
								type="button"
								onClick={() => window.print()}
								className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline hover:underline-offset-4">
								<Printer className="h-4 w-4" aria-hidden />
								Drukuj
							</button>
						</div>
					)}
				</Section>

				<Section title="Zwolnienia lekarskie (e-ZLA)">
					{account.eZla.length === 0 ? (
						<p className="text-sm text-muted">Brak zwolnień lekarskich.</p>
					) : (
						<ul className="divide-y divide-line">
							{account.eZla.map((z) => (
								<li key={z.number} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
									<div>
										<p className="font-semibold text-ink">
											{date(z.from)} – {date(z.to)}
										</p>
										<p className="text-muted">
											{z.number} · {z.issuer}
										</p>
									</div>
									<div className="flex gap-1.5">
										{z.pregnancyCodeB && (
											<span className="rounded border border-line px-1.5 text-xs font-semibold leading-5 text-ink">kod „B”</span>
										)}
										<span
											className={cx(
												'rounded px-1.5 text-xs font-semibold leading-5',
												z.status === 'aktywne' ? 'bg-brand-soft text-brand-ink' : 'bg-hover text-muted'
											)}>
											{z.status === 'aktywne' ? 'aktywne' : 'zakończone'}
										</span>
									</div>
								</li>
							))}
						</ul>
					)}
				</Section>

				<Section title="Świadczenia">
					{account.benefits.length === 0 ? (
						<p className="text-sm text-muted">Brak wypłaconych świadczeń.</p>
					) : (
						<ul className="divide-y divide-line">
							{account.benefits.map((b) => (
								<li key={`${b.type}-${b.from}`} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
									<div>
										<p className="font-semibold text-ink">{BENEFIT[b.type]}</p>
										<p className="text-muted">
											{date(b.from)} – {date(b.to)} · wypłaca {b.paidBy === 'zus' ? 'ZUS' : 'płatnik'}
										</p>
									</div>
									<div className="text-right">
										{b.amount != null && <p className="font-semibold text-ink tabular-nums">{money(b.amount)}</p>}
										<p className="text-xs text-muted">{BENEFIT_STATUS[b.status]}</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</Section>
			</div>

			<Section title="Przychody zgłoszone do ZUS (12 miesięcy)">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[28rem] text-sm">
						<thead>
							<tr className="text-left text-xs uppercase tracking-wider text-muted">
								<th className="pb-2 font-semibold">Miesiąc</th>
								<th className="pb-2 text-right font-semibold">Przychód brutto</th>
								<th className="pb-2 text-right font-semibold">Podstawa składki chorobowej</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{account.contributionBases.map((m) => (
								<tr key={m.month}>
									<td className="py-1.5 capitalize text-ink">{month(m.month)}</td>
									<td className="py-1.5 text-right tabular-nums text-ink">{money(m.gross)}</td>
									<td className="py-1.5 text-right tabular-nums text-muted">{m.sicknessBasis ? money(m.sicknessBasis) : '—'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Section>

			<p className="text-xs text-muted">
				Wersja demonstracyjna: dane osób są fikcyjne, a połączenie z mObywatelem i systemami ZUS jest symulowane.
			</p>
		</div>
	);
}
