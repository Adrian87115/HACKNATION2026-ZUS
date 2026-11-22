/** Knowledge base of official documents (backend/src/library). Errors are user-facing Polish messages. */
import { BACKEND_API } from '../../config/api';

export type LibraryKind = 'formularz' | 'akt_prawny' | 'poradnik';
export type LibraryVersion = { version: string; label: string; validFrom: string | null; url: string; changes: string; addedAt: string };
export type LibraryAmendment = { date: string; title: string; source: string; url: string };
export type LibraryDocument = {
	id: string;
	kind: LibraryKind;
	code: string | null;
	title: string;
	fullTitle: string;
	description: string;
	topics: string[];
	status: 'obowiazujacy' | 'wycofany';
	pageUrl: string;
	versions: LibraryVersion[];
	amendments: LibraryAmendment[];
	withdrawn: { at: string; reason: string; replacedBy: string | null } | null;
};
export type LibraryTopic = { value: string; label: string };
export type LibraryLogEntry = { at: string; action: 'dodano' | 'nowa_wersja' | 'zmieniono' | 'wycofano' | 'przywrocono'; documentId: string; title: string; note: string };

export type NewDocumentInput = {
	kind: LibraryKind;
	code?: string;
	title: string;
	description: string;
	topics: string[];
	pageUrl: string;
} & NewVersionInput;
export type NewVersionInput = { version: string; label?: string; validFrom?: string | null; url: string; changes: string };

export const KIND_LABEL: Record<LibraryKind, string> = { formularz: 'Formularz', akt_prawny: 'Przepis prawny', poradnik: 'Poradnik' };

export class LibraryApiError extends Error {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
	const headers = new Headers(init.headers);
	if (token) headers.set('Authorization', `Bearer ${token}`);
	if (init.body) headers.set('Content-Type', 'application/json');
	let res: Response;
	try {
		res = await fetch(`${BACKEND_API}${path}`, { ...init, headers });
	} catch {
		throw new LibraryApiError('Brak połączenia z serwerem. Spróbuj ponownie za chwilę.', 0);
	}
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
		const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
		const fallback =
			res.status === 401 ? 'Nieprawidłowy token administratora.' : res.status === 403 ? 'Panel administracyjny jest wyłączony na serwerze.' : 'Nie udało się wczytać dokumentów. Spróbuj ponownie.';
		throw new LibraryApiError(res.status < 500 && message ? message : fallback, res.status);
	}
	return (await res.json()) as T;
}

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

export const libraryApi = {
	list: () => request<{ topics: LibraryTopic[]; documents: LibraryDocument[] }>('/library'),
	log: (token: string) => request<LibraryLogEntry[]>('/library/log', {}, token),
	create: (token: string, input: NewDocumentInput) => request<LibraryDocument>('/library', post(input), token),
	addVersion: (token: string, id: string, input: NewVersionInput) =>
		request<LibraryDocument>(`/library/${encodeURIComponent(id)}/versions`, post(input), token),
	update: (token: string, id: string, input: Partial<Pick<LibraryDocument, 'title' | 'description' | 'topics' | 'pageUrl'>>) =>
		request<LibraryDocument>(`/library/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }, token),
	withdraw: (token: string, id: string, reason: string, replacedBy: string | null) =>
		request<LibraryDocument>(`/library/${encodeURIComponent(id)}/withdraw`, post({ reason, replacedBy }), token),
	restore: (token: string, id: string) => request<LibraryDocument>(`/library/${encodeURIComponent(id)}/restore`, post({}), token)
};

export const plDate = (iso: string | null) =>
	iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—';
