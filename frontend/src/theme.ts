import { createTheme } from '@mui/material';
import type { ResolvedMode } from './accessibility/settings';

// Light-mode fallbacks; the real values are the CSS tokens in index.css (single source of truth),
// which switch with data-theme / data-contrast on <html>.
const fallbacks: Record<string, string> = {
	'--primary': '#00843d',
	'--on-primary': '#ffffff',
	'--surface': '#f6f8f7',
	'--paper': '#ffffff',
	'--ink': '#1e293b',
	'--muted': '#64748b',
	'--line': '#e2e8f0'
};

function token(name: keyof typeof fallbacks) {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallbacks[name];
}

export function createAppTheme(mode: ResolvedMode, reduceMotion: boolean) {
	return createTheme({
		palette: {
			mode,
			primary: { main: token('--primary'), contrastText: token('--on-primary') },
			background: { default: token('--surface'), paper: token('--paper') },
			text: { primary: token('--ink'), secondary: token('--muted') },
			divider: token('--line')
		},
		shape: { borderRadius: 12 },
		typography: {
			fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
			button: { textTransform: 'none', fontWeight: 600 }
		},
		...(reduceMotion && { transitions: { create: () => 'none' } }),
		components: {
			MuiButtonBase: { defaultProps: { disableRipple: reduceMotion } },
			MuiCard: {
				defaultProps: { elevation: 0 },
				styleOverrides: { root: { border: `1px solid ${token('--line')}` } }
			}
		}
	});
}
