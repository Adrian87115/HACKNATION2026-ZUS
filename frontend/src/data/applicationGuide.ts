/**
 * Section (g) of the brief: documents, deadlines and where to file them – depending on the benefit,
 * the form of employment and whether the payer (employer / principal) or ZUS pays the benefit.
 *
 * Sources: task brief (ZUS), ustawa zasiłkowa (Art. 61, 67), Kodeks pracy (Art. 180–183).
 * Keep statements conservative – only rules confirmed in those sources.
 */

export type BenefitKey = 'ciaza' | 'macierzynski' | 'ojcowski' | 'rodzicielski' | 'adopcja';
export type EmploymentKey = 'umowa-o-prace' | 'zlecenie' | 'dzialalnosc';
export type PayerKey = 'powyzej-20' | 'do-20' | 'nie-wiem';

export const BENEFITS: { value: BenefitKey; label: string; hint: string }[] = [
	{ value: 'ciaza', label: 'Zwolnienie lekarskie w ciąży', hint: 'zasiłek chorobowy' },
	{ value: 'macierzynski', label: 'Urlop macierzyński', hint: 'zasiłek macierzyński matki' },
	{ value: 'ojcowski', label: 'Urlop ojcowski', hint: '2 tygodnie dla ojca' },
	{ value: 'rodzicielski', label: 'Urlop rodzicielski', hint: 'dla obojga rodziców' },
	{ value: 'adopcja', label: 'Adopcja lub rodzina zastępcza', hint: 'urlop na warunkach macierzyńskiego' }
];

export const EMPLOYMENTS: { value: EmploymentKey; label: string }[] = [
	{ value: 'umowa-o-prace', label: 'Umowa o pracę' },
	{ value: 'zlecenie', label: 'Umowa zlecenia' },
	{ value: 'dzialalnosc', label: 'Własna działalność' }
];

export const PAYERS: { value: PayerKey; label: string }[] = [
	{ value: 'powyzej-20', label: 'Ponad 20 osób' },
	{ value: 'do-20', label: 'Do 20 osób' },
	{ value: 'nie-wiem', label: 'Nie wiem' }
];

/* ------------------------------------------------------------------ */
/*  Documents                                                          */
/* ------------------------------------------------------------------ */

export type DocKey =
	| 'e-ZLA'
	| 'ZAM'
	| 'Z-3'
	| 'Z-3a'
	| 'ZAS-53'
	| 'ZAS-12'
	| 'wniosek-urlop'
	| 'zaswiadczenie-termin-porodu'
	| 'akt-urodzenia'
	| 'za-zyciem'
	| 'szpital'
	| 'martwe-urodzenie'
	| 'sad';

