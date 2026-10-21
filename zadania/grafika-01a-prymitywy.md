# Grafika Komputerowa – Zadanie 1a: Prymitywy graficzne oraz kanwa

**Status:** ✅ zrealizowane

## Treść zadania

- Rysowanie trzech prymitywów: **linii, prostokąta, okręgu**
  (zaimplementować samemu algorytm do rysowania linii/okręgu na liczbach
  całkowitych albo zmiennoprzecinkowych).
- Podawanie parametrów rysowania za pomocą **pola tekstowego**
  (wpisanie parametrów w pola tekstowe i zatwierdzenie przyciskiem).
- Rysowanie przy użyciu **myszy** (definiowanie punktów charakterystycznych kliknięciami).
- **Przesuwanie** przy użyciu myszy (uchwycenie np. za krawędź i przeciągnięcie).
- **Zmiana kształtu / rozmiaru** przy użyciu myszy (uchwycenie za punkty
  charakterystyczne i przeciągnięcie).
- **Zmiana kształtu / rozmiaru** przy użyciu pola tekstowego (zaznaczenie
  obiektu i modyfikacja jego parametrów przy użyciu pola tekstowego).

## Checklista wymagań

- [x] Linia – własny algorytm rasteryzacji
- [x] Prostokąt
- [x] Okrąg – własny algorytm rasteryzacji
- [x] Tworzenie obiektu z pól tekstowych + przycisk
- [x] Tworzenie obiektu kliknięciami myszy
- [x] Zaznaczanie obiektu (kliknięcie)
- [x] Przesuwanie obiektu myszą (przeciąganie)
- [x] Zmiana kształtu/rozmiaru myszą (uchwyty w punktach charakterystycznych)
- [x] Edycja parametrów zaznaczonego obiektu w polach tekstowych

## Analiza / decyzje

- **Rasteryzacja bez Canvas API do kształtów** – piksele wpisujemy do
  `Uint8ClampedArray`, potem jeden `putImageData`. Nie używamy `ctx.lineTo`,
  `ctx.arc`, `ctx.strokeRect`.
  - linia: algorytm **Bresenhama** (liczby całkowite, wszystkie oktanty),
  - okrąg: algorytm **midpoint (Bresenhama dla okręgu)** z symetrią 8-krotną,
  - prostokąt: 4 linie (lub poziome/pionowe odcinki wprost w buforze).
- **Model obiektowy (scena wektorowa)** – żeby obiekty dało się zaznaczać,
  przesuwać i edytować, trzymamy listę kształtów z parametrami
  (np. `{ type: 'line', x1, y1, x2, y2, color }`, `{ type: 'rect', x, y, w, h }`,
  `{ type: 'circle', cx, cy, r }`), a obraz rastrowy jest generowany z tej
  listy przy każdym przerysowaniu.
- **Punkty charakterystyczne / uchwyty**: linia – 2 końce; prostokąt – 4 rogi
  (lub 2 przeciwległe); okrąg – środek + punkt na obwodzie (promień).
- **Trafienie myszą (hit-testing)**: odległość punktu od odcinka / od krawędzi
  prostokąta / `|dist(środek) − r|` dla okręgu, z tolerancją kilku pikseli.
- **Współrzędne myszy**: przeliczenie `clientX/Y` na piksele kanwy przez
  `getBoundingClientRect()` i stosunek `canvas.width / rect.width`
  (kanwa może być skalowana przez CSS).
- Proponowane pliki: `js/shapes.js` (algorytmy rasteryzacji – czyste funkcje
  na buforze), `js/scene.js` (lista obiektów, hit-testing, uchwyty),
  `js/drawingTool.js` (obsługa myszy i paneli). Nowy panel w sidebarze.

## Ustalenia

- **Rysujemy na wczytanym obrazie** (ta sama kanwa co w biometrii).
  - Kształty to osobna warstwa wektorowa nad obrazem: obraz (`state.current`)
    pozostaje nietknięty, a wyświetlany jest obraz złożony = kopia bufora
    obrazu + zrasteryzowane kształty. Dzięki temu kształty da się dalej
    zaznaczać i edytować.
  - Operacje z biometrii (binaryzacja itd.) działają na warstwie obrazu;
    kształty zostają nad nim.
  - Przycisk „Spłaszcz” wtapia kształty w obraz (przez `setCurrent()`, więc
    można to cofnąć). Zapis PNG zapisuje obraz złożony (z kształtami).
  - Gdy obraz nie jest wczytany: przycisk „Nowa kanwa” tworzy pusty, biały
    obraz (np. 800×600), żeby dało się rysować bez wczytywania pliku.
- **Kolor kształtów** = aktywny kolor wybrany w selektorze z zadania 1b.
  Nowy kształt dostaje bieżący kolor; zaznaczony kształt można przekolorować
  przyciskiem „Użyj bieżącego koloru”. Do czasu realizacji 1b – domyślnie czarny.
- **Prostokąt** osiowo wyrównany (brak wymogu obrotu w treści zadania).

## Realizacja

| Element | Gdzie |
|---------|-------|
| Linia – Bresenham (całkowitoliczbowy, wszystkie oktanty) | `js/raster.js` – `drawLine` |
| Okrąg – midpoint z symetrią 8-krotną | `js/raster.js` – `drawCircle` |
| Prostokąt – 4 odcinki Bresenhama | `js/raster.js` – `drawRect` |
| Grubość linii – kwadratowy „pędzel” w każdym punkcie | `js/raster.js` – `createPlotter` |
| Model kształtów, uchwyty, trafienie myszą, kompozycja z obrazem | `js/shapes.js` |
| Rysowanie kliknięciami / przeciągnięciem, zaznaczanie, przesuwanie, uchwyty | `js/drawingTool.js` |
| Pola tekstowe: dodawanie nowego i edycja zaznaczonego | `js/shapeForm.js` |
| Historia Cofnij obejmuje obraz i kształty, „Spłaszcz”, „Nowa kanwa” | `js/main.js`, `js/imageIO.js` |

Obsługa:
- **Narzędzie Linia / Prostokąt / Okrąg** – dwa kliknięcia (punkty
  charakterystyczne) albo wciśnij–przeciągnij–puść; między kliknięciami
  widać podgląd. Esc anuluje.
- **Narzędzie Zaznacz** – klik w krawędź zaznacza kształt; przeciągnięcie
  krawędzi przesuwa, przeciągnięcie uchwytu (kwadracik) zmienia kształt/rozmiar
  (linia: końce, prostokąt: rogi – przeciwległy róg stoi w miejscu, okrąg:
  4 punkty na obwodzie zmieniają promień). Delete usuwa, Esc odznacza.
- **Pola tekstowe** – bez zaznaczenia: parametry nowego kształtu i „Dodaj”;
  z zaznaczeniem: parametry obiektu, „Zastosuj zmiany” (lub Enter),
  „Dodaj jako nowy” (kopia), „Nadaj bieżący styl” (kolor z panelu Kolor
  + grubość), „Usuń”.
- Współrzędne są ograniczone do ±20000 px, żeby wpisanie ogromnej liczby
  nie zawiesiło pętli rysującej (kształty mogą wychodzić poza obraz –
  piksele poza kanwą są pomijane).
- Uchwyty są rysowane tylko na ekranie – zapis PNG zawiera obraz z kształtami
  bez uchwytów.
