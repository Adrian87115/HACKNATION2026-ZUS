import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../account/AuthContext';
import { useBenefitEngine } from '../../hooks/useBenefitEngine';
import { accountContext, screenContext } from './userContext';
import { ChatApiError, checkHealth, createChat, deleteChat, getHistory, sendMessage, setPersistence } from './chatApi';

export type ChatMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	attachment?: { name: string; kind: 'pdf' | 'image' };
	/** Set on a user message whose reply failed. */
	error?: string;
};

type ChatContextValue = {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
	messages: ChatMessage[];
	sending: boolean;
	loadingHistory: boolean;
	/** null = not checked yet, false = the ZUSia service is not reachable */
	available: boolean | null;
	recheck: () => Promise<void>;
	send: (text: string, file?: File) => Promise<void>;
	retry: (messageId: string) => Promise<void>;
	newChat: () => void;
	/** Open the panel and ask a question right away (e.g. "check my application"). */
	ask: (text: string) => void;
	/** The user agreed to keep the conversation (history and files) – off by default. */
	remember: boolean;
	setRemember: (remember: boolean) => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

const SESSION_KEY = 'zusia.chat.session';
const OPEN_KEY = 'zusia.chat.open';
const REMEMBER_KEY = 'zusia.chat.remember';

const read = (key: string) => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};
const write = (key: string, value: string | null) => {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		/* storage unavailable – the chat still works for this visit */
	}
};
const uid = () => crypto.randomUUID();

