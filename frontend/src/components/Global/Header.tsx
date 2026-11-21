import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { NavigationItems } from '../../types/constants';
import { AppRoutePaths } from '../../types/shared';

export default function Header() {
	const { t } = useTranslation();

	return (
		<header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/90 backdrop-blur">
			<div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-4 sm:px-6">
				<Link
					to={AppRoutePaths.HOME}
					className="flex items-center gap-2 font-bold text-slate-900">
					<span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">
						Z
					</span>
					{t('appName')}
				</Link>

				<nav className="flex flex-1 items-center gap-1">
					{NavigationItems.map((item) => (
						<NavLink
							key={item.href}
							to={item.href}
							end
							className={({ isActive }) =>
								`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
									isActive
										? 'bg-brand-50 text-brand-700'
										: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
								}`
							}>
							{t(item.label)}
						</NavLink>
					))}
				</nav>
			</div>
		</header>
	);
}
