SKANER MECZOW WODNECUSTOMY - INSTRUKCJA
========================================

Co to robi
----------
Ten programik przeszukuje podany zakres numerow Game ID i sprawdza kazdy z
nich w Twoim kliencie League of Legends. Jesli w danym meczu bral udzial
Twoje konto (i byl to mecz custom), program pobiera PELNE dane tego meczu
(bohaterowie, statystyki, przedmioty, itd.) i zapisuje je do pliku .json.

Wymagania
---------
1. Zainstalowany Node.js - pobierz i zainstaluj z https://nodejs.org/
   (wystarczy wersja LTS, "Next -> Next -> Finish").
2. Uruchomiony i ZALOGOWANY klient League of Legends (nie musi byc w grze).

Jak uruchomic
--------------
1. Rozpakuj/skopiuj caly ten folder gdziekolwiek na dysku.
2. Otworz w nim terminal:
   - w Eksploratorze plikow wpisz w pasku adresu "cmd" i wcisnij Enter,
     ALBO kliknij prawym w tym folderze -> "Otworz w terminalu".
3. Wpisz:
     node scan.js
   i wcisnij Enter. Program zapyta o:
     - Game ID poczatkowe (od ktorego zaczac szukanie),
     - Game ID koncowe (do ktorego szukac).
   (Znasz w przyblizeniu numery swoich meczow z tego okresu? Podaj zakres,
   ktory je obejmuje - im wiekszy zakres, tym dluzej to potrwa.)

   Mozna tez podac wszystko od razu, bez pytan:
     node scan.js 3880000000 3880100000

	Zakresy do przeszukania:
	3881924791 - 3885104339     - 1 mecz
	3900382128 - 3901715273     - 3 mecze
	Dokładne ID:
	3953891156
	3953906018
	3954277573
	3954302604
	3973350541

4. Program bedzie pokazywal postep na biezaco. Kazdy znaleziony Twoj mecz
   custom zostanie od razu zapisany do pliku w podfolderze "output".
5. Moze to potrwac dlugo (nawet godziny) przy duzym zakresie - mozna
   bezpiecznie przerwac w dowolnym momencie (Ctrl+C w oknie terminala) -
   to co juz zdazylo sie znalezc zostalo juz zapisane w plikach, nic sie
   nie straci. Zeby kontynuowac dalej, uruchom ponownie z zakresem
   zaczynajacym sie od ID, na ktorym przerwales.

Co dalej
--------
Po zakonczeniu spakuj caly podfolder "output" (prawy klik -> Wyslij do ->
Folder skompresowany) i odeslij go z powrotem. Pliki .json z tego folderu
wystarczy wrzucic wprost do folderu z danymi glownej apki WodneCustomy
(ten sam, ktory jest wpisany w Ustawieniach jako "Folder z danymi",
podfolder "matches") - pojawia sie na liscie meczow automatycznie, bez
zadnego dodatkowego importu.

Czego to NIE robi
------------------
- Nie wysyla nigdzie danych samo z siebie (zero internetu poza samym
  klientem League) - dane trafiaja tylko do plikow na Twoim dysku.
- Nie znajdzie meczow, w ktorych Twoje konto nie bralo udzialu (to
  ograniczenie samego API klienta League, nie da sie tego obejsc).
- Nie zmienia niczego w Twoim koncie ani kliencie - tylko odczytuje historie.
