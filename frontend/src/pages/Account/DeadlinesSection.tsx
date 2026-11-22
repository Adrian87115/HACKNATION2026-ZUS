import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BenefitParams } from '@zus/engine';
import type { Account, SubmittedApplication, ZamPeriod } from '../../features/account/accountApi';
import { currentTitle, dueDate, isPregnant } from '../../features/account/accountToCase';
import { AppRoutePaths } from '../../types/shared';

const DAY = 86_400_000;
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const addDays = (iso: string, days: number) => new Date(utc(iso) + days * DAY).toISOString().slice(0, 10);
const addMonths = (iso: string, months: number) => {
	const d = new Date(`${iso}T00:00:00Z`);
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())).toISOString().slice(0, 10);
};
const plDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const days = (n: number) => `${n} ${n === 1 ? 'dzień' : 'dni'}`;

type Deadline = {
	id: string;
	title: string;
	/** start of the window (for the progress bar) and the last day */
	from: string;
	due: string;
	basis: string;
	done?: string;
	action?: { label: string; to: string };
};

/** Countdown: whole days left, hours on the last day. */
function left(due: string, now: number): { text: string; tone: 'ok' | 'soon' | 'late' } {
	const end = utc(due) + DAY; // until the end of the last day
	const ms = end - now;
	if (ms <= 0) return { text: `termin minął ${plDate(due)}`, tone: 'late' };
	const d = Math.floor(ms / DAY);
	if (d === 0) return { text: `zostało ${Math.ceil(ms / 3_600_000)} godz.`, tone: 'soon' };
	return { text: `zostało ${days(d)}`, tone: d <= 7 ? 'soon' : 'ok' };
}

function buildDeadlines(account: Account, applications: SubmittedApplication[], params: BenefitParams): Deadline[] {
	const list: Deadline[] = [];
	const birth = account.family.childBirthDate;
	const due = dueDate(account);
	const title = currentTitle(account);
	const employee = title?.type === 'umowa_o_prace';
	const today = new Date().toISOString().slice(0, 10);
	const sent = (kind: SubmittedApplication['kind']) => applications.find((a) => a.kind === kind);

	if (isPregnant(account) && due) {
		const prenatal = addDays(due, -params.MATERNITY_MAX_PRENATAL_WEEKS * 7);
		if (account.role === 'mother') {
			list.push({
				id: 'prenatal',
				title: 'Najwcześniejszy start urlopu macierzyńskiego',
				from: today,
				due: prenatal,
				basis: `Do ${params.MATERNITY_MAX_PRENATAL_WEEKS} tygodni przed przewidywaną datą porodu (art. 180 § 2 KP).`,
				action: employee ? { label: 'Złóż wniosek o urlop', to: `${AppRoutePaths.SUBMIT_APPLICATION}?rodzaj=urlop_macierzynski` } : undefined
			});
		}
		const threshold = Math.round(params.MIN_WAGE_2026_GROSS * params.DEBT_EXCLUSION_MIN_WAGE_RATIO * 100) / 100;
		if (title?.sickness === 'dobrowolne' && account.debt.amount > threshold) {
			list.push({
				id: 'debt',
				title: `Spłać zaległość w składkach (${account.debt.amount.toFixed(2).replace('.', ',')} zł)`,
				from: today,
				due,
				basis: `Zaległość powyżej ${threshold.toFixed(2).replace('.', ',')} zł w dniu porodu odbiera prawo do zasiłku (art. 2a ustawy zasiłkowej).`
			});
		}
		list.push({ id: 'birth', title: 'Przewidywana data porodu', from: addDays(due, -280), due, basis: 'Z karty ciąży / zaświadczenia lekarskiego.' });
	}

	if (birth) {
		if (account.role === 'mother' || employee) {
			const combined = applications.find((a) => a.fields.some((f) => f.value.includes('wniosek łączny')));
			list.push({
				id: 'combined',
				title: 'Wniosek łączny – zasiłek 81,5% za cały okres',
				from: birth,
				due: addDays(birth, params.COMBINED_APPLICATION_DEADLINE_DAYS),
				basis: 'Wniosek o urlop macierzyński i rodzicielski złożony do 21 dni po porodzie (art. 30a ustawy zasiłkowej).',
				done: combined ? `złożony ${plDate(combined.submittedAt.slice(0, 10))}` : undefined
			});
		}
		if (account.role === 'father') {
			const paternity = sent('urlop_ojcowski');
			list.push({
				id: 'paternity',
				title: 'Wykorzystaj urlop ojcowski',
				from: birth,
				due: addDays(addMonths(birth, params.PATERNITY_MAX_CHILD_AGE_MONTHS_BIRTH), -1),
				basis: `${params.PATERNITY_TOTAL_WEEKS} tygodnie do ukończenia przez dziecko 12 miesięcy; wniosek 7 dni przed (art. 182^3 KP).`,
				done: paternity ? `wniosek ${paternity.number}` : undefined,
				action: employee && !paternity ? { label: 'Złóż wniosek', to: `${AppRoutePaths.SUBMIT_APPLICATION}?rodzaj=urlop_ojcowski` } : undefined
			});
		}
		list.push({
			id: 'parental',
			title: 'Urlop rodzicielski – do 6. roku życia dziecka',
			from: birth,
			due: addDays(addMonths(birth, params.PARENTAL_DEADLINE_CHILD_AGE_YEARS * 12), -1),
			basis: 'Wniosek najpóźniej 21 dni przed rozpoczęciem każdej części (art. 182^1d KP).'
		});
	}

	// claims expire 6 months after the period the benefit is for (art. 67) – one deadline per leave type
	const lastDay = new Map<ZamPeriod, string>();
	for (const l of applications.flatMap((a) => a.leaves ?? [])) {
		if (l.to < today && (!lastDay.has(l.type) || l.to > lastDay.get(l.type)!)) lastDay.set(l.type, l.to);
	}
	for (const [type, to] of lastDay) {
		if (utc(addMonths(to, 6)) < Date.now()) continue;
		list.push({
			id: `claim-${type}`,
			title: `Dokumenty do zasiłku za ${LEAVE_LABEL[type].toLowerCase()}`,
			from: to,
			due: addMonths(to, 6),
			basis: 'Zasiłek za dany okres przepada, jeśli dokumenty nie trafią do ZUS lub płatnika w ciągu 6 miesięcy (art. 67 ustawy zasiłkowej).'
		});
	}
	return list.sort((x, y) => x.due.localeCompare(y.due));
}

