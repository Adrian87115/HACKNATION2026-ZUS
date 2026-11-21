/**
 * Where to get help – public institutions and NGOs for (future) parents.
 *
 * Every phone number and address below was checked on the organisation's own website on 2026-11-21
 * (`source` = the page where it was confirmed). Entries whose details could not be confirmed were left out.
 * When updating: re-check the source page and change VERIFIED_AT.
 */

export const VERIFIED_AT = '2026-11-21';

export type SupportTopic = 'zus' | 'praca' | 'dzialalnosc' | 'ciaza' | 'wczesniak' | 'strata' | 'kryzys';

export const SUPPORT_TOPICS: { value: SupportTopic; label: string; hint: string }[] = [
	{ value: 'zus', label: 'Zasiłki i składki', hint: 'pytania do ZUS, odwołania' },
	{ value: 'praca', label: 'Prawa pracownika', hint: 'ochrona ciąży, urlopy, zwolnienie' },
	{ value: 'dzialalnosc', label: 'Własna działalność', hint: 'zaległości, spory z ZUS' },
	{ value: 'ciaza', label: 'Ciąża i poród', hint: 'prawa pacjentki, opieka' },
	{ value: 'wczesniak', label: 'Wcześniak lub chore dziecko', hint: 'wsparcie i świadczenia' },
	{ value: 'strata', label: 'Strata dziecka', hint: 'żałoba, formalności' },
	{ value: 'kryzys', label: 'Kryzys i przemoc', hint: 'pomoc psychologiczna' }
];

export type SupportOrganization = {
	name: string;
	kind: 'instytucja publiczna' | 'organizacja pozarządowa';
	description: string;
	topics: SupportTopic[];
	phone?: { number: string; note?: string };
	email?: string;
	url: string;
	/** Page where the contact details were confirmed. */
	source: string;
	free?: boolean;
};

