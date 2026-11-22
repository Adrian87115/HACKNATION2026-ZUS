/** Knowledge base of official documents (backend/src/library). Errors are user-facing Polish messages. */
import { BACKEND_API } from '../../config/api';
import { AppRoutePaths } from '../../types/shared';

export type LibraryKind = 'formularz' | 'akt_prawny' | 'poradnik';
export type LibraryFile = { path: string; size: number; pages: number | null; sha256: string; downloadedAt: string; source: string };
export type LibraryVersion = {
	version: string;
	label: string;
	validFrom: string | null;
	url: string;
	changes: string;
	addedAt: string;
	/** Local copy served by the app (frontend/public/dokumenty). */
	file?: LibraryFile | null;
};
export type LibraryCategory = { value: string; label: string; description: string; sections: { value: string; label: string }[] };
export type LibraryAmendment = { date: string; title: string; source: string; url: string };
export type LibraryDocument = {
	id: string;
	kind: LibraryKind;
	code: string | null;
	title: string;
	fullTitle: string;
	description: string;
	topics: string[];
	category: string;
	section: string;
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
	section: string;
	pageUrl: string;
} & NewVersionInput;
export type NewVersionInput = { version: string; label?: string; validFrom?: string | null; url: string; changes: string };

export type LibraryData = { categories: LibraryCategory[]; topics: LibraryTopic[]; documents: LibraryDocument[] };

/** Category of each kind of document (mirrors backend LIBRARY_CATEGORIES). */
export const CATEGORY_OF_KIND: Record<LibraryKind, string> = { akt_prawny: 'prawo', formularz: 'formularze', poradnik: 'poradniki' };

export const fileSize = (bytes: number) =>
	bytes >= 1_048_576 ? `${(bytes / 1_048_576).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB` : `${Math.round(bytes / 1024)} kB`;

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
	list: () => request<LibraryData>('/library'),
	log: (token: string) => request<LibraryLogEntry[]>('/library/log', {}, token),
	create: (token: string, input: NewDocumentInput) => request<LibraryDocument>('/library', post(input), token),
	addVersion: (token: string, id: string, input: NewVersionInput) =>
		request<LibraryDocument>(`/library/${encodeURIComponent(id)}/versions`, post(input), token),
	update: (token: string, id: string, input: Partial<Pick<LibraryDocument, 'title' | 'description' | 'topics' | 'section' | 'pageUrl'>>) =>
		request<LibraryDocument>(`/library/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }, token),
	withdraw: (token: string, id: string, reason: string, replacedBy: string | null) =>
		request<LibraryDocument>(`/library/${encodeURIComponent(id)}/withdraw`, post({ reason, replacedBy }), token),
	restore: (token: string, id: string) => request<LibraryDocument>(`/library/${encodeURIComponent(id)}/restore`, post({}), token)
};

export const plDate = (iso: string | null) =>
	iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—';

/** Address of a document's page in the knowledge base. */
export const documentPath = (id: string) => AppRoutePaths.KNOWLEDGE_DOCUMENT.replace(':id', encodeURIComponent(id));
