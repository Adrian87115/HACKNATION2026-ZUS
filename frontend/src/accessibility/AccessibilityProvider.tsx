import { CssBaseline, ThemeProvider } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createAppTheme } from '../theme';
import { AccessibilityContext } from './AccessibilityContext';
import {
	applySettingsToDocument,
	defaultSettings,
	loadSettings,
	saveSettings,
	type AccessibilitySettings,
	type ResolvedMode
} from './settings';

const darkQuery = '(prefers-color-scheme: dark)';

function subscribeToColorScheme(onChange: () => void) {
	const media = window.matchMedia(darkQuery);
	media.addEventListener('change', onChange);
	return () => media.removeEventListener('change', onChange);
}

const getPrefersDark = () => window.matchMedia(darkQuery).matches;

type Props = {
	children: React.ReactNode;
};

export default function AccessibilityProvider({ children }: Props) {
	const [settings, setSettings] = useState<AccessibilitySettings>(loadSettings);
	const prefersDark = useSyncExternalStore(subscribeToColorScheme, getPrefersDark);

	const resolvedMode: ResolvedMode =
		settings.themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : settings.themeMode;

	// Attributes must be on <html> before the theme is built: createAppTheme reads the CSS color tokens they select.
	const theme = useMemo(() => {
		applySettingsToDocument(settings, resolvedMode);
		return createAppTheme(resolvedMode, settings.reduceMotion);
	}, [settings, resolvedMode]);

	useEffect(() => saveSettings(settings), [settings]);

	const updateSettings = useCallback(
		(patch: Partial<AccessibilitySettings>) => setSettings((prev) => ({ ...prev, ...patch })),
		[]
	);
	const resetSettings = useCallback(() => setSettings(defaultSettings), []);

	const value = useMemo(
		() => ({ settings, resolvedMode, updateSettings, resetSettings }),
		[settings, resolvedMode, updateSettings, resetSettings]
	);

	return (
		<AccessibilityContext.Provider value={value}>
			<ThemeProvider theme={theme}>
				<CssBaseline />
				{children}
			</ThemeProvider>
		</AccessibilityContext.Provider>
	);
}
