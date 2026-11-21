/** Client for the ZUSia chat API (python/routers.py). All errors are mapped to user-facing Polish messages. */
import { ZUSIA_API } from '../../config/api';

export class ChatApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

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
		throw new ChatApiError('Brak połączenia z asystentem. Sprawdź internet i spróbuj ponownie.', 0);
	}
	if (!res.ok) throw new ChatApiError(friendly(res.status), res.status);
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export const createChat = () => request<{ session_id: string }>('/chats', { method: 'POST' }).then((r) => r.session_id);

export const getHistory = (sessionId: string) =>
	request<{ messages: { role: 'user' | 'assistant'; content: string }[] }>(`/chats/${encodeURIComponent(sessionId)}/history`).then(
		(r) => r.messages
	);

export const deleteChat = (sessionId: string) =>
	request<void>(`/chats/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => undefined);

export async function sendMessage(sessionId: string, message: string, file?: File, signal?: AbortSignal): Promise<string> {
	const id = encodeURIComponent(sessionId);
	if (!file) {
		const r = await request<{ reply: string }>(`/chats/${id}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message }),
			signal
		});
		return r.reply;
	}
	const kind = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdfs' : 'images';
	const body = new FormData();
	body.append('file', file, file.name);
	const query = message ? `?message=${encodeURIComponent(message)}` : '';
	const r = await request<{ reply: string }>(`/chats/${id}/${kind}${query}`, { method: 'POST', body, signal });
	return r.reply;
}
