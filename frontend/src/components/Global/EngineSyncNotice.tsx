import { RotateCcw, TriangleExclamationPoint } from 'lucide-react';
import { refreshEngineParams, useEngineSync } from '../../hooks/useBenefitEngine';

/** Shown when the benefit parameters from the admin panel could not be loaded – results then use the 2026 defaults. */
export default function EngineSyncNotice() {
	const status = useEngineSync();
	if (status !== 'failed') return null;
	return (
		<div
			role="status"
			className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
			<TriangleExclamationPoint className="h-4 w-4 shrink-0" aria-hidden />
			<p className="min-w-0 flex-1">
				<span className="font-semibold">Nie udało się pobrać aktualnych parametrów zasiłków.</span> Obliczenia korzystają z wartości
				domyślnych na 2026 r. i mogą nie uwzględniać ostatnich zmian wprowadzonych przez ZUS.
			</p>
			<button
				type="button"
				onClick={() => void refreshEngineParams()}
				className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 px-3 py-1.5 font-semibold transition hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40">
				<RotateCcw className="h-4 w-4" aria-hidden />
				Spróbuj ponownie
			</button>
		</div>
	);
}
