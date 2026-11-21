import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Home from './pages/Home/Home';
import { AppRoutePaths } from './types/shared';

function App() {
	return (
		<Router>
			<Routes>
				<Route path={AppRoutePaths.home} element={<Home />} />
			</Routes>
		</Router>
	);
}

export default App;
