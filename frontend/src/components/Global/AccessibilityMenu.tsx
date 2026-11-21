import {
	Button,
	Divider,
	FormControlLabel,
	IconButton,
	Popover,
	Switch,
	ToggleButton,
	ToggleButtonGroup,
	Tooltip,
	Typography
} from '@mui/material';
import { Accessibility } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../../accessibility/AccessibilityContext';
import type { AccessibilitySettings, FontSize, ThemeMode } from '../../accessibility/settings';
import type { TranslationKey } from '../../translations';

type BooleanSetting = {
	[K in keyof AccessibilitySettings]: AccessibilitySettings[K] extends boolean ? K : never;
}[keyof AccessibilitySettings];

const themeModes: { value: ThemeMode; label: TranslationKey }[] = [
	{ value: 'light', label: 'accessibility.theme.light' },
	{ value: 'dark', label: 'accessibility.theme.dark' },
	{ value: 'system', label: 'accessibility.theme.system' }
];

const fontSizes: { value: FontSize; label: TranslationKey; sampleClass: string }[] = [
	{ value: 'normal', label: 'accessibility.fontSize.normal', sampleClass: 'text-sm' },
	{ value: 'large', label: 'accessibility.fontSize.large', sampleClass: 'text-base' },
	{ value: 'xlarge', label: 'accessibility.fontSize.xlarge', sampleClass: 'text-lg' }
];

const toggles: { key: BooleanSetting; label: TranslationKey }[] = [
	{ key: 'highContrast', label: 'accessibility.highContrast' },
	{ key: 'textSpacing', label: 'accessibility.textSpacing' },
	{ key: 'underlineLinks', label: 'accessibility.underlineLinks' },
	{ key: 'reduceMotion', label: 'accessibility.reduceMotion' }
];

export default function AccessibilityMenu() {
	const { t } = useTranslation();
	const { settings, updateSettings, resetSettings } = useAccessibility();
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const id = useId();
	const open = Boolean(anchor);

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
					className="text-ink">
					<Accessibility className="size-6" aria-hidden />
				</IconButton>
			</Tooltip>

			<Popover
				id={id}
				open={open}
				anchorEl={anchor}
				onClose={() => setAnchor(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				transformOrigin={{ vertical: 'top', horizontal: 'right' }}
				slotProps={{
					paper: {
						role: 'dialog',
						'aria-labelledby': `${id}-title`,
						className: 'mt-2 w-80 max-w-[calc(100vw-2rem)] p-4'
					}
				}}>
				<Typography id={`${id}-title`} variant="subtitle1" component="h2" className="mb-3 font-semibold">
					{t('accessibility.title')}
				</Typography>

				<Typography id={`${id}-theme`} variant="body2" color="text.secondary" className="mb-1">
					{t('accessibility.theme.label')}
				</Typography>
				<ToggleButtonGroup
					exclusive
					fullWidth
					size="small"
					value={settings.themeMode}
					onChange={(_, value: ThemeMode | null) => value && updateSettings({ themeMode: value })}
					aria-labelledby={`${id}-theme`}
					className="mb-4">
					{themeModes.map((mode) => (
						<ToggleButton key={mode.value} value={mode.value}>
							{t(mode.label)}
						</ToggleButton>
					))}
				</ToggleButtonGroup>

				<Typography id={`${id}-font`} variant="body2" color="text.secondary" className="mb-1">
					{t('accessibility.fontSize.label')}
				</Typography>
				<ToggleButtonGroup
					exclusive
					fullWidth
					size="small"
					value={settings.fontSize}
					onChange={(_, value: FontSize | null) => value && updateSettings({ fontSize: value })}
					aria-labelledby={`${id}-font`}
					className="mb-4">
					{fontSizes.map((size) => (
						<ToggleButton key={size.value} value={size.value} aria-label={t(size.label)}>
							<span className={`font-bold ${size.sampleClass}`} aria-hidden>
								A
							</span>
						</ToggleButton>
					))}
				</ToggleButtonGroup>

				<Divider className="mb-2" />

				<div className="flex flex-col">
					{toggles.map(({ key, label }) => (
						<FormControlLabel
							key={key}
							labelPlacement="start"
							className="m-0 justify-between"
							label={t(label)}
							control={<Switch checked={settings[key]} onChange={(e) => toggle(key, e.target.checked)} />}
						/>
					))}
				</div>

				<Button fullWidth variant="outlined" onClick={resetSettings} className="mt-3">
					{t('accessibility.reset')}
				</Button>
			</Popover>
		</>
	);
}
