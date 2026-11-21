import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
	NOT_FOUND_SEO,
	OG_IMAGE,
	absoluteUrl,
	findSeoRoute,
	robotsContent,
	structuredData,
	type SeoMeta
} from './routes';

const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || window.location.origin).replace(/\/+$/, '');
const NOINDEX_ALL = import.meta.env.VITE_NOINDEX === 'true';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
	let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
	if (!el) {
		el = document.createElement('meta');
		el.setAttribute(attr, key);
		document.head.appendChild(el);
	}
	el.content = content;
}

function setCanonical(href: string | undefined) {
	let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
	if (!href) {
		el?.remove();
		return;
	}
	if (!el) {
		el = document.createElement('link');
		el.rel = 'canonical';
		document.head.appendChild(el);
	}
	el.href = href;
}

function setStructuredData(meta: SeoMeta) {
	let el = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
	if (meta.noindex) {
		el?.remove();
		return;
	}
	if (!el) {
		el = document.createElement('script');
		el.type = 'application/ld+json';
		document.head.appendChild(el);
	}
	el.textContent = JSON.stringify(structuredData(SITE_URL, meta));
}

/**
 * Keeps <head> in sync with the current route during client-side navigation.
 * (The first paint already has the right tags – they are pre-rendered per route by seo.plugin.ts.)
 */
export default function RouteSeo() {
	const { pathname } = useLocation();

	useEffect(() => {
		const meta = findSeoRoute(pathname) ?? NOT_FOUND_SEO;
		const url = meta.path ? absoluteUrl(SITE_URL, meta.path) : undefined;

		document.title = meta.title;
		setMeta('name', 'description', meta.description);
		setMeta('name', 'robots', robotsContent(NOINDEX_ALL || Boolean(meta.noindex)));
		setMeta('property', 'og:title', meta.title);
		setMeta('property', 'og:description', meta.description);
		setMeta('property', 'og:image', absoluteUrl(SITE_URL, OG_IMAGE.path));
		setMeta('name', 'twitter:title', meta.title);
		setMeta('name', 'twitter:description', meta.description);
		if (url) setMeta('property', 'og:url', url);
		else document.head.querySelector('meta[property="og:url"]')?.remove();
		setCanonical(url);
		setStructuredData(meta);
	}, [pathname]);

	return null;
}