export const DOCUMENTS: Record<DocKey, { code: string; name: string; description: string; who: string }> = {
	'e-ZLA': {
		code: 'e-ZLA',
		name: 'Elektroniczne zaświadczenie lekarskie',
		description: 'Wystawia lekarz. Trafia automatycznie do ZUS i na profil pracodawcy na PUE/eZUS. Ciąża jest oznaczona kodem „B”.',
		who: 'Wystawia lekarz – nic nie musisz dostarczać'
	},
	ZAM: {
		code: 'ZAM',
		name: 'Wniosek o zasiłek macierzyński',
		description:
			'Jeden wniosek o zasiłek za urlop macierzyński, rodzicielski i ojcowski. Od 24 października 2026 r. zastąpił formularze ZUR i ZAO.',
		who: 'Wypełniasz Ty'
	},
	'Z-3': {
		code: 'Z-3',
		name: 'Zaświadczenie płatnika składek (pracownik)',
		description: 'Dane potrzebne do ustalenia zasiłku: okresy urlopu i składniki wynagrodzenia.',
		who: 'Wypełnia pracodawca i przekazuje do ZUS'
	},
	'Z-3a': {
		code: 'Z-3a',
		name: 'Zaświadczenie płatnika składek (np. umowa zlecenia)',
		description: 'Odpowiednik Z-3 dla osób, które nie są pracownikami.',
		who: 'Wypełnia zleceniodawca i przekazuje do ZUS'
	},
	'ZAS-53': {
		code: 'ZAS-53',
		name: 'Wniosek o zasiłek chorobowy',
		description: 'Wniosek osoby prowadzącej działalność gospodarczą o zasiłek chorobowy.',
		who: 'Wypełniasz Ty i składasz w ZUS'
	},
	'ZAS-12': {
		code: 'ZAS-12',
		name: 'Dokument na dalszy okres zasiłku',
		description: 'Przekazywany do ZUS przy kolejnym okresie niezdolności do pracy – zamiast ponownego Z-3.',
		who: 'Przekazuje pracodawca'
	},
	'wniosek-urlop': {
		code: 'Wniosek o urlop',
		name: 'Wniosek do pracodawcy o udzielenie urlopu',
		description: 'Pisemny lub elektroniczny wniosek pracownika o urlop związany z rodzicielstwem.',
		who: 'Składasz u pracodawcy'
	},
	'zaswiadczenie-termin-porodu': {
		code: 'Zaświadczenie lekarskie',
		name: 'Zaświadczenie o przewidywanej dacie porodu',
		description: 'Potrzebne, jeśli chcesz zacząć urlop macierzyński przed porodem (maks. 6 tygodni wcześniej).',
		who: 'Wystawia lekarz prowadzący ciążę'
	},
	'akt-urodzenia': {
		code: 'Odpis aktu urodzenia',
		name: 'Skrócony odpis aktu urodzenia dziecka',
		description: 'Potwierdza urodzenie dziecka. Możesz go zamówić online w serwisie gov.pl.',
		who: 'Wydaje urząd stanu cywilnego'
	},
	'za-zyciem': {
		code: 'Zaświadczenie „Za życiem”',
		name: 'Zaświadczenie „Za życiem”',
		description: 'Wydłuża urlop rodzicielski. Wystawia lekarz specjalista przy ciężkiej chorobie lub niepełnosprawności dziecka.',
		who: 'Wystawia lekarz specjalista'
	},
	szpital: {
		code: 'Zaświadczenie ze szpitala',
		name: 'Zaświadczenie szpitala o pobycie dziecka',
		description: 'Podstawa do uzupełniającego urlopu macierzyńskiego (wcześniak albo hospitalizacja noworodka).',
		who: 'Wystawia szpital'
	},
	'martwe-urodzenie': {
		code: 'Zaświadczenie o martwym urodzeniu',
		name: 'Zaświadczenie o martwym urodzeniu lub akt zgonu dziecka',
		description: 'Potrzebne do ustalenia zasiłku po stracie dziecka.',
		who: 'Wydaje szpital / urząd stanu cywilnego'
	},
	sad: {
		code: 'Dokument z sądu',
		name: 'Dokument potwierdzający przyjęcie dziecka na wychowanie',
		description:
			'Przy adopcji – potwierdzenie wystąpienia do sądu o przysposobienie; przy rodzinie zastępczej niezawodowej – dokument o umieszczeniu dziecka.',
		who: 'Wydaje sąd'
	}
};

/* ------------------------------------------------------------------ */
/*  Guide                                                              */
/* ------------------------------------------------------------------ */

export type Step = { title: string; body: string; docs?: DocKey[] };
export type Deadline = { value: string; label: string; note?: string };
export type PayerInfo = { who: 'payer' | 'zus' | 'depends'; title: string; body: string };

export type ApplicationGuide = {
	payer: PayerInfo;
	steps: Step[];
	attachments: { doc: DocKey; when: string }[];
	deadlines: Deadline[];
	/** Documents go to ZUS directly (show filing channels). */
	filesWithZus: boolean;
};

const isEmployee = (e: EmploymentKey) => e === 'umowa-o-prace';

