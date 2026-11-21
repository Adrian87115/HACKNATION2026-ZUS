/**
 * SEO build plugin.
 *  - Injects route-specific <head> tags (title, description, canonical, robots, Open Graph, Twitter, JSON-LD)
 *    at the `<!--seo-->` marker in index.html.
 *  - On build, writes a pre-filled HTML file per route (dist/<route>/index.html) and 404.html, so crawlers and
 *    link-preview bots that don't run JavaScript still get the right metadata.
 *  - Generates robots.txt and sitemap.xml (also served by the dev server).
 *
 * Env (see .env.example):
 *   VITE_SITE_URL – public origin, e.g. https://zusia.example.pl (required for production builds)
 *   VITE_NOINDEX  – "true" on staging/preview deployments: blocks indexing everywhere
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv, type Plugin } from 'vite';
import {
	LEGACY_REDIRECTS,
	NOT_FOUND_SEO,
	OG_IMAGE,
	SEO_ROUTES,
	SITE_LOCALE,
	SITE_NAME,
	absoluteUrl,
	findSeoRoute,
	robotsContent,
	structuredData,
	type SeoMeta
} from './src/seo/routes.ts';

const MARKER = '<!--seo-->';
const BLOCK = /<!--seo:start-->[\s\S]*?<!--seo:end-->/;
const DEV_FALLBACK_URL = 'http://localhost:5173';

const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function headTags(siteUrl: string, meta: SeoMeta, noindexAll: boolean): string {
	const noindex = noindexAll || Boolean(meta.noindex);
	const url = meta.path ? absoluteUrl(siteUrl, meta.path) : undefined;
	const image = absoluteUrl(siteUrl, OG_IMAGE.path);
	const tags = [
		`<title>${esc(meta.title)}</title>`,
		`<meta name="description" content="${esc(meta.description)}" />`,
		`<meta name="robots" content="${robotsContent(noindex)}" />`,
		url && `<link rel="canonical" href="${esc(url)}" />`,
		`<meta property="og:type" content="website" />`,
		`<meta property="og:site_name" content="${SITE_NAME}" />`,
		`<meta property="og:locale" content="${SITE_LOCALE}" />`,
		`<meta property="og:title" content="${esc(meta.title)}" />`,
		`<meta property="og:description" content="${esc(meta.description)}" />`,
		url && `<meta property="og:url" content="${esc(url)}" />`,
		`<meta property="og:image" content="${esc(image)}" />`,
		`<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
		`<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
		`<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}" />`,
		`<meta name="twitter:card" content="summary_large_image" />`,
		`<meta name="twitter:title" content="${esc(meta.title)}" />`,
		`<meta name="twitter:description" content="${esc(meta.description)}" />`,
		`<meta name="twitter:image" content="${esc(image)}" />`,
		`<meta name="twitter:image:alt" content="${esc(OG_IMAGE.alt)}" />`,
		!meta.noindex &&
			`<script type="application/ld+json">${JSON.stringify(structuredData(siteUrl, meta)).replace(/</g, '\\u003c')}</script>`
	].filter(Boolean);
	return `<!--seo:start-->\n    ${tags.join('\n    ')}\n    <!--seo:end-->`;
}

/** Static redirect page for hosts without server-side redirects (meta refresh 0 = permanent move for Google). */
function redirectHtml(siteUrl: string, to: string): string {
	const target = absoluteUrl(siteUrl, to);
	return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <title>Strona została przeniesiona</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${esc(target)}" />
    <meta http-equiv="refresh" content="0; url=${esc(to)}" />
    <script>location.replace(${JSON.stringify(to)} + location.search + location.hash);</script>
  </head>
  <body>
    <p>Strona została przeniesiona: <a href="${esc(to)}">${esc(target)}</a></p>
  </body>
</html>
`;
}

function robotsTxt(siteUrl: string, noindexAll: boolean): string {
	if (noindexAll) return 'User-agent: *\nDisallow: /\n';
	return ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}`, ''].join(
		'\n'
	);
}

