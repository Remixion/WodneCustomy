// Domyślny adres URL Apps Script - używany, gdy w localStorage przeglądarki
// (zakładka Ustawienia) nie ma zapisanego innego adresu, np. w trybie
// incognito, gdzie localStorage zawsze zaczyna puste. To NIE jest sekret:
// wdrożenie ma "Dostęp: Każdy" wyłącznie dla odczytu (doGet) - edycja danych
// (doPost) i tak wymaga osobnego SHARED_SECRET, którego tu celowo nie ma.
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby-kP0361nLXZdaBn-7ocIkrPAr1t7K_cHpVLx4Y0pBVShgzwDzrCQQzdoVG3d7KoBRPA/exec';
