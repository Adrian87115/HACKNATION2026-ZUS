// src/hooks/useBenefitEngine.ts
import { useEffect, useState } from 'react';
import { BACKEND_API } from '../config/api';
import { BenefitEngine, DEFAULT_PARAMS_2026, type BenefitParams } from '@zus/engine';

/*
 * One shared engine for the whole app. It starts on the 2026 defaults (no waiting for the network),
 * then switches to the parameters set in the admin panel (GET /engine/params). Every component using
 * the hook re-renders when the parameters change – e.g. right after an admin saves new values.
 */
let current = new BenefitEngine(DEFAULT_PARAMS_2026);
let loading: Promise<void> | null = null;
const listeners = new Set<(engine: BenefitEngine) => void>();

/** Replace the parameters used everywhere in the app. */
export function setEngineParams(params: Partial<BenefitParams>): void {
	const engine = new BenefitEngine(DEFAULT_PARAMS_2026);
	engine.updateParams(params);
	current = engine;
	listeners.forEach((notify) => notify(engine));
}

/** (Re)load the parameters from the backend. Falls back to the 2026 defaults when offline. */
export function refreshEngineParams(): Promise<void> {
	loading = fetch(`${BACKEND_API}/engine/params`)
		.then((res) => (res.ok ? (res.json() as Promise<Partial<BenefitParams>>) : null))
		.then((params) => {
			if (params) setEngineParams(params);
		})
		.catch(() => {
			/* backend unavailable – keep the defaults */
		});
	return loading;
}

export function useBenefitEngine(): BenefitEngine {
	const [engine, setEngine] = useState(current);

	useEffect(() => {
		listeners.add(setEngine);
		if (!loading) void refreshEngineParams();
		else setEngine(current); // parameters may have arrived between render and subscription
		return () => {
			listeners.delete(setEngine);
		};
	}, []);

	return engine;
}
