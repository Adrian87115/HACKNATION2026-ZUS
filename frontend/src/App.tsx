import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LegacyRedirect from './components/Global/LegacyRedirect';
import ScrollToTop from './components/Global/ScrollToTop';
import Applications from './pages/Applications/Applications';
import Calculators from './pages/Calculators/Calculators';
import Home from './pages/Home/Home';
import NotFound from './pages/NotFound/NotFound';
import ParentingGuide from './pages/ParentingGuide/ParentingGuide';
import Risks from './pages/Risks/Risks';
import RouteSeo from './seo/RouteSeo';
import { LEGACY_REDIRECTS } from './seo/routes';
import { AppRoutePaths } from './types/shared';

function App() {
	return (
		<Router>
			<ScrollToTop />
			<RouteSeo />
			<Routes>
				<Route path={AppRoutePaths.HOME} element={<Home />} />
				<Route path={AppRoutePaths.CALCULATORS} element={<Calculators />} />
				<Route path={AppRoutePaths.PARENTING_GUIDE} element={<ParentingGuide />} />
				<Route path={AppRoutePaths.APPLICATIONS} element={<Applications />} />
				<Route path={AppRoutePaths.RISKS} element={<Risks />} />
				{LEGACY_REDIRECTS.map(({ from, to }) => (
					<Route key={from} path={from} element={<LegacyRedirect to={to} />} />
				))}
				<Route path="*" element={<NotFound />} />
			</Routes>
		</Router>
	);
}

export default App;
