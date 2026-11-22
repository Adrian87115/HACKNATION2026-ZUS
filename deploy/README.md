# Wdrożenie ZUSi

Dwie drogi:
- **[Własny komputer + tunel Cloudflare](#własny-komputer--tunel-cloudflare)** – za darmo, bez zakładania serwera; komputer musi być włączony.
- **[Serwer w chmurze](#oracle-cloud-always-free)** (Oracle Cloud lub dowolny inny VPS z Ubuntu) – działa niezależnie od Twojego komputera.

## Własny komputer + tunel Cloudflare

Aplikacja działa w Dockerze na Twoim komputerze, a Cloudflare daje publiczny link `https://…`. Na komputerze nic nie trzeba otwierać w routerze ani zapory.

1. Zainstaluj **Docker Desktop** i **cloudflared**:

   ```bash
   brew install cloudflared            # macOS; Windows: winget install Cloudflare.cloudflared
   ```

2. Przygotuj konfigurację:

   ```bash
   cp .env.production.example .env.production
   ```

   W `.env.production` ustaw:
   - `DOMAIN=:80` – lokalnie zwykłe HTTP, HTTPS zapewnia tunel,
   - `SITE_URL` – publiczny link (na start może zostać przykładowy; zmienia tylko linki kanoniczne i podgląd w social media),
   - `OPEN_AI_KEY`, `ADMIN_TOKEN` (`openssl rand -hex 32`), `MINIO_ROOT_PASSWORD` (`openssl rand -hex 24`).

3. Uruchom aplikację (pierwsze budowanie trwa kilka minut):

   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
   ```

   Sprawdź: <http://localhost> powinno pokazać ZUSię.

4. Wystaw ją do internetu:

   ```bash
   cloudflared tunnel --url http://localhost:80
   ```

   W wyjściu pojawi się adres `https://<losowe-słowa>.trycloudflare.com` – to link dla jury. Zostaw to okno otwarte.

5. Komputer musi przez cały czas oceniania być **włączony, podłączony do prądu i do internetu**. Na macOS wyłącz usypianie:

   ```bash
   caffeinate -dims    # działa, dopóki okno terminala jest otwarte
   ```

### Stały adres zamiast losowego

Szybki tunel dostaje nowy adres przy każdym uruchomieniu `cloudflared` i nie ma gwarancji dostępności. Jeśli link ma się nie zmieniać:

- **Masz domenę** (może być tania, np. `.pl`/`.xyz`) dodaną do darmowego konta Cloudflare:

  ```bash
  cloudflared tunnel login
  cloudflared tunnel create zusia
  cloudflared tunnel route dns zusia zusia.twojadomena.pl
  cloudflared tunnel run --url http://localhost:80 zusia
  ```

  Wtedy ustaw `SITE_URL=https://zusia.twojadomena.pl` i przebuduj (`up -d --build`).
- **Bez domeny**: darmowe konto **ngrok** daje jeden stały adres `*.ngrok-free.app` (`ngrok http --url=<twoj-adres>.ngrok-free.app 80`), ale odwiedzający zobaczą najpierw ekran ostrzeżenia ngrok z przyciskiem „Visit Site”.

### Zatrzymanie i aktualizacja

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down      # stop (dane zostają)
git pull && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

---

## Oracle Cloud (Always Free)

Cała aplikacja działa na jednej darmowej maszynie wirtualnej w Dockerze:

| Kontener | Co robi |
|---|---|
| `web` | Caddy: HTTPS (Let's Encrypt), zbudowany frontend, przekierowanie `/api/zusia/*` → `zusia`, `/api/*` → `backend` |
| `backend` | NestJS: silnik zasiłków, PUE (symulacja), baza wiedzy, panel administratora |
| `zusia` | FastAPI: czat z OpenAI, serwer MCP, odczyt dokumentów sprawy |
| `minio` | prywatny magazyn na załączniki i dokumenty spraw (niewystawiony do internetu) |

Na świat otwarte są tylko porty 80 i 443.

## 1. Maszyna wirtualna

1. Załóż konto na <https://www.oracle.com/cloud/free/>. Potrzebna jest karta do weryfikacji; nic nie zostanie pobrane, dopóki nie przejdziesz na płatny plan.
2. **Compute → Instances → Create instance**:
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Ampere → VM.Standard.A1.Flex**, np. 2 OCPU i 12 GB RAM (darmowy limit to łącznie 4 OCPU i 24 GB).
   - Networking: zostaw domyślną nową sieć (VCN) z publicznym adresem IPv4.
   - SSH keys: wgraj swój klucz publiczny (`~/.ssh/id_ed25519.pub`).
   - Jeśli pojawi się „Out of capacity”, wybierz inną Availability Domain albo spróbuj za kilka minut.
3. Zapisz **publiczny adres IP** instancji.

## 2. Otwarcie portów 80 i 443

W Oracle trzeba to zrobić w dwóch miejscach.

1. **Konsola**: Instance → Subnet → Security List → **Add Ingress Rules**:
   - Source CIDR `0.0.0.0/0`, TCP, Destination port **80**.
   - To samo dla portu **443** (opcjonalnie też UDP 443 dla HTTP/3).
2. **Na maszynie** (Ubuntu w Oracle ma własne reguły iptables):

   ```bash
   ssh ubuntu@<IP>
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 3. Domena

- **Własna domena**: dodaj rekord **A** wskazujący na publiczny IP, np. `zusia.twojadomena.pl → <IP>`.
- **Za darmo**: <https://www.duckdns.org> – zaloguj się, utwórz np. `zusia-hacknation.duckdns.org` i wpisz IP.

Sprawdź, że `ping <domena>` pokazuje IP maszyny, zanim przejdziesz dalej. Caddy wystawia certyfikat dopiero, gdy domena wskazuje na serwer.

## 4. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker
docker compose version
```

## 5. Kod i konfiguracja

```bash
git clone https://github.com/Adrian87115/HACKNATION2026-ZUS.git zusia && cd zusia
cp .env.production.example .env.production
nano .env.production
```

Uzupełnij w `.env.production`:

- `DOMAIN` i `SITE_URL` – domena z kroku 3 (np. `zusia.twojadomena.pl` i `https://zusia.twojadomena.pl`),
- `OPEN_AI_KEY` – klucz OpenAI,
- `ADMIN_TOKEN` – `openssl rand -hex 32` (logowanie do `/admin`),
- `MINIO_ROOT_PASSWORD` – `openssl rand -hex 24`.

Plik `.env.production` jest w `.gitignore` – nie commituj go.

## 6. Start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
```

Pierwsze budowanie na ARM trwa kilka–kilkanaście minut. Gdy w logach `web` pojawi się `certificate obtained successfully`, aplikacja działa pod `https://<DOMAIN>`.

Szybki test:

```bash
curl https://<DOMAIN>/api/zusia/health   # {"status":"ok","assistant":true,...}
curl https://<DOMAIN>/api/features       # przełączniki funkcji
```

## Aktualizacja po zmianach w repo

```bash
cd ~/zusia && git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Dane (parametry z panelu admina, baza dokumentów, zapamiętane rozmowy, pliki w MinIO, certyfikaty) są w wolumenach Dockera i przetrwają aktualizację.

## Najczęstsze problemy

| Objaw | Co sprawdzić |
|---|---|
| Strona się nie otwiera / timeout | Porty 80/443 w Security List **i** w iptables (krok 2). |
| Caddy nie dostaje certyfikatu | Rekord A domeny wskazuje na IP serwera; port 80 jest otwarty. |
| ZUSia „niedostępna” | `docker compose ... logs zusia` – czy jest `OPEN_AI_KEY`. |
| Panel admina: „wyłączony” | Brak `ADMIN_TOKEN` w `.env.production` (po zmianie: `up -d`). |
| Mało RAM-u przy budowaniu | Daj instancji więcej pamięci (do 24 GB za darmo) albo dodaj swap. |
