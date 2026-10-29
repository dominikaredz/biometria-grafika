# Grafika Komputerowa – Zadanie 2: filtry i morfologia

**Status:** ✅ zrealizowane

## Treść zadania

Aby projekt został oceniony maksymalnie, powinien posiadać następujące funkcjonalności:

- Wczytanie obrazu,
- Implementacja następujących filtrów oraz zaprezentowanie ich działania na wczytanym obrazie:
  1. Filtr wygładzający (uśredniający),
  2. Filtr medianowy,
  3. Filtr wykrywania krawędzi (Sobel),
  4. Dylatacja,
  5. Erozja.

Uwaga: w przypadku dylatacji i erozji pracujemy na obrazach binarnych. Użytkownik
ma móc zdefiniować własny element strukturyzujący (dowolnego rozmiaru).

Filtry należy zaimplementować samodzielnie – wykorzystanie bibliotek jest wykluczone.

## Stan przed realizacją

| Wymaganie | Stan |
|-----------|------|
| Wczytanie obrazu | ✅ było (`js/imageIO.js`, zadanie Biometria 1) |
| Obraz binarny do morfologii | ✅ było: binaryzacja progowa, Otsu (Biometria 1–2) |
| Filtr uśredniający, medianowy, Sobel | ❌ brak |
| Dylatacja, erozja, własny element strukturyzujący | ❌ brak |

## Checklista wymagań

- [x] Filtr uśredniający (okno 3–51, nieparzyste)
- [x] Filtr medianowy (okno 3–51, nieparzyste)
- [x] Sobel: |G|, Gx, Gy
- [x] Dylatacja
- [x] Erozja
- [x] Własny element strukturyzujący: rozmiar 1–31 × 1–31, gotowe kształty
  (kwadrat, krzyż, koło, pusty) i ręczne zaznaczanie pól myszą
- [x] Dodatkowo: otwarcie i zamknięcie

## Ustalenia

- **Brzegi obrazu:** w filtrach brakujących sąsiadów zastępuje najbliższy piksel
  brzegowy (powielenie brzegu). Dzięki temu okno ma zawsze pełny rozmiar i brzeg
  nie ciemnieje. W morfologii piksele spoza obrazu są pomijane.
- **Kanały:** filtr uśredniający i medianowy działają na każdym kanale R, G, B
  osobno, więc kolor zostaje zachowany. Sobel działa na obrazie szarości
  (średnia kanałów).
- **Morfologia** traktuje biały jako obiekt. Obraz, który nie jest binarny, jest
  najpierw progowany w połowie skali (średnia ≥ 128).
- **Element strukturyzujący:** środek elementu to pole (⌊w/2⌋, ⌊h/2⌋). Dylatacja
  używa elementu odbitego względem środka (definicja A ⊕ B = {a + b}), co ma
  znaczenie dla elementów niesymetrycznych.

## Algorytmy (skrót)

| Filtr | Idea | Koszt dla obrazu W×H i okna k×k |
|-------|------|---------------------------------|
| Uśredniający | rozdzielny: średnia w wierszach, potem w kolumnach; suma krocząca | O(W·H), niezależnie od k |
| Medianowy | algorytm Huanga: histogram okna aktualizowany przy przesunięciu | O(W·H·k) |
| Sobel | maski 3×3 Gx, Gy; \|G\| = √(Gx² + Gy²) | O(W·H) |
| Dylatacja / erozja | max / min po polach elementu, wcześniejsze wyjście z pętli | O(W·H·\|B\|) |

Szczegółowe opisy: `docs/przewodnik-po-kodzie.md`, sekcja o `filters.js`.

## Realizacja

| Element | Gdzie |
|---------|-------|
| Filtry i morfologia (algorytmy) | `js/filters.js` – `meanFilter`, `medianFilter`, `sobel`, `morphology`, `createStructuringElement` |
| Edytor elementu strukturyzującego | `js/structuringElementEditor.js` |
| Zakładki „Filtry” i „Morfologia” | `index.html`, obsługa w `js/main.js` |

Sprawdzenie:
- filtr uśredniający i medianowy porównane w Node z liczeniem „na piechotę”
  (sortowanie okna): mediana – 0 różnic, średnia – różnice < 0,5 (zaokrąglenie);
- czasy w przeglądarce dla obrazu 512×512: mediana 3×3 ≈ 35 ms, uśredniający 15×15
  ≈ 24 ms, Sobel ≈ 10 ms, dylatacja/erozja elementem 7×3 ≈ 14–22 ms.
