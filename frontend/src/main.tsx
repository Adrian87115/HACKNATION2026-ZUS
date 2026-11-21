import { CssBaseline, StyledEngineProvider, ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './i18n';
import './index.css';
import { theme } from './theme';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<StyledEngineProvider enableCssLayer>
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<App />
			</ThemeProvider>
		</StyledEngineProvider>
	</StrictMode>
);