function payerInfo(benefit: BenefitKey, employment: EmploymentKey, payer: PayerKey): PayerInfo {
	const who = employment === 'umowa-o-prace' ? 'pracodawca' : 'zleceniodawca';
	const cert = employment === 'umowa-o-prace' ? 'Z-3' : 'Z-3a';
	const sickPayNote =
		benefit === 'ciaza' && isEmployee(employment)
			? ' Przez pierwsze 33 dni zwolnienia w roku (14 dni po 50. roku życia) pracodawca i tak płaci wynagrodzenie chorobowe.'
			: '';

	if (employment === 'dzialalnosc') {
		return {
			who: 'zus',
			title: 'Zasiłek wypłaci ZUS',
			body: 'Przy własnej działalności dokumenty składasz bezpośrednio do ZUS. Zasiłek przysługuje, jeśli opłacasz dobrowolne ubezpieczenie chorobowe i nie masz zaległości w składkach.'
		};
	}
	if (payer === 'powyzej-20') {
		return {
			who: 'payer',
			title: `Zasiłek wypłaci Twój ${who}`,
			body: `${who[0].toUpperCase()}${who.slice(1)} zgłasza do ubezpieczenia chorobowego ponad 20 osób, więc sam ustala prawo do zasiłku i go wypłaca (art. 61 ustawy zasiłkowej). Dokumenty składasz u niego.${sickPayNote}`
		};
	}
	if (payer === 'do-20') {
		return {
			who: 'zus',
			title: 'Zasiłek wypłaci ZUS',
			body: `Dokumenty składasz u ${employment === 'umowa-o-prace' ? 'pracodawcy' : 'zleceniodawcy'}, a on przekazuje je do ZUS razem z zaświadczeniem ${cert}. Pieniądze wypłaca ZUS.${sickPayNote}`
		};
	}
	return {
		who: 'depends',
		title: `Wypłaci ${who} albo ZUS`,
		body: `Jeśli ${who} zgłasza do ubezpieczenia chorobowego ponad 20 osób (według stanu na 30 listopada poprzedniego roku), wypłaca zasiłek sam. W przeciwnym razie wypłaca ZUS. Zapytaj w kadrach – w obu przypadkach dokumenty składasz najpierw u ${employment === 'umowa-o-prace' ? 'pracodawcy' : 'zleceniodawcy'}.${sickPayNote}`
	};
}

/** Last step: who forwards the documents (payer pays vs. ZUS pays). */
function settlementStep(employment: EmploymentKey, payer: PayerKey, docs: DocKey[]): Step {
	const cert: DocKey = employment === 'umowa-o-prace' ? 'Z-3' : 'Z-3a';
	const who = employment === 'umowa-o-prace' ? 'Pracodawca' : 'Zleceniodawca';
	if (employment === 'dzialalnosc') {
		return {
			title: 'Złóż dokumenty w ZUS',
			body: 'Przez PUE/eZUS, w placówce ZUS albo pocztą. ZUS ustala prawo do zasiłku i wypłaca pieniądze.',
			docs
		};
	}
	return {
		title: `${who} rozlicza zasiłek`,
		body:
			payer === 'powyzej-20'
				? `${who} sam ustala prawo do zasiłku i wypłaca go razem z wynagrodzeniem.`
				: payer === 'do-20'
					? `${who} przekazuje Twoje dokumenty do ZUS razem z zaświadczeniem ${cert}. ZUS wypłaca zasiłek.`
					: `${who} wypłaca zasiłek sam (ponad 20 ubezpieczonych) albo przekazuje dokumenty do ZUS z zaświadczeniem ${cert}.`,
		docs: payer === 'powyzej-20' ? docs : [...docs, cert]
	};
}

