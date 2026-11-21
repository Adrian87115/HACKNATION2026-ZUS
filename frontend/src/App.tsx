import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LegacyRedirect from './components/Global/LegacyRedirect';
import ScrollToTop from './components/Global/ScrollToTop';
import { AuthProvider } from './features/account/AuthContext';
import { ChatProvider } from './features/chat/ChatContext';
import ChatSidebar from './features/chat/ChatSidebar';
import Account from './pages/Account/Account';
import Admin from './pages/Admin/Admin';
import Applications from './pages/Applications/Applications';
import Calculators from './pages/Calculators/Calculators';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import NotFound from './pages/NotFound/NotFound';
import ParentingGuide from './pages/ParentingGuide/ParentingGuide';
import Risks from './pages/Risks/Risks';
import RouteSeo from './seo/RouteSeo';
import { LEGACY_REDIRECTS } from './seo/routes';
import { AppRoutePaths } from './types/shared';

function App() {
	return (
		<Router>
			<AuthProvider>
				<ChatProvider>
					<ScrollToTop />
					<RouteSeo />
					<Routes>
						<Route path={AppRoutePaths.HOME} element={<Home />} />
						<Route path={AppRoutePaths.CALCULATORS} element={<Calculators />} />
						<Route path={AppRoutePaths.PARENTING_GUIDE} element={<ParentingGuide />} />
						<Route path={AppRoutePaths.APPLICATIONS} element={<Applications />} />
						<Route path={AppRoutePaths.RISKS} element={<Risks />} />
						<Route path={AppRoutePaths.ADMIN} element={<Admin />} />
						<Route path={AppRoutePaths.LOGIN} element={<Login />} />
						<Route path={AppRoutePaths.ACCOUNT} element={<Account />} />
						{LEGACY_REDIRECTS.map(({ from, to }) => (
							<Route key={from} path={from} element={<LegacyRedirect to={to} />} />
						))}
						<Route path="*" element={<NotFound />} />
					</Routes>
					{/* ZUSia assistant – collapsible panel on the right, shared across pages */}
					<ChatSidebar />
				</ChatProvider>
			</AuthProvider>
		</Router>
	);
}

export default App;
