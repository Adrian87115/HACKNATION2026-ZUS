import { ArrowUpRight, ChevronDown, LoaderCircle, MessageCircle, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { useChat } from '../../features/chat/ChatContext';
import { KIND_LABEL, libraryApi, plDate, type LibraryDocument, type LibraryKind, type LibraryTopic } from '../../features/library/libraryApi';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const today = new Date().toISOString().slice(0, 10);
const fold = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/ł/g, 'l');

const KINDS: { value: LibraryKind | null; label: string }[] = [
	{ value: null, label: 'Wszystko' },
	{ value: 'formularz', label: 'Formularze' },
	{ value: 'akt_prawny', label: 'Przepisy' },
	{ value: 'poradnik', label: 'Poradniki' }
];

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline hover:underline-offset-4">
			{children}
			<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
			<span className="sr-only">(otwiera się w nowej karcie)</span>
		</a>
	);
}

function DocumentCard({ doc, byId, topicLabel }: { doc: LibraryDocument; byId: Map<string, LibraryDocument>; topicLabel: (t: string) => string }) {
	const chat = useChat();
	const [open, setOpen] = useState(false);
	const current = doc.versions[0];
	const history = doc.versions.slice(1);
	const withdrawn = doc.status === 'wycofany';
	const replacement = doc.withdrawn?.replacedBy ? byId.get(doc.withdrawn.replacedBy) : null;
	const hasHistory = history.length > 0 || doc.amendments.length > 0;

	return (
		<li className={cx('rounded-lg border bg-paper p-5 shadow-sm', withdrawn ? 'border-dashed border-line opacity-80' : 'border-line')}>
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h2 className="font-semibold text-ink">
					{doc.code && <span className="mr-1.5 text-brand-ink">{doc.code}</span>}
					{doc.title}
				</h2>
				<span className="text-xs text-muted">
					{KIND_LABEL[doc.kind]}
					{withdrawn ? ' · wycofany' : ' · obowiązuje'}
				</span>
			</div>
			{doc.kind === 'akt_prawny' && doc.fullTitle !== doc.title && <p className="mt-0.5 text-xs text-muted">{doc.fullTitle}</p>}
			{doc.description && <p className="mt-1.5 text-sm text-muted">{doc.description}</p>}

			{withdrawn && doc.withdrawn && (
				<p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
					Wycofany {plDate(doc.withdrawn.at)}: {doc.withdrawn.reason}
					{replacement && ` Zamiast niego: ${replacement.fullTitle}.`}
				</p>
			)}

			<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
				<span className="text-muted">
					{withdrawn ? 'Ostatnia wersja' : 'Aktualna wersja'}: <span className="font-semibold text-ink">{current.version}</span>
					{current.validFrom && ` · od ${plDate(current.validFrom)}`}
				</span>
				<ExternalLink href={current.url}>{doc.kind === 'formularz' ? 'Pobierz wzór' : 'Otwórz tekst'}</ExternalLink>
				{doc.pageUrl !== current.url && <ExternalLink href={doc.pageUrl}>Strona dokumentu</ExternalLink>}
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
				{hasHistory && (
					<button
						type="button"
						onClick={() => setOpen((o) => !o)}
						aria-expanded={open}
						className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-ink transition hover:bg-hover">
						<ChevronDown className={cx('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
						Historia zmian ({history.length + doc.amendments.length})
					</button>
				)}
				<button
					type="button"
					onClick={() =>
						chat.ask(
							`Wyjaśnij prostym językiem dokument „${doc.fullTitle}”: do czego służy, kiedy jest potrzebny${hasHistory ? ' i co zmieniało się w nim w ostatnich latach' : ''}.`
						)
					}
					className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-brand-ink transition hover:bg-hover">
					<MessageCircle className="h-4 w-4" aria-hidden />
					Zapytaj ZUSię
				</button>
				<span className="ml-auto text-xs text-muted">{doc.topics.map(topicLabel).join(' · ')}</span>
			</div>

			{open && (
				<div className="enter mt-3 space-y-4 text-sm">
					{history.length > 0 && (
						<div>
							<h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Wcześniejsze wersje</h3>
							<ol className="mt-2 space-y-2">
								{[current, ...history].map((v, i) => (
									<li key={v.version} className="flex gap-3">
										<span aria-hidden className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', i === 0 ? 'bg-brand' : 'bg-line')} />
										<div className="min-w-0">
											<p>
												<a href={v.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-brand-ink hover:underline">
													{v.version}
												</a>
												<span className="text-muted">
													{' '}
													· {v.label}
													{v.validFrom && ` · ${plDate(v.validFrom)}`}
													{i === 0 && ' · aktualna'}
												</span>
											</p>
											{v.changes && <p className="text-muted">{v.changes}</p>}
										</div>
									</li>
								))}
							</ol>
						</div>
					)}
					{doc.amendments.length > 0 && (
						<div>
							<h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Akty zmieniające (od 2022 r.)</h3>
							<ul className="mt-2 divide-y divide-line">
								{doc.amendments.map((a) => (
									<li key={a.source} className="py-1.5">
										<p className="text-ink">
											<span className="font-semibold tabular-nums">{plDate(a.date)}</span>
											{a.date > today && <span className="ml-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">wejdzie w życie</span>}
										</p>
										<p className="text-muted">
											{a.title} –{' '}
											<a href={a.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
												{a.source}
											</a>
										</p>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</li>
	);
}

export default function Knowledge() {
	const [search, setSearch] = useSearchParams();
	const [data, setData] = useState<{ topics: LibraryTopic[]; documents: LibraryDocument[] } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState(search.get('q') ?? '');
	const [showWithdrawn, setShowWithdrawn] = useState(false);

	useEffect(() => {
		libraryApi
			.list()
			.then(setData)
			.catch((err: Error) => setError(err.message));
	}, []);

	const topic = data?.topics.find((t) => t.value === search.get('temat'))?.value ?? null;
	const kind = KINDS.find((k) => k.value === search.get('rodzaj'))?.value ?? null;
	const setParam = (key: string, value: string | null) => {
		const next = new URLSearchParams(search);
		if (value) next.set(key, value);
		else next.delete(key);
		setSearch(next, { replace: true, preventScrollReset: true });
	};

	const byId = useMemo(() => new Map((data?.documents ?? []).map((d) => [d.id, d])), [data]);
	const topicLabel = (t: string) => data?.topics.find((x) => x.value === t)?.label ?? t;

	const list = useMemo(() => {
		if (!data) return [];
		const q = fold(query.trim());
		return data.documents.filter(
			(d) =>
				(showWithdrawn || d.status === 'obowiazujacy') &&
				(!topic || d.topics.includes(topic)) &&
				(!kind || d.kind === kind) &&
				(!q || fold(`${d.code ?? ''} ${d.fullTitle} ${d.description}`).includes(q))
		);
	}, [data, query, topic, kind, showWithdrawn]);

	const withdrawnCount = data?.documents.filter((d) => d.status === 'wycofany').length ?? 0;

	return (
		<BaseLayout>
			<div className="space-y-6">
				<header className="enter space-y-2">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Baza wiedzy</p>
					<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Formularze, przepisy i poradniki</h1>
					<p className="max-w-2xl text-muted">
						Oficjalne wzory wniosków ZUS, aktualne teksty ustaw i rozporządzeń z historią zmian oraz poradniki instytucji. Nie wiesz, którego
						dokumentu potrzebujesz? Zapytaj ZUSię – przetłumaczy język prawny na konkretne wskazówki.
					</p>
				</header>

				<div className="enter space-y-3" style={{ animationDelay: '60ms' }}>
					<div className="flex flex-wrap items-center gap-3">
						<label className="relative min-w-0 flex-1 basis-64">
							<span className="sr-only">Szukaj dokumentu</span>
							<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
							<input
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Szukaj: ZAM, zasiłek chorobowy, Kodeks pracy…"
								className="h-10 w-full rounded-md border border-line bg-paper pr-3 pl-9 text-sm text-ink transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
							/>
						</label>
						<div role="tablist" aria-label="Rodzaj dokumentu" className="flex gap-1 border-b border-line">
							{KINDS.map((k) => (
								<button
									key={k.label}
									type="button"
									role="tab"
									aria-selected={k.value === kind}
									onClick={() => setParam('rodzaj', k.value)}
									className={cx(
										'-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition',
										k.value === kind ? 'border-brand text-brand-ink' : 'border-transparent text-muted hover:text-ink'
									)}>
									{k.label}
								</button>
							))}
						</div>
					</div>
					{data && (
						<div role="radiogroup" aria-label="Temat" className="flex flex-wrap gap-2">
							{[{ value: null as string | null, label: 'Wszystkie tematy' }, ...data.topics].map((t) => (
								<button
									key={t.value ?? 'all'}
									type="button"
									role="radio"
									aria-checked={t.value === topic}
									onClick={() => setParam('temat', t.value)}
									className={cx(
										'rounded-md border px-3 py-1.5 text-sm font-semibold transition',
										t.value === topic ? 'border-brand bg-brand-soft/60 text-brand-ink ring-1 ring-brand' : 'border-line bg-paper text-ink hover:bg-hover'
									)}>
									{t.label}
								</button>
							))}
						</div>
					)}
					{withdrawnCount > 0 && (
						<label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
							<input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} className="h-4 w-4 cursor-pointer accent-brand" />
							Pokaż wycofane dokumenty ({withdrawnCount})
						</label>
					)}
				</div>

				{error ? (
					<p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
						{error}
					</p>
				) : !data ? (
					<p className="flex items-center gap-2 text-sm text-muted" role="status">
						<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
						Wczytuję dokumenty…
					</p>
				) : list.length === 0 ? (
					<p className="text-sm text-muted">Nie znaleźliśmy dokumentów pasujących do wyszukiwania.</p>
				) : (
					<ul className="enter-stagger grid gap-4 lg:grid-cols-2" key={`${topic}-${kind}`}>
						{list.map((d) => (
							<DocumentCard key={d.id} doc={d} byId={byId} topicLabel={topicLabel} />
						))}
					</ul>
				)}

				<p className="text-xs text-muted">
					Teksty aktów i ich historia pochodzą z Internetowego Systemu Aktów Prawnych (API Sejmu RP), wzory formularzy – ze strony zus.pl.
					Bazę aktualizuje administrator w panelu administracyjnym.
				</p>
			</div>
		</BaseLayout>
	);
}
