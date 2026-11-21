export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'normal' | 'large' | 'xlarge';
export type ResolvedMode = 'light' | 'dark';

export interface AccessibilitySettings {
	themeMode: ThemeMode;
	highContrast: boolean;
	fontSize: FontSize;
	textSpacing: boolean;
	underlineLinks: boolean;
	reduceMotion: boolean;
}

export const defaultSettings: AccessibilitySettings = {
	themeMode: 'light',
	highContrast: false,
	fontSize: 'normal',
	textSpacing: false,
	underlineLinks: false,
	reduceMotion: false
};

// Also read by the inline script in index.html (prevents a flash of the wrong theme) — keep in sync
export const STORAGE_KEY = 'zus.a11y';

export function loadSettings(): AccessibilitySettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
	} catch {
		return defaultSettings;
	}
}

export function saveSettings(settings: AccessibilitySettings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// storage unavailable (private mode etc.) — settings just won't persist
	}
}

function setFlag(root: HTMLElement, name: string, enabled: boolean) {
	if (enabled) root.setAttribute(name, 'true');
	else root.removeAttribute(name);
}

/** Reflect settings as data-attributes on <html>; index.css styles react to them. */
export function applySettingsToDocument(settings: AccessibilitySettings, mode: ResolvedMode) {
	const root = document.documentElement;
	root.setAttribute('data-theme', mode);
	root.setAttribute('data-font-size', settings.fontSize);
	if (settings.highContrast) root.setAttribute('data-contrast', 'high');
	else root.removeAttribute('data-contrast');
	setFlag(root, 'data-text-spacing', settings.textSpacing);
	setFlag(root, 'data-underline-links', settings.underlineLinks);
	setFlag(root, 'data-reduce-motion', settings.reduceMotion);
}
