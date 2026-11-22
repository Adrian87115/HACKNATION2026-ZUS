import { plDate, type LibraryDocument } from '../../features/library/libraryApi';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const today = new Date().toISOString().slice(0, 10);

/** Versions of a document (newest first) and, for legal acts, the acts that amended it. */
export default function DocumentHistory({ doc }: { doc: LibraryDocument }) {
	return (
		<div className="space-y-5 text-sm">
			<div>
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Wersje dokumentu</h3>
				<ol className="mt-2 space-y-2.5">
					{doc.versions.map((v, i) => (
						<li key={v.version} className="flex gap-3">
							<span aria-hidden className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', i === 0 ? 'bg-brand' : 'bg-line')} />
							<div className="min-w-0">
								<p>
									<a href={v.file?.path ?? v.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-brand-ink hover:underline">
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
								{i > 0 && (
									<a href={v.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-ink hover:underline">
										tekst tej wersji w ISAP / zus.pl
									</a>
								)}
							</div>
						</li>
					))}
				</ol>
			</div>
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
	);
}
