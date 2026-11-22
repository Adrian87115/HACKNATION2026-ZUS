import { Download, FileText, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { documentPath, fileSize, libraryApi, plDate, type LibraryData, type LibraryDocument } from '../../features/library/libraryApi';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const fold = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/ł/g, 'l');

function DocumentRow({ doc }: { doc: LibraryDocument }) {
	const current = doc.versions[0];
	const file = current.file;
	const withdrawn = doc.status === 'wycofany';
	return (
		<li className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', withdrawn && 'opacity-70')}>
			<FileText className="hidden h-5 w-5 shrink-0 text-muted sm:block" aria-hidden />
			<div className="min-w-0 flex-1 basis-64">
				<Link to={documentPath(doc.id)} className="group block">
					<span className="font-semibold text-ink group-hover:text-brand-ink">
						{doc.code && <span className="mr-1.5 text-brand-ink">{doc.code}</span>}
						{doc.title}
					</span>
					{withdrawn && <span className="ml-2 rounded bg-hover px-1.5 text-xs font-semibold leading-5 text-muted">wycofany</span>}
				</Link>
				{doc.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{doc.description}</p>}
				<p className="mt-0.5 text-xs text-muted">
					{current.version}
					{current.validFrom && ` · od ${plDate(current.validFrom)}`}
					{file?.pages && ` · ${file.pages} str.`}
					{file && ` · PDF ${fileSize(file.size)}`}
				</p>
			</div>
			<div className="flex shrink-0 gap-1">
				<Link to={documentPath(doc.id)} className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-hover">
					Podgląd
				</Link>
				{file ? (
					<a
						href={file.path}
						download
						title={`Pobierz PDF (${fileSize(file.size)})`}
						className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-brand-ink transition hover:bg-hover">
						<Download className="h-4 w-4" aria-hidden />
						PDF
					</a>
				) : (
					<a href={doc.pageUrl} target="_blank" rel="noopener noreferrer" className="rounded-md px-3 py-1.5 text-sm font-semibold text-brand-ink transition hover:bg-hover">
						Strona
					</a>
				)}
			</div>
		</li>
	);
}

