/** Client for the ZUSia chat API (python/routers.py). All errors are mapped to user-facing Polish messages. */
import { ZUSIA_API } from '../../config/api';

export class ChatApiError extends Error {
	readonly status: number;
	/** The ZUSia service could not be reached at all (not running, network down, proxy error). */
	readonly offline: boolean;

	constructor(message: string, status: number, offline = false) {
		super(message);
		this.status = status;
		this.offline = offline;
	}
}

const OFFLINE_MESSAGE = 'ZUSia jest teraz niedostępna – serwer asystenta nie odpowiada. Spróbuj za chwilę.';

export const CHAT_FILE_TYPES = 'application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif';
export const CHAT_MAX_FILE_BYTES = 10 * 1024 * 1024;

function friendly(status: number): string {
	switch (status) {
		case 404:
			return 'Ta rozmowa wygasła. Zacznij nową.';
		case 413:
			return 'Plik jest za duży – maksymalnie 10 MB.';
		case 415:
			return 'Możesz dodać plik PDF albo zdjęcie (JPG, PNG).';
		case 422:
			return 'Wiadomość jest za długa albo pusta.';
		case 502:
			return 'ZUSia nie mogła teraz odpowiedzieć. Spróbuj ponownie.';
		case 503:
			return 'Asystent ZUSia jest chwilowo niedostępny. Spróbuj za chwilę.';
		default:
			return 'Coś poszło nie tak. Spróbuj ponownie.';
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${ZUSIA_API}${path}`, init);
	} catch (err) {
		if ((err as Error).name === 'AbortError') throw err;
		throw new ChatApiError(OFFLINE_MESSAGE, 0, true);
	}
	if (!res.ok) {
		// Errors from the ZUSia service carry a JSON `detail`; a bare 502/503/504 comes from a proxy or
		// gateway in front of it, which means the service itself is not reachable.
		const fromService = await res
			.clone()
			.json()
			.then((body: { detail?: unknown }) => body?.detail !== undefined)
			.catch(() => false);
		if (!fromService && res.status >= 502 && res.status <= 504) throw new ChatApiError(OFFLINE_MESSAGE, res.status, true);
		throw new ChatApiError(friendly(res.status), res.status);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

/** Is the ZUSia service up? (GET /health, short timeout) */
export async function checkHealth(): Promise<boolean> {
	try {
		const res = await fetch(`${ZUSIA_API}/health`, { signal: AbortSignal.timeout(4000) });
		if (!res.ok) return false;
		const body = (await res.json()) as { status?: string; assistant?: boolean };
		// `assistant: false` → the service runs but has no Gemini key configured
		return body.status === 'ok' && body.assistant !== false;
	} catch {
		return false;
	}
}

/** `persist` – the user agreed to keep the conversation; otherwise it lives only in the assistant's memory. */
export const createChat = (persist: boolean) =>
	request<{ session_id: string }>('/chats', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ persist })
	}).then((r) => r.session_id);

export const setPersistence = (sessionId: string, persist: boolean) =>
	request<{ persist: boolean }>(`/chats/${encodeURIComponent(sessionId)}/persistence`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ persist })
	});

export const getHistory = (sessionId: string) =>
	request<{ messages: { role: 'user' | 'assistant'; content: string }[] }>(`/chats/${encodeURIComponent(sessionId)}/history`).then(
		(r) => r.messages
	);

export const deleteChat = (sessionId: string) =>
	request<void>(`/chats/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => undefined);

/** `context` – the signed-in user's account data and the current screen, used for this answer only. */
export async function sendMessage(sessionId: string, message: string, file?: File, context?: string, signal?: AbortSignal): Promise<string> {
	const id = encodeURIComponent(sessionId);
	const ctx = context ? context.slice(0, 20000) : undefined;
	if (!file) {
		const r = await request<{ reply: string }>(`/chats/${id}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message, context: ctx }),
			signal
		});
		return r.reply;
	}
	const kind = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdfs' : 'images';
	const body = new FormData();
	body.append('file', file, file.name);
	if (ctx) body.append('context', ctx);
	const query = message ? `?message=${encodeURIComponent(message)}` : '';
	const r = await request<{ reply: string }>(`/chats/${id}/${kind}${query}`, { method: 'POST', body, signal });
	return r.reply;
}