export const SUPPORT_ORGANIZATIONS: SupportOrganization[] = [
	{
		name: 'ZUS – Centrum Obsługi Telefonicznej',
		kind: 'instytucja publiczna',
		description: 'Pytania o zasiłki, składki, status wniosku i konto na PUE/eZUS. Można też umówić e-wizytę z ekspertem.',
		topics: ['zus', 'dzialalnosc'],
		phone: { number: '22 560 16 00' },
		url: 'https://www.zus.pl/o-zus/kontakt/centrum-obslugi-telefonicznej-cot-',
		source: 'https://www.zus.pl/o-zus/kontakt/centrum-obslugi-telefonicznej-cot-'
	},
	{
		name: 'Nieodpłatna pomoc prawna',
		kind: 'instytucja publiczna',
		description:
			'Państwowy system bezpłatnych porad prawnych i obywatelskich w każdym powiecie – także przy odwołaniu od decyzji ZUS czy sporze z pracodawcą.',
		topics: ['zus', 'praca', 'dzialalnosc'],
		url: 'https://www.gov.pl/web/nieodplatna-pomoc',
		source: 'https://www.gov.pl/web/nieodplatna-pomoc',
		free: true
	},
	{
		name: 'Państwowa Inspekcja Pracy – porady prawne',
		kind: 'instytucja publiczna',
		description: 'Bezpłatne porady z prawa pracy: ochrona kobiet w ciąży, urlopy rodzicielskie, przedłużenie umowy do dnia porodu.',
		topics: ['praca'],
		url: 'https://www.gov.pl/web/pip/porady-prawne',
		source: 'https://www.gov.pl/web/pip/porady-prawne',
		free: true
	},
	{
		name: 'Rzecznik Małych i Średnich Przedsiębiorców',
		kind: 'instytucja publiczna',
		description: 'Pomoc przedsiębiorcom w sporach z urzędami, w tym z ZUS – np. przy zaległościach w składkach.',
		topics: ['dzialalnosc'],
		phone: { number: '22 123 70 70' },
		url: 'https://rzecznikmsp.gov.pl',
		source: 'https://rzecznikmsp.gov.pl/kontakt/'
	},
	{
		name: 'Rzecznik Praw Pacjenta',
		kind: 'instytucja publiczna',
		description: 'Bezpłatna infolinia w sprawach praw pacjentki – opieka w ciąży, przy porodzie i po stracie dziecka.',
		topics: ['ciaza', 'strata'],
		phone: { number: '800 190 590', note: 'w dni robocze' },
		url: 'https://www.gov.pl/web/rpp',
		source: 'https://www.gov.pl/web/rpp',
		free: true
	},
	{
		name: 'Program „Za życiem” – jednorazowe świadczenie 4000 zł',
		kind: 'instytucja publiczna',
		description: 'Świadczenie z tytułu urodzenia ciężko i nieodwracalnie upośledzonego lub chorego dziecka; wniosek w gminie.',
		topics: ['wczesniak'],
		url: 'https://www.gov.pl/web/rodzina/program-za-zyciem',
		source: 'https://www.gov.pl/web/rodzina/program-za-zyciem'
	},
	{
		name: 'Rzecznik Praw Dziecka – Telefon Zaufania',
		kind: 'instytucja publiczna',
		description: 'Bezpłatny telefon dla dzieci i dorosłych w sprawach praw i bezpieczeństwa dziecka.',
		topics: ['kryzys'],
		phone: { number: '800 12 12 12' },
		url: 'https://brpd.gov.pl',
		source: 'https://brpd.gov.pl',
		free: true
	},
	{
		name: 'Fundacja Rodzić po Ludzku',
		kind: 'organizacja pozarządowa',
		description: 'Prawa kobiet w ciąży, przy porodzie i po porodzie – bezpłatne porady prawne, wzory pism, zgłaszanie naruszeń.',
		topics: ['ciaza', 'strata'],
		url: 'https://rodzicpoludzku.pl/twoje-prawa/uzyskaj-porade-prawna/',
		source: 'https://rodzicpoludzku.pl',
		free: true
	},
	{
		name: 'Fundacja Ernesta',
		kind: 'organizacja pozarządowa',
		description: 'Wsparcie dla rodziców w ciąży i po porodzie: psycholog, prawnik, diagnostyka, pomoc rodzicom wcześniaków.',
		topics: ['ciaza', 'wczesniak', 'strata'],
		phone: { number: '22 350 00 50' },
		email: 'biuro@fundacjaernesta.pl',
		url: 'https://fundacjaernesta.pl',
		source: 'https://fundacjaernesta.pl'
	},
	{
		name: 'Fundacja Wcześniak Rodzice–Rodzicom',
		kind: 'organizacja pozarządowa',
		description: 'Organizacja rodziców wcześniaków: „Niezbędnik rodzica wcześniaka”, subkonta na leczenie, wypożyczalnia sprzętu.',
		topics: ['wczesniak'],
		phone: { number: '22 121 80 55' },
		url: 'https://wczesniak.pl',
		source: 'https://wczesniak.pl'
	},
	{
		name: 'Koalicja dla Wcześniaka',
		kind: 'organizacja pozarządowa',
		description: 'Poradniki dla rodziców wcześniaków – pierwsze dni na oddziale, zdrowie i opieka w domu.',
		topics: ['wczesniak'],
		url: 'https://koalicjadlawczesniaka.pl',
		source: 'https://koalicjadlawczesniaka.pl'
	},
	{
		name: 'Fundacja Nagle Sami – Telefon Wsparcia',
		kind: 'organizacja pozarządowa',
		description: 'Bezpłatny telefon i konsultacje dla osób w żałobie, także po stracie dziecka.',
		topics: ['strata', 'kryzys'],
		phone: { number: '800 108 108' },
		url: 'https://naglesami.org.pl',
		source: 'https://naglesami.org.pl',
		free: true
	},
	{
		name: 'Centrum Wsparcia dla osób w stanie kryzysu psychicznego',
		kind: 'organizacja pozarządowa',
		description: 'Bezpłatna pomoc psychologiczna przez telefon, czat i e-mail dla osób w kryzysie psychicznym.',
		topics: ['kryzys'],
		phone: { number: '800 70 2222' },
		url: 'https://centrumwsparcia.pl',
		source: 'https://centrumwsparcia.pl',
		free: true
	},
	{
		name: 'Fundacja Centrum Praw Kobiet',
		kind: 'organizacja pozarządowa',
		description: 'Pomoc psychologiczna, prawna i telefoniczna dla kobiet – m.in. przy przemocy i dyskryminacji w pracy.',
		topics: ['kryzys', 'praca'],
		phone: { number: '800 107 777', note: 'pn.–pt. 9–17' },
		email: 'sekretariat@cpk.org.pl',
		url: 'https://cpk.org.pl',
		source: 'https://cpk.org.pl'
	},
	{
		name: 'Fundacja Dajemy Dzieciom Siłę – telefon dla rodziców',
		kind: 'organizacja pozarządowa',
		description: 'Bezpłatny telefon dla rodziców i nauczycieli w sprawach bezpieczeństwa dzieci.',
		topics: ['kryzys'],
		phone: { number: '800 100 100' },
		url: 'https://800100100.pl',
		source: 'https://fdds.pl',
		free: true
	}
];
