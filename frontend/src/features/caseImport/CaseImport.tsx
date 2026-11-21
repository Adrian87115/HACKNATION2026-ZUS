import {
	ArrowRight,
	CircleX,
	Clock,
	FileText,
	FileUp,
	Info,
	LoaderCircle,
	ShieldBan,
	ShieldCheck,
	ShieldEllipsis,
	Sparkles,
	Trash,
	TriangleExclamationPoint,
	X
} from 'lucide-react';
import { useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useBenefitEngine } from '../../hooks/useBenefitEngine';
import {
	ACCEPTED_FILE_TYPES,
	MAX_FILE_BYTES,
	MAX_FILES,
	analyzeCase,
	caseFileUrl,
	caseName,
	deleteCase,
	extractCase,
	loadStoredCases,
	saveStoredCases,
	type CalculatorTarget,
	type CaseAnalysis,
	type CaseExtraction,
	type InsuranceStatus,
	type StoredCase
} from './caseData';

/* ------------------------------------------------------------------ */
/*  Labels                                                             */
/* ------------------------------------------------------------------ */

const EMPLOYMENT: Record<CaseExtraction['employment_type'], string> = {
	employee: 'Umowa o pracę',
	contract: 'Umowa zlecenia',
	business: 'Działalność gospodarcza',
	other: 'Inna forma',
	unknown: 'Nie ustalono'
};
const EVENT: Record<CaseExtraction['event'], string> = {
	birth: 'Urodzenie dziecka',
	adoption: 'Adopcja',
	foster: 'Rodzina zastępcza',
	pregnancy: 'Ciąża – zwolnienie lekarskie',
	unknown: 'Nie ustalono'
};
const ROLE: Record<CaseExtraction['person_role'], string> = { mother: 'Matka', father: 'Ojciec', unknown: 'Nie ustalono' };
const LEAVE: Record<string, string> = {
	maternity: 'Urlop macierzyński',
	maternity_conditions: 'Urlop na warunkach macierzyńskiego',
	supplementary_maternity: 'Uzupełniający urlop macierzyński',
	parental: 'Urlop rodzicielski',
	paternity: 'Urlop ojcowski'
};
const DOC: Record<string, string> = {
	poswiadczenie_ubezpieczenia: 'Poświadczenie ubezpieczenia',
	zrzut_systemu_ZUS: 'Zrzut z systemu ZUS',
	zaswiadczenie_lekarskie: 'Zaświadczenie lekarskie',
	akt_urodzenia: 'Akt urodzenia',
	decyzja_ZUS: 'Decyzja ZUS',
	inny: 'Inny dokument'
};
const TARGET_LABEL: Record<CalculatorTarget, string> = {
	maternity: 'kalkulator urlopów rodzicielskich',
	pregnancy: 'kalkulator świadczeń w ciąży'
};

const INSURANCE: Record<InsuranceStatus, { label: string; cls: string; icon: ReactNode }> = {
	insured: {
		label: 'Ubezpieczenie chorobowe potwierdzone',
		cls: 'border-brand/40 bg-brand-soft text-brand-ink',
		icon: <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
	},
	not_insured: {
		label: 'Brak ubezpieczenia chorobowego',
		cls: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
		icon: <ShieldBan className="h-5 w-5 shrink-0" aria-hidden />
	},
	unknown: {
		label: 'Nie ustalono ubezpieczenia chorobowego',
		cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
		icon: <ShieldEllipsis className="h-5 w-5 shrink-0" aria-hidden />
	}
};

