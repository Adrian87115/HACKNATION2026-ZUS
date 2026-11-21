/**
 * Single source of truth for SEO metadata.
 * Used at runtime (src/seo/RouteSeo.tsx) and at build time (seo.plugin.ts → per-route HTML, sitemap.xml).
 * Keep this file free of browser/React imports – it is also loaded by Node in vite.config.ts.
 */
import { AppRoutePaths } from '../types/shared.ts';

export const SITE_NAME = 'ZUSia';
export const SITE_LOCALE = 'pl_PL';
export const SITE_LANGUAGE = 'pl-PL';
export const THEME_COLOR = '#00843d';
export const SITE_DESCRIPTION =
	'ZUSia pomaga rodzicom zaplanować urlop macierzyński, ojcowski i rodzicielski oraz policzyć zasiłki z ZUS na 2026 rok. Bez logowania.';

export const OG_IMAGE = {
	path: '/og-image.png',
	width: 1200,
	height: 630,
	alt: 'ZUSia – asystent urlopów i zasiłków dla rodziców'
} as const;

export type SeoMeta = {
	/** Route path; omitted for pages without a canonical URL (e.g. 404). */
	path?: string;
	/** Full <title> (50–60 characters works best in search results). */
	title: string;
	/** Meta description (~150–160 characters). */
	description: string;
	/** Short page name used in breadcrumbs / structured data. */
	name?: string;
	noindex?: boolean;
	sitemap?: { changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'; priority: number };
};

export const SEO_ROUTES: SeoMeta[] = [
	{
		path: AppRoutePaths.HOME,
		title: 'ZUSia – urlopy i zasiłki dla rodziców 2026',
		description: SITE_DESCRIPTION,
		name: 'Strona główna',
		sitemap: { changefreq: 'monthly', priority: 1.0 }
	},
	{
		path: AppRoutePaths.PARENTING_GUIDE,
		title: 'Przewodnik rodzica – plan urlopów i zasiłków | ZUSia',
		description:
			'Odpowiedz na kilka pytań i zobacz harmonogram urlopu macierzyńskiego, ojcowskiego i rodzicielskiego oraz kwoty zasiłku dla obojga rodziców.',
		name: 'Przewodnik rodzica',
		sitemap: { changefreq: 'monthly', priority: 0.9 }
	},
	{
		path: AppRoutePaths.CALCULATORS,
		title: 'Kalkulator zasiłku macierzyńskiego i chorobowego 2026 | ZUSia',
		description:
			'Policz zasiłek macierzyński, rodzicielski i ojcowski oraz zasiłek chorobowy w ciąży według przepisów i stawek ZUS na 2026 rok.',
		name: 'Kalkulatory',
		sitemap: { changefreq: 'monthly', priority: 0.9 }
	}
];

/** Old URLs that permanently moved. Client-side redirect in App.tsx; 301 / static redirect pages from seo.plugin.ts. */
export const LEGACY_REDIRECTS: { from: string; to: string }[] = [
	{ from: '/calculators', to: AppRoutePaths.CALCULATORS }
];

export const NOT_FOUND_SEO: SeoMeta = {
	title: 'Nie znaleziono strony | ZUSia',
	description: 'Ta strona nie istnieje. Wróć na stronę główną ZUSi i skorzystaj z przewodnika rodzica lub kalkulatorów.',
	noindex: true
};

export const findSeoRoute = (pathname: string): SeoMeta | undefined => {
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	return SEO_ROUTES.find((r) => r.path === normalized);
};

export const absoluteUrl = (siteUrl: string, path: string): string =>
	`${siteUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

export const robotsContent = (noindex: boolean): string =>
	noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

/** schema.org JSON-LD for a page (site-wide WebSite + WebApplication, plus breadcrumbs on sub-pages). */
export function structuredData(siteUrl: string, meta: SeoMeta): object[] {
	const home = absoluteUrl(siteUrl, '/');
	const graph: object[] = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			'@id': `${home}#website`,
			name: SITE_NAME,
			url: home,
			description: SITE_DESCRIPTION,
			inLanguage: SITE_LANGUAGE
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			'@id': `${home}#app`,
			name: SITE_NAME,
			url: home,
			description: SITE_DESCRIPTION,
			applicationCategory: 'FinanceApplication',
			operatingSystem: 'Any',
			inLanguage: SITE_LANGUAGE,
			isAccessibleForFree: true,
			image: absoluteUrl(siteUrl, OG_IMAGE.path),
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' }
		}
	];
	if (meta.path && meta.path !== AppRoutePaths.HOME && meta.name) {
		graph.push({
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Strona główna', item: home },
				{ '@type': 'ListItem', position: 2, name: meta.name, item: absoluteUrl(siteUrl, meta.path) }
			]
		});
	}
	return graph;
}