const PRESCRIPTION: Deadline = {
	value: '6 miesięcy',
	label: 'na złożenie dokumentów',
	note: 'Zasiłek za dany okres przepada, jeśli dokumenty nie trafią do ZUS lub płatnika w ciągu 6 miesięcy od jego zakończenia (art. 67 ustawy zasiłkowej).'
};

export function buildGuide(benefit: BenefitKey, employment: EmploymentKey, payer: PayerKey): ApplicationGuide {
	const employee = isEmployee(employment);
	const filesWithZus = employment === 'dzialalnosc' || payer !== 'powyzej-20';
	const info = payerInfo(benefit, employment, payer);
	const submitTo = employee ? 'pracodawcy' : employment === 'zlecenie' ? 'zleceniodawcy (albo do ZUS, jeśli zleceniodawca nie wypłaca zasiłków)' : 'ZUS';

	switch (benefit) {
		case 'ciaza': {
			const steps: Step[] = [
				{
					title: 'Wizyta u lekarza',
					body: 'Jeśli stan zdrowia nie pozwala Ci pracować, lekarz wystawi e-ZLA z kodem „B” (ciąża). Zaświadczenie samo trafi do ZUS i do płatnika – nie musisz go nigdzie zanosić.',
					docs: ['e-ZLA']
				},
				employee
					? {
							title: 'Poinformuj pracodawcę o nieobecności',
							body: 'Zrób to niezwłocznie, zgodnie z zasadami usprawiedliwiania nieobecności w pracy.'
						}
					: {
							title: 'Nie wykonuj pracy w czasie zwolnienia',
							body: 'Zasiłek przysługuje tylko wtedy, gdy w okresie zwolnienia powstrzymujesz się od pracy zarobkowej.'
						}
			];
			if (employment === 'dzialalnosc') {
				steps.push(settlementStep(employment, payer, ['ZAS-53']));
			} else {
				steps.push({
					...settlementStep(employment, payer, []),
					docs: payer === 'powyzej-20' ? [] : [employee ? 'Z-3' : 'Z-3a', ...(employee ? (['ZAS-12'] as DocKey[]) : [])]
				});
			}
			return {
				payer: info,
				steps,
				attachments: [],
				filesWithZus,
				deadlines: [
					{ value: '100%', label: 'podstawy zasiłku', note: 'Gdy e-ZLA ma kod „B”.' },
					{ value: '270 dni', label: 'maksymalny okres zasiłkowy w ciąży' },
					{
						value: employment === 'umowa-o-prace' ? '30 dni' : '90 dni',
						label: 'ubezpieczenia przed prawem do zasiłku',
						note: employment === 'umowa-o-prace' ? 'Nieprzerwanego – ubezpieczenie obowiązkowe.' : 'Ubezpieczenie dobrowolne.'
					},
					PRESCRIPTION
				]
			};
		}

		case 'macierzynski': {
			const steps: Step[] = [
				{
					title: 'Przed porodem (jeśli chcesz)',
					body: 'Urlop macierzyński możesz zacząć maksymalnie 6 tygodni przed przewidywaną datą porodu. Możesz też pracować do porodu.',
					docs: employee ? ['zaswiadczenie-termin-porodu', 'wniosek-urlop'] : ['zaswiadczenie-termin-porodu']
				},
				employee
					? {
							title: 'Po porodzie złóż wniosek u pracodawcy',
							body: 'Wniosek o urlop macierzyński. Jeśli zaraz po nim chcesz wziąć urlop rodzicielski, wystarczy jeden wspólny wniosek.',
							docs: ['wniosek-urlop', 'akt-urodzenia']
						}
					: {
							title: `Złóż wniosek ZAM do ${submitTo}`,
							body: 'Nie dostajesz urlopu, ale przysługuje Ci zasiłek za okres odpowiadający urlopowi macierzyńskiemu i rodzicielskiemu.',
							docs: ['ZAM', 'akt-urodzenia']
						},
				{
					title: 'Zdecyduj o stawce w ciągu 21 dni',
					body: 'Jeśli w ciągu 21 dni po porodzie złożysz wniosek o zasiłek za cały urlop macierzyński i rodzicielski, dostaniesz 81,5% podstawy przez cały okres. W przeciwnym razie: 100% za urlop macierzyński i 70% za rodzicielski.'
				},
				settlementStep(employment, payer, employee ? [] : ['ZAM'])
			];
			return {
				payer: info,
				steps,
				filesWithZus,
				attachments: [
					{ doc: 'za-zyciem', when: 'jeśli dziecko ma takie zaświadczenie – wydłuża urlop rodzicielski' },
					{ doc: 'szpital', when: 'przy wcześniaku lub hospitalizacji noworodka – uzupełniający urlop macierzyński' },
					{ doc: 'martwe-urodzenie', when: 'po stracie dziecka' }
				],
				deadlines: [
					{ value: '21 dni', label: 'po porodzie na wniosek o 81,5%' },
					{ value: '6 tygodni', label: 'przed porodem – najwcześniejszy start urlopu' },
					{ value: '14 tygodni', label: 'po porodzie matka wykorzystuje osobiście', note: 'Dalszą część urlopu macierzyńskiego może przejąć ojciec.' },
					PRESCRIPTION
				]
			};
		}

		case 'ojcowski': {
			const steps: Step[] = employee
				? [
						{
							title: 'Złóż wniosek o urlop ojcowski',
							body: 'U pracodawcy, co najmniej 7 dni przed planowanym rozpoczęciem urlopu. Możesz go wziąć w całości albo w dwóch częściach po co najmniej 7 dni.',
							docs: ['wniosek-urlop']
						},
						{ title: 'Złóż wniosek o zasiłek', body: 'Wniosek ZAM obejmuje także zasiłek za urlop ojcowski.', docs: ['ZAM', 'akt-urodzenia'] },
						settlementStep(employment, payer, [])
					]
				: [
						{
							title: `Złóż wniosek ZAM do ${submitTo}`,
							body: 'Nie dostajesz urlopu, ale przysługuje Ci zasiłek za okres odpowiadający urlopowi ojcowskiemu.',
							docs: ['ZAM', 'akt-urodzenia']
						},
						settlementStep(employment, payer, ['ZAM'])
					];
			return {
				payer: info,
				steps,
				filesWithZus,
				attachments: [],
				deadlines: [
					{ value: '2 tygodnie', label: 'urlopu ojcowskiego', note: 'Liczba dzieci nie wydłuża urlopu.' },
					...(employee ? [{ value: '7 dni', label: 'przed urlopem na złożenie wniosku' }] : []),
					{
						value: '12 miesięcy',
						label: 'życia dziecka na wykorzystanie',
						note: 'Przy adopcji: 12 miesięcy od uprawomocnienia przysposobienia, nie dłużej niż do 14. roku życia dziecka.'
					},
					{ value: '100%', label: 'podstawy zasiłku' }
				]
			};
		}

		case 'rodzicielski': {
			const steps: Step[] = employee
				? [
						{
							title: 'Złóż wniosek o urlop rodzicielski',
							body: 'U pracodawcy, co najmniej 21 dni przed rozpoczęciem urlopu (chyba że składasz go razem z wnioskiem o urlop macierzyński). Urlop można podzielić na maksymalnie 5 części.',
							docs: ['wniosek-urlop']
						},
						{
							title: 'Chcesz łączyć urlop z pracą?',
							body: 'Możesz pracować u tego samego pracodawcy maksymalnie na pół etatu. Urlop wydłuża się wtedy proporcjonalnie, a zasiłek przysługuje także za wydłużony okres.'
						},
						{ title: 'Złóż wniosek o zasiłek', body: 'Wniosek ZAM obejmuje także zasiłek za urlop rodzicielski.', docs: ['ZAM'] },
						settlementStep(employment, payer, [])
					]
				: [
						{
							title: `Złóż wniosek ZAM do ${submitTo}`,
							body: 'Nie dostajesz urlopu, ale przysługuje Ci zasiłek za okres odpowiadający urlopowi rodzicielskiemu.',
							docs: ['ZAM']
						},
						settlementStep(employment, payer, ['ZAM'])
					];
			return {
				payer: info,
				steps,
				filesWithZus,
				attachments: [{ doc: 'za-zyciem', when: 'jeśli dziecko ma takie zaświadczenie – dłuższy urlop' }],
				deadlines: [
					{ value: '41 / 43 tyg.', label: 'urlopu rodzicielskiego', note: 'Przy jednym / więcej niż jednym dziecku. 9 tygodni przysługuje wyłącznie każdemu z rodziców.' },
					...(employee ? [{ value: '21 dni', label: 'przed urlopem na złożenie wniosku' }] : []),
					{ value: '6 lat', label: 'do końca roku, w którym dziecko je kończy', note: 'Do tego czasu trzeba wykorzystać urlop.' },
					{ value: '70%', label: 'podstawy zasiłku', note: 'Albo 81,5%, jeśli matka złożyła wniosek w ciągu 21 dni po porodzie.' }
				]
			};
		}

		case 'adopcja': {
			const steps: Step[] = [
				employee
					? {
							title: 'Złóż wniosek o urlop na warunkach urlopu macierzyńskiego',
							body: 'U pracodawcy, po przyjęciu dziecka na wychowanie. To odpowiednik urlopu macierzyńskiego.',
							docs: ['wniosek-urlop', 'sad']
						}
					: {
							title: `Złóż wniosek ZAM do ${submitTo}`,
							body: 'Przysługuje Ci zasiłek za okres odpowiadający urlopowi na warunkach urlopu macierzyńskiego.',
							docs: ['ZAM', 'sad']
						},
				{
					title: 'Potem urlop rodzicielski',
					body: 'Po urlopie na warunkach macierzyńskiego przysługuje urlop rodzicielski – na takich zasadach jak po urodzeniu dziecka, z uwzględnieniem jego wieku.',
					docs: employee ? ['wniosek-urlop', 'ZAM'] : ['ZAM']
				},
				settlementStep(employment, payer, employee ? [] : ['ZAM'])
			];
			return {
				payer: info,
				steps,
				filesWithZus,
				attachments: [],
				deadlines: [
					{ value: '14 lat', label: 'dziecka – przy przysposobieniu', note: 'Do tego wieku przysługuje urlop na warunkach urlopu macierzyńskiego.' },
					{ value: '7 lat', label: 'dziecka – rodzina zastępcza', note: '10 lat przy odroczonym obowiązku szkolnym.' },
					{ value: '100%', label: 'podstawy zasiłku za urlop na warunkach macierzyńskiego' },
					PRESCRIPTION
				]
			};
		}
	}
}

/* ------------------------------------------------------------------ */
/*  Filing channels and official links                                 */
/* ------------------------------------------------------------------ */

export const ZUS_CHANNELS = [
	{ title: 'Przez internet – PUE/eZUS', body: 'Najszybciej. Zalogujesz się m.in. przez mObywatela, profil zaufany lub bankowość elektroniczną.' },
	{ title: 'W placówce ZUS', body: 'Osobiście, w dowolnej placówce ZUS.' },
	{ title: 'Pocztą', body: 'Listem do placówki ZUS.' }
];

export const OFFICIAL_LINKS = [
	{ label: 'Wzory formularzy ZUS (Zasiłki)', href: 'https://www.zus.pl' },
	{ label: 'Odpis aktu urodzenia online – gov.pl', href: 'https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego' },
	{ label: 'Urlop rodzicielski – Ministerstwo Rodziny', href: 'https://www.gov.pl/web/rodzina/urlop-rodzicielski' },
	{ label: 'Rodzicielstwo – Państwowa Inspekcja Pracy', href: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo' }
];
