import { IconButton, Popover, Tooltip } from '@mui/material';
import ToggleSwitch from '../Inputs/ToggleSwitch';
import {
	Accessibility,
	Contrast,
	LetterText,
	Monitor,
	Moon,
	RotateCcw,
	Sun,
	Underline,
	X,
	ZapOff,
	type LucideIcon
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../../accessibility/AccessibilityContext';
import type { AccessibilitySettings, FontSize, ThemeMode } from '../../accessibility/settings';
import type { TranslationKey } from '../../translations';

type BooleanSetting = {
	[K in keyof AccessibilitySettings]: AccessibilitySettings[K] extends boolean ? K : never;
}[keyof AccessibilitySettings];

const themeModes: { value: ThemeMode; label: TranslationKey; icon: LucideIcon }[] = [
	{ value: 'light', label: 'accessibility.theme.light', icon: Sun },
	{ value: 'dark', label: 'accessibility.theme.dark', icon: Moon },
	{ value: 'system', label: 'accessibility.theme.system', icon: Monitor }
];

const fontSizes: { value: FontSize; label: TranslationKey; percent: string; sampleClass: string }[] = [
	{ value: 'normal', label: 'accessibility.fontSize.normal', percent: '100%', sampleClass: 'text-sm' },
	{ value: 'large', label: 'accessibility.fontSize.large', percent: '125%', sampleClass: 'text-lg' },
	{ value: 'xlarge', label: 'accessibility.fontSize.xlarge', percent: '150%', sampleClass: 'text-2xl' }
];

const toggles: { key: BooleanSetting; label: TranslationKey; description: TranslationKey; icon: LucideIcon }[] = [
	{
		key: 'highContrast',
		label: 'accessibility.highContrast.label',
		description: 'accessibility.highContrast.description',
		icon: Contrast
	},
	{
		key: 'textSpacing',
		label: 'accessibility.textSpacing.label',
		description: 'accessibility.textSpacing.description',
		icon: LetterText
	},
	{
		key: 'underlineLinks',
		label: 'accessibility.underlineLinks.label',
		description: 'accessibility.underlineLinks.description',
		icon: Underline
	},
	{
		key: 'reduceMotion',
		label: 'accessibility.reduceMotion.label',
		description: 'accessibility.reduceMotion.description',
		icon: ZapOff
	}
];

const segmentClass = (active: boolean) =>
	`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-all ${
		active ? 'bg-paper text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'
	}`;

function SectionLabel({ id, children }: { id: string; children: ReactNode }) {
	return (
		<p id={id} className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
			{children}
		</p>
	);
}

export default function AccessibilityMenu() {
	const { t } = useTranslation();
	const { settings, updateSettings, resetSettings } = useAccessibility();
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const id = useId();
	const open = Boolean(anchor);
	const close = () => setAnchor(null);

	const toggle = (key: BooleanSetting, checked: boolean) => {
		const patch: Partial<AccessibilitySettings> = {};
		patch[key] = checked;
		updateSettings(patch);
	};

	return (
		<>
			<Tooltip title={t('accessibility.title')}>
				<IconButton
					aria-label={t('accessibility.open')}
					aria-haspopup="dialog"
					aria-expanded={open}
					aria-controls={open ? id : undefined}
					onClick={(e) => setAnchor(e.currentTarget)}
					className={`size-10 rounded-xl border border-line transition-colors ${
						open ? 'bg-brand-soft text-brand-ink' : 'text-ink hover:bg-hover'
					}`}>
					<Accessibility className="size-5" aria-hidden />
				</IconButton>
			</Tooltip>

			<Popover
				id={id}
				open={open}
				anchorEl={anchor}
				onClose={close}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				transformOrigin={{ vertical: 'top', horizontal: 'right' }}
				slotProps={{
					paper: {
						role: 'dialog',
						'aria-labelledby': `${id}-title`,
						elevation: 0,
						className:
							'mt-3 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-paper text-ink shadow-2xl'
					}
				}}>
				{/* Header */}
				<div className="flex items-start gap-3 px-5 pt-5 pb-4">
					<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
						<Accessibility className="size-5" aria-hidden />
					</div>
					<div className="min-w-0 flex-1">
						<h2 id={`${id}-title`} className="text-base font-semibold leading-tight">
							{t('accessibility.title')}
						</h2>
						<p className="mt-0.5 text-sm text-muted">{t('accessibility.subtitle')}</p>
					</div>
					<IconButton size="small" aria-label={t('accessibility.close')} onClick={close} className="-mt-1 -mr-1 text-muted">
						<X className="size-4" aria-hidden />
					</IconButton>
				</div>

				<div className="space-y-5 px-5 pb-5">
					{/* Theme */}
					<section>
						<SectionLabel id={`${id}-theme`}>{t('accessibility.theme.label')}</SectionLabel>
						<div role="radiogroup" aria-labelledby={`${id}-theme`} className="grid grid-cols-3 gap-1 rounded-xl bg-hover p-1">
							{themeModes.map(({ value, label, icon: Icon }) => {
								const active = settings.themeMode === value;
								return (
									<button
										key={value}
										type="button"
										role="radio"
										aria-checked={active}
										onClick={() => updateSettings({ themeMode: value })}
										className={segmentClass(active)}>
										<Icon className="size-4" aria-hidden />
										{t(label)}
									</button>
								);
							})}
						</div>
					</section>

					{/* Font size */}
					<section>
						<SectionLabel id={`${id}-font`}>{t('accessibility.fontSize.label')}</SectionLabel>
						<div role="radiogroup" aria-labelledby={`${id}-font`} className="grid grid-cols-3 gap-1 rounded-xl bg-hover p-1">
							{fontSizes.map(({ value, label, percent, sampleClass }) => {
								const active = settings.fontSize === value;
								return (
									<button
										key={value}
										type="button"
										role="radio"
										aria-checked={active}
										aria-label={`${t(label)} (${percent})`}
										onClick={() => updateSettings({ fontSize: value })}
										className={segmentClass(active)}>
										<span className={`flex h-7 items-end font-bold leading-none ${sampleClass}`} aria-hidden>
											Aa
										</span>
										<span aria-hidden>{percent}</span>
									</button>
								);
							})}
						</div>
					</section>

					{/* Toggles */}
					<section>
						<SectionLabel id={`${id}-options`}>{t('accessibility.options')}</SectionLabel>
						<ul aria-labelledby={`${id}-options`} className="divide-y divide-line overflow-hidden rounded-xl border border-line">
							{toggles.map(({ key, label, description, icon: Icon }) => (
								<li key={key}>
									<label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-hover">
										<Icon className="size-5 shrink-0 text-muted" aria-hidden />
										<span className="min-w-0 flex-1">
											<span className="block text-sm font-medium">{t(label)}</span>
											<span className="block text-xs text-muted">{t(description)}</span>
										</span>
										<ToggleSwitch
											size="sm"
											checked={settings[key]}
											onChange={(e) => toggle(key, e.target.checked)}
										/>
									</label>
								</li>
							))}
						</ul>
					</section>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3">
					<p className="text-xs text-muted">{t('accessibility.autosave')}</p>
					<button
						type="button"
						onClick={resetSettings}
						className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-soft">
						<RotateCcw className="size-3.5" aria-hidden />
						{t('accessibility.reset')}
					</button>
				</div>
			</Popover>
		</>
	);
}
