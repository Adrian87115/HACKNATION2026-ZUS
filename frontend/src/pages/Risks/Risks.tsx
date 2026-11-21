import { CircleCheck, Info, ShieldCheck, TriangleExclamationPoint, OctagonExclamationPoint } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import {
	DEFAULT_ANSWERS,
	EMPLOYEE_PROTECTION,
	RISK_OVERVIEW,
	evaluateRisks,
	type RiskAnswers,
	type Severity,
	type YesNo
} from '../../data/benefitRisks';
import { useBenefitEngine } from '../../hooks/useBenefitEngine';
import { AppRoutePaths } from '../../types/shared';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/*  Form controls                                                      */
/* ------------------------------------------------------------------ */

function Options<T extends string>({
	label,
	hint,
	value,
	options,
	onChange
}: {
	label: string;
	hint?: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (v: T) => void;
}) {
	const id = useId();
	return (
		<div>
			<p id={id} className="text-sm font-medium text-ink">
				{label}
			</p>
			{hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
			<div role="radiogroup" aria-labelledby={id} className="mt-2 flex flex-wrap gap-1 rounded-md border border-line bg-surface p-0.5">
				{options.map((o) => (
					<button
						key={o.value}
						type="button"
						role="radio"
						aria-checked={value === o.value}
						onClick={() => onChange(o.value)}
						className={cx(
							'min-w-fit flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition',
							value === o.value ? 'bg-paper text-brand-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'
						)}>
						{o.label}
					</button>
				))}
			</div>
		</div>
	);
}

function DateInput({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
	const id = useId();
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium text-ink">
				{label}
			</label>
			<input
				id={id}
				type="date"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink shadow-xs transition hover:border-muted/60 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
			/>
			{hint && <p className="text-xs text-muted">{hint}</p>}
		</div>
	);
}

const YES_NO: { value: YesNo; label: string }[] = [
	{ value: 'tak', label: 'Tak' },
	{ value: 'nie', label: 'Nie' },
	{ value: 'nie-wiem', label: 'Nie wiem' }
];

/* ------------------------------------------------------------------ */
/*  Results                                                            */
/* ------------------------------------------------------------------ */

const SEVERITY: Record<Severity, { label: string; cls: string; icon: ReactNode }> = {
	high: {
		label: 'Wysokie ryzyko',
		cls: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100',
		icon: <OctagonExclamationPoint className="h-5 w-5 shrink-0" aria-hidden />
	},
	medium: {
		label: 'Sprawdź',
		cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100',
		icon: <TriangleExclamationPoint className="h-5 w-5 shrink-0" aria-hidden />
	},
	info: {
		label: 'Dobrze wiedzieć',
		cls: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100',
		icon: <Info className="h-5 w-5 shrink-0" aria-hidden />
	},
	ok: {
		label: 'Na Twoją korzyść',
		cls: 'border-brand/40 bg-brand-soft text-brand-ink',
		icon: <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
	}
};

export default function Risks() {
	const p = useBenefitEngine().getParams();
	const [a, setA] = useState<RiskAnswers>(DEFAULT_ANSWERS);
	const set = <K extends keyof RiskAnswers>(key: K, value: RiskAnswers[K]) => setA((prev) => ({ ...prev, [key]: value }));
	const risks = useMemo(() => evaluateRisks(a, p), [a, p]);
	const employee = a.employment === 'umowa-o-prace';
	const serious = risks.filter((r) => r.severity === 'high').length;

	return (
		<BaseLayout>
			<div className="space-y-10">
				<header className="enter space-y-2">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Ryzyka i ochrona</p>
					<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Co może odebrać lub obniżyć zasiłek?</h1>
					<p className="max-w-2xl text-muted">
						Odpowiedz na kilka pytań, a wskażemy sytuacje, w których możesz stracić prawo do zasiłku albo dostać niższy – i co
						możesz z tym zrobić.
					</p>
				</header>

				<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
					<section
						aria-label="Twoja sytuacja"
						className="enter space-y-5 rounded-lg border border-line bg-paper p-5 shadow-sm"
						style={{ animationDelay: '60ms' }}>
						<Options
							label="Jak pracujesz?"
							value={a.employment}
							onChange={(v) => set('employment', v)}
							options={[
								{ value: 'umowa-o-prace', label: 'Umowa o pracę' },
								{ value: 'zlecenie', label: 'Umowa zlecenia' },
								{ value: 'dzialalnosc', label: 'Działalność' }
							]}
						/>
						{employee && (
							<Options
								label="Rodzaj umowy o pracę"
								value={a.contractType}
								onChange={(v) => set('contractType', v)}
								options={[
									{ value: 'nieokreslony', label: 'Na czas nieokreślony' },
									{ value: 'okreslony', label: 'Na czas określony' },
									{ value: 'probny', label: 'Na okres próbny' }
								]}
							/>
						)}
						<div className="grid gap-4 sm:grid-cols-2">
							<DateInput
								label="Od kiedy masz ubezpieczenie chorobowe?"
								hint="Data zawarcia umowy lub zgłoszenia do ubezpieczenia"
								value={a.insuranceStart}
								onChange={(v) => set('insuranceStart', v)}
							/>
							<DateInput label="Przewidywana data porodu" value={a.dueDate} onChange={(v) => set('dueDate', v)} />
						</div>
						{!employee && (
							<Options
								label="Czy opłacasz dobrowolne ubezpieczenie chorobowe?"
								value={a.voluntaryInsurance}
								onChange={(v) => set('voluntaryInsurance', v)}
								options={YES_NO}
							/>
						)}
						<Options
							label={employee ? 'Czy umowa kończy się przed porodem?' : 'Czy umowa lub działalność kończy się przed porodem?'}
							value={a.endsBeforeBirth}
							onChange={(v) => set('endsBeforeBirth', v)}
							options={YES_NO}
						/>
						<Options
							label="Czy w ciąży podwyższono Twoje wynagrodzenie lub podstawę składek?"
							hint="Także jeśli dopiero to planujesz"
							value={a.baseRaised}
							onChange={(v) => set('baseRaised', v)}
							options={YES_NO}
						/>
						{!employee && (
							<Options
								label="Czy masz zaległości w składkach ZUS?"
								value={a.debt}
								onChange={(v) => set('debt', v)}
								options={YES_NO}
							/>
						)}
					</section>

					<section aria-live="polite" aria-label="Wynik" className="space-y-3 lg:sticky lg:top-24">
						<div
							className={cx(
								'enter rounded-lg border px-5 py-4',
								serious ? SEVERITY.high.cls : risks.some((r) => r.severity === 'medium') ? SEVERITY.medium.cls : SEVERITY.ok.cls
							)}
							style={{ animationDelay: '100ms' }}>
							<p className="flex items-center gap-2 font-semibold">
								{serious ? SEVERITY.high.icon : <CircleCheck className="h-5 w-5 shrink-0" aria-hidden />}
								{serious
									? `${serious} ${serious === 1 ? 'poważne ryzyko' : 'poważne ryzyka'} dla Twojego zasiłku`
									: risks.some((r) => r.severity === 'medium')
										? 'Kilka rzeczy warto sprawdzić'
										: 'Nie widzimy zagrożeń dla Twojego zasiłku'}
							</p>
						</div>

						<ul key={JSON.stringify(a)} className="enter-stagger space-y-3">
							{risks.map((r) => {
								const s = SEVERITY[r.severity];
								return (
									<li key={r.id} className={cx('rounded-lg border px-5 py-4', s.cls)}>
										<p className="text-xs font-semibold uppercase tracking-wider opacity-80">{s.label}</p>
										<h2 className="mt-1 flex items-start gap-2 font-semibold">
											{s.icon}
											{r.title}
										</h2>
										<p className="mt-1.5 text-sm">{r.body}</p>
										{r.todo.length > 0 && (
											<>
												<p className="mt-3 text-sm font-semibold">Co możesz zrobić</p>
												<ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
													{r.todo.map((t) => (
														<li key={t}>{t}</li>
													))}
												</ul>
											</>
										)}
										<p className="mt-3 text-xs opacity-75">{r.legal}</p>
									</li>
								);
							})}
						</ul>

						<Link
							to={AppRoutePaths.APPLICATIONS}
							className="block rounded-lg border border-line bg-paper px-5 py-4 text-sm font-semibold text-ink shadow-sm transition hover:border-brand">
							Jakie dokumenty złożyć i gdzie? →
						</Link>
					</section>
				</div>

				<section>
					<h2 className="enter text-xl font-semibold tracking-tight text-ink">Najczęstsze powody utraty lub obniżenia zasiłku</h2>
					<div className="enter-stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{RISK_OVERVIEW.map((r) => (
							<div key={r.title} className="rounded-lg border border-line bg-paper p-5">
								<h3 className="font-semibold text-ink">{r.title}</h3>
								<p className="mt-1.5 text-sm text-muted">{r.body}</p>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-lg border border-line bg-paper p-6">
					<h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
						<ShieldCheck className="h-5 w-5 text-brand-ink" aria-hidden />
						Szczególna ochrona pracownicy w ciąży
					</h2>
					<p className="mt-1 text-sm text-muted">Kodeks pracy – dotyczy osób zatrudnionych na umowę o pracę.</p>
					<ul className="mt-4 space-y-2 text-sm text-ink">
						{EMPLOYEE_PROTECTION.map((t) => (
							<li key={t} className="flex gap-2">
								<CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden />
								{t}
							</li>
						))}
					</ul>
				</section>

				<p className="text-xs text-muted">
					Informacje mają charakter orientacyjny i nie zastępują decyzji ZUS. W razie wątpliwości zapytaj w ZUS albo w Państwowej
					Inspekcji Pracy.
				</p>
			</div>
		</BaseLayout>
	);
}
