import { ThemeProvider } from '@mui/material';
import Button from '@mui/material/Button';
import { Loader } from 'lucide-react';
import { primaryBlueTheme } from '../../utils/mui_extended';

type Props = {
	text?: string;
	className?: string;
	onClick?: React.MouseEventHandler | React.FormEventHandler;
	startIcon?: React.JSX.Element;
	endIcon?: React.JSX.Element;
	disabled?: boolean;
	type?: 'button' | 'submit' | 'reset' | undefined;
	children?: React.ReactNode;
	variant?: 'text' | 'contained' | 'outlined';
	size?: 'small' | 'medium' | 'large';
	icon?: React.JSX.Element;
	loading?: boolean;
	// opt out of the global ui click sound (see SoundManager click delegation)
	silent?: boolean;
};

export default function BaseButton({
	text,
	className,
	onClick,
	startIcon,
	loading,
	endIcon,
	disabled,
	type,
	children,
	variant,
	size,
	icon,
	silent
}: Props) {
	return (
		<ThemeProvider theme={primaryBlueTheme}>
			<Button
				disableElevation
				startIcon={
					loading ? <Loader className="h-4 w-4 animate-spin" /> : startIcon
				}
				endIcon={endIcon}
				color="primaryBlue"
				variant={variant ? variant : 'contained'}
				disabled={disabled}
				onClick={onClick}
				type={type}
				size={size ? size : 'small'}
				data-click-silent={silent ? '' : undefined}
				className={`font-medium px-4 py-2 rounded-md min-w-fit
					hover:bg-dimmed-blue/50
					normal-case button-shadow
					bg-transparent text-primary-blue border disabled:opacity-40 border-primary-blue ${
						className || ''
					}`}>
				{text ? text : children}
				{icon}
			</Button>
		</ThemeProvider>
	);
}
