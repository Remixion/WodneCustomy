// Domyślny adres URL Apps Script - używany, gdy w localStorage przeglądarki
// (zakładka Ustawienia) nie ma zapisanego innego adresu, np. w trybie
// incognito, gdzie localStorage zawsze zaczyna puste. To NIE jest sekret:
// wdrożenie ma "Dostęp: Każdy" wyłącznie dla odczytu (doGet) - edycja danych
// (doPost) i tak wymaga osobnego SHARED_SECRET, którego tu celowo nie ma.
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyjXHV0IqOhQxuN1o5i26e3jzQc6rWWTJvZN71hme2ki2v9fPvXeU2DGLOf-Kl8XMZHKQ/exec';
