# CLAUDE.md

Wskazówki dla Claude Code przy pracy w tym repozytorium.

## O projekcie

Edytor graficzny w przeglądarce, rozwijany na dwa przedmioty: **Biometria**
(histogram, binaryzacja, filtracja…) i **Grafika Komputerowa** (prymitywy,
przestrzenie barw…). Kolejne zadania rozbudowują tę samą aplikację.
Projekt zostanie później połączony z projektem drugiej osoby, która pisze w JS.

Treści zadań i ich status: folder [`zadania/`](zadania/README.md).
Przed realizacją zadania przeczytaj jego plik i zaktualizuj w nim status
oraz sekcję „Realizacja” po skończeniu.
Po zmianach w plikach JS zaktualizuj też `docs/pliki-js.md` i `docs/przewodnik-po-kodzie.md`.

## Styl pracy

- **Odpowiadaj po polsku** (rozmowa, komentarze w kodzie, opisy commitów).
- Użytkownik dobrze zna JS i C#, słabo C++, podstawowo Pythona, **nie zna Javy**.
  Porównania (jeśli pomagają) rób do C#.
- Do każdego nowego algorytmu / mniej oczywistej funkcji API dodawaj
  **wytłumaczenie edukacyjne**: w odpowiedzi oraz w `docs/przewodnik-po-kodzie.md`
  (jak działa algorytm, dlaczego tak, złożoność / optymalizacje).

## Decyzje techniczne

- HTML + CSS + **czysty JavaScript ES6+**. Bez TypeScript, bez bundlerów,
  bez npm, bez backendu (o ile użytkownik nie zdecyduje inaczej).
- Aplikacja musi działać po zwykłym otwarciu `index.html` z dysku (`file://`).
  Dlatego **nie używamy modułów ES** (`type="module"` jest blokowane przez CORS) –
  skrypty ładujemy klasycznymi `<script src>` w ustalonej kolejności.

## Zasady (wymagania prowadzącego)

- **Zakaz gotowych bibliotek do operacji na obrazie** – binaryzacja, histogram,
  filtry, konwersje kolorów, rysowanie prymitywów itd. piszemy sami.
- Z przeglądarki wolno używać tylko mechanizmów do wczytania, wyświetlenia
  i zapisu obrazu: `<input type="file">`, Canvas, `getImageData`/`putImageData`,
  `canvas.toBlob`.
- **Histogram rysujemy ręcznie na Canvas** – bez bibliotek do wykresów.
- Prymitywy graficzne (linia, okrąg…) rasteryzujemy **własnym algorytmem**
  (np. Bresenham / midpoint) przez wpisywanie pikseli do bufora –
  **nie** przez `ctx.lineTo`, `ctx.arc`, `ctx.strokeRect` itp.
  (Canvas 2D do rysowania UI/osi wykresu histogramu jest w porządku).
- Algorytmy piszemy od zera na tablicy pikseli `Uint8ClampedArray`, dbając
  o wydajność: **jedna pętla po buforze**, LUT tam, gdzie się da,
  bez odczytu/zapisu pojedynczych pikseli przez Canvas API.
- Wymóg szybkości: obraz 512×512 – brak widocznego opóźnienia po kliknięciu.

## Architektura

```
index.html              – układ UI: pasek zakładek (nav.tabbar) + sidebar z panelem aktywnej zakładki
                          i przypiętym histogramem + obszar roboczy
css/style.css           – style, ciemny motyw; wszystkie kolory jako zmienne w :root
js/imageIO.js           – wczytanie / wyświetlenie / zapis (BioEditor.ImageIO)
js/imageProcessing.js   – algorytmy na ImageData (BioEditor.ImageProcessing)
js/histogram.js         – liczenie i rysowanie histogramu (BioEditor.Histogram)
js/colorSpaces.js       – konwersje RGB/CMYK/HSV/HEX (BioEditor.ColorSpaces)
js/raster.js            – rasteryzacja: Bresenham, midpoint (BioEditor.Raster)
js/shapes.js            – model kształtów, uchwyty, hit-test, kompozycja (BioEditor.Shapes)
js/ui.js                – generyczne kontrolki DOM (BioEditor.UI)
js/colorPicker.js       – panel wyboru koloru (BioEditor.ColorPicker)
js/drawingTool.js       – mysz na kanwie: rysowanie/zaznaczanie (BioEditor.DrawingTool)
js/shapeForm.js         – pola tekstowe parametrów kształtu (BioEditor.ShapeForm)
js/main.js              – stan aplikacji, obsługa zdarzeń, „klej” (ładowany ostatni)
zadania/                – treści zadań, status, notatki z realizacji
docs/                   – dokumentacja kodu (pliki-js.md – skrót, przewodnik-po-kodzie.md – szczegóły)
```

