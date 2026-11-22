/** Feature switches set in the admin panel (backend /features). Shared module-level state, fetched once per visit. */
import { useEffect, useState } from 'react';
import { BACKEND_API } from '../../config/api';

export type Features = {
	assistant: boolean;
	caseImport: boolean;
	onlineApplications: boolean;
	announcement: { enabled: boolean; tone: 'info' | 'warning'; text: string };
};

/** Everything on until the backend says otherwise – a backend outage must not hide the app's features. */
export const DEFAULT_FEATURES: Features = {
	assistant: true,
	caseImport: true,
	onlineApplications: true,
	announcement: { enabled: false, tone: 'info', text: '' }
};

let current: Features = DEFAULT_FEATURES;
let loaded: Promise<void> | null = null;
const listeners = new Set<(f: Features) => void>();

export function setFeatures(next: Features) {
	current = next;
	listeners.forEach((l) => l(next));
}

function load() {
	loaded ??= fetch(`${BACKEND_API}/features`)
		.then((res) => (res.ok ? (res.json() as Promise<Features>) : null))
		.then((f) => {
			if (f) setFeatures({ ...DEFAULT_FEATURES, ...f });
		})
		.catch(() => undefined);
	return loaded;
}

export function useFeatures(): Features {
	const [features, set] = useState(current);
	useEffect(() => {
		listeners.add(set);
		set(current);
		void load();
		return () => {
			listeners.delete(set);
		};
	}, []);
	return features;
}
