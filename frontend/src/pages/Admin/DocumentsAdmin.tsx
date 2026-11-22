import { ArchiveRestore, ArchiveX, FilePlus2, FileUp, LoaderCircle, Pencil, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
	KIND_LABEL,
	LibraryApiError,
	libraryApi,
	plDate,
	type LibraryDocument,
	type LibraryKind,
	type LibraryLogEntry,
	type LibraryTopic
} from '../../features/library/libraryApi';
import Modal from './Modal';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const inputCls =
	'h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15';
const areaCls =
	'w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15';
const primaryBtn =
	'inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60';
const secondaryBtn = 'rounded-md px-4 py-2 text-sm font-semibold text-muted transition hover:bg-hover hover:text-ink';
const rowBtn = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-ink transition hover:bg-hover';

const ACTION_LABEL: Record<LibraryLogEntry['action'], string> = {
	dodano: 'Dodano',
	nowa_wersja: 'Nowa wersja',
	zmieniono: 'Zmieniono',
	wycofano: 'Wycofano',
	przywrocono: 'Przywrócono'
};

type Dialog =
	| { type: 'create' }
	| { type: 'version'; doc: LibraryDocument }
	| { type: 'edit'; doc: LibraryDocument }
	| { type: 'withdraw'; doc: LibraryDocument };

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<label className="block">
			<span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
			{children}
			{hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
		</label>
	);
}

