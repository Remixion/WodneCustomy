// Domyślny adres URL Apps Script - używany, gdy w localStorage przeglądarki
// (zakładka Ustawienia) nie ma zapisanego innego adresu, np. w trybie
// incognito, gdzie localStorage zawsze zaczyna puste. To NIE jest sekret:
// wdrożenie ma "Dostęp: Każdy" wyłącznie dla odczytu (doGet) - edycja danych
// (doPost) i tak wymaga osobnego SHARED_SECRET, którego tu celowo nie ma.
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw46lv2KBChxFefh5NFLcflBqapn1o1-PcHSTSOMGu7-Wid1orq2xLbfPZHGUfv0PYSxA/exec';
