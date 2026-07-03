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

### Import meczów rozegranych pod nieobecność apki

Jeśli apka nie była uruchomiona w chwili zakończenia gry (np. nie było Cię
wtedy przy komputerze), zakładka **Mecze** oferuje dwa sposoby na
doimportowanie takiego meczu:

1. **Import z historii klienta League** (zalecane, pełne dane) - przycisk
   "Wczytaj ostatnie mecze z klienta" pokazuje listę Twoich ostatnich gier
   zapisanych lokalnie przez sam klient League (dotyczy też meczów sprzed
   wielu miesięcy) - wystarczy kliknąć "Importuj" przy wybranym meczu, żeby
   pobrać dokładnie te same, pełne dane co przy automatycznym
   przechwytywaniu. Wymaga uruchomionego i zalogowanego klienta League.
2. **Import z pliku .rofl** - przycisk "Wybierz plik(i) .rofl" pozwala
   wskazać zapisane repliki z folderu `Replays` klienta League. Uwaga: sam
   plik `.rofl` **od patcha 13.20 nie zawiera już szczegółowych statystyk
   graczy** - to potwierdzony, zgłoszony i nigdy niezałatany błąd po stronie
   Riota ([RiotGames/developer-relations#831](https://github.com/RiotGames/developer-relations/issues/831)).
   Dlatego import korzysta z identyfikatora gry zawartego w nazwie pliku
   (np. `EUN1-3880767863.rofl`) i pobiera pełne dane tym samym sposobem co
   punkt 1 powyżej - o ile klient League jest uruchomiony i ma dostęp do
   historii tej gry. Jeśli się nie uda, zapisany zostanie tylko podstawowy,
   pusty wpis (identyfikator gry) do ręcznego uzupełnienia albo ponownej
   próby przez import z historii klienta.

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
  po każdym meczu: **nick** (ogólna, dowolna nazwa gracza - nie musi być tym
  samym co nazwa w League of Legends), **color** (opcjonalny własny kolor
  hex nicku - jeśli pusty, kolor jest przydzielany automatycznie z palety na
  podstawie `puuid`), **avatarSource** (`lol` albo `discord` - wybór
  domyślnego źródła awatara), **discordNick** (nazwa użytkownika/nick na
  Discordzie, używana przez bota do dopasowania gracza), **discordUserId** /
  **discordAvatarHash** / **discordAvatarUrl** (dane avataru z Discorda,
  patrz sekcja "Drugie źródło awatarów" niżej), nazwa przywoływacza, poziom
  konta, ranga solo/flex (tier, dywizja, LP, bilans W/L), TOP 3 najbardziej
  opanowanych bohaterów wraz z punktami mistrzostwa, łączny wynik
  mistrzostwa, notatki.

Ręcznie wpisane pola (`notes`, `nick`, `color`, `avatarSource`, `discordNick`)
nigdy nie są nadpisywane przez automatyczną synchronizację danych z gry.

## Zakładka Statystyki

Zarówno strona GitHub Pages, jak i apka desktopowa, mają zakładkę
**Statystyki** licząca się na bieżąco z zebranych meczów:

- **Statystyki ogólne** - liczba meczów, łączny i średni czas gry, najdłuższy/
  najkrótszy mecz, bilans zwycięstw drużyny niebieskiej vs czerwonej,
  najczęściej wybierany i banowany champion, łączna liczba zabójstw i
  Pentakilli.
- **Rankingi** - listy TOP 10 graczy według: liczby zwycięstw, % wygranych
  (min. 3 gry), liczby rozegranych gier, średniego KDA, łącznych zabójstw i
  asyst, średnich obrażeń zadanych bohaterom, średniego Vision Score,
  Pentakilli oraz pierwszych krwi.
- **Statystyki indywidualne** - jedna zbiorcza tabela na gracza z pełnym
  zestawem uśrednionych i sumarycznych statystyk oraz ulubionym championem i
  rolą.

Wszędzie tam, gdzie wyświetlane jest imię gracza, pierwszeństwo ma **nick**
(jeśli ustawiony w zakładce Gracze), w przeciwnym razie używana jest nazwa
przywoływacza z League of Legends.

## Zakładka Profile

Zakładka **Profile** pozwala wybrać konkretnego gracza z listy (z awatarem i
kolorowym nickiem) i zobaczyć jego pełny profil:

- awatar - z League of Legends (Data Dragon, na podstawie `profileIconId`) albo
  z Discorda, zależnie od wybranego domyślnego źródła (patrz niżej),
- kolorowy nick (patrz sekcja "Kolor gracza" niżej),
- nazwa przywoływacza, poziom konta, ranga Solo/Duo i Flex,
- zbiorcze statystyki: liczba gier, bilans W/L, średnie KDA, ulubiony
  champion i rola,
- tabela ostatnich 10 rozegranych meczów tego gracza (data, champion, wynik,
  K/D/A, KDA, CS, obrażenia) z linkiem do pełnych szczegółów meczu.

### Drugie źródło awatarów - Discord

Apka desktopowa potrafi pobrać avatary z Discorda jako alternatywę dla ikony
profilu z League of Legends, na dwa sposoby.

#### Sposób A: każdy gracz samodzielnie (bez bota)

1. Załóż darmową aplikację na [discord.com/developers/applications](https://discord.com/developers/applications)
   ("New Application", dowolna nazwa) - nie trzeba dodawać bota ani niczego
   konfigurować, potrzebny jest tylko **Application ID** ze strony "General
   Information" (to jest Twój `discordClientId`).
2. W apce desktopowej, w zakładce **Ustawienia**, wklej ten identyfikator w
   polu Discord Client ID i zapisz.
3. Upewnij się, że desktopowy klient Discord jest uruchomiony i zalogowany, a
   klient League of Legends jest uruchomiony i zalogowany.
4. Kliknij **Połącz z Discordem i zapisz mój avatar** - aplikacja połączy się
   z Discordem lokalnie (bez okna logowania - to podstawowa informacja o
   koncie, tak jak przy standardowej integracji Rich Presence w grach),
   odczyta Twój avatar oraz dopasuje go do Twojego gracza League (po
   `puuid` aktualnie zalogowanego konta) i zsynchronizuje z Arkuszem.
5. Każdy gracz w drużynie powtarza ten krok na swoim komputerze, żeby jego
   avatar Discorda pojawił się w danych współdzielonych przez wszystkich.

#### Sposób B: bot serwera (jedna osoba pobiera awatary dla wszystkich)

Jeśli macie wspólny serwer Discord, jedna osoba może pobrać awatary całej
drużyny naraz, bez potrzeby uruchamiania czegokolwiek przez pozostałych
graczy:

1. W tej samej aplikacji na [discord.com/developers/applications](https://discord.com/developers/applications)
   (tej samej co w Sposobie A lub nowej) wejdź w zakładkę **Bot** -> **Add Bot**.
2. Tam samo w zakładce **Bot** kliknij **Reset Token** / **Copy** i skopiuj
   **token bota** (traktuj go jak hasło - daje pełną kontrolę nad botem).
3. W tej samej zakładce włącz przełącznik **Server Members Intent**
   (sekcja "Privileged Gateway Intents") i zapisz zmiany - bez tego bot nie
   odczyta listy członków serwera.
4. Wejdź w zakładkę **OAuth2 -> URL Generator**, zaznacz scope **bot** (nie
   trzeba zaznaczać żadnych uprawnień), skopiuj wygenerowany link, otwórz go
   w przeglądarce i dodaj bota do swojego serwera.
5. Włącz w Discordzie **Tryb dewelopera** (Ustawienia -> Zaawansowane),
   kliknij prawym na ikonę swojego serwera -> **Kopiuj ID serwera** (to Twój
   Guild ID).
6. W apce desktopowej, w zakładce **Ustawienia**, wklej token bota oraz ID
   serwera i zapisz.
7. W zakładce **Gracze** wypełnij pole **discordNick** dla każdego gracza -
   jego nazwę użytkownika Discord albo nick na serwerze.
8. Kliknij **Pobierz avatary wszystkich graczy (bot)** - aplikacja pobierze
   listę członków serwera, dopasuje ich do graczy po `discordNick` i zapisze
   znalezione awatary (lokalnie i w Arkuszu) dla wszystkich naraz.

Niedopasowani gracze (literówka w `discordNick`, brak na serwerze) zostaną
wypisani w wyniku, żeby łatwo poprawić dane i spróbować ponownie.

#### Wspólne dla obu sposobów

W zakładce **Gracze** wybierz w polu **avatarSource** wartość `Discord` dla
graczy, u których avatar Discorda ma mieć pierwszeństwo przed ikoną profilu z
League (domyślnie brany jest avatar z League of Legends).

Obie funkcje działają wyłącznie w apce desktopowej (wymagają lokalnego
dostępu do Discorda przez IPC albo tokena bota, niedostępnych z poziomu
przeglądarki). Na stronie GitHub Pages oraz w apce desktopowej można też
**ręcznie** wkleić dowolny link do obrazka w polu **discordAvatarUrl** w
zakładce Gracze - to działa bez Discorda w ogóle, np. gdy ktoś nie chce
uruchamiać apki desktopowej ani zakładać bota.

### Kolor gracza

Każdy gracz ma przypisany indywidualny kolor, używany wszędzie tam, gdzie
wyświetlany jest jego nick (zakładki Profile, Statystyki, Gracze oraz widok
szczegółów meczu):

- domyślnie kolor jest przydzielany **automatycznie i deterministycznie** z
  ustalonej 20-kolorowej palety na podstawie `puuid` gracza - nie wymaga to
  żadnej konfiguracji i pozostaje stały między odświeżeniami,
  - własny kolor można nadpisać ręcznie w zakładce Gracze, wpisując kod hex
  (np. `#3498db`) w polu **color** - podobnie jak `nick`, jest on chroniony
  przed nadpisaniem przez automatyczną synchronizację.

Kolorowanie realizowane jest znacznikiem `<font color="...">` (a nie CSS),
zgodnie z założeniem czystego HTML w tym projekcie.

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
- **Token bota Discord daje pełną kontrolę nad botem** - traktuj go jak
  hasło: nie publikuj go, nie commituj, nie wysyłaj nikomu. Jest zapisywany
  wyłącznie lokalnie w konfiguracji apki desktopowej i nigdy nie jest
  synchronizowany do Arkusza ani nigdzie indziej.
- Strona i aplikacja nie używają żadnego CSS - wygląd celowo ogranicza się do
  czystej, semantycznej struktury HTML (tabele, listy definicji, formularze).
