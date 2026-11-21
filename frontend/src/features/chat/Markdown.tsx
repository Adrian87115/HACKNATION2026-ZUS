import { Fragment, type ReactNode } from 'react';

/**
 * Minimal, safe Markdown for assistant replies (no HTML injection – everything becomes React elements).
 * Supports paragraphs, headings, bullet / numbered lists, **bold**, *italic*, `code` and http(s) links.
 */

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g;

function inline(text: string): ReactNode[] {
	return text.split(INLINE).map((part, i) => {
		if (!part) return null;
		if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__')))
			return <strong key={i}>{inline(part.slice(2, -2))}</strong>;
		if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_')))
			return <em key={i}>{inline(part.slice(1, -1))}</em>;
		if (part.startsWith('`') && part.endsWith('`'))
			return (
				<code key={i} className="rounded bg-hover px-1 py-0.5 text-[0.9em]">
					{part.slice(1, -1)}
				</code>
			);
		const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
		const href = link ? link[2] : /^https?:\/\//.test(part) ? part : null;
		if (href)
			return (
				<a key={i} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-ink underline underline-offset-2">
					{link ? link[1] : part}
				</a>
			);
		return <Fragment key={i}>{part}</Fragment>;
	});
}

type Block = { type: 'p'; text: string } | { type: 'h'; text: string } | { type: 'ul' | 'ol'; items: string[] };

function parse(source: string): Block[] {
	const blocks: Block[] = [];
	let para: string[] = [];
	const flush = () => {
		if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
		para = [];
	};
	for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
		const line = raw.trimEnd();
		const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
		const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
		const heading = /^#{1,6}\s+(.*)$/.exec(line);
		if (!line.trim()) {
			flush();
		} else if (heading) {
			flush();
			blocks.push({ type: 'h', text: heading[1] });
		} else if (bullet || numbered) {
			flush();
			const type = bullet ? 'ul' : 'ol';
			const item = (bullet ?? numbered)![1];
			const last = blocks[blocks.length - 1];
			if (last && last.type === type) last.items.push(item);
			else blocks.push({ type, items: [item] });
		} else {
			para.push(line);
		}
	}
	flush();
	return blocks;
}

export default function Markdown({ text }: { text: string }) {
	return (
		<div className="space-y-2">
			{parse(text).map((b, i) => {
				if (b.type === 'h')
					return (
						<p key={i} className="font-semibold">
							{inline(b.text)}
						</p>
					);
				if (b.type === 'p')
					return (
						<p key={i} className="whitespace-pre-line">
							{inline(b.text)}
						</p>
					);
				const List = b.type === 'ul' ? 'ul' : 'ol';
				return (
					<List key={i} className={b.type === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-1 pl-5'}>
						{b.items.map((item, j) => (
							<li key={j}>{inline(item)}</li>
						))}
					</List>
				);
			})}
		</div>
	);
}
