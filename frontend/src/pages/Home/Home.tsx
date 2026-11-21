import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import DashboardTile from '../../components/Dashboard/DashboardTile';
import BaseLayout from '../../components/Layouts/BaseLayout';
import type { TranslationKey } from '../../translations';

type Tile = {
	title: TranslationKey;
	description: TranslationKey;
	value: string;
	badge?: string;
};

// Placeholder data for the test dashboard
const tiles: Tile[] = [
	{ title: 'dashboard.tiles.applications.title', description: 'dashboard.tiles.applications.description', value: '3', badge: '+1' },
	{ title: 'dashboard.tiles.messages.title', description: 'dashboard.tiles.messages.description', value: '2' },
	{ title: 'dashboard.tiles.documents.title', description: 'dashboard.tiles.documents.description', value: '14' },
	{ title: 'dashboard.tiles.appointments.title', description: 'dashboard.tiles.appointments.description', value: '1' }
];

export default function Home() {
	const { t } = useTranslation();

	return (
		<BaseLayout>
			<section className="mb-8 rounded-2xl bg-linear-to-br from-brand-600 to-brand-700 p-6 text-white sm:p-8">
				<Typography variant="h4" component="h1" className="font-bold">
					{t('dashboard.welcome.title')}
				</Typography>
				<Typography className="mt-2 max-w-2xl text-white/85">{t('dashboard.welcome.subtitle')}</Typography>
			</section>

			<section>
				<Typography variant="h6" component="h2" className="mb-4 font-semibold">
					{t('dashboard.overview')}
				</Typography>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{tiles.map((tile) => (
						<DashboardTile
							key={tile.title}
							title={t(tile.title)}
							description={t(tile.description)}
							value={tile.value}
							badge={tile.badge}
						/>
					))}
				</div>
			</section>
		</BaseLayout>
	);
}
