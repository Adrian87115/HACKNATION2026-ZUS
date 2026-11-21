import { ArrowLeft, CircleCheck, LoaderCircle, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { accountApi, type Persona } from '../../features/account/accountApi';
import { useAuth } from '../../features/account/AuthContext';
import { AppRoutePaths } from '../../types/shared';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Step = 'start' | 'confirm' | 'signing';

/**
 * Simulated sign-in with mObywatel (the brief asks only for a simulation).
 * Flow mirrors the real one: start → confirm in the mObywatel app with a verification code → back to the service.
 * Instead of a real identity, the user picks one of the fictional demo profiles.
 */
export default function Login() {
	const { status, login } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const from = (location.state as { from?: string } | null)?.from ?? AppRoutePaths.ACCOUNT;

	const [step, setStep] = useState<Step>('start');
	const [personas, setPersonas] = useState<Persona[] | null>(null);
	const [persona, setPersona] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [code] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));

	useEffect(() => {
		if (step !== 'confirm' || personas) return;
		accountApi
			.personas()
			.then((list) => {
				setPersonas(list);
				setPersona(list[0]?.id ?? null);
			})
			.catch((err: Error) => setError(err.message));
	}, [step, personas]);

	if (status === 'authenticated') return <Navigate to={from} replace />;

	async function confirm() {
		if (!persona) return;
		setStep('signing');
		setError(null);
		try {
			// short pause so the hand-over from the mObywatel app is visible in the demo
			await Promise.all([login(persona), new Promise((r) => setTimeout(r, 900))]);
			navigate(from, { replace: true });
		} catch (err) {
			setError((err as Error).message);
			setStep('confirm');
		}
	}

	return (
		<BaseLayout>
			<div className="mx-auto max-w-lg space-y-6 py-4">
				<header className="enter space-y-2 text-center">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Moje konto</p>
					<h1 className="text-3xl font-bold tracking-tight text-ink">Zaloguj się</h1>
					<p className="text-muted">
						Po zalogowaniu pobierzemy Twoje dane z ZUS – ubezpieczenia, podstawę zasiłku, zwolnienia lekarskie i stan rozliczeń –
						i wykorzystamy je w kalkulatorach.
					</p>
				</header>

				<p className="enter rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
					<span className="font-semibold">Wersja demonstracyjna.</span> Logowanie przez mObywatela i dane z ZUS są symulowane – wybierasz
					jedną z fikcyjnych osób testowych.
				</p>

				<section className="enter rounded-lg border border-line bg-paper p-6 shadow-sm" style={{ animationDelay: '60ms' }}>
					{step === 'start' && (
						<div className="space-y-4 text-center">
							<Smartphone className="mx-auto h-8 w-8 text-brand-ink" aria-hidden />
							<p className="text-sm text-muted">Zaloguj się bezpiecznie aplikacją mObywatel na telefonie.</p>
							<button
								type="button"
								onClick={() => setStep('confirm')}
								className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong">
								Zaloguj się przez mObywatel
							</button>
						</div>
					)}

					{step !== 'start' && (
						<div className="space-y-5">
							<button
								type="button"
								onClick={() => setStep('start')}
								disabled={step === 'signing'}
								className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50">
								<ArrowLeft className="h-4 w-4" aria-hidden />
								Wróć
							</button>

							<div className="rounded-md border border-line bg-surface p-4 text-center">
								<p className="text-sm text-muted">Otwórz aplikację mObywatel i potwierdź logowanie. Kod weryfikacyjny:</p>
								<p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-ink" aria-label={`Kod ${code.split('').join(' ')}`}>
									{code}
								</p>
							</div>

							<fieldset disabled={step === 'signing'}>
								<legend className="text-sm font-semibold text-ink">Symulacja: wybierz osobę testową</legend>
								{!personas && !error && (
									<div className="flex justify-center py-6 text-muted">
										<LoaderCircle className="h-5 w-5 animate-spin" aria-label="Wczytuję osoby testowe" />
									</div>
								)}
								<div className="mt-2 space-y-2" role="radiogroup">
									{personas?.map((p) => (
										<label
											key={p.id}
											className={cx(
												'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition',
												persona === p.id ? 'border-brand bg-brand-soft/50' : 'border-line hover:bg-hover'
											)}>
											<input
												type="radio"
												name="persona"
												value={p.id}
												checked={persona === p.id}
												onChange={() => setPersona(p.id)}
												className="mt-1 accent-(--brand)"
											/>
											<span>
												<span className="block text-sm font-semibold text-ink">{p.label}</span>
												<span className="block text-xs text-muted">{p.description}</span>
											</span>
										</label>
									))}
								</div>
							</fieldset>

							{error && (
								<p role="alert" className="text-sm text-red-700 dark:text-red-300">
									{error}
								</p>
							)}

							<button
								type="button"
								onClick={() => void confirm()}
								disabled={!persona || step === 'signing'}
								className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60">
								{step === 'signing' ? (
									<>
										<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
										Pobieram dane z ZUS…
									</>
								) : (
									<>
										<CircleCheck className="h-4 w-4" aria-hidden />
										Potwierdź w aplikacji
									</>
								)}
							</button>
						</div>
					)}
				</section>
			</div>
		</BaseLayout>
	);
}