const money = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
const date = (iso: string | null | undefined) =>
	iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
		? new Date(`${iso}T00:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
		: '—';
const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type Props = {
	/** Fill the calculator with the case data and calculate. */
	onApply: (analysis: CaseAnalysis, target: CalculatorTarget, name: string) => void;
};

type State =
	| { kind: 'idle' }
	| { kind: 'loading' }
	| { kind: 'error'; message: string }
	| { kind: 'done'; stored: StoredCase };

export default function CaseImport({ onApply }: Props) {
	const id = useId();
	const engine = useBenefitEngine();
	const inputRef = useRef<HTMLInputElement>(null);
	const abortRef = useRef<AbortController | null>(null);

	const [files, setFiles] = useState<File[]>([]);
	const [fileError, setFileError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);
	const [state, setState] = useState<State>({ kind: 'idle' });
	const [recent, setRecent] = useState<StoredCase[]>(loadStoredCases);

	const analysis = useMemo(
		() => (state.kind === 'done' ? analyzeCase(state.stored.extraction, engine) : null),
		[state, engine]
	);

	function addFiles(list: FileList | File[]) {
		const incoming = Array.from(list);
		const accepted = incoming.filter((f) => ACCEPTED_FILE_TYPES.split(',').includes(f.type) || /\.pdf$/i.test(f.name));
		const tooBig = accepted.filter((f) => f.size > MAX_FILE_BYTES);
		const ok = accepted.filter((f) => f.size <= MAX_FILE_BYTES);
		const next = [...files, ...ok.filter((f) => !files.some((e) => e.name === f.name && e.size === f.size))].slice(
			0,
			MAX_FILES
		);
		setFiles(next);
		setFileError(
			incoming.length !== accepted.length
				? 'Część plików pominięto – dodaj dokumenty PDF albo zdjęcia (JPG, PNG).'
				: tooBig.length
					? `Pominięto pliki większe niż 10 MB: ${tooBig.map((f) => f.name).join(', ')}.`
					: files.length + ok.length > MAX_FILES
						? `Możesz dodać maksymalnie ${MAX_FILES} plików.`
						: null
		);
		if (state.kind === 'error') setState({ kind: 'idle' });
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		setDragging(false);
		if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
	}

	async function read() {
		if (!files.length) return;
		const controller = new AbortController();
		abortRef.current = controller;
		setState({ kind: 'loading' });
		try {
			const extraction = await extractCase(files, controller.signal);
			const stored: StoredCase = {
				id: crypto.randomUUID(),
				name: caseName(files),
				createdAt: new Date().toISOString(),
				extraction
			};
			const nextRecent = [stored, ...recent];
			setRecent(nextRecent);
			saveStoredCases(nextRecent);
			setFiles([]);
			setState({ kind: 'done', stored });
		} catch (err) {
			if ((err as Error).name === 'AbortError') setState({ kind: 'idle' });
			else setState({ kind: 'error', message: (err as Error).message });
		} finally {
			abortRef.current = null;
		}
	}

	function removeRecent(caseId: string) {
		const removed = recent.find((c) => c.id === caseId);
		if (removed?.extraction.case_id) void deleteCase(removed.extraction.case_id);
		const next = recent.filter((c) => c.id !== caseId);
		setRecent(next);
		saveStoredCases(next);
		if (state.kind === 'done' && state.stored.id === caseId) setState({ kind: 'idle' });
	}

	return (
		<section aria-labelledby={`${id}-title`} className="rounded-lg border border-line bg-paper shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
				<div className="min-w-0">
					<h2 id={`${id}-title`} className="text-base font-semibold text-ink">
						Wczytaj sprawę z dokumentów
					</h2>
					<p className="mt-0.5 max-w-2xl text-sm text-muted">
						Dodaj dokumenty sprawy – np. ZAM, Z-3, Z-3a, ZAS-53, e-ZLA albo poświadczenie ubezpieczenia. Odczytamy z nich
						dane, sprawdzimy ubezpieczenie chorobowe i uzupełnimy kalkulator.
					</p>
				</div>
				<span className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 text-xs font-medium text-muted">
					<Sparkles className="h-3.5 w-3.5" aria-hidden />
					Odczyt wspierany przez AI
				</span>
			</div>

			<div className="space-y-4 px-5 py-4">
				{state.kind === 'done' && analysis ? (
					<Review
						stored={state.stored}
						analysis={analysis}
						onApply={(target) => onApply(analysis, target, state.stored.name)}
						onClose={() => setState({ kind: 'idle' })}
					/>
				) : state.kind === 'loading' ? (
					<div className="flex flex-col items-center gap-3 rounded-md border border-line bg-surface px-6 py-8 text-center" role="status">
						<LoaderCircle className="h-6 w-6 animate-spin text-brand-ink" aria-hidden />
						<div>
							<p className="font-medium text-ink">Odczytuję dokumenty…</p>
							<p className="mt-0.5 text-sm text-muted">To może potrwać do minuty, zależnie od liczby stron.</p>
						</div>
						<button
							type="button"
							onClick={() => abortRef.current?.abort()}
							className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-hover">
							Anuluj
						</button>
					</div>
				) : (
					<>
						<div
							onDragOver={(e) => {
								e.preventDefault();
								setDragging(true);
							}}
							onDragLeave={() => setDragging(false)}
							onDrop={onDrop}
							className={cx(
								'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-8 text-center transition',
								dragging ? 'border-brand bg-brand-soft/50' : 'border-line bg-surface'
							)}>
							<FileUp className="h-6 w-6 text-muted" aria-hidden />
							<p className="text-sm text-ink">
								Przeciągnij pliki tutaj albo{' '}
								<button
									type="button"
									onClick={() => inputRef.current?.click()}
									className="font-semibold text-brand-ink underline-offset-4 hover:underline">
									wybierz z dysku
								</button>
							</p>
							<p className="text-xs text-muted">PDF lub zdjęcia (JPG, PNG) · do {MAX_FILES} plików · maks. 10 MB każdy</p>
							<input
								ref={inputRef}
								type="file"
								multiple
								accept={ACCEPTED_FILE_TYPES}
								className="sr-only"
								aria-label="Wybierz dokumenty sprawy"
								onChange={(e) => {
									if (e.target.files) addFiles(e.target.files);
									e.target.value = '';
								}}
							/>
						</div>

						{fileError && <p className="text-sm text-amber-700 dark:text-amber-300">{fileError}</p>}

						{files.length > 0 && (
							<ul className="divide-y divide-line rounded-md border border-line">
								{files.map((f) => (
									<li key={`${f.name}-${f.size}`} className="flex items-center gap-3 px-3 py-2 text-sm">
										<FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
										<span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
										<span className="shrink-0 text-xs text-muted tabular-nums">{size(f.size)}</span>
										<button
											type="button"
											aria-label={`Usuń ${f.name}`}
											onClick={() => setFiles(files.filter((x) => x !== f))}
											className="rounded p-1 text-muted transition hover:bg-hover hover:text-ink">
											<X className="h-4 w-4" aria-hidden />
										</button>
									</li>
								))}
							</ul>
						)}

						{state.kind === 'error' && (
							<div
								role="alert"
								className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
								<CircleX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
								{state.message}
							</div>
						)}

						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								disabled={!files.length}
								onClick={read}
								className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong disabled:bg-hover disabled:text-muted disabled:shadow-none">
								<Sparkles className="h-4 w-4" aria-hidden />
								{state.kind === 'error' ? 'Spróbuj ponownie' : 'Odczytaj dokumenty'}
							</button>
							<p className="text-xs text-muted">
								Dokumenty przechowujemy w prywatnym magazynie maksymalnie 30 dni – możesz je usunąć w każdej chwili.
							</p>
						</div>

						{recent.length > 0 && (
							<div>
								<h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
									<Clock className="h-3.5 w-3.5" aria-hidden />
									Wczytane sprawy
								</h3>
								<ul className="mt-2 divide-y divide-line rounded-md border border-line">
									{recent.map((c) => (
										<li key={c.id} className="flex items-center gap-2 pr-2">
											<button
												type="button"
												onClick={() => setState({ kind: 'done', stored: c })}
												className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-hover">
												<span className="min-w-0 flex-1 truncate font-medium text-ink">{c.name}</span>
												<span className="shrink-0 text-xs text-muted">
													{new Date(c.createdAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
												</span>
												<ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
											</button>
											<button
												type="button"
												aria-label={`Usuń sprawę ${c.name}`}
												onClick={() => removeRecent(c.id)}
												className="rounded p-1.5 text-muted transition hover:bg-hover hover:text-ink">
												<Trash className="h-4 w-4" aria-hidden />
											</button>
										</li>
									))}
								</ul>
								<p className="mt-1.5 text-xs text-muted">
									Lista jest zapisana tylko w tej przeglądarce. Usunięcie sprawy usuwa też jej dokumenty z serwera.
								</p>
							</div>
						)}
					</>
				)}
			</div>
		</section>
	);
}

/* ------------------------------------------------------------------ */
/*  Review of extracted data                                           */
/* ------------------------------------------------------------------ */

function Review({
	stored,
	analysis,
	onApply,
	onClose
}: {
	stored: StoredCase;
	analysis: CaseAnalysis;
	onApply: (target: CalculatorTarget) => void;
	onClose: () => void;
}) {
	const x = stored.extraction;
	const ins = INSURANCE[analysis.insurance.status];
	const other: CalculatorTarget = analysis.target === 'maternity' ? 'pregnancy' : 'maternity';
	const warnings = [...analysis.missing, ...x.warnings];

	const rows: [string, ReactNode][] = [
		['Rodzaj sprawy', EVENT[x.event]],
		['Osoba', ROLE[x.person_role]],
		['Forma zatrudnienia', EMPLOYMENT[x.employment_type]],
		[x.event === 'adoption' || x.event === 'foster' ? 'Data przyjęcia dziecka' : 'Data porodu', date(x.event_date ?? x.expected_birth_date)],
		['Liczba dzieci', x.children_count ?? '—'],
		[
			'Podstawa wymiaru zasiłku',
			analysis.basis ? (
				<>
					{money(analysis.basis.monthly)}
					<span className="block text-xs font-normal text-muted">
						{analysis.basis.source === 'salary' ? `wyliczona z ${analysis.basis.months} mies. wynagrodzeń` : 'podana w dokumentach'}
					</span>
				</>
			) : (
				'—'
			)
		],
		['Zadłużenie składkowe', x.contribution_debt != null ? money(x.contribution_debt) : '—']
	];

	return (
		<div className="enter-stagger space-y-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Odczytana sprawa</p>
					<h3 className="mt-0.5 truncate text-base font-semibold text-ink">{stored.name}</h3>
					<p className="mt-1 text-sm text-muted">{x.summary}</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					aria-label="Zamknij podgląd sprawy"
					className="rounded p-1.5 text-muted transition hover:bg-hover hover:text-ink">
					<X className="h-4 w-4" aria-hidden />
				</button>
			</div>

			<div className={cx('rounded-md border px-4 py-3', ins.cls)}>
				<p className="flex items-center gap-2 font-semibold">
					{ins.icon}
					{ins.label}
				</p>
				<ul className="mt-1 space-y-0.5 pl-7 text-sm">
					{analysis.insurance.reasons.map((r) => (
						<li key={r}>{r}</li>
					))}
				</ul>
			</div>

			<dl className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 *:bg-paper">
				{rows.map(([k, v]) => (
					<div key={k} className="px-4 py-2.5">
						<dt className="text-xs text-muted">{k}</dt>
						<dd className="mt-0.5 text-sm font-medium text-ink tabular-nums">{v}</dd>
					</div>
				))}
			</dl>

			{(x.leave_periods.length > 0 || x.incapacity_periods.length > 0) && (
				<div>
					<h4 className="text-sm font-semibold text-ink">Okresy z dokumentów</h4>
					<ul className="mt-1.5 space-y-1 text-sm text-ink">
						{x.leave_periods.map((l, i) => (
							<li key={`l${i}`}>
								{LEAVE[l.type] ?? l.type}
								{l.parent !== 'unknown' && <span className="text-muted"> · {ROLE[l.parent]}</span>}
								<span className="text-muted">
									{' '}
									· {date(l.start_date)} – {date(l.end_date)}
								</span>
								{l.work_fte ? <span className="text-muted"> · praca {l.work_fte} etatu</span> : null}
							</li>
						))}
						{x.incapacity_periods.map((p, i) => (
							<li key={`i${i}`}>
								Zwolnienie lekarskie{p.pregnancy_code_b ? ' (kod „B”)' : ''}
								<span className="text-muted">
									{' '}
									· {date(p.start_date)} – {date(p.end_date)}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{x.zus_decision && (x.zus_decision.granted != null || x.zus_decision.amount != null) && (
				<div className="flex items-start gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm">
					<Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
					<p className="text-ink">
						<span className="font-semibold">Rozstrzygnięcie w dokumentach: </span>
						{x.zus_decision.granted === true ? 'świadczenie przyznane' : x.zus_decision.granted === false ? 'odmowa' : 'brak informacji'}
						{x.zus_decision.benefit && ` (${x.zus_decision.benefit})`}
						{x.zus_decision.amount != null && ` – ${money(x.zus_decision.amount)}`}
						{x.zus_decision.reason && <span className="block text-muted">{x.zus_decision.reason}</span>}
						<span className="mt-1 block text-xs text-muted">Porównaj z wynikiem kalkulatora poniżej.</span>
					</p>
				</div>
			)}

			{warnings.length > 0 && (
				<div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
					<p className="flex items-center gap-2 font-semibold">
						<TriangleExclamationPoint className="h-4 w-4 shrink-0" aria-hidden />
						Sprawdź przed obliczeniem
					</p>
					<ul className="mt-1 list-disc space-y-0.5 pl-6">
						{warnings.map((w) => (
							<li key={w}>{w}</li>
						))}
					</ul>
				</div>
			)}

			{x.case_id && x.files && x.files.length > 0 && (
				<div>
					<h4 className="text-sm font-semibold text-ink">Pliki źródłowe</h4>
					<ul className="mt-1.5 flex flex-wrap gap-2">
						{x.files.map((f) => (
							<li key={f.id}>
								<a
									href={caseFileUrl(x.case_id!, f.id)}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex max-w-xs items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink transition hover:border-brand hover:text-brand-ink">
									<FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
									<span className="truncate">{f.name}</span>
									<span className="sr-only">(otwiera się w nowej karcie)</span>
								</a>
							</li>
						))}
					</ul>
				</div>
			)}

			{x.documents.length > 0 && (
				<div>
					<h4 className="text-sm font-semibold text-ink">Rozpoznane dokumenty</h4>
					<ul className="mt-1.5 space-y-1 text-sm">
						{x.documents.map((d, i) => (
							<li key={i} className="flex gap-2">
								<span className="shrink-0 rounded border border-line px-1.5 text-xs font-semibold leading-5 text-ink">
									{DOC[d.type] ?? d.type}
								</span>
								<span className="text-muted">{d.summary}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
				<button
					type="button"
					onClick={() => onApply(analysis.target)}
					className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong">
					Uzupełnij {TARGET_LABEL[analysis.target]} i oblicz
					<ArrowRight className="h-4 w-4" aria-hidden />
				</button>
				<button
					type="button"
					onClick={() => onApply(other)}
					className="rounded-md border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-hover">
					Użyj w: {TARGET_LABEL[other]}
				</button>
			</div>
			<p className="text-xs text-muted">
				Dane odczytuje model AI (Google Gemini) – mogą zawierać błędy. Wszystkie pola możesz poprawić w kalkulatorze.
			</p>
		</div>
	);
}
