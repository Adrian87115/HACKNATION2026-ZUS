import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

/** A benefit period as shown in the calculator results (one parent, one rate). */
export type CalendarSegment = {
	label: string;
	color: string;
	who?: string;
	startDate: string;
	endDate: string;
	rate: number;
	dailyAmount: number;
	payable: boolean;
};

type Day = { iso: string; segments: CalendarSegment[]; amount: number };
type Month = { key: string; days: Day[]; amount: number; rates: number[]; benefitDays: number };

const DAY_MS = 86_400_000;
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const money = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
const pct = (r: number) => `${(r * 100).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
const monthName = (key: string) =>
	new Date(`${key}-01T00:00:00Z`).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const WEEKDAYS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'];

/** Split benefit periods into calendar months and days (several periods can run in parallel – e.g. both parents). */
function buildMonths(segments: CalendarSegment[]): Month[] {
	const valid = segments.filter((s) => s.startDate && s.endDate && s.endDate >= s.startDate);
	if (!valid.length) return [];
	const first = Math.min(...valid.map((s) => Date.parse(`${s.startDate}T00:00:00Z`)));
	const last = Math.max(...valid.map((s) => Date.parse(`${s.endDate}T00:00:00Z`)));
	const months = new Map<string, Month>();

	// whole months from the first to the last benefit day, so the daily view shows complete weeks
	const start = new Date(first);
	for (let d = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1); d <= last; d += DAY_MS) {
		const iso = new Date(d).toISOString().slice(0, 10);
		const key = iso.slice(0, 7);
		const covering = valid.filter((s) => s.startDate <= iso && iso <= s.endDate);
		const amount = covering.reduce((sum, s) => sum + (s.payable ? s.dailyAmount : 0), 0);
		const month = months.get(key) ?? { key, days: [], amount: 0, rates: [], benefitDays: 0 };
		month.days.push({ iso, segments: covering, amount });
		month.amount += amount;
		if (covering.length) month.benefitDays += 1;
		for (const s of covering) if (s.payable && !month.rates.includes(s.rate)) month.rates.push(s.rate);
		months.set(key, month);
	}
	// fill the rest of the last month
	const lastMonth = [...months.values()].at(-1)!;
	const [y, m] = lastMonth.key.split('-').map(Number);
	for (let d = Date.parse(`${lastMonth.days.at(-1)!.iso}T00:00:00Z`) + DAY_MS; new Date(d).getUTCMonth() === m - 1 && new Date(d).getUTCFullYear() === y; d += DAY_MS) {
		lastMonth.days.push({ iso: new Date(d).toISOString().slice(0, 10), segments: [], amount: 0 });
	}
	return [...months.values()].filter((mo) => mo.benefitDays > 0);
}

/**
 * Monthly and daily view of the forecast benefit payments with the rate in force (100%, 81,5%, 80%, 70%…).
 * Amounts are the calculator's forecast – ZUS or the employer pays monthly in arrears.
 */
export default function BenefitCalendar({ segments }: { segments: CalendarSegment[] }) {
	const months = useMemo(() => buildMonths(segments), [segments]);
	const [selected, setSelected] = useState(0);
	const [view, setView] = useState<'months' | 'days'>('months');
	if (!months.length) return null;
	const index = Math.min(selected, months.length - 1);
	const month = months[index];
	const max = Math.max(...months.map((m) => m.amount), 1);
	const offset = (new Date(`${month.days[0].iso}T00:00:00Z`).getUTCDay() + 6) % 7;
	const legend = Array.from(new Map(segments.map((s) => [`${s.label}|${s.rate}`, s])).values());

	return (
		<div className="space-y-3">
			<div role="tablist" aria-label="Widok kalendarza" className="flex gap-1 border-b border-line">
				{(
					[
						['months', 'Miesiące'],
						['days', 'Dni']
					] as const
				).map(([id, label]) => (
					<button
						key={id}
						type="button"
						role="tab"
						aria-selected={view === id}
						onClick={() => setView(id)}
						className={cx(
							'-mb-px border-b-2 px-3 py-1.5 text-sm font-semibold transition',
							view === id ? 'border-brand text-brand-ink' : 'border-transparent text-muted hover:text-ink'
						)}>
						{label}
					</button>
				))}
			</div>

			{view === 'months' ? (
				<ul className="divide-y divide-line">
					{months.map((m, i) => (
						<li key={m.key}>
							<button
								type="button"
								onClick={() => {
									setSelected(i);
									setView('days');
								}}
								className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 text-left transition hover:bg-hover sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
								<span className="text-sm font-semibold capitalize text-ink">{monthName(m.key)}</span>
								<span className="order-3 col-span-2 flex items-center gap-2 sm:order-none sm:col-span-1">
									<span className="h-2 flex-1 overflow-hidden rounded-sm bg-surface">
										<span className="block h-full rounded-sm bg-brand" style={{ width: `${(m.amount / max) * 100}%` }} />
									</span>
									<span className="shrink-0 text-xs text-muted">
										{m.benefitDays} dni · {m.rates.length ? m.rates.sort((a, b) => b - a).map(pct).join(' / ') : 'niewypłacane'}
									</span>
								</span>
								<span className="text-right text-sm font-semibold tabular-nums text-ink">{money(m.amount)}</span>
							</button>
						</li>
					))}
				</ul>
			) : (
				<div>
					<div className="flex items-center justify-between gap-2">
						<button
							type="button"
							disabled={index === 0}
							onClick={() => setSelected(index - 1)}
							aria-label="Poprzedni miesiąc"
							className="rounded-md p-1.5 text-muted transition hover:bg-hover hover:text-ink disabled:opacity-30">
							<ChevronLeft className="h-4 w-4" aria-hidden />
						</button>
						<p className="text-sm font-semibold capitalize text-ink">
							{monthName(month.key)} · <span className="tabular-nums">{money(month.amount)}</span>
						</p>
						<button
							type="button"
							disabled={index === months.length - 1}
							onClick={() => setSelected(index + 1)}
							aria-label="Następny miesiąc"
							className="rounded-md p-1.5 text-muted transition hover:bg-hover hover:text-ink disabled:opacity-30">
							<ChevronRight className="h-4 w-4" aria-hidden />
						</button>
					</div>
					<div className="mt-2 grid grid-cols-7 gap-1 text-center">
						{WEEKDAYS.map((d) => (
							<span key={d} className="text-[11px] font-semibold uppercase text-muted">
								{d}
							</span>
						))}
						{Array.from({ length: offset }, (_, i) => (
							<span key={`pad-${i}`} />
						))}
						{month.days.map((d) => {
							const s = d.segments[0];
							const title = d.segments.length
								? `${dayLabel(d.iso)}: ${d.segments.map((x) => `${x.label}${x.who ? ` (${x.who})` : ''} – ${x.payable ? `${pct(x.rate)}, ${money(x.dailyAmount)}` : 'niewypłacane'}`).join('; ')}`
								: dayLabel(d.iso);
							return (
								<span
									key={d.iso}
									title={title}
									aria-label={title}
									className={cx(
										'relative flex aspect-square min-h-8 flex-col items-center justify-center rounded-sm text-[11px] leading-tight',
										s ? cx(s.color, 'text-white', !s.payable && 'opacity-40') : 'bg-surface text-muted'
									)}>
									<span className="font-semibold">{Number(d.iso.slice(8))}</span>
									{d.amount > 0 && <span className="hidden tabular-nums sm:block">{Math.round(d.amount)} zł</span>}
									{d.segments.length > 1 && (
										<span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
									)}
								</span>
							);
						})}
					</div>
					<p className="mt-2 text-xs text-muted">Kropka w rogu – tego dnia zasiłek pobierają oboje rodzice. Najedź na dzień, aby zobaczyć stawkę i kwotę.</p>
				</div>
			)}

			<div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2">
				{legend.map((s) => (
					<span key={`${s.label}|${s.rate}`} className="inline-flex items-center gap-1.5 text-xs text-muted">
						<span className={cx('h-2 w-2 rounded-full', s.color)} />
						{s.label} · {s.payable ? `${pct(s.rate)} · ${money(s.dailyAmount)}/dzień` : 'niewypłacane'}
					</span>
				))}
			</div>
		</div>
	);
}