const LEAVE_LABEL: Record<ZamPeriod, string> = { macierzynski: 'Urlop macierzyński', rodzicielski: 'Urlop rodzicielski', ojcowski: 'Urlop ojcowski' };

/** Planned and used leave from the submitted applications, against the entitlement. */
function leaveUsage(account: Account, applications: SubmittedApplication[], params: BenefitParams) {
	const children = Math.min(account.circumstances?.expectedChildren ?? 1, 5);
	const entitlement: Record<ZamPeriod, number> = {
		macierzynski: params.MATERNITY_WEEKS_BY_CHILDREN[children] * 7,
		rodzicielski: ((children > 1 ? params.PARENTAL_WEEKS_MULTIPLE_CHILDREN : params.PARENTAL_WEEKS_SINGLE_CHILD) - params.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS) * 7,
		ojcowski: params.PATERNITY_TOTAL_WEEKS * 7
	};
	// the same period can appear in a leave request and in ZAM – count each day once
	const byType = new Map<ZamPeriod, Set<string>>();
	const usedByType = new Map<ZamPeriod, Set<string>>();
	const today = new Date().toISOString().slice(0, 10);
	for (const a of applications) {
		for (const l of a.leaves ?? []) {
			const planned = byType.get(l.type) ?? new Set<string>();
			const used = usedByType.get(l.type) ?? new Set<string>();
			for (let d = l.from; d <= l.to; d = addDays(d, 1)) {
				planned.add(d);
				if (d <= today) used.add(d);
			}
			byType.set(l.type, planned);
			usedByType.set(l.type, used);
		}
	}
	const types: ZamPeriod[] = account.role === 'mother' ? ['macierzynski', 'rodzicielski'] : ['ojcowski', 'rodzicielski'];
	return types.map((type) => ({
		type,
		planned: byType.get(type)?.size ?? 0,
		used: usedByType.get(type)?.size ?? 0,
		max: entitlement[type]
	}));
}

