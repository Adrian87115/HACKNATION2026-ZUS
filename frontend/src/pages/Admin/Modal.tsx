import { useEffect, useId, type ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

export default function Modal({ title, children, actions, onClose }: { title: string; children: ReactNode; actions: ReactNode; onClose: () => void }) {
	const id = useId();
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={id}
				onClick={(e) => e.stopPropagation()}
				className="enter max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-paper p-5 shadow-xl">
				<h2 id={id} className="text-lg font-semibold text-ink">
					{title}
				</h2>
				<div className="mt-2">{children}</div>
				<div className="mt-5 flex justify-end gap-2">{actions}</div>
			</div>
		</div>
	);
}
