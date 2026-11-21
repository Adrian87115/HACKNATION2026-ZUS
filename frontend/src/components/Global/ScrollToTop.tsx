import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Start every new page at the top (BrowserRouter keeps the previous scroll position otherwise).
 * Only reacts to pathname changes, so query-string updates (e.g. ?tab=) don't jump the page;
 * links with a #hash keep their default in-page anchor behaviour.
 */
export default function ScrollToTop() {
	const { pathname, hash } = useLocation();

	useLayoutEffect(() => {
		if (hash) return;
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}, [pathname, hash]);

	return null;
}
