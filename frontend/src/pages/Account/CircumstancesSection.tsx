import { LoaderCircle, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { accountApi, type Account, type CircumstancesInput, type EmploymentChange } from '../../features/account/accountApi';
import { useAuth } from '../../features/account/AuthContext';

const CHANGES: { value: EmploymentChange; label: string; dateLabel: string }[] = [
	{ value: 'brak', label: 'Bez zmian', dateLabel: '' },
	{ value: 'nowa_umowa_o_prace', label: 'Zaczynam nową umowę o pracę', dateLabel: 'Od kiedy' },
	{ value: 'umowa_zlecenia', label: 'Przechodzę na umowę zlecenia', dateLabel: 'Od kiedy' },
	{ value: 'dzialalnosc', label: 'Zakładam działalność gospodarczą', dateLabel: 'Od kiedy' },
	{ value: 'koniec_umowy_na_czas_okreslony', label: 'Kończy mi się umowa na czas określony', dateLabel: 'Data końca umowy' },
	{ value: 'likwidacja_pracodawcy', label: 'Pracodawca ogłasza upadłość lub likwidację', dateLabel: 'Data zwolnienia' },
	{ value: 'wypowiedzenie', label: 'Dostałam/dostałem wypowiedzenie', dateLabel: 'Data wypowiedzenia' }
];

const plDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const inputCls =
	'h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<label className="block">
			<span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
			{children}
			{hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
		</label>
	);
}

/** Circumstances the user enters on top of the registry data – used by the calculators, applications and ZUSia. */
export default function CircumstancesSection({ account }: { account: Account }) {
	const { token, setCircumstances } = useAuth();
	const c = account.circumstances;
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [draft, setDraft] = useState<CircumstancesInput>(() => ({
		expectedBirthDate: c.expectedBirthDate ?? account.family.expectedBirthDate,
		expectedChildren: c.expectedChildren,
		employmentChange: c.employmentChange,
		employmentChangeDate: c.employmentChangeDate,
		notes: c.notes
	}));
	const change = CHANGES.find((x) => x.value === draft.employmentChange)!;
	const set = (patch: Partial<CircumstancesInput>) => setDraft((d) => ({ ...d, ...patch }));
	const filled = Boolean(c.updatedAt);

	async function save() {
		if (!token) return;
		setSaving(true);
		setError(null);
		try {
			// a due date equal to the one on the account is not a separate statement
			const sameDue = draft.expectedBirthDate === account.family.expectedBirthDate;
			setCircumstances(
				await accountApi.updateCircumstances(token, { ...draft, expectedBirthDate: sameDue ? null : draft.expectedBirthDate || null })
			);
			setEditing(false);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSaving(false);
		}
	}

	return (
		<section className="rounded-lg border border-line bg-paper shadow-sm">
			<header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
				<div>
					<h2 className="font-semibold text-ink">Moje okoliczności</h2>
					<p className="text-xs text-muted">Wpisujesz je sama/sam – uzupełniają dane z ZUS w kalkulatorach, wnioskach i odpowiedziach ZUSi.</p>
				</div>
				{!editing && (
					<button
						type="button"
						onClick={() => setEditing(true)}
						className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-hover">
						<Pencil className="h-4 w-4" aria-hidden />
						{filled ? 'Zmień' : 'Uzupełnij'}
					</button>
				)}
			</header>

			<div className="px-5 py-4">
				{editing ? (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void save();
						}}
						className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="Przewidywana data porodu" hint="Z karty ciąży – zostaw puste, jeśli nie dotyczy.">
								<input
									type="date"
									value={draft.expectedBirthDate ?? ''}
									onChange={(e) => set({ expectedBirthDate: e.target.value || null })}
									className={inputCls}
								/>
							</Field>
							<Field label="Liczba dzieci z jednego porodu">
								<select
									value={draft.expectedChildren}
									onChange={(e) => set({ expectedChildren: Number(e.target.value) })}
									className={`${inputCls} cursor-pointer`}>
									{[1, 2, 3, 4, 5].map((n) => (
										<option key={n} value={n}>
											{n === 5 ? '5 lub więcej' : n}
										</option>
									))}
								</select>
							</Field>
							<Field label="Zmiana sytuacji zawodowej">
								<select
									value={draft.employmentChange}
									onChange={(e) => {
										const value = e.target.value as EmploymentChange;
										set({ employmentChange: value, employmentChangeDate: value === 'brak' ? null : draft.employmentChangeDate });
									}}
									className={`${inputCls} cursor-pointer`}>
									{CHANGES.map((x) => (
										<option key={x.value} value={x.value}>
											{x.label}
										</option>
									))}
								</select>
							</Field>
							{draft.employmentChange !== 'brak' && (
								<Field label={change.dateLabel}>
									<input
										type="date"
										required
										value={draft.employmentChangeDate ?? ''}
										onChange={(e) => set({ employmentChangeDate: e.target.value || null })}
										className={inputCls}
									/>
								</Field>
							)}
						</div>
						<Field label="Uwagi (opcjonalnie)" hint="Np. „drugi rodzic pracuje za granicą”. Nie wpisuj numeru PESEL ani danych innych osób.">
							<textarea
								value={draft.notes}
								maxLength={500}
								rows={2}
								onChange={(e) => set({ notes: e.target.value })}
								className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
							/>
						</Field>
						{error && (
							<p role="alert" className="text-sm text-red-700 dark:text-red-300">
								{error}
							</p>
						)}
						<div className="flex flex-wrap gap-2">
							<button
								type="submit"
								disabled={saving}
								className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60">
								{saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
								Zapisz
							</button>
							<button
								type="button"
								onClick={() => setEditing(false)}
								className="rounded-md px-4 py-2 text-sm font-semibold text-muted transition hover:bg-hover hover:text-ink">
								Anuluj
							</button>
						</div>
					</form>
				) : filled ? (
					<dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
						<div>
							<dt className="text-muted">Przewidywana data porodu</dt>
							<dd className="font-semibold text-ink">
								{c.expectedBirthDate ? plDate(c.expectedBirthDate) : account.family.expectedBirthDate ? `${plDate(account.family.expectedBirthDate)} (z konta)` : '—'}
							</dd>
						</div>
						<div>
							<dt className="text-muted">Liczba dzieci z jednego porodu</dt>
							<dd className="font-semibold text-ink">{c.expectedChildren}</dd>
						</div>
						<div>
							<dt className="text-muted">Sytuacja zawodowa</dt>
							<dd className="font-semibold text-ink">
								{CHANGES.find((x) => x.value === c.employmentChange)?.label}
								{c.employmentChangeDate && ` · ${plDate(c.employmentChangeDate)}`}
							</dd>
						</div>
						{c.notes && (
							<div>
								<dt className="text-muted">Uwagi</dt>
								<dd className="text-ink">{c.notes}</dd>
							</div>
						)}
					</dl>
				) : (
					<p className="text-sm text-muted">
						Spodziewasz się dziecka, bliźniąt albo zmieniasz pracę? Dopisz to – przeliczymy zasiłki i podpowiemy, co to oznacza.
					</p>
				)}

				{!editing && c.hints.length > 0 && (
					<ul className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
						{c.hints.map((h) => (
							<li key={h} className="flex gap-2 text-ink">
								<span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
								{h}
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
