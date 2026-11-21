/** Admin API (backend/ – EngineController). Errors are mapped to user-facing Polish messages. */
import { BACKEND_API } from '../../config/api';
import type { BenefitParams } from '../../engine/index';

export type ParamChange = { key: string; from: unknown; to: unknown };
export type HistoryEntry = { at: string; action: 'update' | 'reset'; changes: ParamChange[] };

export class AdminApiError extends Error {
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
		throw new AdminApiError('Brak połączenia z serwerem. Sprawdź, czy backend działa, i spróbuj ponownie.', 0);
	}
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
		const serverMessage = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
		const fallback =
			res.status === 401
				? 'Nieprawidłowy token administratora.'
				: res.status === 403
					? 'Panel administracyjny jest wyłączony na serwerze.'
					: 'Nie udało się wykonać operacji. Spróbuj ponownie.';
		// 4xx messages from the backend are written for users (Polish); hide anything else.
		throw new AdminApiError(res.status < 500 && serverMessage ? serverMessage : fallback, res.status);
	}
	return (await res.json()) as T;
}

export const adminApi = {
	verify: (token: string) => request<{ ok: true }>('/engine/admin/verify', { method: 'POST' }, token),
	params: () => request<BenefitParams>('/engine/params'),
	defaults: () => request<BenefitParams>('/engine/params/defaults'),
	history: (token: string) => request<HistoryEntry[]>('/engine/params/history', {}, token),
	update: (token: string, overrides: Partial<BenefitParams>) =>
		request<BenefitParams>('/engine/params', { method: 'PUT', body: JSON.stringify(overrides) }, token),
	reset: (token: string) => request<BenefitParams>('/engine/params/reset', { method: 'POST' }, token)
};
