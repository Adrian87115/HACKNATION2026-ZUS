import { LoaderCircle, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BACKEND_API } from '../../config/api';
import { setFeatures, type Features } from '../../features/system/features';

type LogEntry = { at: string; changes: string[] };

const SWITCHES: { key: 'assistant' | 'caseImport' | 'onlineApplications'; label: string; description: string }[] = [
	{ key: 'assistant', label: 'Asystentka ZUSia', description: 'Panel czatu, przyciski „Zapytaj ZUSię” i sprawdzanie wniosków przez asystentkę.' },
	{ key: 'caseImport', label: 'Odczyt dokumentów sprawy (AI)', description: 'Wczytywanie dokumentów (ZAM, Z-3, e-ZLA…) i uzupełnianie kalkulatora na ich podstawie.' },
	{ key: 'onlineApplications', label: 'Składanie wniosków online', description: 'Formularz wniosków o urlopy, ZAM i odpis aktu urodzenia z podpisem w mObywatelu.' }
];

async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${token}`);
	if (init.body) headers.set('Content-Type', 'application/json');
	let res: Response;
	try {
		res = await fetch(`${BACKEND_API}${path}`, { ...init, headers });
	} catch {
		throw Object.assign(new Error('Brak połączenia z serwerem. Spróbuj ponownie.'), { status: 0 });
	}
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string } | null;
		throw Object.assign(new Error(res.status < 500 && body?.message ? body.message : 'Nie udało się zapisać zmian. Spróbuj ponownie.'), {
			status: res.status
		});
	}
	return (await res.json()) as T;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${checked ? 'bg-brand' : 'bg-line'}`}>
			<span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
		</button>
	);
}

/** Switch system features on and off and publish a message for all users – without a deployment. */
export default function FeaturesAdmin({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
	const [saved, setSaved] = useState<Features | null>(null);
	const [draft, setDraft] = useState<Features | null>(null);
	const [log, setLog] = useState<LogEntry[]>([]);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

	const fail = useCallback(
		(err: unknown) => {
			if ((err as { status?: number }).status === 401) onUnauthorized();
			else setMessage({ tone: 'error', text: (err as Error).message });
		},
		[onUnauthorized]
	);

	useEffect(() => {
		Promise.all([fetch(`${BACKEND_API}/features`).then((r) => r.json() as Promise<Features>), call<LogEntry[]>('/features/log', token)])
			.then(([features, entries]) => {
				setSaved(features);
				setDraft(features);
				setLog(entries);
			})
			.catch(fail);
	}, [token, fail]);

	async function save() {
		if (!draft) return;
		setBusy(true);
		setMessage(null);
		try {
			const next = await call<Features>('/features', token, { method: 'PUT', body: JSON.stringify(draft) });
			setSaved(next);
			setDraft(next);
			setFeatures(next);
			setLog(await call<LogEntry[]>('/features/log', token));
			setMessage({ tone: 'ok', text: 'Zapisano. Zmiany działają od razu dla wszystkich użytkowników.' });
		} catch (err) {
			fail(err);
		} finally {
			setBusy(false);
		}
	}

	if (!draft || !saved) {
		return message ? (
			<p role="alert" className="text-sm text-red-700 dark:text-red-300">
				{message.text}
			</p>
		) : (
			<p className="flex items-center gap-2 text-sm text-muted" role="status">
				<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
				Wczytuję ustawienia…
			</p>
		);
	}

	const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
	const a = draft.announcement;

	return (
		<div className="space-y-6">
			<section className="rounded-lg border border-line bg-paper shadow-sm">
				<h2 className="border-b border-line px-5 py-3 font-semibold text-ink">Funkcje systemu</h2>
				<ul className="divide-y divide-line">
					{SWITCHES.map((s) => (
						<li key={s.key} className="flex items-start justify-between gap-4 px-5 py-3">
							<div>
								<p className="text-sm font-semibold text-ink">{s.label}</p>
								<p className="text-sm text-muted">{s.description}</p>
							</div>
							<Toggle checked={draft[s.key]} onChange={(v) => setDraft({ ...draft, [s.key]: v })} label={s.label} />
						</li>
					))}
				</ul>
			</section>

			<section className="rounded-lg border border-line bg-paper shadow-sm">
				<header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
					<div>
						<h2 className="font-semibold text-ink">Komunikat dla użytkowników</h2>
						<p className="text-sm text-muted">Pasek na górze każdej strony – np. o przerwie technicznej albo zmianie przepisów.</p>
					</div>
					<Toggle checked={a.enabled} onChange={(v) => setDraft({ ...draft, announcement: { ...a, enabled: v } })} label="Pokaż komunikat" />
				</header>
				<div className="space-y-3 px-5 py-4">
					<label className="block">
						<span className="mb-1 block text-sm font-semibold text-ink">Treść</span>
						<textarea
							rows={2}
							maxLength={300}
							value={a.text}
							onChange={(e) => setDraft({ ...draft, announcement: { ...a, text: e.target.value } })}
							className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
						/>
					</label>
					<div role="radiogroup" aria-label="Rodzaj komunikatu" className="flex gap-4 text-sm">
						{(['info', 'warning'] as const).map((tone) => (
							<label key={tone} className="flex cursor-pointer items-center gap-1.5 text-ink">
								<input
									type="radio"
									name="tone"
									checked={a.tone === tone}
									onChange={() => setDraft({ ...draft, announcement: { ...a, tone } })}
									className="h-4 w-4 cursor-pointer accent-brand"
								/>
								{tone === 'info' ? 'Informacja' : 'Ostrzeżenie'}
							</label>
						))}
					</div>
				</div>
			</section>

			<div className="flex flex-wrap items-center gap-3">
				<button
					type="button"
					disabled={!dirty || busy}
					onClick={() => void save()}
					className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:bg-hover disabled:text-muted">
					{busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
					Zapisz zmiany
				</button>
				{dirty && (
					<button type="button" onClick={() => setDraft(saved)} className="rounded-md px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-hover hover:text-ink">
						Odrzuć
					</button>
				)}
				{message && (
					<p role="status" className={`text-sm ${message.tone === 'ok' ? 'text-brand-ink' : 'text-red-700 dark:text-red-300'}`}>
						{message.text}
					</p>
				)}
			</div>

			<section className="rounded-lg border border-line bg-paper shadow-sm">
				<h2 className="border-b border-line px-5 py-3 font-semibold text-ink">Historia zmian</h2>
				{log.length === 0 ? (
					<p className="px-5 py-4 text-sm text-muted">Wszystkie funkcje działają w ustawieniach domyślnych.</p>
				) : (
					<ul className="divide-y divide-line">
						{log.slice(0, 15).map((e) => (
							<li key={e.at} className="px-5 py-2.5 text-sm">
								<p className="text-xs text-muted">{new Date(e.at).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}</p>
								<p className="text-ink">{e.changes.join(' · ')}</p>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
