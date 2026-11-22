import { Clock as History, KeyRound, LoaderCircle, LogOut, RotateCcw, Save, Search, ShieldCheck, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { useSearchParams } from 'react-router-dom';
import DocumentsAdmin from './DocumentsAdmin';
import FeaturesAdmin from './FeaturesAdmin';
import Modal from './Modal';
import { benefitAmount, type BenefitParams } from '@zus/engine';
import { AdminApiError, adminApi, type HistoryEntry, type ParamChange } from '../../features/admin/adminApi';
import { PARAM_GROUPS, UNIT, formatValue, fromInput, kindOf, labelOf, toInput, type ParamGroup } from '../../features/admin/paramMeta';
import { setEngineParams } from '../../hooks/useBenefitEngine';

const TOKEN_KEY = 'zusia.admin.token';
const SAMPLE_BASIS = 6000;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const readToken = () => {
	try {
		return sessionStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
};
const writeToken = (token: string | null) => {
	try {
		if (token) sessionStorage.setItem(TOKEN_KEY, token);
		else sessionStorage.removeItem(TOKEN_KEY);
	} catch {
		/* session storage unavailable – token kept in memory only */
	}
};

type Draft = Record<string, string | Record<string, string>>;

const TABS = [
	{ id: 'parametry', label: 'Parametry kalkulatorów', title: 'Parametry kalkulatorów', description: 'Zmieniaj stawki, kwoty i wymiary urlopów bez zmian w kodzie – np. po zmianie przepisów. Nowe wartości od razu działają we wszystkich kalkulatorach i w odpowiedziach ZUSi.' },
	{ id: 'dokumenty', label: 'Dokumenty', title: 'Formularze, przepisy i poradniki', description: 'Dodawaj nowe formularze, publikuj nowe wersje przepisów i poradników oraz wycofuj nieaktualne dokumenty. Poprzednie wersje zostają w historii.' },
	{ id: 'funkcje', label: 'Funkcje systemu', title: 'Funkcje systemu', description: 'Włączaj i wyłączaj moduły aplikacji oraz publikuj komunikaty dla użytkowników – bez wdrażania nowej wersji.' }
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function Admin() {
	const [token, setToken] = useState<string | null>(readToken);
	const [notice, setNotice] = useState<string | null>(null);
	const [search, setSearch] = useSearchParams();
	const tab = TABS.find((t) => t.id === search.get('zakladka')) ?? TABS[0];
	const selectTab = (id: TabId) => setSearch(id === 'parametry' ? {} : { zakladka: id }, { replace: true });

	const logout = useCallback((message?: string) => {
		writeToken(null);
		setToken(null);
		setNotice(message ?? null);
	}, []);

	return (
		<BaseLayout>
			<div className="space-y-6">
				<header className="enter flex flex-wrap items-end justify-between gap-4">
					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Panel administracyjny</p>
						<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{token ? tab.title : 'Zaplecze ZUSi'}</h1>
						<p className="max-w-2xl text-muted">
							{token ? tab.description : 'Parametry kalkulatorów, baza dokumentów i funkcje systemu – zarządzane przez pracowników ZUS bez udziału programistów.'}
						</p>
					</div>
					{token && (
						<button
							type="button"
							onClick={() => logout()}
							className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink transition hover:bg-hover">
							<LogOut className="h-4 w-4" aria-hidden />
							Wyloguj
						</button>
					)}
				</header>

				{token ? (
					<>
						<div role="tablist" aria-label="Sekcje panelu" className="flex gap-1 overflow-x-auto border-b border-line">
							{TABS.map((t) => (
								<button
									key={t.id}
									type="button"
									role="tab"
									aria-selected={t.id === tab.id}
									onClick={() => selectTab(t.id)}
									className={cx(
										'-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition',
										t.id === tab.id ? 'border-brand text-brand-ink' : 'border-transparent text-muted hover:text-ink'
									)}>
									{t.label}
								</button>
							))}
						</div>
						{tab.id === 'parametry' && (
							<Dashboard token={token} onUnauthorized={() => logout('Sesja wygasła albo token jest nieprawidłowy. Zaloguj się ponownie.')} />
						)}
						{tab.id === 'dokumenty' && (
							<DocumentsAdmin token={token} onUnauthorized={() => logout('Sesja wygasła albo token jest nieprawidłowy. Zaloguj się ponownie.')} />
						)}
						{tab.id === 'funkcje' && (
							<FeaturesAdmin token={token} onUnauthorized={() => logout('Sesja wygasła albo token jest nieprawidłowy. Zaloguj się ponownie.')} />
						)}
					</>
				) : (
					<Login
						notice={notice}
						onLogin={(t) => {
							writeToken(t);
							setNotice(null);
							setToken(t);
						}}
					/>
				)}
			</div>
		</BaseLayout>
	);
}

/* ------------------------------------------------------------------ */
/*  Login                                                              */
/* ------------------------------------------------------------------ */

function Login({ notice, onLogin }: { notice: string | null; onLogin: (token: string) => void }) {
	const id = useId();
	const [value, setValue] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit() {
		if (!value.trim()) return;
		setBusy(true);
		setError(null);
		try {
			await adminApi.verify(value.trim());
			onLogin(value.trim());
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
			className="enter mx-auto max-w-md space-y-4 rounded-lg border border-line bg-paper p-6 shadow-sm"
			style={{ animationDelay: '60ms' }}>
			<div className="flex items-center gap-2 font-semibold text-ink">
				<KeyRound className="h-5 w-5 text-brand-ink" aria-hidden />
				Zaloguj się
			</div>
			{notice && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{notice}</p>}
			<div className="flex flex-col gap-1.5">
				<label htmlFor={id} className="text-sm font-medium text-ink">
					Token administratora
				</label>
				<input
					id={id}
					type="password"
					autoComplete="current-password"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					className="h-10 rounded-md border border-line bg-paper px-3 text-sm text-ink shadow-xs focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
				/>
				<p className="text-xs text-muted">Token ustawia się na serwerze w zmiennej ADMIN_TOKEN.</p>
			</div>
			{error && (
				<p role="alert" className="text-sm text-red-700 dark:text-red-300">
					{error}
				</p>
			)}
			<button
				type="submit"
				disabled={busy || !value.trim()}
				className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:bg-hover disabled:text-muted">
				{busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
				Zaloguj
			</button>
		</form>
	);
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

function Dashboard({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
	const [params, setParams] = useState<BenefitParams | null>(null);
	const [defaults, setDefaults] = useState<BenefitParams | null>(null);
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [draft, setDraft] = useState<Draft>({});
	const [query, setQuery] = useState('');
	const [onlyChanged, setOnlyChanged] = useState(false);
	const [confirm, setConfirm] = useState<'save' | 'reset' | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

	const handle = useCallback(
		(err: unknown) => {
			if (err instanceof AdminApiError && err.status === 401) onUnauthorized();
			else setMessage({ tone: 'error', text: (err as Error).message });
		},
		[onUnauthorized]
	);

	useEffect(() => {
		Promise.all([adminApi.params(), adminApi.defaults(), adminApi.history(token)])
			.then(([p, d, h]) => {
				setParams(p);
				setDefaults(d);
				setHistory(h);
			})
			.catch((err) => {
				if (err instanceof AdminApiError && err.status === 401) onUnauthorized();
				else setLoadError((err as Error).message);
			});
	}, [token, onUnauthorized]);

	/* Parse the draft into overrides + per-field errors */
	const { overrides, errors } = useMemo(() => {
		const out: Record<string, unknown> = {};
		const errs: Record<string, string> = {};
		if (!params) return { overrides: out, errors: errs };
		for (const [key, value] of Object.entries(draft)) {
			if (typeof value === 'object') {
				const table: Record<string, number> = {};
				for (const [k, v] of Object.entries(value)) {
					const n = Number(v);
					if (!Number.isInteger(n) || n < 1) errs[key] = 'Podaj liczbę całkowitą tygodni (co najmniej 1).';
					table[k] = n;
				}
				if (!errs[key] && !same(table, (params as Record<string, unknown>)[key])) out[key] = table;
				continue;
			}
			const n = fromInput(key, value);
			if (Number.isNaN(n)) errs[key] = 'Podaj liczbę.';
			else if (n < 0) errs[key] = 'Wartość nie może być ujemna.';
			else if (kindOf(key) === 'percent' && n > 1) errs[key] = 'Maksymalnie 100%.';
			else if (kindOf(key) !== 'percent' && /WEEKS|DAYS|MONTHS|YEARS|PARTS|_DAY$|COUNT/.test(key) && !Number.isInteger(n))
				errs[key] = 'Podaj liczbę całkowitą.';
			else if (!same(n, (params as Record<string, unknown>)[key])) out[key] = n;
		}
		return { overrides: out as Partial<BenefitParams>, errors: errs };
	}, [draft, params]);

	const pending: ParamChange[] = params
		? Object.entries(overrides).map(([key, to]) => ({ key, from: (params as Record<string, unknown>)[key], to }))
		: [];
	const hasErrors = Object.keys(errors).length > 0;

	async function save() {
		setBusy(true);
		try {
			const updated = await adminApi.update(token, overrides);
			setParams(updated);
			setEngineParams(updated);
			setDraft({});
			setHistory(await adminApi.history(token));
			setMessage({ tone: 'ok', text: `Zapisano ${pending.length} ${pending.length === 1 ? 'zmianę' : 'zmiany'}. Kalkulatory już korzystają z nowych wartości.` });
		} catch (err) {
			handle(err);
		} finally {
			setBusy(false);
			setConfirm(null);
		}
	}

	async function reset() {
		setBusy(true);
		try {
			const updated = await adminApi.reset(token);
			setParams(updated);
			setEngineParams(updated);
			setDraft({});
			setHistory(await adminApi.history(token));
			setMessage({ tone: 'ok', text: 'Przywrócono wartości domyślne na 2026 r.' });
		} catch (err) {
			handle(err);
		} finally {
			setBusy(false);
			setConfirm(null);
		}
	}

	if (loadError) {
		return (
			<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
				{loadError}
			</p>
		);
	}
	if (!params || !defaults) {
		return (
			<div className="flex justify-center py-16 text-muted">
				<LoaderCircle className="h-6 w-6 animate-spin" aria-label="Wczytuję parametry" />
			</div>
		);
	}

	const p = params as Record<string, unknown>;
	const d = defaults as Record<string, unknown>;
	const known = new Set(PARAM_GROUPS.flatMap((g) => g.params.map((x) => x.key)));
	const groups: ParamGroup[] = [
		...PARAM_GROUPS,
		{
			id: 'inne',
			title: 'Pozostałe',
			description: 'Parametry bez opisu w panelu.',
			params: Object.keys(params)
				.filter((k) => !known.has(k))
				.map((key) => ({ key, label: key }))
		}
	];
	const q = query.trim().toLowerCase();
	const visible = groups
		.map((g) => ({
			...g,
			params: g.params.filter(
				(x) =>
					x.key in p &&
					(!q || x.label.toLowerCase().includes(q) || x.key.toLowerCase().includes(q)) &&
					(!onlyChanged || !same(p[x.key], d[x.key]) || x.key in draft)
			)
		}))
		.filter((g) => g.params.length > 0);
	const changedFromDefaults = Object.keys(params).filter((k) => !same(p[k], d[k])).length;

	return (
		<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="space-y-4">
				{message && (
					<p
						role={message.tone === 'error' ? 'alert' : 'status'}
						className={cx(
							'rounded-md border px-4 py-3 text-sm',
							message.tone === 'ok'
								? 'border-brand/40 bg-brand-soft text-brand-ink'
								: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
						)}>
						{message.text}
					</p>
				)}

				<div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper p-3">
					<div className="relative min-w-48 flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Szukaj parametru…"
							aria-label="Szukaj parametru"
							className="h-9 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
						/>
					</div>
					<label className="flex items-center gap-2 text-sm text-ink">
						<input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="accent-(--brand)" />
						Tylko zmienione ({changedFromDefaults})
					</label>
				</div>

				{visible.map((group) => (
					<section key={group.id} className="rounded-lg border border-line bg-paper shadow-sm">
						<header className="border-b border-line px-5 py-3">
							<h2 className="font-semibold text-ink">{group.title}</h2>
							<p className="text-xs text-muted">{group.description}</p>
						</header>
						<ul className="divide-y divide-line">
							{group.params.map((meta) => (
								<ParamRow
									key={meta.key}
									meta={meta}
									current={p[meta.key]}
									defaultValue={d[meta.key]}
									draft={draft[meta.key]}
									error={errors[meta.key]}
									onChange={(value) => setDraft((prev) => ({ ...prev, [meta.key]: value }))}
									onUndo={() =>
										setDraft((prev) => {
											const next = { ...prev };
											delete next[meta.key];
											return next;
										})
									}
								/>
							))}
						</ul>
					</section>
				))}
				{visible.length === 0 && <p className="py-8 text-center text-sm text-muted">Brak parametrów pasujących do wyszukiwania.</p>}

				{(pending.length > 0 || hasErrors) && (
					<div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper px-4 py-3 shadow-lg">
						<p className="text-sm text-ink">
							{hasErrors ? (
								<span className="text-red-700 dark:text-red-300">Popraw zaznaczone pola, aby zapisać.</span>
							) : (
								<>
									<span className="font-semibold">{pending.length}</span> niezapisanych zmian
								</>
							)}
						</p>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setDraft({})}
								className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-hover">
								Odrzuć
							</button>
							<button
								type="button"
								disabled={hasErrors || pending.length === 0}
								onClick={() => setConfirm('save')}
								className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:bg-hover disabled:text-muted">
								<Save className="h-4 w-4" aria-hidden />
								Zapisz zmiany
							</button>
						</div>
					</div>
				)}
			</div>

			<aside className="space-y-4 lg:sticky lg:top-24">
				<Preview current={params} overrides={overrides} />

				<section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
					<h2 className="flex items-center gap-2 font-semibold text-ink">
						<History className="h-4 w-4 text-muted" aria-hidden />
						Historia zmian
					</h2>
					{history.length === 0 ? (
						<p className="mt-2 text-sm text-muted">Parametry nie były jeszcze zmieniane.</p>
					) : (
						<ol className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1 text-sm">
							{history.map((h) => (
								<li key={h.at} className="border-l-2 border-line pl-3">
									<p className="text-xs text-muted">
										{new Date(h.at).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
										{h.action === 'reset' ? 'przywrócenie domyślnych' : 'zmiana'}
									</p>
									<ul className="mt-0.5 space-y-0.5">
										{h.changes.map((c) => (
											<li key={c.key} className="text-ink">
												{labelOf(c.key)}: <span className="text-muted">{formatValue(c.key, c.from)}</span> →{' '}
												<span className="font-medium">{formatValue(c.key, c.to)}</span>
											</li>
										))}
									</ul>
								</li>
							))}
						</ol>
					)}
				</section>

				<section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
					<h2 className="font-semibold text-ink">Wartości domyślne</h2>
					<p className="mt-1 text-sm text-muted">Przywraca wszystkie parametry do wartości na 2026 r. z przepisów.</p>
					<button
						type="button"
						disabled={changedFromDefaults === 0}
						onClick={() => setConfirm('reset')}
						className="mt-3 inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-hover disabled:opacity-50">
						<RotateCcw className="h-4 w-4" aria-hidden />
						Przywróć domyślne
					</button>
				</section>

				<p className="flex items-start gap-2 text-xs text-muted">
					<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
					Wersja demonstracyjna: dostęp chroniony tokenem. W systemie produkcyjnym logowanie odbywałoby się przez SSO ZUS.
				</p>
			</aside>

			{confirm && (
				<Modal
					title={confirm === 'save' ? 'Zapisać zmiany?' : 'Przywrócić wartości domyślne?'}
					onClose={() => !busy && setConfirm(null)}
					actions={
						<>
							<button
								type="button"
								onClick={() => setConfirm(null)}
								disabled={busy}
								className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-hover">
								Anuluj
							</button>
							<button
								type="button"
								autoFocus
								disabled={busy}
								onClick={() => void (confirm === 'save' ? save() : reset())}
								className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60">
								{busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
								{confirm === 'save' ? 'Zapisz' : 'Przywróć'}
							</button>
						</>
					}>
					{confirm === 'save' ? (
						<>
							<p className="text-sm text-muted">Nowe wartości zaczną działać od razu we wszystkich kalkulatorach.</p>
							<ul className="mt-3 space-y-1.5 text-sm">
								{pending.map((c) => (
									<li key={c.key}>
										<span className="font-medium text-ink">{labelOf(c.key)}</span>
										<br />
										<span className="text-muted">{formatValue(c.key, c.from)}</span> →{' '}
										<span className="font-semibold text-ink">{formatValue(c.key, c.to)}</span>
									</li>
								))}
							</ul>
						</>
					) : (
						<p className="text-sm text-muted">
							Wszystkie {changedFromDefaults} zmienione parametry wrócą do wartości z przepisów na 2026 r. Operacja zostanie zapisana w
							historii.
						</p>
					)}
				</Modal>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Parameter row                                                      */
/* ------------------------------------------------------------------ */

function ParamRow({
	meta,
	current,
	defaultValue,
	draft,
	error,
	onChange,
	onUndo
}: {
	meta: { key: string; label: string; hint?: string };
	current: unknown;
	defaultValue: unknown;
	draft: string | Record<string, string> | undefined;
	error?: string;
	onChange: (value: string | Record<string, string>) => void;
	onUndo: () => void;
}) {
	const id = useId();
	const kind = kindOf(meta.key);
	const edited = draft !== undefined;
	const differsFromDefault = !same(current, defaultValue);
	const inputCls = cx(
		'h-9 rounded-md border bg-paper px-2.5 text-sm text-ink tabular-nums focus:outline-none focus:ring-4',
		error
			? 'border-red-500 focus:ring-red-500/15'
			: edited
				? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500/15'
				: 'border-line focus:border-brand focus:ring-brand/15'
	);

	return (
		<li className={cx('grid gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center', edited && 'bg-amber-50/50 dark:bg-amber-950/10')}>
			<div className="min-w-0">
				<label htmlFor={id} className="text-sm font-medium text-ink">
					{meta.label}
				</label>
				<p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
					<code className="font-mono">{meta.key}</code>
					<span>· domyślnie {formatValue(meta.key, defaultValue)}</span>
					{differsFromDefault && <span className="rounded bg-sky-100 px-1.5 font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">zmieniony</span>}
				</p>
				{meta.hint && <p className="mt-0.5 text-xs text-muted">{meta.hint}</p>}
				{error && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>}
			</div>

			<div className="flex items-center gap-2">
				{kind === 'table' ? (
					<div className="flex flex-wrap gap-1.5" id={id}>
						{Object.entries(current as Record<string, number>).map(([children, weeks]) => {
							const value = typeof draft === 'object' ? draft[children] : String(weeks);
							return (
								<label key={children} className="flex flex-col items-center text-[11px] text-muted">
									<input
										type="number"
										min={1}
										step={1}
										value={value}
										aria-label={`Liczba dzieci ${children}${children === '5' ? ' i więcej' : ''} – tygodnie`}
										onChange={(e) => {
											const base =
												typeof draft === 'object'
													? draft
													: Object.fromEntries(Object.entries(current as Record<string, number>).map(([k, v]) => [k, String(v)]));
											onChange({ ...base, [children]: e.target.value });
										}}
										className={cx(inputCls, 'w-14 text-center')}
									/>
									{children}
									{children === '5' ? '+' : ''} dz.
								</label>
							);
						})}
					</div>
				) : (
					<div className="relative">
						<input
							id={id}
							type="number"
							step="any"
							value={typeof draft === 'string' ? draft : toInput(meta.key, current)}
							onChange={(e) => onChange(e.target.value)}
							className={cx(inputCls, 'w-32', UNIT[kind] && 'pr-11')}
						/>
						{UNIT[kind] && (
							<span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted">{UNIT[kind]}</span>
						)}
					</div>
				)}
				<button
					type="button"
					onClick={onUndo}
					disabled={!edited}
					title="Cofnij zmianę"
					aria-label={`Cofnij zmianę: ${meta.label}`}
					className={cx('rounded p-1.5 text-muted transition hover:bg-hover hover:text-ink', !edited && 'invisible')}>
					<Undo2 className="h-4 w-4" aria-hidden />
				</button>
			</div>
		</li>
	);
}

/* ------------------------------------------------------------------ */
/*  Preview                                                            */
/* ------------------------------------------------------------------ */

function Preview({ current, overrides }: { current: BenefitParams; overrides: Partial<BenefitParams> }) {
	const next = { ...current, ...overrides } as BenefitParams;
	const money = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
	const monthly = (p: BenefitParams, rate: number) => benefitAmount(p, { monthlyBasis: SAMPLE_BASIS, rate, days: 30 }).monthlyAmount;
	const rows: { label: string; before: number; after: number }[] = [
		{ label: 'Urlop macierzyński', before: monthly(current, current.RATE_FULL), after: monthly(next, next.RATE_FULL) },
		{
			label: 'Wniosek do 21 dni',
			before: monthly(current, current.RATE_COMBINED_21_DAYS),
			after: monthly(next, next.RATE_COMBINED_21_DAYS)
		},
		{ label: 'Urlop rodzicielski', before: monthly(current, current.RATE_PARENTAL_70), after: monthly(next, next.RATE_PARENTAL_70) }
	];
	const changed = Object.keys(overrides).length > 0;

	return (
		<section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
			<h2 className="font-semibold text-ink">Podgląd skutków</h2>
			<p className="mt-1 text-xs text-muted">Miesięczny zasiłek przy podstawie {money(SAMPLE_BASIS)}.</p>
			<dl className="mt-3 space-y-2 text-sm">
				{rows.map((r) => (
					<div key={r.label} className="flex items-baseline justify-between gap-3">
						<dt className="text-muted">{r.label}</dt>
						<dd className="text-right tabular-nums">
							{changed && r.after !== r.before ? (
								<>
									<span className="text-muted line-through">{money(r.before)}</span>{' '}
									<span className="font-semibold text-ink">{money(r.after)}</span>
								</>
							) : (
								<span className="font-medium text-ink">{money(r.before)}</span>
							)}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
