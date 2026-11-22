import { Info, TriangleExclamationPoint } from 'lucide-react';
import { useFeatures } from '../../features/system/features';

/** Message for all users set by the admin (e.g. planned maintenance, a change in the law). */
export default function AnnouncementBanner() {
	const { announcement } = useFeatures();
	if (!announcement.enabled || !announcement.text) return null;
	const warning = announcement.tone === 'warning';
	const Icon = warning ? TriangleExclamationPoint : Info;
	return (
		<div
			role="status"
			className={`mb-6 flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
				warning
					? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'
					: 'border-brand/40 bg-brand-soft text-brand-ink'
			}`}>
			<Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
			<p>{announcement.text}</p>
		</div>
	);
}
