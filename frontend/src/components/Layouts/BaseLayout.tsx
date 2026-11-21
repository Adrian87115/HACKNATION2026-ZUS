import React from 'react';
import EngineSyncNotice from '../Global/EngineSyncNotice';
import Footer from '../Global/Footer';
import Header from '../Global/Header';
import { useChat } from '../../features/chat/ChatContext';

type Props = {
	children: React.ReactNode;
};

export default function BaseLayout({ children }: Props) {
	const { open } = useChat();
	return (
		<div className="flex min-h-screen flex-col">
			<Header />
			{/* On wide screens the ZUSia panel is docked on the right – make room for it instead of covering content. */}
			<div
				className={`flex flex-1 flex-col transition-[padding] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
					open ? 'xl:pr-[26rem]' : ''
				}`}>
				<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
					<EngineSyncNotice />
					{children}
				</main>
				<Footer />
			</div>
		</div>
	);
}
