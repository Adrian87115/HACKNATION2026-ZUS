import type { TranslationKey } from '../translations';
import { AppRoutePaths } from './shared';

export interface NavigationItem {
	label: TranslationKey;
	href: string;
}

export const NavigationItems: NavigationItem[] = [
	{
		label: 'navigation.home',
		href: AppRoutePaths.home
	},
	{
		label: 'navigation.calculators',
		href: AppRoutePaths.calculators
	}
];
