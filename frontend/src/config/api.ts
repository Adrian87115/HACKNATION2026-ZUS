/** Base URL of the ZUSia service (python/, FastAPI). Proxied at /api/zusia in development. */
export const ZUSIA_API = ((import.meta.env.VITE_ZUSIA_API_URL as string | undefined) || '/api/zusia').replace(/\/+$/, '');
