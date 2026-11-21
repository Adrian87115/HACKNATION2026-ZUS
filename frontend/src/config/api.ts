/** Base URL of the ZUSia service (python/, FastAPI). Proxied at /api/zusia in development. */
export const ZUSIA_API = ((import.meta.env.VITE_ZUSIA_API_URL as string | undefined) || '/api/zusia').replace(/\/+$/, '');

/** Base URL of the backend (backend/, NestJS: engine parameters, admin). Proxied at /api in development. */
export const BACKEND_API = ((import.meta.env.VITE_BACKEND_API_URL as string | undefined) || '/api').replace(/\/+$/, '');
