import { ArrowLeft, ArrowUpRight, Download, ExternalLink, LoaderCircle, MessageCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { useChat } from '../../features/chat/ChatContext';
import { KIND_LABEL, documentPath, fileSize, libraryApi, plDate, type LibraryData } from '../../features/library/libraryApi';
import { AppRoutePaths } from '../../types/shared';
import DocumentHistory from './DocumentHistory';

function Info({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div>
			<dt className="text-xs text-muted">{label}</dt>
			<dd className="font-medium text-ink">{children}</dd>
		</div>
	);
}

const btn = 'inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition';

/** One document of the knowledge base: PDF preview of the local copy, details, sources and version history. */
export default function KnowledgeDocument() {
	const { id = '' } = useParams();
	const chat = useChat();
	const [data, setData] = useState<LibraryData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		libraryApi
			.list()
			.then(setData)
			.catch((err: Error) => setError(err.message));
	}, []);

	const doc = data?.documents.find((d) => d.id === id);
	const category = data?.categories.find((c) => c.value === doc?.category);
	const section = category?.sections.find((s) => s.value === doc?.section);
	const topicLabel = (t: string) => data?.topics.find((x) => x.value === t)?.label ?? t;

	useEffect(() => {
		if (doc) document.title = `${doc.code ? `${doc.code} – ` : ''}${doc.title} | Baza wiedzy ZUSia`;
	}, [doc]);

	if (error || (data && !doc)) {
		return (
			<BaseLayout>
				<div className="space-y-3 py-12 text-center">
					<h1 className="text-2xl font-bold text-ink">{error ? 'Nie udało się wczytać dokumentu' : 'Nie znaleźliśmy tego dokumentu'}</h1>
					<p className="text-muted">{error ?? 'Mógł zostać usunięty albo adres jest niepoprawny.'}</p>
					<Link to={AppRoutePaths.KNOWLEDGE} className="font-semibold text-brand-ink hover:underline">
						Wróć do bazy wiedzy
					</Link>
				</div>
			</BaseLayout>
		);
	}
	if (!doc) {
		return (
			<BaseLayout>
				<p className="flex items-center gap-2 py-12 text-sm text-muted" role="status">
					<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
					Wczytuję dokument…
				</p>
			</BaseLayout>
		);
	}

	const current = doc.versions[0];
	const file = current.file;
	const siblings = data!.documents.filter((d) => d.section === doc.section && d.category === doc.category && d.id !== doc.id && d.status === 'obowiazujacy');
	const replacement = doc.withdrawn?.replacedBy ? data!.documents.find((d) => d.id === doc.withdrawn!.replacedBy) : null;

	return (
		<BaseLayout>
			<div className="space-y-6">
				<nav aria-label="Ścieżka" className="enter flex flex-wrap items-center gap-1.5 text-sm text-muted">
					<Link to={AppRoutePaths.KNOWLEDGE} className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
						<ArrowLeft className="h-4 w-4" aria-hidden />
						Baza wiedzy
					</Link>
					{category && (
						<>
							<span aria-hidden>/</span>
							<Link to={`${AppRoutePaths.KNOWLEDGE}?kategoria=${category.value}`} className="hover:text-ink hover:underline">
								{category.label}
							</Link>
						</>
					)}
					{category && section && (
						<>
							<span aria-hidden>/</span>
							<Link to={`${AppRoutePaths.KNOWLEDGE}?kategoria=${category.value}&sekcja=${section.value}`} className="hover:text-ink hover:underline">
								{section.label}
							</Link>
						</>
					)}
				</nav>

				<header className="enter space-y-2">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">
						{KIND_LABEL[doc.kind]}
						{doc.status === 'wycofany' ? ' · wycofany' : ' · obowiązuje'}
					</p>
					<h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
						{doc.code && <span className="mr-2 text-brand-ink">{doc.code}</span>}
						{doc.title}
					</h1>
					{doc.kind === 'akt_prawny' && <p className="max-w-3xl text-sm text-muted">{doc.fullTitle}</p>}
					{doc.description && <p className="max-w-3xl text-muted">{doc.description}</p>}
					{doc.withdrawn && (
						<p className="max-w-3xl rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
							Dokument wycofany {plDate(doc.withdrawn.at)}: {doc.withdrawn.reason}{' '}
							{replacement && (
								<Link to={documentPath(replacement.id)} className="font-semibold underline">
									Zamiast niego: {replacement.fullTitle}
								</Link>
							)}
						</p>
					)}
				</header>

				<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
					<div className="space-y-6">
						<section aria-label="Podgląd dokumentu" className="overflow-hidden rounded-lg border border-line bg-paper shadow-sm">
							{file ? (
								<object data={`${file.path}#view=FitH`} type="application/pdf" className="h-[75vh] min-h-[28rem] w-full" aria-label={`Podgląd: ${doc.fullTitle}`}>
									<div className="space-y-2 p-6 text-sm text-muted">
										<p>Twoja przeglądarka nie wyświetla plików PDF na stronie.</p>
										<a href={file.path} download className="font-semibold text-brand-ink hover:underline">
											Pobierz PDF ({fileSize(file.size)})
										</a>
									</div>
								</object>
							) : (
								<div className="space-y-2 p-6 text-sm text-muted">
									<p>Ten dokument jest dostępny na stronie instytucji, która go publikuje.</p>
									<a href={doc.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
										Otwórz stronę dokumentu
										<ArrowUpRight className="h-4 w-4" aria-hidden />
									</a>
								</div>
							)}
						</section>

						<section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
							<h2 className="mb-3 font-semibold text-ink">Historia zmian</h2>
							<DocumentHistory doc={doc} />
						</section>
					</div>

					<aside className="space-y-4 lg:sticky lg:top-24">
						<section className="space-y-2 rounded-lg border border-line bg-paper p-5 shadow-sm">
							{file && (
								<>
									<a href={file.path} download className={`${btn} bg-brand text-white hover:bg-brand-strong`}>
										<Download className="h-4 w-4" aria-hidden />
										Pobierz PDF ({fileSize(file.size)})
									</a>
									<a href={file.path} target="_blank" rel="noopener noreferrer" className={`${btn} border border-line text-ink hover:bg-hover`}>
										<ExternalLink className="h-4 w-4" aria-hidden />
										Otwórz w nowej karcie
									</a>
								</>
							)}
							<a href={doc.pageUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border border-line text-ink hover:bg-hover`}>
								<ArrowUpRight className="h-4 w-4" aria-hidden />
								{doc.kind === 'akt_prawny' ? 'Akt w ISAP' : doc.kind === 'formularz' ? 'Strona formularza na zus.pl' : 'Strona poradnika'}
							</a>
							{chat.enabled && (
								<button
									type="button"
									onClick={() =>
										chat.ask(
											`Wyjaśnij prostym językiem dokument „${doc.fullTitle}”: do czego służy, kto i kiedy go składa lub stosuje${doc.versions.length > 1 || doc.amendments.length ? ' i co zmieniało się w nim w ostatnich latach' : ''}.`
										)
									}
									className={`${btn} text-brand-ink hover:bg-hover`}>
									<MessageCircle className="h-4 w-4" aria-hidden />
									Zapytaj ZUSię o ten dokument
								</button>
							)}
						</section>

						<section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
							<h2 className="mb-3 font-semibold text-ink">Informacje</h2>
							<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
								<Info label="Kategoria">{category?.label ?? '—'}</Info>
								<Info label="Sekcja">{section?.label ?? '—'}</Info>
								<Info label="Aktualna wersja">{current.version}</Info>
								<Info label="Obowiązuje od">{plDate(current.validFrom)}</Info>
								{file?.pages && <Info label="Liczba stron">{file.pages}</Info>}
								{file && <Info label="Kopia pobrana">{plDate(file.downloadedAt)}</Info>}
								<div className="col-span-2">
									<Info label="Tematy">{doc.topics.map(topicLabel).join(', ') || '—'}</Info>
								</div>
								{file && (
									<div className="col-span-2">
										<dt className="text-xs text-muted">Suma kontrolna SHA-256 kopii</dt>
										<dd className="break-all font-mono text-xs text-ink" title={file.sha256}>
											{file.sha256}
										</dd>
									</div>
								)}
							</dl>
						</section>

						{siblings.length > 0 && (
							<section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
								<h2 className="mb-2 font-semibold text-ink">Inne w sekcji „{section?.label}”</h2>
								<ul className="space-y-1.5 text-sm">
									{siblings.map((d) => (
										<li key={d.id}>
											<Link to={documentPath(d.id)} className="text-ink hover:text-brand-ink hover:underline">
												{d.code && <span className="mr-1 font-semibold text-brand-ink">{d.code}</span>}
												{d.title}
											</Link>
										</li>
									))}
								</ul>
							</section>
						)}
					</aside>
				</div>
			</div>
		</BaseLayout>
	);
}
