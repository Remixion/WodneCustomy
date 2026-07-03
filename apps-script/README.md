# Backend Google Apps Script

Ten skrypt zamienia Twój Arkusz Google w prosty serwer JSON, z którego korzysta
zarówno aplikacja desktopowa, jak i strona na GitHub Pages.

## 1. Utwórz arkusz

1. Utwórz nowy Arkusz Google (Google Sheets), np. `WodneCustomy - Dane`.
2. Nie musisz ręcznie tworzyć podarkuszy — skrypt sam utworzy `Matches`,
   `MatchPlayers` oraz `Players` wraz z nagłówkami kolumn przy pierwszym uruchomieniu.

## 2. Wklej skrypt

1. W arkuszu: **Rozszerzenia -> Apps Script**.
2. Usuń domyślną zawartość `Code.gs` i wklej zawartość pliku [`Code.gs`](./Code.gs) z tego repozytorium.
3. Kliknij ikonę ustawień projektu (koło zębate) i w sekcji **appsscript.json**
   (włącz widoczność pliku manifestu w ustawieniach projektu), wklej zawartość
   [`appsscript.json`](./appsscript.json) z tego repozytorium.

## 3. Ustaw sekret (token) zabezpieczający zapis

1. W edytorze Apps Script: **Ustawienia projektu -> Właściwości skryptu (Script properties)**.
2. Dodaj właściwość: `SHARED_SECRET` = dowolny długi losowy ciąg znaków (to będzie Twoje "hasło" do edycji danych).
3. Ten sam sekret wpiszesz później w apce desktopowej oraz w ustawieniach strony GitHub Pages.

Bez ustawionego `SHARED_SECRET` każdy z linkiem do API mógłby zapisywać dane —
zdecydowanie zalecane jest jego ustawienie.

## 4. (opcjonalnie) Przygotuj arkusze z góry

W edytorze Apps Script uruchom raz funkcję `setupSheets` (menu **Uruchom**),
aby od razu utworzyć podarkusze z nagłówkami przed pierwszym wdrożeniem.

## 5. Wdróż jako aplikację internetową

1. **Wdróż -> Nowe wdrożenie**.
2. Typ: **Aplikacja internetowa (Web app)**.
3. Wykonaj jako: **Ja (Twoje konto)**.
4. Dostęp mają: **Każdy (Anyone)**.
5. Kliknij **Wdróż**, zaakceptuj uprawnienia.
6. Skopiuj wygenerowany **URL aplikacji internetowej** (kończy się na `/exec`).

Ten URL oraz sekret z kroku 3 wklejasz:
- w apce desktopowej (`desktop-app`) w ekranie **Ustawienia**,
- na stronie GitHub Pages (`docs/settings.html`).

## Aktualizacja skryptu

Jeśli zmienisz `Code.gs`, użyj **Wdróż -> Zarządzaj wdrożeniami -> Edytuj (ikona ołówka) ->
Nowa wersja -> Wdróż**, aby zaktualizować działający URL bez zmiany adresu.

## Format danych

- `GET /exec` — zwraca `{ ok, data: { matches, matchPlayers, players, generatedAt } }`, publiczne (bez tokenu).
- `POST /exec` — wymaga `Content-Type: text/plain` z ciałem JSON
  `{ token, action, payload }`. Obsługiwane akcje: `syncMatch`, `syncPlayers`,
  `updateMatchField`, `updateMatchPlayerField`, `updatePlayerField`,
  `deleteMatch`, `deletePlayer`. Szczegóły w komentarzach `Code.gs`.
