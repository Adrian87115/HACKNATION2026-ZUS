import { ArrowUpRight, Mail, Phone } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { SUPPORT_ORGANIZATIONS, SUPPORT_TOPICS, VERIFIED_AT, type SupportTopic } from '../../data/supportOrganizations';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const verified = new Date(`${VERIFIED_AT}T00:00:00Z`).toLocaleDateString('pl-PL', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

export default function Support() {
	const [search, setSearch] = useSearchParams();
	const topic = SUPPORT_TOPICS.find((t) => t.value === search.get('temat'))?.value ?? null;

	const list = useMemo(
		() => (topic ? SUPPORT_ORGANIZATIONS.filter((o) => o.topics.includes(topic)) : SUPPORT_ORGANIZATIONS),
		[topic]
	);

	const choose = (value: SupportTopic | null) => setSearch(value ? { temat: value } : {}, { replace: true, preventScrollReset: true });

	return (
		<BaseLayout>
			<div className="space-y-6">
				<header className="enter space-y-2">
					<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">Pomoc i wsparcie</p>
					<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Gdzie szukać pomocy?</h1>
					<p className="max-w-2xl text-muted">
						Instytucje i organizacje, które bezpłatnie lub niskim kosztem pomagają przyszłym rodzicom – w sprawach z ZUS i pracodawcą,
						przy porodzie, wcześniactwie, stracie dziecka i w kryzysie.
					</p>
				</header>

				<div role="radiogroup" aria-label="Czego dotyczy Twoja sprawa?" className="enter flex flex-wrap gap-2" style={{ animationDelay: '60ms' }}>
					{[{ value: null, label: 'Wszystkie', hint: `${SUPPORT_ORGANIZATIONS.length} miejsc` }, ...SUPPORT_TOPICS].map((t) => {
						const active = t.value === topic;
						return (
							<button
								key={t.value ?? 'all'}
								type="button"
								role="radio"
								aria-checked={active}
								onClick={() => choose(t.value as SupportTopic | null)}
								className={cx(
									'rounded-md border px-3 py-2 text-left transition',
									active ? 'border-brand bg-brand-soft/60 ring-1 ring-brand' : 'border-line bg-paper hover:border-muted/60 hover:bg-hover'
								)}>
								<span className={cx('block text-sm font-semibold', active ? 'text-brand-ink' : 'text-ink')}>{t.label}</span>
								<span className="block text-xs text-muted">{t.hint}</span>
							</button>
						);
					})}
				</div>

				<ul className="enter-stagger grid gap-4 md:grid-cols-2" key={topic ?? 'all'}>
					{list.map((o) => (
						<li key={o.name} className="flex flex-col rounded-lg border border-line bg-paper p-5 shadow-sm">
							<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
								<h2 className="font-semibold text-ink">{o.name}</h2>
								<span className="text-xs text-muted">
									{o.kind}
									{o.free && ' · bezpłatnie'}
								</span>
							</div>
							<p className="mt-1.5 flex-1 text-sm text-muted">{o.description}</p>
							<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
								{o.phone && (
									<a
										href={`tel:${o.phone.number.replace(/\s/g, '')}`}
										className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-brand-ink">
										<Phone className="h-4 w-4 text-muted" aria-hidden />
										{o.phone.number}
										{o.phone.note && <span className="font-normal text-muted">({o.phone.note})</span>}
									</a>
								)}
								{o.email && (
									<a href={`mailto:${o.email}`} className="inline-flex items-center gap-1.5 text-ink hover:text-brand-ink">
										<Mail className="h-4 w-4 text-muted" aria-hidden />
										{o.email}
									</a>
								)}
								<a
									href={o.url}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline hover:underline-offset-4">
									{host(o.url)}
									<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
									<span className="sr-only">(otwiera się w nowej karcie)</span>
								</a>
							</div>
							<p className="mt-3 border-t border-line pt-2 text-xs text-muted">
								Dane kontaktowe sprawdzone {verified} na{' '}
								<a href={o.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
									stronie źródłowej
								</a>
								.
							</p>
						</li>
					))}
				</ul>

				<p className="text-xs text-muted">
					ZUSia nie jest powiązana z wymienionymi organizacjami. Godziny pracy i numery mogą się zmienić – przed kontaktem sprawdź stronę
					organizacji. W sytuacji zagrożenia życia dzwoń pod numer alarmowy 112.
				</p>
			</div>
		</BaseLayout>
	);
}
