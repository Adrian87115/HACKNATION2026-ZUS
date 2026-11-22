import { FileText, Image as ImageIcon, LoaderCircle, PanelRightClose, Paperclip, RotateCcw, Send, SquarePen, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useAuth } from '../account/AuthContext';
import { useChat, type ChatMessage } from './ChatContext';
import { CHAT_FILE_TYPES, CHAT_MAX_FILE_BYTES } from './chatApi';
import Markdown from './Markdown';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const ACCOUNT_SUGGESTION = 'Co wynika z moich danych w ZUS – czy dostanę zasiłek?';

const SUGGESTIONS = [
	'Ile wyniesie mój zasiłek macierzyński?',
	'Kto wypłaci zasiłek – pracodawca czy ZUS?',
	'Jakie dokumenty złożyć po porodzie?',
	'Czy na umowie zlecenia dostanę zasiłek macierzyński?'
];

/** Width of the docked panel – BaseLayout reserves the same space on wide screens. */
export const CHAT_PANEL_WIDTH_CLASS = 'sm:w-[26rem]';

export default function ChatSidebar() {
	const { open, setOpen, messages, sending, loadingHistory, available, recheck, send, retry, newChat, remember, setRemember } =
		useChat();
	const [rememberError, setRememberError] = useState<string | null>(null);
	const { account } = useAuth();
	const offline = available === false;
	const titleId = useId();
	const [text, setText] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);

	// Focus the composer when opening; close the overlay with Escape on smaller screens.
	useEffect(() => {
		if (!open) return;
		const t = window.setTimeout(() => inputRef.current?.focus(), 150);
		const onKey = (e: globalThis.KeyboardEvent) => {
			if (e.key === 'Escape' && !window.matchMedia('(min-width: 1280px)').matches) setOpen(false);
		};
		window.addEventListener('keydown', onKey);
		return () => {
			window.clearTimeout(t);
			window.removeEventListener('keydown', onKey);
		};
	}, [open, setOpen]);

	useEffect(() => {
		endRef.current?.scrollIntoView({ block: 'end' });
	}, [messages, sending, open]);

	// Auto-grow the composer up to ~6 lines.
	useEffect(() => {
		const el = inputRef.current;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
	}, [text]);

	async function submit() {
		if (sending || offline || (!text.trim() && !file)) return;
		const t = text;
		const f = file ?? undefined;
		setText('');
		setFile(null);
		await send(t, f);
	}

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			void submit();
		}
	}

	function pickFile(f: File | undefined) {
		if (!f) return;
		if (!CHAT_FILE_TYPES.split(',').includes(f.type)) setFileError('Możesz dodać plik PDF albo zdjęcie (JPG, PNG).');
		else if (f.size > CHAT_MAX_FILE_BYTES) setFileError('Plik jest za duży – maksymalnie 10 MB.');
		else {
			setFileError(null);
			setFile(f);
		}
	}

	return (
		<>
			{/* Backdrop on screens where the panel overlays the page */}
			<div
				aria-hidden
				onClick={() => setOpen(false)}
				className={cx(
					'fixed inset-0 top-16 z-30 bg-black/30 transition-opacity xl:hidden',
					open ? 'opacity-100' : 'pointer-events-none opacity-0'
				)}
			/>

			<aside
				aria-labelledby={titleId}
				inert={!open}
				aria-hidden={!open}
				className={cx(
					'fixed bottom-0 right-0 top-16 z-40 flex w-full flex-col border-l border-line bg-paper shadow-xl transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] xl:shadow-none',
					CHAT_PANEL_WIDTH_CLASS,
					open ? 'translate-x-0' : 'translate-x-full'
				)}>
				{/* Header */}
				<div className="flex items-center gap-3 border-b border-line px-4 py-3">
					<img src="/icon-192.png" alt="" className="h-8 w-8 shrink-0" width={32} height={32} />
					<div className="min-w-0 flex-1">
						<h2 id={titleId} className="font-semibold leading-tight text-ink">
							ZUSia
						</h2>
						<p className="text-xs text-muted">Asystentka AI – urlopy i zasiłki</p>
					</div>
					<button
						type="button"
						onClick={newChat}
						disabled={sending || messages.length === 0}
						title="Nowa rozmowa"
						aria-label="Nowa rozmowa"
						className="rounded-md p-2 text-muted transition hover:bg-hover hover:text-ink disabled:opacity-40">
						<SquarePen className="h-4 w-4" aria-hidden />
					</button>
					<button
						type="button"
						onClick={() => setOpen(false)}
						title="Zwiń panel"
						aria-label="Zwiń panel ZUSi"
						className="rounded-md p-2 text-muted transition hover:bg-hover hover:text-ink">
						<PanelRightClose className="h-4 w-4" aria-hidden />
					</button>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={sending || loadingHistory}>
					{offline && (
						<div
							role="status"
							className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
							<p className="font-semibold">ZUSia jest teraz niedostępna</p>
							<p className="mt-0.5">Serwer asystenta nie odpowiada. Kalkulatory i przewodnik działają normalnie.</p>
							<button
								type="button"
								onClick={() => void recheck()}
								className="mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-2">
								<RotateCcw className="h-3.5 w-3.5" aria-hidden />
								Sprawdź ponownie
							</button>
						</div>
					)}
					{loadingHistory ? (
						<div className="flex justify-center py-10 text-muted">
							<LoaderCircle className="h-5 w-5 animate-spin" aria-label="Wczytuję rozmowę" />
						</div>
					) : messages.length === 0 ? (
						<div className="enter-stagger space-y-4">
							<div className="rounded-lg bg-surface p-4 text-sm text-ink">
								<p className="font-semibold">Cześć, jestem ZUSia 👋</p>
								<p className="mt-1 text-muted">
									Pomogę Ci zrozumieć urlopy i zasiłki związane z rodzicielstwem. Możesz też dodać dokument (PDF lub zdjęcie), a
									wyjaśnię, co oznacza.
								</p>
							</div>
							<div>
								<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Przykładowe pytania</p>
								<ul className="space-y-2">
									{(account ? [ACCOUNT_SUGGESTION, ...SUGGESTIONS] : SUGGESTIONS).map((s) => (
										<li key={s}>
											<button
												type="button"
												disabled={offline}
												onClick={() => void send(s)}
												className="w-full disabled:pointer-events-none disabled:opacity-50 rounded-md border border-line bg-paper px-3 py-2 text-left text-sm text-ink transition hover:border-brand hover:bg-brand-soft/40">
												{s}
											</button>
										</li>
									))}
								</ul>
							</div>
						</div>
					) : (
						<ol className="space-y-4">
							{messages.map((m) => (
								<Bubble key={m.id} message={m} onRetry={() => void retry(m.id)} disabled={sending} />
							))}
							{sending && (
								<li className="flex justify-start">
									<span className="inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-3" aria-label="ZUSia pisze odpowiedź">
										{[0, 150, 300].map((d) => (
											<span
												key={d}
												className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
												style={{ animationDelay: `${d}ms` }}
											/>
										))}
									</span>
								</li>
							)}
						</ol>
					)}
					<div ref={endRef} />
				</div>

				{/* Composer */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void submit();
					}}
					className="border-t border-line px-4 pb-4 pt-3">
					{file && (
						<div className="mb-2 flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm">
							{file.type === 'application/pdf' ? (
								<FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
							) : (
								<ImageIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
							)}
							<span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
							<button
								type="button"
								onClick={() => setFile(null)}
								aria-label={`Usuń załącznik ${file.name}`}
								className="rounded p-0.5 text-muted hover:text-ink">
								<X className="h-4 w-4" aria-hidden />
							</button>
						</div>
					)}
					{fileError && <p className="mb-2 text-xs text-red-600 dark:text-red-300">{fileError}</p>}
					<div className="flex items-end gap-2 rounded-md border border-line bg-paper px-2 py-1.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							title="Dodaj dokument"
							aria-label="Dodaj dokument (PDF lub zdjęcie)"
							className="rounded p-1.5 text-muted transition hover:bg-hover hover:text-ink">
							<Paperclip className="h-4 w-4" aria-hidden />
						</button>
						<input
							ref={fileRef}
							type="file"
							accept={CHAT_FILE_TYPES}
							className="sr-only"
							tabIndex={-1}
							aria-hidden
							onChange={(e) => {
								pickFile(e.target.files?.[0]);
								e.target.value = '';
							}}
						/>
						<label htmlFor={`${titleId}-input`} className="sr-only">
							Wiadomość do ZUSi
						</label>
						<textarea
							id={`${titleId}-input`}
							ref={inputRef}
							rows={1}
							value={text}
							maxLength={20000}
							onChange={(e) => setText(e.target.value)}
							onKeyDown={onKeyDown}
							placeholder={offline ? 'ZUSia jest teraz niedostępna' : 'Zadaj pytanie…'}
							className="max-h-40 min-h-[2rem] flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none"
						/>
						<button
							type="submit"
							disabled={sending || offline || (!text.trim() && !file)}
							aria-label="Wyślij"
							className="rounded-md bg-brand p-2 text-white transition hover:bg-brand-strong disabled:bg-hover disabled:text-muted">
							{sending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
						</button>
					</div>
					<label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-muted">
						<input
							type="checkbox"
							checked={remember}
							onChange={(e) => {
								setRememberError(null);
								setRemember(e.target.checked).catch(() => setRememberError('Nie udało się zapisać ustawienia. Spróbuj ponownie.'));
							}}
							className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand"
						/>
						<span>
							Zapamiętaj rozmowę i dodane pliki, żebym mogła do nich wrócić. Bez zgody rozmowa znika po zamknięciu strony.
						</span>
					</label>
					{rememberError && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{rememberError}</p>}
					<p className="mt-1.5 text-[11px] leading-snug text-muted">
						ZUSia korzysta z AI (Google Gemini) i może się mylić. Nie podawaj numeru PESEL ani danych innych osób.
					</p>
				</form>
			</aside>
		</>
	);
}

