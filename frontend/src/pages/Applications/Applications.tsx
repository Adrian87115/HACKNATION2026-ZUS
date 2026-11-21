import { ArrowUpRight, Building2, Landmark, Scale } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import {
	BENEFITS,
	DOCUMENTS,
	EMPLOYMENTS,
	OFFICIAL_LINKS,
	PAYERS,
	ZUS_CHANNELS,
	buildGuide,
	type BenefitKey,
	type DocKey,
	type EmploymentKey,
	type PayerKey
} from '../../data/applicationGuide';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const pick = <T extends string>(value: string | null, options: { value: T }[], fallback: T): T =>
	options.some((o) => o.value === value) ? (value as T) : fallback;

/* ------------------------------------------------------------------ */
/*  Choice group                                                       */
/* ------------------------------------------------------------------ */

function Choice<T extends string>({
	label,
	value,
	options,
	onChange,
	columns
}: {
	label: string;
	value: T;
	options: { value: T; label: string; hint?: string }[];
	onChange: (v: T) => void;
	columns: string;
}) {
	const id = useId();
	return (
		<div>
			<p id={id} className="mb-2 text-sm font-semibold text-ink">
				{label}
			</p>
			<div role="radiogroup" aria-labelledby={id} className={cx('grid gap-2', columns)}>
				{options.map((o) => {
					const active = o.value === value;
					return (
						<button
							key={o.value}
							type="button"
							role="radio"
							aria-checked={active}
							onClick={() => onChange(o.value)}
							className={cx(
								'rounded-md border px-3 py-2.5 text-left transition',
								active
									? 'border-brand bg-brand-soft/60 ring-1 ring-brand'
									: 'border-line bg-paper hover:border-muted/60 hover:bg-hover'
							)}>
							<span className={cx('block text-sm font-semibold', active ? 'text-brand-ink' : 'text-ink')}>{o.label}</span>
							{o.hint && <span className="block text-xs text-muted">{o.hint}</span>}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function DocChip({ doc }: { doc: DocKey }) {
	const d = DOCUMENTS[doc];
	return (
		<a
			href={`#dok-${doc}`}
			title={d.name}
			className="inline-flex items-center rounded border border-line bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand-ink">
			{d.code}
		</a>
	);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
			<h2 className="text-base font-semibold text-ink">{title}</h2>
			<div className="mt-3">{children}</div>
		</section>
	);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const PAYER_STYLE = {
	payer: { icon: Building2, cls: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100' },
	zus: { icon: Landmark, cls: 'border-brand/40 bg-brand-soft text-brand-ink' },
	depends: { icon: Scale, cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100' }
} as const;

export default function Applications() {
	const [params, setParams] = useSearchParams();
	const benefit = pick<BenefitKey>(params.get('swiadczenie'), BENEFITS, 'macierzynski');
	const employment = pick<EmploymentKey>(params.get('zatrudnienie'), EMPLOYMENTS, 'umowa-o-prace');
	const payer = pick<PayerKey>(params.get('platnik'), PAYERS, 'nie-wiem');

	const update = (patch: Record<string, string>) =>
		setParams({ swiadczenie: benefit, zatrudnienie: employment, platnik: payer, ...patch }, { replace: true, preventScrollReset: true });

	const guide = buildGuide(benefit, employment, payer);
	const style = PAYER_STYLE[guide.payer.who];
	const PayerIcon = style.icon;

	const docs = Array.from(
		new Set<DocKey>([...guide.steps.flatMap((s) => s.docs ?? []), ...guide.attachments.map((a) => a.doc)])
	);

	return (
		<BaseLayout>
			<div className="space-y-8">
				<header className="enter space-y-2">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Dokumenty i wnioski</p>
					<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Jakie dokumenty złożyć i gdzie?</h1>
					<p className="max-w-2xl text-muted">
						Odpowiedz na trzy pytania, a pokażemy, kto wypłaci zasiłek, jakie wnioski przygotować, w jakich terminach i gdzie je
						złożyć.
					</p>
				</header>

				<section
					aria-label="Twoja sytuacja"
					className="enter space-y-5 rounded-lg border border-line bg-paper p-5 shadow-sm"
					style={{ animationDelay: '60ms' }}>
					<Choice
						label="1. Czego dotyczy Twoja sprawa?"
						value={benefit}
						options={BENEFITS}
						onChange={(v) => update({ swiadczenie: v })}
						columns="sm:grid-cols-2 lg:grid-cols-5"
					/>
					<Choice
						label="2. Jak pracujesz?"
						value={employment}
						options={EMPLOYMENTS}
						onChange={(v) => update({ zatrudnienie: v })}
						columns="grid-cols-1 sm:grid-cols-3"
					/>
					{employment !== 'dzialalnosc' && (
						<Choice
							label={`3. Ile osób ${employment === 'umowa-o-prace' ? 'pracodawca' : 'zleceniodawca'} zgłasza do ubezpieczenia chorobowego?`}
							value={payer}
							options={PAYERS}
							onChange={(v) => update({ platnik: v })}
							columns="grid-cols-1 sm:grid-cols-3"
						/>
					)}
				</section>

				<div key={`${benefit}-${employment}-${payer}`} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
					<div className="enter-stagger space-y-6">
						<div className={cx('flex items-start gap-3 rounded-lg border px-5 py-4', style.cls)}>
							<PayerIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
							<div>
								<h2 className="font-semibold">{guide.payer.title}</h2>
								<p className="mt-1 text-sm">{guide.payer.body}</p>
							</div>
						</div>

						<Panel title="Krok po kroku">
							<ol className="space-y-4">
								{guide.steps.map((step, i) => (
									<li key={step.title} className="flex gap-3">
										<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-sm font-bold text-brand-ink">
											{i + 1}
										</span>
										<div className="min-w-0">
											<h3 className="font-semibold text-ink">{step.title}</h3>
											<p className="mt-0.5 text-sm text-muted">{step.body}</p>
											{step.docs && step.docs.length > 0 && (
												<div className="mt-2 flex flex-wrap gap-1.5">
													{step.docs.map((d) => (
														<DocChip key={d} doc={d} />
													))}
												</div>
											)}
										</div>
									</li>
								))}
							</ol>
						</Panel>

						{guide.attachments.length > 0 && (
							<Panel title="Dołącz, jeśli dotyczy Twojej sytuacji">
								<ul className="space-y-2 text-sm">
									{guide.attachments.map((a) => (
										<li key={a.doc} className="flex flex-wrap items-baseline gap-2">
											<DocChip doc={a.doc} />
											<span className="text-muted">{a.when}</span>
										</li>
									))}
								</ul>
							</Panel>
						)}

						<Panel title="Dokumenty w tej sprawie">
							<dl className="divide-y divide-line">
								{docs.map((key) => {
									const d = DOCUMENTS[key];
									return (
										<div key={key} id={`dok-${key}`} className="scroll-mt-24 py-3 first:pt-0 last:pb-0">
											<dt className="flex flex-wrap items-baseline gap-x-2">
												<span className="font-semibold text-ink">{d.code}</span>
												{d.code !== d.name && <span className="text-sm text-muted">{d.name}</span>}
											</dt>
											<dd className="mt-0.5 text-sm text-muted">{d.description}</dd>
											<dd className="mt-1 text-xs font-medium text-brand-ink">{d.who}</dd>
										</div>
									);
								})}
							</dl>
						</Panel>
					</div>

					<aside className="enter-stagger space-y-6 lg:sticky lg:top-24" style={{ '--enter-offset': '80ms' } as CSSProperties}>
						<Panel title="Terminy i liczby">
							<dl className="space-y-3">
								{guide.deadlines.map((d) => (
									<div key={d.value + d.label}>
										<dt className="text-xl font-bold tracking-tight text-ink tabular-nums">{d.value}</dt>
										<dd className="text-sm text-ink">{d.label}</dd>
										{d.note && <dd className="mt-0.5 text-xs text-muted">{d.note}</dd>}
									</div>
								))}
							</dl>
						</Panel>

						{guide.filesWithZus && (
							<Panel title="Jak złożyć dokumenty w ZUS">
								<ul className="space-y-3 text-sm">
									{ZUS_CHANNELS.map((c) => (
										<li key={c.title}>
											<p className="font-semibold text-ink">{c.title}</p>
											<p className="text-muted">{c.body}</p>
										</li>
									))}
								</ul>
							</Panel>
						)}

						<Panel title="Oficjalne źródła">
							<ul className="space-y-2 text-sm">
								{OFFICIAL_LINKS.map((l) => (
									<li key={l.href}>
										<a
											href={l.href}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline hover:underline-offset-4">
											{l.label}
											<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
											<span className="sr-only">(otwiera się w nowej karcie)</span>
										</a>
									</li>
								))}
							</ul>
						</Panel>
					</aside>
				</div>

				<p className="text-xs text-muted">
					Informacje mają charakter orientacyjny. W razie wątpliwości zapytaj w dziale kadr lub w ZUS.
				</p>
			</div>
		</BaseLayout>
	);
}
