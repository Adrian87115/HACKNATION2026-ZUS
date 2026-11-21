import { ArrowRight, Check } from 'lucide-react';
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { benefitAmount, type BenefitParams } from '@zus/engine';
import { useBenefitEngine } from '../../hooks/useBenefitEngine';
import { useCountUp } from '../../hooks/useCountUp';
import type { TranslationKey } from '../../translations';
import { AppRoutePaths } from '../../types/shared';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const money = (n: number, fractionDigits = 0) =>
	n.toLocaleString('pl-PL', {
		style: 'currency',
		currency: 'PLN',
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	});

const pct = (rate: number) => `${(rate * 100).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/*  Quick estimate                                                     */
/* ------------------------------------------------------------------ */

type Variant = 'combined' | 'split';

function estimate(p: Readonly<BenefitParams>, basis: number, variant: Variant) {
	const maternityWeeks = p.MATERNITY_WEEKS_BY_CHILDREN[1];
	const parentalWeeks = p.PARENTAL_WEEKS_SINGLE_CHILD - p.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS;
	const totalWeeks = maternityWeeks + parentalWeeks;

	if (variant === 'combined') {
		const a = benefitAmount(p, { monthlyBasis: basis, rate: p.RATE_COMBINED_21_DAYS, days: totalWeeks * 7 });
		return {
			totalWeeks,
			total: a.totalAmount,
			rows: [{ key: 'home.estimate.rowCombined' as const, weeks: totalWeeks, monthly: a.monthlyAmount }]
		};
	}
	const m = benefitAmount(p, { monthlyBasis: basis, rate: p.RATE_FULL, days: maternityWeeks * 7 });
	const r = benefitAmount(p, { monthlyBasis: basis, rate: p.RATE_PARENTAL_70, days: parentalWeeks * 7 });
	return {
		totalWeeks,
		total: m.totalAmount + r.totalAmount,
		rows: [
			{ key: 'home.estimate.rowMaternity' as const, weeks: maternityWeeks, monthly: m.monthlyAmount },
			{ key: 'home.estimate.rowParental' as const, weeks: parentalWeeks, monthly: r.monthlyAmount }
		]
	};
}

function QuickEstimate() {
	const { t } = useTranslation();
	const engine = useBenefitEngine();
	const p = engine.getParams();
	const id = useId();

	const [gross, setGross] = useState('7500');
	const [variant, setVariant] = useState<Variant>('combined');

	const parsed = Number(gross.replace(/\s/g, '').replace(',', '.'));
	const valid = gross.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;

	const result = useMemo(() => {
		if (!valid) return null;
		try {
			const basis = engine.calculateBasis({
				kind: 'employee',
				months: Array.from({ length: 12 }, () => ({ grossSalary: parsed })),
				fullTime: true
			}).monthlyBasis;
			return { basis, ...estimate(p, basis, variant) };
		} catch {
			return null;
		}
	}, [engine, p, parsed, valid, variant]);

	const total = useCountUp(result?.total ?? 0, 500);

	const variants: { value: Variant; label: string }[] = [
		{ value: 'combined', label: t('home.estimate.combined', { rate: pct(p.RATE_COMBINED_21_DAYS) }) },
		{
			value: 'split',
			label: t('home.estimate.split', { full: pct(p.RATE_FULL), parental: pct(p.RATE_PARENTAL_70) })
		}
	];

	return (
		<section
			aria-labelledby={`${id}-title`}
			className="enter rounded-lg border border-line bg-paper shadow-sm"
			style={{ animationDelay: '120ms' }}>
			<div className="border-b border-line px-5 py-4">
				<h2 id={`${id}-title`} className="text-base font-semibold text-ink">
					{t('home.estimate.title')}
				</h2>
				<p className="mt-0.5 text-sm text-muted">{t('home.estimate.subtitle')}</p>
			</div>

			<div className="space-y-4 px-5 py-4">
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-gross`} className="text-sm font-medium text-ink">
						{t('home.estimate.grossLabel')}
					</label>
					<div className="relative">
						<input
							id={`${id}-gross`}
							type="text"
							inputMode="decimal"
							autoComplete="off"
							value={gross}
							onChange={(e) => setGross(e.target.value)}
							aria-invalid={!valid}
							aria-describedby={`${id}-hint`}
							className={cx(
								'h-11 w-full rounded-md border bg-paper px-3 pr-10 text-base text-ink tabular-nums shadow-xs transition',
								'focus:outline-none focus:ring-4',
								valid
									? 'border-line hover:border-muted/60 focus:border-brand focus:ring-brand/15'
									: 'border-red-500 focus:ring-red-500/15'
							)}
						/>
						<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
							zł
						</span>
					</div>
					<p id={`${id}-hint`} className={cx('text-xs', valid ? 'text-muted' : 'text-red-600 dark:text-red-300')}>
						{valid ? t('home.estimate.grossHint') : t('home.estimate.invalid')}
					</p>
				</div>

				<div className="flex flex-col gap-1.5">
					<span className="text-sm font-medium text-ink">{t('home.estimate.variantLabel')}</span>
					<div
						role="radiogroup"
						aria-label={t('home.estimate.variantLabel')}
						className="flex gap-1 rounded-md border border-line bg-surface p-0.5">
						{variants.map((v) => (
							<button
								key={v.value}
								type="button"
								role="radio"
								aria-checked={variant === v.value}
								onClick={() => setVariant(v.value)}
								className={cx(
									'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition',
									variant === v.value
										? 'bg-paper text-brand-ink shadow-sm ring-1 ring-line'
										: 'text-muted hover:text-ink'
								)}>
								{v.label}
							</button>
						))}
					</div>
				</div>

				{result && (
					<div className="space-y-3 rounded-md bg-surface p-4">
						<dl className="space-y-2 text-sm">
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-muted">{t('home.estimate.basis')}</dt>
								<dd className="font-medium tabular-nums text-ink">{money(result.basis, 2)}</dd>
							</div>
							{result.rows.map((row) => (
								<div key={row.key} className="flex items-baseline justify-between gap-3">
									<dt className="text-muted">{t(row.key, { weeks: row.weeks })}</dt>
									<dd className="font-semibold tabular-nums text-ink">
										{money(row.monthly, 2)}{' '}
										<span className="font-normal text-muted">{t('home.estimate.perMonth')}</span>
									</dd>
								</div>
							))}
						</dl>
						<div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
							<span className="text-sm font-medium text-ink">
								{t('home.estimate.total', { weeks: result.totalWeeks })}
							</span>
							<span className="text-2xl font-bold tracking-tight text-brand-ink tabular-nums" aria-hidden>
								{money(total)}
							</span>
							<span className="sr-only" aria-live="polite">
								{money(result.total)}
							</span>
						</div>
						<p className="text-xs text-muted">
							{t('home.estimate.note', { weeks: p.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS })}
						</p>
					</div>
				)}

				<Link
					to={AppRoutePaths.PARENTING_GUIDE}
					className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline hover:underline-offset-4">
					{t('home.estimate.more')}
					<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
				</Link>
			</div>
		</section>
	);
}

