import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import Footer from './components/Global/Footer';
import Header from './components/Global/Header';
import Home from './pages/Home/Home';
import { AppRoutePaths } from './types/shared';

function App() {
	return (
		<>
			<Router>
				<Header />
				<Routes>
					<Route path={AppRoutePaths.HOME} element={<Home />} />
				</Routes>
				<Footer />
			</Router>
		</>
	);
}

export default App;
