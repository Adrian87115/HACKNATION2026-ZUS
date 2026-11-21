import type { ChangeEvent } from 'react';

type Props = {
	checked: boolean;
	onChange: (e: ChangeEvent<HTMLInputElement>) => void;
	disabled?: boolean;
	size?: 'sm' | 'md';
	/** Needed only when the switch is not wrapped in a <label>. */
	'aria-label'?: string;
};

/**
 * Accessible toggle: a real checkbox (role="switch") visually replaced by a track + thumb.
 * Works inside a <label>, so clicking the label text toggles it too.
 */
export default function ToggleSwitch({ checked, onChange, disabled, size = 'md', ...aria }: Props) {
	const sm = size === 'sm';
	return (
		<span className={`relative inline-flex shrink-0 ${sm ? 'h-5 w-9' : 'h-6 w-11'}`}>
			<input
				type="checkbox"
				role="switch"
				checked={checked}
				onChange={onChange}
				disabled={disabled}
				aria-checked={checked}
				className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
				{...aria}
			/>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus) peer-disabled:opacity-50"
			/>
			<span
				aria-hidden
				className={`pointer-events-none absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform ${
					sm ? 'h-4 w-4 peer-checked:translate-x-4' : 'h-5 w-5 peer-checked:translate-x-5'
				}`}
			/>
		</span>
	);
}