/* ------------------------------------------------------------------ */
/*  Tools                                                              */
/* ------------------------------------------------------------------ */

type Tool = {
	key: 'guide' | 'leave' | 'pregnancy';
	href: string;
	featured?: boolean;
};

const TOOLS: Tool[] = [
	{ key: 'guide', href: AppRoutePaths.PARENTING_GUIDE, featured: true },
	{ key: 'leave', href: `${AppRoutePaths.CALCULATORS}?tab=maternity` },
	{ key: 'pregnancy', href: `${AppRoutePaths.CALCULATORS}?tab=pregnancy` }
];

function ToolCard({ tool }: { tool: Tool }) {
	const { t } = useTranslation();
	const k = (s: string) => `home.tools.${tool.key}.${s}` as TranslationKey;
	return (
		<Link
			to={tool.href}
			className={cx(
				'group flex h-full flex-col rounded-lg border bg-paper p-5 transition',
				'hover:-translate-y-0.5 hover:shadow-md',
				tool.featured ? 'border-brand/50 hover:border-brand' : 'border-line hover:border-muted/60'
			)}>
			<span className="text-xs font-semibold uppercase tracking-wider text-brand-ink">{t(k('label'))}</span>
			<h3 className="mt-1.5 text-lg font-semibold text-ink">{t(k('title'))}</h3>
			<p className="mt-1.5 text-sm text-muted">{t(k('description'))}</p>
			<ul className="mt-4 space-y-1.5 text-sm text-ink">
				{(['point1', 'point2', 'point3'] as const).map((pt) => (
					<li key={pt} className="flex items-start gap-2">
						<Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden />
						{t(k(pt))}
					</li>
				))}
			</ul>
			<span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand-ink">
				{t('home.tools.open')}
				<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
			</span>
		</Link>
	);
}

