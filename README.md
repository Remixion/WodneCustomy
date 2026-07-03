# WodneCustomy

Śledzenie customowych gier 5 vs 5 League of Legends: dane pobierane są lokalnie
z klienta League (LCU), zapisywane lokalnie w plikach JSON oraz synchronizowane
z Arkuszem Google, a następnie prezentowane na stronie (może być hostowana na
GitHub Pages), gdzie można je również ręcznie edytować.

## Jak to działa (architektura)

Klient League of Legends (LCU) odpowiada wyłącznie na zapytania lokalne i
blokuje żądania z obcych stron internetowych (np. z `github.io`) ze względów
bezpieczeństwa. Dlatego całość składa się z trzech niezależnych części:

```
┌─────────────────────┐     LCU API (localhost)     ┌────────────────────┐
│  Klient League of    │◄────────────────────────────│  Apka desktopowa    │
│  Legends (LCU)        │───────────────────────────►│  (Electron,          │
└─────────────────────┘   dane meczu + graczy         │  desktop-app/)       │
                                                        └──────────┬──────────┘
                                                                   │ zapis lokalny (JSON)
                                                                   │ + synchronizacja
                                                                   ▼
                                                        ┌────────────────────┐
                                                        │  Arkusz Google       │
                                                        │  + Apps Script       │
                                                        │  (apps-script/)      │
                                                        └──────────┬──────────┘
                                                                   │ odczyt / zapis (JSON przez HTTP)
                                                                   ▼
                                                        ┌────────────────────┐
                                                        │  Strona WWW          │
                                                        │  (docs/, GitHub      │
                                                        │  Pages) - podgląd    │
                                                        │  i ręczna edycja     │
                                                        └────────────────────┘
```

- **`apps-script/`** - kod Google Apps Script wdrażany bezpośrednio w Twoim
  Arkuszu Google. Pełni rolę prostego API: `GET` zwraca wszystkie dane jako
  JSON, `POST` pozwala zapisywać/edytować dane (chronione sekretem).
- **`desktop-app/`** - aplikacja desktopowa (Electron) uruchamiana lokalnie na
  tym samym komputerze co klient League. Nasłuchuje zakończenia gry, pobiera
  pełne dane meczu i graczy z LCU, zapisuje je lokalnie (`data/`) i wysyła do
  Arkusza Google. Pozwala też ręcznie edytować dane offline.
- **`docs/`** - statyczna strona (czysty HTML/JS, bez CSS) do hostowania na
  GitHub Pages. Wyświetla dane pobrane z Arkusza Google (przez Apps Script) w
  eleganckiej, czytelnej strukturze i pozwala je ręcznie edytować bezpośrednio
  z przeglądarki.

## 1. Skonfiguruj Arkusz Google + Apps Script

Instrukcja krok po kroku: [`apps-script/README.md`](./apps-script/README.md).

W skrócie: tworzysz Arkusz Google, wklejasz `apps-script/Code.gs` w edytorze
Apps Script, ustawiasz sekret (`SHARED_SECRET`) i wdrażasz jako aplikację
internetową. Zapisujesz sobie wygenerowany URL (`.../exec`) oraz sekret.

## 2. Uruchom aplikację desktopową

```bash
cd desktop-app
npm install
npm start
```

Wymagany jest zainstalowany i uruchomiony klient League of Legends na tym
samym komputerze. Aplikacja automatycznie wykrywa lokalne dane uwierzytelniające
klienta (plik `lockfile`), łączy się z LCU i czeka na zakończenie gry.

Po pierwszym uruchomieniu przejdź do zakładki **Ustawienia** w aplikacji i
wklej:
- adres URL Apps Script (`.../exec`) z kroku 1,
- sekret (`SHARED_SECRET`) z kroku 1,
- opcjonalnie: własną ścieżkę do folderu na dane lokalne lub do pliku `lockfile`
  (jeśli klient League jest zainstalowany w niestandardowej lokalizacji, np. w
  środowisku Wine na Linuksie).

Po rozegraniu customowej gry 5 vs 5 dane zostaną automatycznie pobrane,
zapisane lokalnie w `desktop-app` (w katalogu danych aplikacji) oraz wysłane
do Arkusza Google (jeśli włączona jest automatyczna synchronizacja).

### Budowanie pliku instalacyjnego (.exe / .dmg / .AppImage)

```bash
cd desktop-app
npm run dist
```

## 3. Wystaw stronę na GitHub Pages

1. W ustawieniach repozytorium na GitHubie: **Settings -> Pages**.
2. Źródło: gałąź (branch), folder **`/docs`**.
3. Po chwili strona będzie dostępna pod adresem `https://<uzytkownik>.github.io/<repo>/`.
4. Wejdź na stronę, w zakładce **Ustawienia** wklej ten sam adres URL Apps
   Script oraz sekret co w apce desktopowej (zapisywane wyłącznie lokalnie w
   przeglądarce, w `localStorage`).

Strona działa też lokalnie bez GitHub Pages - wystarczy otworzyć pliki z
folderu `docs/` bezpośrednio w przeglądarce lub przez dowolny serwer
statyczny.

## Struktura danych

Dane trafiają do trzech podarkuszy w Arkuszu Google:

- **`Matches`** - jeden wiersz na mecz: data, tryb, mapa, kolejka, czas trwania,
  zwycięska drużyna, składy banów, statystyki celów drużynowych (smoki, baron,
  herald, wieże, inhibitory), notatki, oraz surowe dane JSON z LCU jako kopia
  zapasowa (`rawDataJson`).
- **`MatchPlayers`** - jeden wiersz na gracza w danym meczu: bohater, pozycja,
  przywoływacze, runy, poziom, KDA, CS, złoto, obrażenia, leczenie, vision
  score, wardy, przedmioty (0-6), pierwsza krew/wieża, wielokrotne zabójstwa,
  wynik (wygrana/przegrana), notatki.
- **`Players`** - jeden wiersz na unikalnego gracza (po `puuid`), aktualizowany
  po każdym meczu: poziom konta, ranga solo/flex (tier, dywizja, LP, bilans
  W/L), TOP 3 najbardziej opanowanych bohaterów wraz z punktami mistrzostwa,
  łączny wynik mistrzostwa, notatki.

Ręcznie wpisane notatki (`notes`) nigdy nie są nadpisywane przez automatyczną
synchronizację danych z gry.

## Uwagi i ograniczenia

- **LCU API jest nieoficjalne i niedokumentowane przez Riot Games** - część
  endpointów (szczególnie ranking i mistrzostwo championów dla graczy innych
  niż Ty) może nie działać na wszystkich wersjach klienta. Aplikacja obsługuje
  to w sposób odporny na błędy: brakujące dane zostają puste, a zbieranie
  meczu się nie przerywa.
- **Bezpieczeństwo edycji na stronie GitHub Pages**: zapis do Arkusza jest
  chroniony wyłącznie sekretem (`SHARED_SECRET`) wpisanym w ustawieniach -
  każdy, kto pozna URL Apps Script i sekret, może edytować dane. Traktuj
  sekret jak hasło i nie publikuj go.
- Strona i aplikacja nie używają żadnego CSS - wygląd celowo ogranicza się do
  czystej, semantycznej struktury HTML (tabele, listy definicji, formularze).
