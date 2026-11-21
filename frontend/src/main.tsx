import { StyledEngineProvider } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AccessibilityProvider from './accessibility/AccessibilityProvider';
import App from './App.tsx';
import './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<StyledEngineProvider enableCssLayer>
			<AccessibilityProvider>
				<App />
			</AccessibilityProvider>
		</StyledEngineProvider>
	</StrictMode>
);