function sitemapXml(siteUrl: string): string {
	const lastmod = new Date().toISOString().slice(0, 10);
	const urls = SEO_ROUTES.filter((r) => r.path && r.sitemap && !r.noindex)
		.map(
			(r) =>
				`  <url>\n    <loc>${esc(absoluteUrl(siteUrl, r.path!))}</loc>\n    <lastmod>${lastmod}</lastmod>\n` +
				`    <changefreq>${r.sitemap!.changefreq}</changefreq>\n    <priority>${r.sitemap!.priority.toFixed(1)}</priority>\n  </url>`
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export default function seoPlugin(): Plugin {
	let siteUrl = DEV_FALLBACK_URL;
	let noindexAll = false;
	let outDir = 'dist';
	const home = SEO_ROUTES.find((r) => r.path === '/')!;

	return {
		name: 'zusia-seo',

		configResolved(config) {
			const env = loadEnv(config.mode, config.envDir || config.root, 'VITE_');
			noindexAll = env.VITE_NOINDEX === 'true';
			outDir = path.resolve(config.root, config.build.outDir);
			if (env.VITE_SITE_URL) {
				siteUrl = env.VITE_SITE_URL.replace(/\/+$/, '');
			} else if (config.command === 'build') {
				config.logger.warn(
					`\n[seo] VITE_SITE_URL is not set – canonical URLs, sitemap and social tags will point to ${DEV_FALLBACK_URL}.\n` +
						'      Set it to the production origin, e.g. VITE_SITE_URL=https://zusia.example.pl\n'
				);
			}
		},

		transformIndexHtml(html, ctx) {
			// Dev: the SPA fallback serves index.html for every path – use that path's metadata.
			// Build: ctx.path is /index.html → home; other routes are written in writeBundle.
			const requested = (ctx.originalUrl ?? '').split(/[?#]/)[0];
			const meta = requested ? (findSeoRoute(requested) ?? NOT_FOUND_SEO) : home;
			return html.replace(MARKER, headTags(siteUrl, meta, noindexAll));
		},

		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url?.split('?')[0];
				if (url === '/robots.txt') {
					res.setHeader('Content-Type', 'text/plain; charset=utf-8');
					res.end(robotsTxt(siteUrl, noindexAll));
				} else if (url === '/sitemap.xml') {
					res.setHeader('Content-Type', 'application/xml; charset=utf-8');
					res.end(sitemapXml(siteUrl));
				} else {
					next();
				}
			});
		},

		writeBundle: {
			order: 'post',
			async handler() {
				const indexPath = path.join(outDir, 'index.html');
				const html = await readFile(indexPath, 'utf8');
				const withMeta = (meta: SeoMeta) => html.replace(BLOCK, headTags(siteUrl, meta, noindexAll));

				for (const route of SEO_ROUTES) {
					if (!route.path || route.path === '/') continue;
					const dir = path.join(outDir, route.path.replace(/^\/+/, ''));
					await mkdir(dir, { recursive: true });
					await writeFile(path.join(dir, 'index.html'), withMeta(route));
				}
				await writeFile(path.join(outDir, '404.html'), withMeta(NOT_FOUND_SEO));

				// Moved URLs: a static redirect page per old path + `_redirects` (real 301 on Netlify / Cloudflare Pages).
				for (const { from, to } of LEGACY_REDIRECTS) {
					const dir = path.join(outDir, from.replace(/^\/+/, ''));
					await mkdir(dir, { recursive: true });
					await writeFile(path.join(dir, 'index.html'), redirectHtml(siteUrl, to));
				}
				await writeFile(
					path.join(outDir, '_redirects'),
					LEGACY_REDIRECTS.map(({ from, to }) => `${from} ${to} 301\n${from}/ ${to} 301`).join('\n') + '\n'
				);
				await writeFile(path.join(outDir, 'robots.txt'), robotsTxt(siteUrl, noindexAll));
				await writeFile(path.join(outDir, 'sitemap.xml'), sitemapXml(siteUrl));
			}
		}
	};
}
