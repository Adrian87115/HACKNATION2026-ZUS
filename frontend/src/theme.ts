import { createTheme } from '@mui/material';

// Brand tokens — keep in sync with the @theme block in index.css
export const theme = createTheme({
	palette: {
		primary: { main: '#00843d', light: '#00994d', dark: '#006b32', contrastText: '#ffffff' },
		background: { default: '#f6f8f7', paper: '#ffffff' },
		text: { primary: '#1e293b', secondary: '#64748b' },
		divider: '#e2e8f0'
	},
	shape: { borderRadius: 12 },
	typography: {
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
		button: { textTransform: 'none', fontWeight: 600 }
	},
	components: {
		MuiCard: {
			defaultProps: { elevation: 0 },
			styleOverrides: { root: { border: '1px solid #e2e8f0' } }
		}
	}
});
