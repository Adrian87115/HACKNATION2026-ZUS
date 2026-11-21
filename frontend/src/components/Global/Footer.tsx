import { useTranslation } from 'react-i18next';

export default function Footer() {
	const { t } = useTranslation();
	const year = new Date().getFullYear();

	return (
		<footer className="border-t border-line bg-paper">
			<div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<p>
					© {year} {t('appName')}. {t('footer.rights')}
				</p>
				<p>{t('footer.tagline')}</p>
			</div>
		</footer>
	);
}