/* ------------------------------------------------------------------ */
/*  Key figures                                                        */
/* ------------------------------------------------------------------ */

function Facts() {
	const { t } = useTranslation();
	const p = useBenefitEngine().getParams();

	const facts: { key: string; vars: Record<string, string | number> }[] = [
		{ key: 'maternity', vars: { weeks: p.MATERNITY_WEEKS_BY_CHILDREN[1] } },
		{
			key: 'parental',
			vars: { weeks: p.PARENTAL_WEEKS_SINGLE_CHILD, exclusive: p.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS }
		},
		{ key: 'paternity', vars: { weeks: p.PATERNITY_TOTAL_WEEKS, months: p.PATERNITY_MAX_CHILD_AGE_MONTHS_BIRTH } },
		{
			key: 'rates',
			vars: { full: pct(p.RATE_FULL), combined: pct(p.RATE_COMBINED_21_DAYS), parental: pct(p.RATE_PARENTAL_70) }
		},
		{ key: 'floor', vars: { amount: money(p.PARENTAL_BENEFIT_FLOOR_MONTHLY) } },
		{ key: 'minWage', vars: { amount: money(p.MIN_WAGE_2026_GROSS), basis: money(p.MIN_FULL_TIME_BASIS_2026, 2) } },
		{ key: 'sickness', vars: { rate: pct(p.RATE_SICKNESS_PREGNANCY) } },
		{ key: 'period', vars: { days: p.SICKNESS_PERIOD_MAX_DAYS_PREGNANCY } }
	];
	const k = (fact: string, s: string) => `home.facts.${fact}.${s}` as TranslationKey;

	return (
		<dl className="enter-stagger grid overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4 *:bg-paper gap-px">
			{facts.map((f) => (
				<div key={f.key} className="p-5">
					<dt className="text-sm font-medium text-ink">{t(k(f.key, 'label'))}</dt>
					<dd className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">
						{t(k(f.key, 'value'), f.vars)}
					</dd>
					<dd className="mt-1 text-xs text-muted">{t(k(f.key, 'hint'), f.vars)}</dd>
				</div>
			))}
		</dl>
	);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function SectionHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
	return (
		<div className="enter mb-5">
			<h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
			{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
		</div>
	);
}

export default function Home() {
	const { t } = useTranslation();
	const year = useBenefitEngine().getParams().YEAR;

	return (
		<BaseLayout>
			<div className="space-y-16 pb-8">
				{/* Hero */}
				<section className="grid items-center gap-10 pt-2 lg:grid-cols-[minmax(0,1fr)_26rem] lg:pt-8">
					<div className="enter-stagger">
						<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">
							{t('home.eyebrow', { year })}
						</p>
						<h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-ink sm:text-5xl sm:leading-[1.1]">
							{t('home.title')}
						</h1>
						<p className="mt-4 max-w-xl text-lg text-muted">{t('home.subtitle')}</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								to={AppRoutePaths.PARENTING_GUIDE}
								className="group inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong active:scale-[0.99]">
								{t('home.ctaGuide')}
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
							</Link>
							<Link
								to={AppRoutePaths.CALCULATORS}
								className="inline-flex items-center rounded-md border border-line bg-paper px-5 py-3 text-sm font-semibold text-ink transition hover:border-muted/60 hover:bg-hover">
								{t('home.ctaCalculators')}
							</Link>
						</div>
						<ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
							{(['rules', 'noLogin', 'private'] as const).map((key) => (
								<li key={key} className="flex items-center gap-1.5">
									<Check className="h-4 w-4 text-brand-ink" aria-hidden />
									{t(`home.trust.${key}`, { year })}
								</li>
							))}
						</ul>
					</div>

					<QuickEstimate />
				</section>

				{/* Tools */}
				<section>
					<SectionHeading title={t('home.tools.title')} />
					<div className="enter-stagger grid gap-4 md:grid-cols-3" style={{ '--enter-offset': '80ms' } as CSSProperties}>
						{TOOLS.map((tool) => (
							<ToolCard key={tool.key} tool={tool} />
						))}
					</div>
				</section>

				{/* Key figures */}
				<section>
					<SectionHeading title={t('home.facts.title', { year })} subtitle={t('home.facts.subtitle')} />
					<Facts />
				</section>

				<p className="text-xs text-muted">{t('home.disclaimer')}</p>
			</div>
		</BaseLayout>
	);
}