function TopicPicker({ topics, value, onChange }: { topics: LibraryTopic[]; value: string[]; onChange: (v: string[]) => void }) {
	return (
		<fieldset>
			<legend className="mb-1 text-sm font-semibold text-ink">Tematy</legend>
			<div className="flex flex-wrap gap-x-4 gap-y-1">
				{topics.map((t) => (
					<label key={t.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
						<input
							type="checkbox"
							checked={value.includes(t.value)}
							onChange={(e) => onChange(e.target.checked ? [...value, t.value] : value.filter((x) => x !== t.value))}
							className="h-4 w-4 cursor-pointer accent-brand"
						/>
						{t.label}
					</label>
				))}
			</div>
		</fieldset>
	);
}

/** Fields of a new version – shared by "add document" and "new version". */
type VersionDraft = { version: string; label: string; validFrom: string; url: string; changes: string };
const emptyVersion: VersionDraft = { version: '', label: '', validFrom: '', url: '', changes: '' };

function VersionFields({ draft, set, requireChanges }: { draft: VersionDraft; set: (p: Partial<VersionDraft>) => void; requireChanges: boolean }) {
	return (
		<>
			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="Oznaczenie wersji" hint="Np. „Dz.U. 2027 poz. 120” albo „wzór 01.2027”.">
					<input required value={draft.version} onChange={(e) => set({ version: e.target.value })} className={inputCls} />
				</Field>
				<Field label="Obowiązuje od">
					<input type="date" value={draft.validFrom} onChange={(e) => set({ validFrom: e.target.value })} className={inputCls} />
				</Field>
			</div>
			<Field label="Rodzaj wersji (opcjonalnie)" hint="Np. „Tekst jednolity”, „Wzór do druku”.">
				<input value={draft.label} onChange={(e) => set({ label: e.target.value })} className={inputCls} />
			</Field>
			<Field label="Adres pliku lub tekstu" hint="Link do PDF lub strony z tekstem tej wersji.">
				<input required type="url" value={draft.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" className={inputCls} />
			</Field>
			<Field label={requireChanges ? 'Co się zmieniło' : 'Co się zmieniło (opcjonalnie)'} hint="Prostym językiem – ZUSia użyje tego opisu, tłumacząc zmiany użytkownikom.">
				<textarea required={requireChanges} rows={3} maxLength={1000} value={draft.changes} onChange={(e) => set({ changes: e.target.value })} className={areaCls} />
			</Field>
		</>
	);
}

export default function DocumentsAdmin({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
	const [docs, setDocs] = useState<LibraryDocument[] | null>(null);
	const [topics, setTopics] = useState<LibraryTopic[]>([]);
	const [log, setLog] = useState<LibraryLogEntry[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [kind, setKind] = useState<LibraryKind | 'all'>('all');
	const [dialog, setDialog] = useState<Dialog | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const fail = useCallback(
		(err: unknown) => {
			if (err instanceof LibraryApiError && err.status === 401) onUnauthorized();
			else setError((err as Error).message);
		},
		[onUnauthorized]
	);

	const load = useCallback(() => {
		Promise.all([libraryApi.list(), libraryApi.log(token)])
			.then(([list, entries]) => {
				setDocs(list.documents);
				setTopics(list.topics);
				setLog(entries);
			})
			.catch(fail);
	}, [token, fail]);

	useEffect(load, [load]);

	const list = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (docs ?? []).filter((d) => (kind === 'all' || d.kind === kind) && (!q || `${d.code ?? ''} ${d.fullTitle}`.toLowerCase().includes(q)));
	}, [docs, query, kind]);

	async function done(promise: Promise<LibraryDocument>, text: string) {
		const doc = await promise;
		setDialog(null);
		setMessage(`${text}: ${doc.fullTitle}. Zmiana jest już widoczna w bazie wiedzy i dla ZUSi.`);
		load();
	}

	async function restore(doc: LibraryDocument) {
		setMessage(null);
		try {
			await done(libraryApi.restore(token, doc.id), 'Przywrócono');
		} catch (err) {
			fail(err);
		}
	}

	if (error && !docs) {
		return (
			<p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
				{error}
			</p>
		);
	}
	if (!docs) {
		return (
			<p className="flex items-center gap-2 text-sm text-muted" role="status">
				<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
				Wczytuję dokumenty…
			</p>
		);
	}

	return (
		<div className="space-y-6">
			{message && (
				<p role="status" className="rounded-md border border-brand/40 bg-brand-soft px-4 py-3 text-sm text-brand-ink">
					{message}
				</p>
			)}

			<section className="rounded-lg border border-line bg-paper shadow-sm">
				<header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
					<h2 className="font-semibold text-ink">Dokumenty w bazie wiedzy</h2>
					<span className="text-sm text-muted">{docs.length}</span>
					<button type="button" onClick={() => setDialog({ type: 'create' })} className={cx(primaryBtn, 'ml-auto py-1.5')}>
						<FilePlus2 className="h-4 w-4" aria-hidden />
						Dodaj dokument
					</button>
				</header>
				<div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
					<label className="relative min-w-0 flex-1 basis-56">
						<span className="sr-only">Szukaj</span>
						<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
						<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj dokumentu…" className={cx(inputCls, 'pl-9')} />
					</label>
					<select value={kind} onChange={(e) => setKind(e.target.value as LibraryKind | 'all')} className={cx(inputCls, 'w-auto cursor-pointer')}>
						<option value="all">Wszystkie rodzaje</option>
						{(Object.keys(KIND_LABEL) as LibraryKind[]).map((k) => (
							<option key={k} value={k}>
								{KIND_LABEL[k]}
							</option>
						))}
					</select>
				</div>
				<ul className="divide-y divide-line">
					{list.map((d) => (
						<li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
							<div className="min-w-0 flex-1 basis-72">
								<p className={cx('font-semibold', d.status === 'wycofany' ? 'text-muted line-through' : 'text-ink')}>{d.fullTitle}</p>
								<p className="text-xs text-muted">
									{KIND_LABEL[d.kind]} · wersja {d.versions[0].version}
									{d.versions[0].validFrom && ` od ${plDate(d.versions[0].validFrom)}`} · {d.versions.length}{' '}
									{d.versions.length === 1 ? 'wersja' : d.versions.length < 5 ? 'wersje' : 'wersji'}
									{d.status === 'wycofany' && ' · wycofany'}
								</p>
							</div>
							<div className="flex flex-wrap gap-1">
								<button type="button" onClick={() => setDialog({ type: 'version', doc: d })} className={rowBtn}>
									<FileUp className="h-3.5 w-3.5" aria-hidden />
									Nowa wersja
								</button>
								<button type="button" onClick={() => setDialog({ type: 'edit', doc: d })} className={rowBtn}>
									<Pencil className="h-3.5 w-3.5" aria-hidden />
									Edytuj
								</button>
								{d.status === 'wycofany' ? (
									<button type="button" onClick={() => void restore(d)} className={rowBtn}>
										<ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
										Przywróć
									</button>
								) : (
									<button type="button" onClick={() => setDialog({ type: 'withdraw', doc: d })} className={cx(rowBtn, 'text-red-700 dark:text-red-300')}>
										<ArchiveX className="h-3.5 w-3.5" aria-hidden />
										Wycofaj
									</button>
								)}
							</div>
						</li>
					))}
				</ul>
			</section>

			<section className="rounded-lg border border-line bg-paper shadow-sm">
				<h2 className="border-b border-line px-5 py-3 font-semibold text-ink">Historia zmian w bazie</h2>
				{log.length === 0 ? (
					<p className="px-5 py-4 text-sm text-muted">Nie wprowadzono jeszcze zmian – baza zawiera dokumenty startowe z ISAP i zus.pl.</p>
				) : (
					<ul className="divide-y divide-line">
						{log.slice(0, 15).map((e) => (
							<li key={e.at + e.documentId} className="px-5 py-2.5 text-sm">
								<p className="text-ink">
									<span className="font-semibold">{ACTION_LABEL[e.action]}</span> · {e.title}
								</p>
								<p className="text-xs text-muted">
									{new Date(e.at).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}
									{e.note && ` · ${e.note}`}
								</p>
							</li>
						))}
					</ul>
				)}
			</section>

			{dialog?.type === 'create' && <CreateDialog topics={topics} onClose={() => setDialog(null)} onSubmit={(input) => done(libraryApi.create(token, input), 'Dodano')} onError={fail} />}
			{dialog?.type === 'version' && (
				<VersionDialog doc={dialog.doc} onClose={() => setDialog(null)} onSubmit={(input) => done(libraryApi.addVersion(token, dialog.doc.id, input), 'Opublikowano nową wersję')} onError={fail} />
			)}
			{dialog?.type === 'edit' && (
				<EditDialog doc={dialog.doc} topics={topics} onClose={() => setDialog(null)} onSubmit={(input) => done(libraryApi.update(token, dialog.doc.id, input), 'Zapisano')} onError={fail} />
			)}
			{dialog?.type === 'withdraw' && (
				<WithdrawDialog
					doc={dialog.doc}
					docs={docs}
					onClose={() => setDialog(null)}
					onSubmit={(reason, replacedBy) => done(libraryApi.withdraw(token, dialog.doc.id, reason, replacedBy), 'Wycofano')}
					onError={fail}
				/>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Dialogs                                                            */
/* ------------------------------------------------------------------ */

function useSubmit(onError: (err: unknown) => void) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const run = async (action: () => Promise<void>) => {
		setBusy(true);
		setError(null);
		try {
			await action();
		} catch (err) {
			if (err instanceof LibraryApiError && err.status === 401) onError(err);
			else setError((err as Error).message);
		} finally {
			setBusy(false);
		}
	};
	return { busy, error, run };
}

function DialogForm({
	title,
	busy,
	error,
	submitLabel,
	onClose,
	onSubmit,
	children
}: {
	title: string;
	busy: boolean;
	error: string | null;
	submitLabel: string;
	onClose: () => void;
	onSubmit: () => void;
	children: ReactNode;
}) {
	const formId = `form-${title.replace(/\W+/g, '-')}`;
	return (
		<Modal
			title={title}
			onClose={onClose}
			actions={
				<>
					<button type="button" onClick={onClose} className={secondaryBtn}>
						Anuluj
					</button>
					<button type="submit" form={formId} disabled={busy} className={primaryBtn}>
						{busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
						{submitLabel}
					</button>
				</>
			}>
			<form
				id={formId}
				onSubmit={(e) => {
					e.preventDefault();
					onSubmit();
				}}
				className="space-y-3">
				{children}
				{error && (
					<p role="alert" className="text-sm text-red-700 dark:text-red-300">
						{error}
					</p>
				)}
			</form>
		</Modal>
	);
}

type CreateInput = Parameters<typeof libraryApi.create>[1];

function CreateDialog({ topics, onClose, onSubmit, onError }: { topics: LibraryTopic[]; onClose: () => void; onSubmit: (i: CreateInput) => Promise<void>; onError: (e: unknown) => void }) {
	const { busy, error, run } = useSubmit(onError);
	const [meta, setMeta] = useState({ kind: 'formularz' as LibraryKind, code: '', title: '', description: '', topics: [] as string[], pageUrl: '' });
	const [version, setVersion] = useState<VersionDraft>(emptyVersion);
	return (
		<DialogForm
			title="Dodaj dokument"
			busy={busy}
			error={error}
			submitLabel="Dodaj"
			onClose={onClose}
			onSubmit={() => run(() => onSubmit({ ...meta, ...version, validFrom: version.validFrom || null }))}>
			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="Rodzaj">
					<select value={meta.kind} onChange={(e) => setMeta({ ...meta, kind: e.target.value as LibraryKind })} className={cx(inputCls, 'cursor-pointer')}>
						{(Object.keys(KIND_LABEL) as LibraryKind[]).map((k) => (
							<option key={k} value={k}>
								{KIND_LABEL[k]}
							</option>
						))}
					</select>
				</Field>
				<Field label={meta.kind === 'formularz' ? 'Symbol formularza' : 'Symbol (opcjonalnie)'}>
					<input required={meta.kind === 'formularz'} value={meta.code} onChange={(e) => setMeta({ ...meta, code: e.target.value })} placeholder="np. ZAS-58" className={inputCls} />
				</Field>
			</div>
			<Field label="Nazwa">
				<input required value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} className={inputCls} />
			</Field>
			<Field label="Opis (opcjonalnie)">
				<textarea rows={2} maxLength={600} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} className={areaCls} />
			</Field>
			<TopicPicker topics={topics} value={meta.topics} onChange={(t) => setMeta({ ...meta, topics: t })} />
			<Field label="Strona dokumentu">
				<input required type="url" value={meta.pageUrl} onChange={(e) => setMeta({ ...meta, pageUrl: e.target.value })} placeholder="https://" className={inputCls} />
			</Field>
			<p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Pierwsza wersja</p>
			<VersionFields draft={version} set={(p) => setVersion({ ...version, ...p })} requireChanges={false} />
		</DialogForm>
	);
}

function VersionDialog({ doc, onClose, onSubmit, onError }: { doc: LibraryDocument; onClose: () => void; onSubmit: (i: Parameters<typeof libraryApi.addVersion>[2]) => Promise<void>; onError: (e: unknown) => void }) {
	const { busy, error, run } = useSubmit(onError);
	const [version, setVersion] = useState<VersionDraft>(emptyVersion);
	return (
		<DialogForm
			title={`Nowa wersja: ${doc.code ?? doc.title}`}
			busy={busy}
			error={error}
			submitLabel="Opublikuj wersję"
			onClose={onClose}
			onSubmit={() => run(() => onSubmit({ ...version, validFrom: version.validFrom || null }))}>
			<p className="text-sm text-muted">
				Aktualna wersja: <span className="font-semibold text-ink">{doc.versions[0].version}</span>. Poprzednie wersje zostaną w historii dokumentu.
			</p>
			<VersionFields draft={version} set={(p) => setVersion({ ...version, ...p })} requireChanges />
		</DialogForm>
	);
}

function EditDialog({
	doc,
	topics,
	onClose,
	onSubmit,
	onError
}: {
	doc: LibraryDocument;
	topics: LibraryTopic[];
	onClose: () => void;
	onSubmit: (i: Parameters<typeof libraryApi.update>[2]) => Promise<void>;
	onError: (e: unknown) => void;
}) {
	const { busy, error, run } = useSubmit(onError);
	const [draft, setDraft] = useState({ title: doc.title, description: doc.description, topics: doc.topics, pageUrl: doc.pageUrl });
	return (
		<DialogForm title={`Edytuj: ${doc.code ?? doc.title}`} busy={busy} error={error} submitLabel="Zapisz" onClose={onClose} onSubmit={() => run(() => onSubmit(draft))}>
			<Field label="Nazwa">
				<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputCls} />
			</Field>
			<Field label="Opis" hint="Krótko: do czego służy dokument i kiedy jest potrzebny.">
				<textarea rows={3} maxLength={600} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={areaCls} />
			</Field>
			<TopicPicker topics={topics} value={draft.topics} onChange={(t) => setDraft({ ...draft, topics: t })} />
			<Field label="Strona dokumentu">
				<input required type="url" value={draft.pageUrl} onChange={(e) => setDraft({ ...draft, pageUrl: e.target.value })} className={inputCls} />
			</Field>
		</DialogForm>
	);
}

function WithdrawDialog({
	doc,
	docs,
	onClose,
	onSubmit,
	onError
}: {
	doc: LibraryDocument;
	docs: LibraryDocument[];
	onClose: () => void;
	onSubmit: (reason: string, replacedBy: string | null) => Promise<void>;
	onError: (e: unknown) => void;
}) {
	const { busy, error, run } = useSubmit(onError);
	const [reason, setReason] = useState('');
	const [replacedBy, setReplacedBy] = useState('');
	const candidates = docs.filter((d) => d.id !== doc.id && d.kind === doc.kind && d.status === 'obowiazujacy');
	return (
		<DialogForm
			title={`Wycofaj: ${doc.code ?? doc.title}`}
			busy={busy}
			error={error}
			submitLabel="Wycofaj dokument"
			onClose={onClose}
			onSubmit={() => run(() => onSubmit(reason, replacedBy || null))}>
			<p className="text-sm text-muted">
				Dokument zostanie oznaczony jako wycofany – użytkownicy zobaczą go tylko po włączeniu „Pokaż wycofane”, a ZUSia przestanie go polecać.
			</p>
			<Field label="Powód wycofania">
				<textarea required rows={2} maxLength={400} value={reason} onChange={(e) => setReason(e.target.value)} className={areaCls} placeholder="np. Formularz zastąpiony nowym wzorem od 1.01.2027." />
			</Field>
			<Field label="Zastępuje go (opcjonalnie)">
				<select value={replacedBy} onChange={(e) => setReplacedBy(e.target.value)} className={cx(inputCls, 'cursor-pointer')}>
					<option value="">— brak —</option>
					{candidates.map((d) => (
						<option key={d.id} value={d.id}>
							{d.fullTitle}
						</option>
					))}
				</select>
			</Field>
		</DialogForm>
	);
}
