# Biometria – Zadanie 2: operacje na histogramie

**Status:** ✅ zrealizowane

## Treść zadania

Zaimplementować:

- Wyświetlanie histogramu dowolnego wczytanego obrazu (25%)
- [Rozciąganie histogramu](http://www.algorytm.org/przetwarzanie-obrazow/histogram-rozciaganie.html)
  (do dowolnego zakresu) (25%)
- [Wyrównanie histogramu](https://cez.wi.pb.edu.pl/mod/url/view.php?id=7446) (25%)
- [Binaryzacja Otsu (binaryzacja na podstawie histogramu)](https://ieeexplore.ieee.org/document/4310076) (25%)

W aplikacji powinien być wyświetlany obraz oraz jego
[histogram](https://cez.wi.pb.edu.pl/mod/url/view.php?id=7439).

Dodatkowe 5 punktów za dodatkowe, globalne operacje na obrazie, na przykład
zwiększanie/zmniejszanie jasności obrazu za pomocą suwaka.

## Stan przed realizacją

| Wymaganie | Stan |
|-----------|------|
| Wyświetlanie obrazu i histogramu | ✅ było z zadania 1 (`js/histogram.js`): R, G, B, średnia, wszystkie, skala log. |
| Rozciąganie histogramu | ❌ brak |
| Wyrównanie histogramu | ❌ brak |
| Binaryzacja Otsu | ❌ brak (była tylko binaryzacja z ręcznym progiem) |
| Dodatkowe operacje globalne | ❌ brak |

## Checklista wymagań

- [x] Obraz + histogram (odświeżany po każdej operacji)
- [x] Rozciąganie histogramu do dowolnego zakresu [od, do]
- [x] Wyrównanie histogramu
- [x] Binaryzacja Otsu (próg wyznaczany automatycznie z histogramu)
- [x] Dodatkowo: jasność i kontrast (suwaki z podglądem na żywo), negatyw

## Algorytmy

Wszystkie operacje poza Otsu to **operacje punktowe**: nowa wartość piksela
zależy tylko od jego starej wartości. Każdą sprowadzamy więc do tablicy LUT
(256 elementów na kanał) i jednej pętli po buforze (`applyLut`).

**Rozciąganie** (min, max – najmniejsza i największa wartość w obrazie,
[a, b] – zakres docelowy):

```
v' = a + (v − min) · (b − a) / (max − min)
```

**Wyrównanie** (dystrybuanta CDF, N – liczba pikseli):

```
cdf[v] = h[0] + h[1] + … + h[v]
v' = round( (cdf[v] − cdf_min) / (N − cdf_min) · 255 )
```

**Otsu** – próg k maksymalizujący wariancję międzyklasową:

```
σ²_B(k) = ω₀(k) · ω₁(k) · (μ₀(k) − μ₁(k))²
```

ω₀, ω₁ – liczby pikseli w klasach [0..k] i [k+1..255], μ₀, μ₁ – ich średnie.
Sprawdzamy wszystkie k w jednej pętli po histogramie, przyrostowo, więc
koszt to O(256) plus jedno przejście po obrazie, żeby policzyć histogram.

**Jasność / kontrast:**

```
v' = F · (v − 128) + 128 + jasność,   F = 259 · (C + 255) / (255 · (259 − C))
```

## Ustalenia

- Rozciąganie i wyrównanie mają dwa tryby:
  - **kanały osobno** – każdy kanał R, G, B ma własne min/max (własną CDF);
    najmocniejszy efekt, ale może zmienić barwy,
  - **wspólnie** – jedno odwzorowanie dla wszystkich kanałów (rozciąganie:
    wspólne min/max, wyrównanie: CDF średniej kanałów); barwy zmieniają się
    mniej.
- Zakres docelowy może być odwrócony (od > do) – wtedy wynik jest dodatkowo
  zanegowany.
- Otsu liczy próg z histogramu kanału wybranego w panelu binaryzacji
  (R, G, B albo średnia), ustawia suwak progu i wykonuje binaryzację.
- Jasność/kontrast: suwaki pokazują podgląd na żywo (razem z histogramem),
  „Zastosuj” zapisuje zmianę w historii. Podgląd, którego nie zatwierdzono,
  jest odrzucany przy każdej innej operacji.
- Operacje działają na warstwie obrazu; kształty z zadania GK 1a zostają nad nim.

## Realizacja

| Element | Gdzie |
|---------|-------|
| LUT + jedna pętla po buforze | `js/imageProcessing.js` – `applyLut` |
| Rozciąganie | `js/imageProcessing.js` – `stretchHistogram` |
| Wyrównanie | `js/imageProcessing.js` – `equalizeHistogram` |
| Próg Otsu | `js/imageProcessing.js` – `otsuThreshold` |
| Jasność / kontrast, negatyw | `js/imageProcessing.js` – `adjustBrightnessContrast`, `invert` |
| Panele „Operacje na histogramie”, „Jasność i kontrast”, przycisk Otsu | `index.html`, `js/main.js` |