export function ChatProvider({ children }: { children: ReactNode }) {
	const { account } = useAuth();
	const engine = useBenefitEngine();
	const [open, setOpenState] = useState(() => read(OPEN_KEY) === '1');
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [sending, setSending] = useState(false);
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [available, setAvailable] = useState<boolean | null>(null);
	const [remember, setRememberState] = useState(() => read(REMEMBER_KEY) === '1');
	// Only a conversation the user agreed to keep is restored after reloading the page.
	const sessionRef = useRef<string | null>(read(REMEMBER_KEY) === '1' ? read(SESSION_KEY) : null);
	const historyLoaded = useRef(false);
	// Files can't be persisted; keep them in memory so a failed upload can be retried.
	const pendingFiles = useRef(new Map<string, File>());

	const setOpen = useCallback((value: boolean) => {
		setOpenState(value);
		write(OPEN_KEY, value ? '1' : '0');
	}, []);
	const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

	const recheck = useCallback(async () => {
		setAvailable(null);
		setAvailable(await checkHealth());
	}, []);

	// A conversation saved before consent was asked for: forget it.
	useEffect(() => {
		const stale = read(SESSION_KEY);
		if (stale && read(REMEMBER_KEY) !== '1') {
			void deleteChat(stale);
			write(SESSION_KEY, null);
		}
	}, []);

	// Check that the assistant is reachable whenever the panel is opened.
	useEffect(() => {
		if (open) void recheck();
	}, [open, recheck]);

	// Restore the previous conversation the first time the panel is opened.
	useEffect(() => {
		if (!open || historyLoaded.current || !sessionRef.current) return;
		historyLoaded.current = true;
		setLoadingHistory(true);
		getHistory(sessionRef.current)
			.then((history) => setMessages(history.map((m) => ({ id: uid(), role: m.role, content: m.content }))))
			.catch(() => {
				sessionRef.current = null;
				write(SESSION_KEY, null);
			})
			.finally(() => setLoadingHistory(false));
	}, [open]);

	const ensureSession = useCallback(async (fresh = false) => {
		if (sessionRef.current && !fresh) return sessionRef.current;
		const id = await createChat(remember);
		sessionRef.current = id;
		historyLoaded.current = true;
		if (remember) write(SESSION_KEY, id);
		return id;
	}, [remember]);

	const setRemember = useCallback(async (value: boolean) => {
		const id = sessionRef.current;
		if (id) {
			try {
				await setPersistence(id, value);
			} catch (err) {
				// the session is gone on the server – the next message starts a new one with the chosen setting
				if (!(err instanceof ChatApiError && err.status === 404)) throw err;
				sessionRef.current = null;
			}
		}
		setRememberState(value);
		write(REMEMBER_KEY, value ? '1' : null);
		write(SESSION_KEY, value && sessionRef.current ? sessionRef.current : null);
	}, []);

	/** Account of the signed-in user (only theirs) and the current screen – sent with each message, not stored. */
	const buildContext = useCallback(() => {
		const params = engine.getParams();
		const threshold = Math.round(params.MIN_WAGE_2026_GROSS * params.DEBT_EXCLUSION_MIN_WAGE_RATIO * 100) / 100;
		return [
			account ? accountContext(account, threshold) : 'Użytkownik nie jest zalogowany – nie masz dostępu do danych z jego konta ZUS. Jeśli pyta o swoje dane, zaproponuj logowanie przez mObywatel (symulacja).',
			screenContext()
		].join('\n\n');
	}, [account, engine]);

	const deliver = useCallback(
		async (userMessage: ChatMessage, text: string, file?: File) => {
			setSending(true);
			try {
				let reply: string;
				const context = buildContext();
				try {
					reply = await sendMessage(await ensureSession(), text, file, context);
				} catch (err) {
					// Session expired on the server (e.g. restart) – start a new one and resend once.
					if (err instanceof ChatApiError && err.status === 404) reply = await sendMessage(await ensureSession(true), text, file, context);
					else throw err;
				}
				pendingFiles.current.delete(userMessage.id);
				setMessages((prev) => [
					...prev.map((m) => (m.id === userMessage.id ? { ...m, error: undefined } : m)),
					{ id: uid(), role: 'assistant', content: reply }
				]);
			} catch (err) {
				if (err instanceof ChatApiError && err.offline) setAvailable(false);
				const message = err instanceof Error ? err.message : 'Coś poszło nie tak. Spróbuj ponownie.';
				setMessages((prev) => prev.map((m) => (m.id === userMessage.id ? { ...m, error: message } : m)));
			} finally {
				setSending(false);
			}
		},
		[ensureSession, buildContext]
	);

	const send = useCallback(
		async (text: string, file?: File) => {
			const trimmed = text.trim();
			if ((!trimmed && !file) || sending) return;
			const message: ChatMessage = {
				id: uid(),
				role: 'user',
				content: trimmed,
				attachment: file ? { name: file.name, kind: file.type === 'application/pdf' ? 'pdf' : 'image' } : undefined
			};
			if (file) pendingFiles.current.set(message.id, file);
			setMessages((prev) => [...prev, message]);
			await deliver(message, trimmed, file);
		},
		[deliver, sending]
	);

	const retry = useCallback(
		async (messageId: string) => {
			const message = messages.find((m) => m.id === messageId);
			if (!message || sending) return;
			setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, error: undefined } : m)));
			await deliver(message, message.content, pendingFiles.current.get(messageId));
		},
		[deliver, messages, sending]
	);

	const ask = useCallback(
		(text: string) => {
			setOpen(true);
			void send(text);
		},
		[setOpen, send]
	);

	const newChat = useCallback(() => {
		if (sessionRef.current) void deleteChat(sessionRef.current);
		sessionRef.current = null;
		write(SESSION_KEY, null);
		pendingFiles.current.clear();
		setMessages([]);
	}, []);

	const value = useMemo(
		() => ({ open, setOpen, toggle, messages, sending, loadingHistory, available, recheck, send, retry, newChat, ask, remember, setRemember }),
		[open, setOpen, toggle, messages, sending, loadingHistory, available, recheck, send, retry, newChat, ask, remember, setRemember]
	);

	return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
	const ctx = useContext(ChatContext);
	if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
	return ctx;
}
