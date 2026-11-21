import { Navigate, useLocation } from 'react-router-dom';

/** Redirects an old URL to its new path, keeping the query string (e.g. ?tab=) and hash. */
export default function LegacyRedirect({ to }: { to: string }) {
	const { search, hash } = useLocation();
	return <Navigate to={{ pathname: to, search, hash }} replace />;
}
