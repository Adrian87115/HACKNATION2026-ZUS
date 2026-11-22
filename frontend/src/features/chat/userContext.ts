/**
 * What the user sees right now – sent with each message to ZUSia, which reads it through the MCP tool
 * get_current_screen (kept in the assistant's memory only, never saved). Account data is not sent from here:
 * ZUSia's MCP tools fetch it from the backend with the user's own session token.
 * Bank account numbers are masked.
 */
const MAX_SCREEN_CHARS = 9000;

const squash = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

function fieldLabel(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
	const fromLabel = el.labels?.[0]?.innerText;
	const fromAria = el.getAttribute('aria-label') ?? (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby')!)?.innerText);
	return squash(fromLabel || fromAria || el.getAttribute('placeholder') || el.name || 'pole').slice(0, 120);
}

function fieldValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string | null {
	if (el instanceof HTMLInputElement) {
		if (el.type === 'hidden' || el.type === 'file' || el.type === 'password') return null;
		if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'zaznaczone' : el.type === 'radio' ? null : 'niezaznaczone';
		// bank account numbers are masked – ZUSia only needs to know whether one was typed
		if (/konto|rachun|iban/i.test(fieldLabel(el)) && el.value) return `wpisano (…${el.value.replace(/\s/g, '').slice(-4)})`;
	}
	if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.text ?? el.value;
	return el.value || '(puste)';
}

/** The page content the user sees right now: headings, text, chosen options and typed values. */
export function screenContext(): string {
	const main = document.querySelector('main');
	if (!main) return '';
	const text = squash(main.innerText).slice(0, MAX_SCREEN_CHARS);

	const fields: string[] = [];
	main.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el) => {
		if (fields.length >= 60 || el.disabled || el.closest('[aria-hidden="true"]')) return;
		const value = fieldValue(el);
		if (value !== null) fields.push(`- ${fieldLabel(el)}: ${value}`);
	});
	// toggle buttons used as radio groups / switches
	main.querySelectorAll<HTMLElement>('[role="radio"][aria-checked="true"], [role="switch"]').forEach((el) => {
		if (fields.length >= 80) return;
		const label = squash(el.getAttribute('aria-label') || el.innerText).slice(0, 120);
		if (label) fields.push(`- ${label}: ${el.getAttribute('role') === 'switch' ? (el.getAttribute('aria-checked') === 'true' ? 'włączone' : 'wyłączone') : 'wybrane'}`);
	});

	return [
		`Ekran: „${document.title}” (${window.location.pathname}${window.location.search})`,
		fields.length ? `Pola formularza i wybrane opcje:\n${fields.join('\n')}` : '',
		`Treść widoczna na stronie:\n${text}`
	]
		.filter(Boolean)
		.join('\n\n');
}
