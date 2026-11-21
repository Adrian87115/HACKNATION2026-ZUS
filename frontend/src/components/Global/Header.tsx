import { useTranslation } from 'react-i18next';
import { NavigationItems } from '../../types/constants';

type Props = {};

export default function Header({}: Props) {
	const { t } = useTranslation();

	return (
		<div className="fixed top-0 left-0 w-full h-[60px] flex items-center justify-center border-b border-gray-200">
			{NavigationItems.map((item) => (
				<a
					key={item.label}
					href={item.href}
					className="mx-4 text-gray-700 hover:text-gray-900 transition-colors duration-300">
					{t(item.label)}
				</a>
			))}
		</div>
	);
}
