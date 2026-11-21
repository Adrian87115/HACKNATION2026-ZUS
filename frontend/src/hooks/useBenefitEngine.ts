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

/** Whether the parameters from the admin panel were loaded – the UI shows a notice when they were not. */
export type EngineSyncStatus = 'pending' | 'synced' | 'failed';
let syncStatus: EngineSyncStatus = 'pending';
const syncListeners = new Set<(status: EngineSyncStatus) => void>();
function setSyncStatus(status: EngineSyncStatus): void {
	syncStatus = status;
	syncListeners.forEach((notify) => notify(status));
}

/** Replace the parameters used everywhere in the app. */
export function setEngineParams(params: Partial<BenefitParams>): void {
	const engine = new BenefitEngine(DEFAULT_PARAMS_2026);
	engine.updateParams(params);
	current = engine;
	listeners.forEach((notify) => notify(engine));
	setSyncStatus('synced');
}

/** (Re)load the parameters from the backend. Falls back to the 2026 defaults (and reports it) when that fails. */
export function refreshEngineParams(): Promise<void> {
	setSyncStatus('pending');
	loading = fetch(`${BACKEND_API}/engine/params`)
		.then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json() as Promise<Partial<BenefitParams>>;
		})
		.then((params) => setEngineParams(params))
		.catch(() => {
			// backend unavailable – keep the current parameters and let the UI show a notice
			setSyncStatus('failed');
		});
	return loading;
}

/** Status of loading the admin-panel parameters (for the „calculating on defaults” notice). */
export function useEngineSync(): EngineSyncStatus {
	const [status, setStatus] = useState(syncStatus);
	useEffect(() => {
		syncListeners.add(setStatus);
		if (!loading) void refreshEngineParams();
		else setStatus(syncStatus);
		return () => {
			syncListeners.delete(setStatus);
		};
	}, []);
	return status;
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
