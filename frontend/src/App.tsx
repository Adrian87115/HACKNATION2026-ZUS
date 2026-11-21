import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import Footer from "./components/Global/Footer";
import Header from "./components/Global/Header";
import Home from "./pages/Home/Home";
import ParentingGuide from "./pages/ParentingGuide/ParentingGuide";
import { AppRoutePaths } from "./types/shared";

function App() {
  return (
    <>
      <Router>
        <Header />
        <Routes>
          <Route path={AppRoutePaths.HOME} element={<Home />} />
          <Route
            path={AppRoutePaths.PARENTING_GUIDE}
            element={<ParentingGuide />}
          />
        </Routes>
        <Footer />
      </Router>
    </>
  );
}

export default App;
