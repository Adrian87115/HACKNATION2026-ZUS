import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import BaseLayout from '../../components/Layouts/BaseLayout';
import { AppRoutePaths } from '../../types/shared';

export default function NotFound() {
	const { t } = useTranslation();

	return (
		<BaseLayout>
			<section className="enter-stagger mx-auto max-w-xl py-16 text-center">
				<p className="text-xs font-semibold uppercase tracking-wider text-brand-ink">{t('notFound.code')}</p>
				<h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t('notFound.title')}</h1>
				<p className="mt-3 text-muted">{t('notFound.description')}</p>
				<div className="mt-8 flex flex-wrap justify-center gap-3">
					<Link
						to={AppRoutePaths.HOME}
						className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong">
						{t('notFound.home')}
					</Link>
					<Link
						to={AppRoutePaths.PARENTING_GUIDE}
						className="group inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-5 py-3 text-sm font-semibold text-ink transition hover:bg-hover">
						{t('notFound.guide')}
						<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
					</Link>
				</div>
			</section>
		</BaseLayout>
	);
}
