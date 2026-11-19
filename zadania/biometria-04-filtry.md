# Biometria – Zadanie 4: filtry splotowe, mediana, pikselizacja, Kuwahara, Predator

**Status:** ✅ zrealizowane (4 z 4 filtrów + maski dowolnego rozmiaru + Predator)

## Treść zadania

1. Zaimplementuj 3 algorytmy z 4 (90%, 3 × 30%):
   1. Filtry liniowe oparte o funkcję splotu (filtry konwolucyjne). Daj możliwość
      zmiany filtru na dowolny inny – przetestuj działanie na kilku standardowych
      operatorach: rozmyciu Gaussowskim, filtrze Prewitta, Sobela, Laplasjanach.
   2. Filtr medianowy.
   3. Pikselizacja.
   4. Filtr Kuwahara.
2. Dodaj obsługę masek o dowolnym rozmiarze dla filtru 2 lub 3 (10%).

Za implementację czwartego filtru można uzyskać dodatkowe 5 punktów.
Dodatkowo 10 punktów za filtr Predatora
([opis w GIMP](https://docs.gimp.org/2.4/en/script-fu-predator.html)) – nałożenie
na siebie w odpowiedniej kolejności: 1. pikselizacji, 2. MinRGB, 3. filtru Sobela.

## Stan przed realizacją

| Wymaganie | Stan |
|-----------|------|
| Filtr medianowy | ✅ częściowo – był w zadaniu Grafika 2, tylko z oknem kwadratowym nieparzystym (3–51) |
| Sobel (gotowy operator) | ✅ był w zadaniu Grafika 2 – jako stały filtr, nie jako dowolny splot |
| Splot z dowolną maską (Gauss, Prewitt, Laplasjany…) | ❌ brak |
| Pikselizacja | ❌ brak |
| Kuwahara | ❌ brak |
| Maski dowolnego rozmiaru dla mediany / pikselizacji | ❌ brak |
| Predator (pikselizacja, MinRGB, Sobel) | ❌ brak |

## Checklista wymagań

- [x] Splot z **dowolną maską** (pole tekstowe, do 51×51, także parzyste i prostokątne)
  oraz gotowe maski: uśredniający, **Gauss** (rozmiar i σ), **Prewitt** X/Y,
  **Sobel** X/Y, **Laplasjany** (4- i 8-sąsiedztwo, LoG), wyostrzanie, płaskorzeźba
- [x] Filtr medianowy
- [x] Pikselizacja
- [x] Filtr Kuwahary (czwarty filtr, +5 pkt)
- [x] Maski dowolnego rozmiaru: **mediana** w × h (1–51 × 1–51, także parzyste)
  i **pikselizacja** – blok w × h (1–256 × 1–256)
- [x] Filtr Predatora (+10 pkt)

## Ustalenia

- **Splot** liczony jest jako prawdziwy splot, czyli z odwróceniem maski
  (`I(x − i, y − j)`). Dla masek symetrycznych nie ma to znaczenia, a dla Sobela
  i Prewitta zmienia tylko znak wyniku.
- **Parametry splotu:**
  - **dzielnik** – domyślnie suma wag (1, gdy suma = 0),
  - **stała** – dodawana do wyniku,
  - **wartość bezwzględna** – włączana automatycznie dla detektorów krawędzi.
- **Brzegi:** brakujących sąsiadów zastępuje najbliższy piksel brzegowy.
- **Kanały:** wszystkie filtry działają na kanałach R, G, B osobno. Kuwahara
  wybiera kwadrat na podstawie wariancji jasności, a uśrednia kolor.
- **Predator:**
  - kolejność kroków jest wzięta z treści zadania;
  - MinRGB zostawia w pikselu tylko najsłabszy kanał (jak „Maximum RGB” GIMP-a
    w trybie minimum);
  - Sobel działa osobno na każdym kanale, a jego wynik jest mnożony przez „siłę”;
  - parametry „piksel” (domyślnie 4) i „siła” (domyślnie 2) są regulowane w panelu;
  - **wartości domyślne nie zostały sprawdzone w dokumentacji GIMP-a**, bo strona
    była niedostępna z naszego środowiska.

## Wzory i algorytmy

| Filtr | Działanie | Koszt (obraz W×H, maska k×k) |
|-------|-----------|-------------------------------|
| Splot | `wynik = Σ K(i,j)·I(x−i, y−j) / dzielnik + stała`, tylko niezerowe wagi | O(W·H·liczba niezerowych wag) |
| Gauss | `G(x,y) = e^(−(x²+y²)/(2σ²))`, dzielnik = suma wag | jak splot |
| Mediana w × h | algorytm Huanga: histogram okna aktualizowany przy przesunięciu | O(W·H·h) |
| Pikselizacja | średni kolor bloku (sumy w blokach, potem wpisanie średnich) | O(W·H) |
| Kuwahara | 4 kwadraty (r+1)×(r+1) wokół piksela; średnia kwadratu o najmniejszej wariancji jasności; obrazy całkowe | O(W·H) |
| Predator | `Sobel_RGB(MinRGB(Pikselizacja(obraz))) · siła` | O(W·H) |

## Realizacja

| Element | Gdzie |
|---------|-------|
| Splot, maski gotowe, maska Gaussa, parsowanie maski z tekstu | `js/convolution.js` |
| Mediana w × h, pikselizacja, Kuwahara, MinRGB, Sobel RGB, Predator | `js/filters.js` |
| Zakładki „Splot” i „Efekty” | `index.html`, obsługa w `js/main.js` |

Sprawdzenie (Node, porównanie z liczeniem „na piechotę”):
- splot: wszystkie 11 gotowych masek i maska parzysta 2×4 – różnica 0;
- mediana: okna 3×3, 7×1, 1×5, 4×4, 6×3, 2×2 – różnica 0;
- Kuwahara: okna 3, 5, 9 – różnica 0;
- pikselizacja: średnie bloków, także niepełnych przy brzegu, zgodne.

Czasy w przeglądarce dla 512×512:
- splot 3×3: 13–42 ms, Gauss 5×5: ≈ 43 ms;
- mediana 9×1: ≈ 50 ms;
- pikselizacja: ≈ 13 ms;
- Kuwahara 9×9: ≈ 64 ms;
- Predator: ≈ 44 ms.

Bardzo duże maski splotu są wolniejsze, bo koszt rośnie z liczbą wag
(Gauss 15×15 ≈ 270 ms).
