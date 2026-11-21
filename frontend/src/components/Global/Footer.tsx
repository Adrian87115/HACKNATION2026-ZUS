import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import zusiaLogo from '../../assets/zusia-logo.png';
import type { TranslationKey } from '../../translations';
import { AppRoutePaths } from '../../types/shared';

const TOOLS: { label: TranslationKey; to: string }[] = [
	{ label: 'footer.guide', to: AppRoutePaths.PARENTING_GUIDE },
	{ label: 'footer.leaveCalculator', to: `${AppRoutePaths.CALCULATORS}?tab=maternity` },
	{ label: 'footer.pregnancyCalculator', to: `${AppRoutePaths.CALCULATORS}?tab=pregnancy` },
	{ label: 'footer.applications', to: AppRoutePaths.APPLICATIONS },
	{ label: 'footer.risks', to: AppRoutePaths.RISKS }
];

const SOURCES: { label: TranslationKey; href: string; external: boolean }[] = [
	{ label: 'footer.zus', href: 'https://www.zus.pl', external: true },
	{ label: 'footer.phone', href: 'tel:+48225601600', external: false },
	{ label: 'footer.law', href: 'https://isap.sejm.gov.pl', external: true }
];

const linkCls = 'inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink';

function Column({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div>
			<h2 className="text-xs font-semibold uppercase tracking-wider text-ink">{title}</h2>
			<ul className="mt-3 space-y-2">{children}</ul>
		</div>
	);
}

export default function Footer() {
	const { t } = useTranslation();
	const year = new Date().getFullYear();

	return (
		<footer className="border-t border-line bg-paper">
			<div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
				<div className="max-w-sm">
					<Link to={AppRoutePaths.HOME} className="inline-block">
						<img src={zusiaLogo} alt={t('appName')} className="h-8 w-auto" width={467} height={160} />
					</Link>
					<p className="mt-3 text-sm text-muted">{t('footer.description')}</p>
				</div>

				<Column title={t('footer.tools')}>
					{TOOLS.map((item) => (
						<li key={item.label}>
							<Link to={item.to} className={linkCls}>
								{t(item.label)}
							</Link>
						</li>
					))}
				</Column>

				<Column title={t('footer.help')}>
					{SOURCES.map((item) => (
						<li key={item.label}>
							<a
								href={item.href}
								className={linkCls}
								{...(item.external && { target: '_blank', rel: 'noopener noreferrer' })}>
								{t(item.label)}
								{item.external && (
									<>
										<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
										<span className="sr-only">({t('footer.external')})</span>
									</>
								)}
							</a>
						</li>
					))}
				</Column>
			</div>

			<div className="border-t border-line">
				<div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
					<p>
						© {year} {t('appName')}. {t('footer.rights')} {t('footer.disclaimer')}
					</p>
					<p className="flex items-center gap-3">
						<Link to={AppRoutePaths.ADMIN} className="transition-colors hover:text-ink">
							{t('footer.admin')}
						</Link>
						<span aria-hidden>·</span>
						{t('footer.tagline')}
					</p>
				</div>
			</div>
		</footer>
	);
}
