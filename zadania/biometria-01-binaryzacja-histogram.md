# Biometria – Zadanie 1: wczytywanie, binaryzacja, histogram

**Status:** ✅ zrealizowane

## Treść zadania

1. Wczytywanie, wyświetlanie i zapisywanie obrazu (10%)
2. Binaryzacja progowa obrazu (20%)
   - możliwość binaryzacji poszczególnych kanałów (R, G, B) oraz średniej kanałów (10%)
3. Wyświetlanie histogramu wczytanego obrazu (20%)
   - histogram każdego kanału osobno oraz ich średniej (10%)
4. Szybkość: na obrazie 512×512 brak widocznego opóźnienia po kliknięciu przycisku (15%)
5. Przejrzysty, przyjazny i profesjonalny interfejs, wykorzystywany w późniejszych zadaniach (15%)

## Realizacja

| Wymaganie | Gdzie |
|-----------|-------|
| 1. Wczytanie / wyświetlenie / zapis PNG | `js/imageIO.js` – `loadImageData`, `drawImageData`, `saveCanvasAsPng`; przyciski w `index.html` (topbar) |
| 2. Binaryzacja R / G / B / średnia | `js/imageProcessing.js` – `binarize(src, { channel, threshold })` (LUT 256 el., jedna pętla) |
| 3. Histogram R / G / B / średnia / wszystkie | `js/histogram.js` – `compute` (4 histogramy w jednej pętli), `draw` (ręcznie na Canvas, opcjonalna skala log.) |
| 4. Szybkość | jedna pętla po `Uint8ClampedArray`, LUT, histogram liczony raz na zmianę obrazu i buforowany; czas operacji na pasku statusu |
| 5. Interfejs | topbar + sidebar z panelami (`<section class="panel">`) + obszar roboczy + pasek statusu; Cofnij (10 kroków) i Przywróć oryginał |

## Uwagi

- Definicja średniej kanałów (`((R+G+B)/3) | 0`) jest wspólna dla binaryzacji i histogramu.
- Panel narzędzi jest gotowy do dokładania kolejnych sekcji w następnych zadaniach.