function Bubble({ message, onRetry, disabled }: { message: ChatMessage; onRetry: () => void; disabled: boolean }) {
	const user = message.role === 'user';
	return (
		<li className={cx('flex flex-col', user ? 'items-end' : 'items-start')}>
			<div
				className={cx(
					'max-w-[88%] rounded-lg px-3 py-2 text-sm',
					user ? 'bg-brand text-white' : 'bg-surface text-ink',
					message.error && 'opacity-70'
				)}>
				{message.attachment && (
					<p className={cx('mb-1 flex items-center gap-1.5 text-xs', user ? 'text-white/85' : 'text-muted')}>
						{message.attachment.kind === 'pdf' ? (
							<FileText className="h-3.5 w-3.5" aria-hidden />
						) : (
							<ImageIcon className="h-3.5 w-3.5" aria-hidden />
						)}
						<span className="truncate">{message.attachment.name}</span>
					</p>
				)}
				{user ? <p className="whitespace-pre-wrap">{message.content}</p> : <Markdown text={message.content} />}
			</div>
			{message.error && (
				<p className="mt-1 flex items-center gap-2 text-xs text-red-600 dark:text-red-300" role="alert">
					{message.error}
					<button
						type="button"
						onClick={onRetry}
						disabled={disabled}
						className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 disabled:opacity-50">
						<RotateCcw className="h-3 w-3" aria-hidden />
						Ponów
					</button>
				</p>
			)}
		</li>
	);
}