export default function DeadlinesSection({ account, applications, params }: { account: Account; applications: SubmittedApplication[]; params: BenefitParams }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const t = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(t);
	}, []);

	const deadlines = buildDeadlines(account, applications, params);
	const usage = leaveUsage(account, applications, params);

	return (
		<section className="rounded-lg border border-line bg-paper shadow-sm">
			<header className="border-b border-line px-5 py-3">
				<h2 className="font-semibold text-ink">Moje terminy i urlopy</h2>
				<p className="text-xs text-muted">Odliczamy czas do ważnych terminów na podstawie dat z konta, Twoich okoliczności i wysłanych wniosków.</p>
			</header>
			<div className="grid gap-6 px-5 py-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div>
					{deadlines.length === 0 ? (
						<p className="text-sm text-muted">
							Brak terminów do pilnowania. Dodaj przewidywaną datę porodu w „Moich okolicznościach”, a pokażemy, do kiedy złożyć wnioski.
						</p>
					) : (
						<ol className="space-y-3">
							{deadlines.map((d) => {
								const status = left(d.due, now);
								const span = Math.max(utc(d.due) + DAY - utc(d.from), DAY);
								const elapsed = Math.min(Math.max((now - utc(d.from)) / span, 0), 1);
								return (
									<li key={d.id} className="text-sm">
										<div className="flex flex-wrap items-baseline justify-between gap-x-3">
											<p className="font-semibold text-ink">{d.title}</p>
											<p
												className={cx(
													'font-semibold tabular-nums',
													d.done
														? 'text-brand-ink'
														: status.tone === 'late'
															? 'text-red-700 dark:text-red-300'
															: status.tone === 'soon'
																? 'text-amber-700 dark:text-amber-300'
																: 'text-ink'
												)}>
												{d.done ? `✓ ${d.done}` : status.text}
											</p>
										</div>
										<div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-surface" aria-hidden>
											<div
												className={cx('h-full rounded-sm', d.done ? 'bg-brand' : status.tone === 'late' ? 'bg-red-500' : status.tone === 'soon' ? 'bg-amber-500' : 'bg-brand')}
												style={{ width: `${(d.done ? 1 : elapsed) * 100}%` }}
											/>
										</div>
										<p className="mt-1 text-xs text-muted">
											do {plDate(d.due)} · {d.basis}
											{d.action && !d.done && status.tone !== 'late' && (
												<>
													{' '}
													<Link to={d.action.to} className="font-semibold text-brand-ink hover:underline hover:underline-offset-4">
														{d.action.label} →
													</Link>
												</>
											)}
										</p>
									</li>
								);
							})}
						</ol>
					)}
				</div>

				<div className="space-y-3">
					<h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Wykorzystanie urlopu</h3>
					{usage.map((u) => (
						<div key={u.type} className="text-sm">
							<div className="flex items-baseline justify-between gap-2">
								<span className="font-semibold text-ink">{LEAVE_LABEL[u.type]}</span>
								<span className="text-xs tabular-nums text-muted">
									{u.used} / {u.max} dni
								</span>
							</div>
							<div className="relative mt-1 h-2 overflow-hidden rounded-sm bg-surface" aria-hidden>
								<div className="absolute inset-y-0 left-0 bg-brand/30" style={{ width: `${Math.min(u.planned / u.max, 1) * 100}%` }} />
								<div className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${Math.min(u.used / u.max, 1) * 100}%` }} />
							</div>
							<p className="mt-1 text-xs text-muted">
								{u.planned === 0
									? 'Brak wniosków o ten urlop.'
									: `Wykorzystano ${days(u.used)}, zaplanowano ${days(u.planned)}, pozostało ${days(Math.max(u.max - u.planned, 0))} do zaplanowania.`}
							</p>
						</div>
					))}
					<p className="text-xs text-muted">
						Rodzicielski: limit dla jednego rodzica – {params.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS} tygodni przysługuje wyłącznie drugiemu rodzicowi.
					</p>
				</div>
			</div>
		</section>
	);
}
