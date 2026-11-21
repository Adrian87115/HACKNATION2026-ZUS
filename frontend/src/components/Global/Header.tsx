import { LogIn, LogOut, Menu, MessageCircle, PanelRightClose, Send, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
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
	const [menuOpen, setMenuOpen] = useState(false);
	const closeMenu = useCallback(() => setMenuOpen(false), []);

	return (
		<header className="sticky top-0 z-50 h-16 border-b border-line bg-paper/90 backdrop-blur">
			<div className="mx-auto flex h-full max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 xl:gap-6">
				<Link to={AppRoutePaths.HOME} className="flex shrink-0 items-center">
					<img src={zusiaLogo} alt={t('appName')} className="h-9 w-auto" width={467} height={160} />
				</Link>

				<nav
					aria-label={t('navigation.label')}
					className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] xl:flex">
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

				<div className="flex-1 xl:hidden" />

				{/* actions sit close together; the larger header gap only separates logo, navigation and this group */}
				<div className="flex shrink-0 items-center gap-1.5">
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
					<div className="flex shrink-0 items-center gap-1.5">
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
							className="hidden h-10 w-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink sm:inline-flex">
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

				<button
					type="button"
					onClick={() => setMenuOpen((o) => !o)}
					aria-expanded={menuOpen}
					aria-controls="mobile-menu"
					aria-label={menuOpen ? t('navigation.closeMenu') : t('navigation.menu')}
					className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-ink transition-colors hover:bg-hover xl:hidden">
					{menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
				</button>
				</div>
			</div>

			{/* portal: the header's backdrop-filter would otherwise become the containing block of the fixed panel */}
			{menuOpen && createPortal(<MobileMenu onClose={closeMenu} />, document.body)}
		</header>
	);
}

/** Navigation below the xl breakpoint: a panel under the header with large tap targets. */
function MobileMenu({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation();
	const auth = useAuth();
	const location = useLocation();
	const panelRef = useRef<HTMLDivElement>(null);
	const firstPath = useRef(location.pathname);

	// close after navigating, on Escape and when the window grows past the breakpoint
	useEffect(() => {
		if (location.pathname !== firstPath.current) onClose();
	}, [location.pathname, onClose]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		const wide = window.matchMedia('(min-width: 80rem)');
		const onWide = () => wide.matches && onClose();
		const overflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', onKey);
		wide.addEventListener('change', onWide);
		panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
		return () => {
			document.body.style.overflow = overflow;
			window.removeEventListener('keydown', onKey);
			wide.removeEventListener('change', onWide);
		};
	}, [onClose]);

	const itemCls = ({ isActive }: { isActive: boolean }) =>
		`flex items-center rounded-md px-3 py-3 text-base font-medium transition-colors ${
			isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink hover:bg-hover'
		}`;

	return (
		<div className="fixed inset-x-0 top-16 bottom-0 z-40 xl:hidden">
			<button type="button" aria-label={t('navigation.closeMenu')} onClick={onClose} className="absolute inset-0 h-full w-full bg-ink/20" />
			<div
				id="mobile-menu"
				ref={panelRef}
				className="enter relative max-h-full overflow-y-auto border-b border-line bg-paper shadow-lg"
				style={{ animationDuration: '220ms' }}>
				<nav aria-label={t('navigation.label')} className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
					{NavigationItems.map((item) => (
						<NavLink key={item.href} to={item.href} end className={itemCls}>
							{t(item.label)}
						</NavLink>
					))}
				</nav>
				<div className="mx-auto flex max-w-7xl flex-col gap-1 border-t border-line px-4 py-3 sm:px-6">
					{auth.status === 'authenticated' && auth.account ? (
						<>
							<NavLink to={AppRoutePaths.ACCOUNT} end className={itemCls}>
								<UserRound className="mr-3 size-4 text-muted" aria-hidden />
								{t('account.myAccount')}
							</NavLink>
							<NavLink to={AppRoutePaths.SUBMIT_APPLICATION} className={itemCls}>
								<Send className="mr-3 size-4 text-muted" aria-hidden />
								{t('account.submitApplication')}
							</NavLink>
							<button
								type="button"
								onClick={() => {
									void auth.logout();
									onClose();
								}}
								className="flex items-center rounded-md px-3 py-3 text-left text-base font-medium text-ink transition-colors hover:bg-hover">
								<LogOut className="mr-3 size-4 text-muted" aria-hidden />
								{t('account.logout')}
							</button>
						</>
					) : (
						<NavLink to={AppRoutePaths.LOGIN} className={itemCls}>
							<LogIn className="mr-3 size-4 text-muted" aria-hidden />
							{t('account.login')}
						</NavLink>
					)}
				</div>
			</div>
		</div>
	);
}
