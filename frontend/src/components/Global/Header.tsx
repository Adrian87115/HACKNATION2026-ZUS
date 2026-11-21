import { LogIn, LogOut, MessageCircle, PanelRightClose, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { NavigationItems } from '../../types/constants';
import { AppRoutePaths } from '../../types/shared';
import zusiaLogo from '../../assets/zusia-logo.png';
import AccessibilityMenu from './AccessibilityMenu';
import { useChat } from '../../features/chat/ChatContext';
import { useAuth } from '../../features/account/AuthContext';

export default function Header() {
	const { t } = useTranslation();
	const chat = useChat();
	const auth = useAuth();

	return (
		<header className="sticky top-0 z-50 h-16 border-b border-line bg-paper/90 backdrop-blur">
			<div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-4 sm:px-6">
				<Link to={AppRoutePaths.HOME} className="flex shrink-0 items-center">
					<img src={zusiaLogo} alt={t('appName')} className="h-9 w-auto" width={467} height={160} />
				</Link>

				<nav
					aria-label={t('navigation.label')}
					className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
					{NavigationItems.map((item) => (
						<NavLink
							key={item.href}
							to={item.href}
							end
							className={({ isActive }) =>
								`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
									isActive ? 'bg-brand-soft text-brand-ink' : 'text-muted hover:bg-hover hover:text-ink'
								}`
							}>
							{t(item.label)}
						</NavLink>
					))}
				</nav>

				<button
					type="button"
					onClick={chat.toggle}
					aria-expanded={chat.open}
					title={chat.open ? t('chat.close') : t('chat.open')}
					className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors ${
						chat.open ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-ink hover:bg-hover'
					}`}>
					{chat.open ? (
						<PanelRightClose className="size-4" aria-hidden />
					) : (
						<MessageCircle className="size-4" aria-hidden />
					)}
					<span className="hidden sm:inline">{t('chat.open')}</span>
					<span className="sr-only sm:hidden">{chat.open ? t('chat.close') : t('chat.open')}</span>
				</button>

				<AccessibilityMenu />

				{auth.status === 'authenticated' && auth.account ? (
					<div className="flex shrink-0 items-center gap-1">
						<Link
							to={AppRoutePaths.ACCOUNT}
							className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-ink transition-colors hover:bg-hover">
							<UserRound className="size-4" aria-hidden />
							<span className="hidden md:inline">{t('account.myAccount')}</span>
							<span className="sr-only md:hidden">{t('account.myAccount')}</span>
						</Link>
						<button
							type="button"
							onClick={() => void auth.logout()}
							title={t('account.logout')}
							aria-label={t('account.logout')}
							className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink">
							<LogOut className="size-4" aria-hidden />
						</button>
					</div>
				) : (
					<Link
						to={AppRoutePaths.LOGIN}
						className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-strong">
						<LogIn className="size-4" aria-hidden />
						<span className="hidden md:inline">{t('account.login')}</span>
						<span className="sr-only md:hidden">{t('account.login')}</span>
					</Link>
				)}
			</div>
		</header>
	);
}
