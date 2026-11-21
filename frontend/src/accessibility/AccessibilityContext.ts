import { createContext, useContext } from 'react';
import type { AccessibilitySettings, ResolvedMode } from './settings';

export interface AccessibilityContextValue {
	settings: AccessibilitySettings;
	resolvedMode: ResolvedMode;
	updateSettings: (patch: Partial<AccessibilitySettings>) => void;
	resetSettings: () => void;
}

export const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function useAccessibility() {
	const ctx = useContext(AccessibilityContext);
	if (!ctx) throw new Error('useAccessibility must be used inside <AccessibilityProvider>');
	return ctx;
}
