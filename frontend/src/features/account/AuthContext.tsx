import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccountApiError, accountApi, type Account, type Circumstances } from './accountApi';

type Status = 'anonymous' | 'loading' | 'authenticated';

type AuthContextValue = {
	status: Status;
	account: Account | null;
	token: string | null;
	error: string | null;
	login: (personaId: string) => Promise<void>;
	logout: () => Promise<void>;
	/** Replace the circumstances after the user saved them. */
	setCircumstances: (circumstances: Circumstances) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'zusia.pue.token';

const readToken = () => {
	try {
		return sessionStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
};
const writeToken = (token: string | null) => {
	try {
		if (token) sessionStorage.setItem(TOKEN_KEY, token);
		else sessionStorage.removeItem(TOKEN_KEY);
	} catch {
		/* session storage unavailable – stays signed in for this page view only */
	}
};

/** Simulated mObywatel session (token kept for the browser tab only). */
export function AuthProvider({ children }: { children: ReactNode }) {
	const [token, setToken] = useState<string | null>(readToken);
	const [account, setAccount] = useState<Account | null>(null);
	const [status, setStatus] = useState<Status>(() => (readToken() ? 'loading' : 'anonymous'));
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!token) {
			setAccount(null);
			setStatus('anonymous');
			return;
		}
		let active = true;
		setStatus('loading');
		accountApi
			.me(token)
			.then((data) => {
				if (!active) return;
				setAccount(data);
				setStatus('authenticated');
				setError(null);
			})
			.catch((err: AccountApiError) => {
				if (!active) return;
				if (err.status === 401) {
					writeToken(null);
					setToken(null);
				}
				setError(err.message);
				setStatus('anonymous');
			});
		return () => {
			active = false;
		};
	}, [token]);

	const login = useCallback(async (personaId: string) => {
		const session = await accountApi.login(personaId);
		writeToken(session.token);
		setToken(session.token);
	}, []);

	const logout = useCallback(async () => {
		if (token) await accountApi.logout(token);
		writeToken(null);
		setToken(null);
	}, [token]);

	const setCircumstances = useCallback((circumstances: Circumstances) => {
		setAccount((prev) => (prev ? { ...prev, circumstances } : prev));
	}, []);

	const value = useMemo(
		() => ({ status, account, token, error, login, logout, setCircumstances }),
		[status, account, token, error, login, logout, setCircumstances]
	);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
	return ctx;
}
