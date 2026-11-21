import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Home from './pages/Home/Home';
import ParentingGuide from './pages/ParentingGuide/ParentingGuide';
import { AppRoutePaths } from './types/shared';

function App() {
	return (
		<Router>
			<Routes>
				<Route path={AppRoutePaths.HOME} element={<Home />} />
				<Route path={AppRoutePaths.PARENTING_GUIDE} element={<ParentingGuide />} />
			</Routes>
		</Router>
	);
}

export default App;