### Konwencje modułów

- Każdy plik to IIFE `(function (global) { 'use strict'; ... })(window);`,
  eksportujący obiekt do wspólnej przestrzeni nazw `window.BioEditor`
  (`const BioEditor = (global.BioEditor = global.BioEditor || {});`).
  Nie twórz innych zmiennych globalnych – to ułatwi łączenie z drugim projektem.
- Nowy moduł = nowy plik w `js/` + `<script>` w `index.html` **przed** `main.js`.
- Rozdzielamy odpowiedzialności: algorytmy (bez DOM) / rysowanie / UI / stan.
- Funkcje przetwarzania obrazu:
  - nie dotykają DOM ani Canvas (dają się testować w Node),
  - są **czyste** – nie modyfikują wejściowego `ImageData`, zwracają nowy
    (na tym opiera się Cofnij / Przywróć oryginał w `main.js`),
  - przyjmują parametry jako obiekt opcji, np. `binarize(src, { channel, threshold })`.
- Dokument = warstwa obrazu (`state.current`) + lista kształtów wektorowych
  (`state.shapes`, obiekty niezmienne). Ekran i zapis PNG pokazują ich
  złożenie (`Shapes.composite`). Operacje z biometrii działają na warstwie
  obrazu. Stos Cofnij przechowuje pary `{ image, shapes }`.
- Operacje punktowe (rozciąganie, wyrównanie, jasność…) budują tablice LUT
  i wołają `ImageProcessing.applyLut` – jedna pętla po buforze.
- Nowa operacja na obrazie w `main.js`: `applyOperation(src => ..., 'opis')`
  (commit + render + czas na pasku statusu). Podgląd na żywo (suwaki) idzie
  przez `state.preview` – nie trafia do historii, `commit()` go odrzuca.
- Wyjątek od „czystości”: funkcje w `raster.js` rysują DO przekazanego bufora
  (modyfikują go) – wywoływać je tylko na kopii roboczej.
- Moduły bez DOM (`colorSpaces.js`, `raster.js`, `shapes.js`) eksportują do
  `window` albo `globalThis`, więc można je załadować w Node przez `require`.
- Kanały oznaczamy kluczami `'r' | 'g' | 'b' | 'avg'`; średnia to
  `((R + G + B) / 3) | 0` – ta sama definicja wszędzie.
- Nowa funkcja w UI = nowy przycisk zakładki w `<nav id="tool-tabs">` (`data-tab="nazwa"`,
  ikona SVG + krótki podpis) + `<section class="panel" data-tab-panel="nazwa" hidden>`
  w `.sidebar-content` (przełącza `UI.createTabs`). Kolory tylko przez zmienne CSS
  (`--panel`, `--accent`…; wykres histogramu czyta `--chart-*`). Panel z
  użyciem istniejących klas (`.field`, `.label`, `.segmented`, `.btn`, `.btn-primary`,
  `.btn-block`, `.input`, `.hint`, `.btn-row`). Akcje przetwarzające obraz idą przez `commit()` + `render()`
  + `updateControls()` i wypisują czas operacji na pasku statusu.
- **Pliki w `js/` są bez komentarzy** (decyzja użytkowniczki). Opisy funkcji
  i algorytmów trzymamy w `docs/`. Wersja z komentarzami JSDoc jest zachowana
  na gałęzi `archiwum/wersja-z-komentarzami-2026-10-24`.
- Nazwy identyfikatorów po angielsku (camelCase), teksty UI po polsku.

## Uruchamianie i testowanie

- Uruchomienie: otworzyć `index.html` w przeglądarce (bez serwera).
- Brak testów automatycznych i lintera. Weryfikacja ręczna w przeglądarce;
  czyste funkcje (`imageProcessing.js`, `colorSpaces.js`, `raster.js`,
  `shapes.js`) można dodatkowo sprawdzić w Node.
- Chromium + Playwright są dostępne w środowisku chmurowym, jeśli trzeba
  zrobić zrzut ekranu lub sprawdzić działanie.