export default function Knowledge() {
	const [search, setSearch] = useSearchParams();
	const [data, setData] = useState<LibraryData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState(search.get('q') ?? '');
	const [showWithdrawn, setShowWithdrawn] = useState(false);

	useEffect(() => {
		libraryApi
			.list()
			.then(setData)
			.catch((err: Error) => setError(err.message));
	}, []);

	const category = data?.categories.find((c) => c.value === search.get('kategoria')) ?? null;
	const section = category?.sections.find((s) => s.value === search.get('sekcja')) ?? null;
	const topic = data?.topics.find((t) => t.value === search.get('temat'))?.value ?? null;

	const select = (patch: Record<string, string | null>) => {
		const next = new URLSearchParams(search);
		for (const [k, v] of Object.entries(patch)) {
			if (v) next.set(k, v);
			else next.delete(k);
		}
		setSearch(next, { replace: true, preventScrollReset: true });
	};

	/** Documents matching search, topic and the withdrawn switch – before choosing a category (for the counts). */
	const matching = useMemo(() => {
		if (!data) return [];
		const q = fold(query.trim());
		return data.documents.filter(
			(d) =>
				(showWithdrawn || d.status === 'obowiazujacy') &&
				(!topic || d.topics.includes(topic)) &&
				(!q || fold(`${d.code ?? ''} ${d.fullTitle} ${d.description}`).includes(q))
		);
	}, [data, query, topic, showWithdrawn]);

	const count = (cat: string, sec?: string) => matching.filter((d) => d.category === cat && (!sec || d.section === sec)).length;
	const visibleCategories = (data?.categories ?? []).filter((c) => !category || c.value === category.value);
	const withdrawnCount = data?.documents.filter((d) => d.status === 'wycofany').length ?? 0;
	const navItem = (active: boolean) =>
		cx(
			'flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition',
			active ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-ink hover:bg-hover'
		);

	return (
		<BaseLayout>
			<div className="space-y-6">
				<header className="enter space-y-2">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Baza wiedzy</p>
					<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Przepisy, wnioski i zaświadczenia</h1>
					<p className="max-w-2xl text-muted">
						Wszystkie dokumenty w jednym miejscu: teksty ustaw i rozporządzeń z historią zmian oraz oficjalne wzory formularzy ZUS. Otwórz
						podgląd, pobierz PDF albo zapytaj ZUSię, co oznacza dany dokument.
					</p>
				</header>

				<div className="enter flex flex-wrap items-center gap-3" style={{ animationDelay: '60ms' }}>
					<label className="relative min-w-0 flex-1 basis-64">
						<span className="sr-only">Szukaj dokumentu</span>
						<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Szukaj: ZAM, Z-3, zasiłek chorobowy, Kodeks pracy…"
							className="h-10 w-full rounded-md border border-line bg-paper pr-3 pl-9 text-sm text-ink transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
						/>
					</label>
					{data && (
						<label className="flex items-center gap-2 text-sm text-muted">
							<span className="sr-only sm:not-sr-only">Temat</span>
							<select
								value={topic ?? ''}
								onChange={(e) => select({ temat: e.target.value || null })}
								className="h-10 cursor-pointer rounded-md border border-line bg-paper px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15">
								<option value="">Wszystkie tematy</option>
								{data.topics.map((t) => (
									<option key={t.value} value={t.value}>
										{t.label}
									</option>
								))}
							</select>
						</label>
					)}
					{withdrawnCount > 0 && (
						<label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
							<input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} className="h-4 w-4 cursor-pointer accent-brand" />
							Wycofane ({withdrawnCount})
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
				) : (
					<div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
						{/* Categories and sections */}
						<nav aria-label="Kategorie dokumentów" className="rounded-lg border border-line bg-paper p-2 shadow-sm lg:sticky lg:top-24">
							<button type="button" onClick={() => select({ kategoria: null, sekcja: null })} className={navItem(!category)} aria-current={!category ? 'true' : undefined}>
								<span>Wszystkie dokumenty</span>
								<span className="text-xs tabular-nums text-muted">{matching.length}</span>
							</button>
							{data.categories.map((c) => (
								<div key={c.value} className="mt-1">
									<button
										type="button"
										onClick={() => select({ kategoria: c.value, sekcja: null })}
										className={navItem(category?.value === c.value && !section)}
										aria-current={category?.value === c.value && !section ? 'true' : undefined}>
										<span className="font-semibold">{c.label}</span>
										<span className="text-xs tabular-nums text-muted">{count(c.value)}</span>
									</button>
									<div className="ml-3 border-l border-line pl-1">
										{c.sections.map((s) => (
											<button
												key={s.value}
												type="button"
												onClick={() => select({ kategoria: c.value, sekcja: s.value })}
												className={navItem(section?.value === s.value && category?.value === c.value)}
												aria-current={section?.value === s.value && category?.value === c.value ? 'true' : undefined}>
												<span>{s.label}</span>
												<span className="text-xs tabular-nums text-muted">{count(c.value, s.value)}</span>
											</button>
										))}
									</div>
								</div>
							))}
						</nav>

						{/* Documents grouped by category → section */}
						<div className="space-y-8">
							{visibleCategories.map((c) => {
								const sections = c.sections.filter((s) => !section || s.value === section.value);
								if (!count(c.value)) return null;
								return (
									<section key={c.value} aria-labelledby={`kat-${c.value}`} className="enter space-y-4">
										<div>
											<h2 id={`kat-${c.value}`} className="text-xl font-bold tracking-tight text-ink">
												{c.label}
											</h2>
											<p className="text-sm text-muted">{c.description}</p>
										</div>
										{sections.map((s) => {
											const docs = matching.filter((d) => d.category === c.value && d.section === s.value);
											if (!docs.length) return null;
											return (
												<div key={s.value}>
													<h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
														{s.label}
														<span className="font-normal normal-case tracking-normal">({docs.length})</span>
													</h3>
													<ul className="divide-y divide-line rounded-lg border border-line bg-paper shadow-sm">
														{docs.map((d) => (
															<DocumentRow key={d.id} doc={d} />
														))}
													</ul>
												</div>
											);
										})}
									</section>
								);
							})}
							{matching.length === 0 && <p className="text-sm text-muted">Nie znaleźliśmy dokumentów pasujących do wyszukiwania.</p>}
						</div>
					</div>
				)}

				<p className="text-xs text-muted">
					Kopie dokumentów pobrano 21 listopada 2026 r. z API Sejmu RP (teksty z Dziennika Ustaw, jak w ISAP) i ze strony zus.pl („Wzory
					formularzy”). Bazę aktualizuje administrator w panelu administracyjnym – poprzednie wersje zostają w historii.
				</p>
			</div>
		</BaseLayout>
	);
}
