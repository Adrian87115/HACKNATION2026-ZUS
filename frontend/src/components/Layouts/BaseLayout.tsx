import React from 'react';
import Footer from '../Global/Footer';
import Header from '../Global/Header';

type Props = {
	children: React.ReactNode;
};

export default function BaseLayout({ children }: Props) {
	return (
		<div className="flex min-h-screen flex-col">
			<Header />
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
			<Footer />
		</div>
	);
}
