# Przewodnik po kodzie – dla osób, które nie znają JavaScriptu

Ten dokument tłumaczy **krok po kroku**, jak działa edytor graficzny: co jest
w każdym pliku, co robi każda funkcja, skąd bierze dane i co zwraca.
Nie zakłada znajomości JavaScriptu. Krótsze podsumowanie plików:
[pliki-js.md](pliki-js.md).

Spis treści:

1. [Minimum wiedzy o HTML, CSS i JavaScripcie](#1-minimum-wiedzy-o-html-css-i-javascripcie)
2. [Jak zapisany jest obraz w pamięci](#2-jak-zapisany-jest-obraz-w-pamięci)
3. [Jak działa aplikacja jako całość](#3-jak-działa-aplikacja-jako-całość)
4. [Opis plików i funkcji](#4-opis-plików-i-funkcji)
   - [imageIO.js](#41-imageiojs--wczytanie-wyświetlenie-zapis)
   - [imageProcessing.js](#42-imageprocessingjs--algorytmy-przetwarzania-obrazu)
   - [histogram.js](#43-histogramjs--liczenie-i-rysowanie-histogramu)
   - [colorSpaces.js](#44-colorspacesjs--przeliczanie-kolorów)
   - [raster.js](#45-rasterjs--rysowanie-linii-okręgów-i-prostokątów)
   - [shapes.js](#46-shapesjs--kształty-jako-obiekty)
   - [ui.js](#47-uijs--drobne-elementy-interfejsu)
   - [colorPicker.js](#48-colorpickerjs--panel-wyboru-koloru)
   - [drawingTool.js](#49-drawingtooljs--mysz-na-obrazie)
   - [shapeForm.js](#410-shapeformjs--pola-tekstowe-kształtu)
   - [main.js](#411-mainjs--serce-aplikacji)
5. [Scenariusze: co się dzieje po kliknięciu](#5-scenariusze-co-się-dzieje-po-kliknięciu)
6. [Słowniczek pojęć](#6-słowniczek-pojęć)

---

## 1. Minimum wiedzy o HTML, CSS i JavaScripcie

Aplikacja działa w przeglądarce i składa się z trzech rodzajów plików:

| Rodzaj | Plik | Rola (porównanie do domu) |
|--------|------|---------------------------|
| HTML | `index.html` | **Konstrukcja** – jakie są przyciski, suwaki, panele, gdzie leżą. |
| CSS | `css/style.css` | **Wystrój** – kolory, odstępy, zaokrąglenia, rozmiary. |
| JavaScript | `js/*.js` | **Instalacje** – co się dzieje po kliknięciu, jak liczone są piksele. |

Układ ekranu: u góry pasek z operacjami na pliku i historią, po lewej
pionowy pasek **zakładek** (Progowanie, Histogram, Korekta, Kolor, Kształty),
obok panel wybranej zakładki z **histogramem przypiętym na dole**, a w środku
obraz. Motyw jest ciemny.

Przeglądarka otwiera `index.html`, rysuje elementy strony, nakłada style
z CSS, a na końcu wczytuje i uruchamia pliki JavaScript (w kolejności
podanej na dole `index.html`).

### 1.1. Podstawowe pojęcia JavaScriptu użyte w kodzie

**Komentarze** – tekst dla człowieka, komputer go pomija:

```js
// komentarz w jednej linii
/** komentarz w wielu liniach (tzw. JSDoc – opis funkcji) */
```

W komentarzach JSDoc zapis `@param {number} x` znaczy „parametr x jest liczbą”,
a `@returns {ImageData}` – „funkcja zwraca obraz”.

**Zmienne** – nazwane „pudełka” na wartości:

```js
const MAX_UNDO = 30;   // const – wartość, której nie zmieniamy
let selected = -1;     // let – wartość, która będzie się zmieniać
```

**Rodzaje wartości:**

| Zapis | Znaczenie |
|-------|-----------|
| `42`, `0.5`, `-3` | liczba |
| `'tekst'`, `` `Próg: ${t}` `` | tekst; w odwrotnych apostrofach `${...}` wstawia wartość do tekstu |
| `true` / `false` | prawda / fałsz |
| `null` | „nic” – celowo pusta wartość (np. brak obrazu) |
| `{ r: 255, g: 0, b: 0 }` | **obiekt** – zestaw nazwanych pól (jak rekord / struktura) |
| `[1, 2, 3]` | **tablica** – lista wartości numerowana od 0 |

Do pola obiektu sięga się kropką: `kolor.r` → `255`.
Do elementu tablicy – nawiasem: `lista[0]` → pierwszy element.

**Funkcje** – nazwane „przepisy”, które dostają dane (parametry), wykonują
kroki i zwykle zwracają wynik (`return`):

```js
function dodaj(a, b) {
  return a + b;
}
dodaj(2, 3); // wynik: 5
```

Krótszy zapis tej samej funkcji (tzw. **funkcja strzałkowa**):

```js
const dodaj = (a, b) => a + b;
```

**Obiekt opcji i „rozpakowanie” (destrukturyzacja)** – zamiast wielu
parametrów przekazujemy jeden obiekt z nazwanymi polami:

```js
binarize(obraz, { channel: 'r', threshold: 128 });

function binarize(src, { channel, threshold }) { ... }
//                     ^ od razu wyjmuje pola channel i threshold
```

**Trzy kropki `...` (spread)** – „skopiuj wszystkie pola / elementy”:

```js
const nowy = { ...stary, r: 0 }; // kopia obiektu stary, ale z r = 0
```

**Warunki i pętle:**

```js
if (warunek) { ... } else { ... }
const x = warunek ? 'gdy prawda' : 'gdy fałsz';   // skrócony if

for (let i = 0; i < 10; i++) { ... }   // powtórz 10 razy, i = 0, 1, ..., 9
```

**Zdarzenia** – „gdy użytkownik kliknie przycisk, zrób to”:

```js
przycisk.addEventListener('click', () => { /* co zrobić */ });
```

Rodzaje zdarzeń użyte w kodzie: `click` (kliknięcie), `input` (zmiana suwaka
lub pola w trakcie), `change` (zatwierdzenie zmiany), `keydown` (wciśnięcie
klawisza), `pointerdown` / `pointermove` / `pointerup` (wciśnięcie, ruch
i puszczenie przycisku myszy).

**DOM** – przeglądarka udostępnia elementy strony jako obiekty.
`document.getElementById('btn-save')` zwraca przycisk z `id="btn-save"`
z pliku HTML. W kodzie skrócono to do `$('btn-save')`.

### 1.2. Jak pliki „rozmawiają” ze sobą

Każdy plik JS ma taką budowę:

```js
(function (global) {
  'use strict';
  const BioEditor = (global.BioEditor = global.BioEditor || {});

  function cośPożytecznego() { ... }

  BioEditor.NazwaModułu = { cośPożytecznego };
})(window);
```

Co tu się dzieje:

1. `(function (global) { ... })(window);` – funkcja, która **od razu się
   uruchamia** (tzw. IIFE). Dzięki temu zmienne w środku nie „wyciekają”
   i nie mieszają się z innymi plikami (ważne przy łączeniu z projektem
   drugiej osoby).
2. `'use strict'` – tryb ścisły: przeglądarka zgłasza więcej błędów, zamiast
   je przemilczać.
3. `global.BioEditor = global.BioEditor || {}` – „weź wspólny obiekt
   `BioEditor`, a jeśli go jeszcze nie ma, utwórz pusty”.
4. `BioEditor.NazwaModułu = { ... }` – plik „wystawia” swoje funkcje pod
   wspólną nazwą. Inne pliki używają ich jako `BioEditor.NazwaModułu.funkcja()`.

Niektóre pliki mają na końcu `(typeof window !== 'undefined' ? window : globalThis)`
zamiast `(window)`. To znaczy: „w przeglądarce użyj `window`, a poza nią
(np. w Node przy testach) użyj `globalThis`”.

### 1.3. Kilka rzeczy wbudowanych w przeglądarkę

| Nazwa | Co to jest |
|-------|------------|
| `Uint8ClampedArray` | Tablica liczb 0–255. Wpisanie 300 zapisze 255, wpisanie −5 zapisze 0 („przycinanie”). Idealna na piksele. |
| `Uint32Array` | Tablica dużych liczb całkowitych (do ~4 mld) – na liczniki w histogramie. |
| `ImageData` | Obraz w pamięci: `width` (szerokość), `height` (wysokość), `data` (piksele jako `Uint8ClampedArray`). |
| `<canvas>` | Element strony, na którym można rysować piksele. |
| `getImageData` / `putImageData` | Odczyt pikseli z kanwy / wpisanie pikseli na kanwę. |
| `canvas.toBlob` | Zamiana zawartości kanwy na plik (u nas PNG). |
| `Promise`, `async`, `await` | Sposób czekania na coś, co trwa (np. wczytanie pliku), bez zamrażania strony. |
| `requestAnimationFrame` | „Wywołaj tę funkcję tuż przed następnym odświeżeniem ekranu” (~60 razy na sekundę). |
| `performance.now()` | Bardzo dokładny zegar – używany do mierzenia czasu operacji. |

---

## 2. Jak zapisany jest obraz w pamięci

Obraz to prostokąt pikseli. Każdy piksel ma 4 liczby 0–255:

- **R** – ilość czerwonego,
- **G** – ilość zielonego,
- **B** – ilość niebieskiego,
- **A** – nieprzezroczystość (255 = pełna, 0 = przezroczysty).

Wszystkie piksele leżą w **jednej długiej tablicy**, wiersz po wierszu,
od lewego górnego rogu:

```
data = [R, G, B, A,  R, G, B, A,  R, G, B, A, ...]
        piksel 0     piksel 1     piksel 2
```

Piksel o współrzędnych (x, y) zaczyna się pod indeksem `(y · szerokość + x) · 4`.

Dlatego prawie każdy algorytm wygląda tak:

```js
for (let i = 0; i < data.length; i += 4) {
  // data[i] = R, data[i+1] = G, data[i+2] = B, data[i+3] = A
}
```

Jest to **jedna pętla po całym buforze** – najszybszy sposób w przeglądarce.
Obraz 512×512 to 262 144 piksele, czyli ponad milion liczb.

---

## 3. Jak działa aplikacja jako całość

### 3.1. Dokument = obraz + kształty

To, co widać na ekranie, składa się z dwóch warstw:

1. **Obraz** (`state.current`) – zdjęcie lub pusta kanwa. Na nim działają
   operacje z biometrii (binaryzacja, histogram, jasność…).
2. **Kształty** (`state.shapes`) – lista linii, prostokątów i okręgów
   „unoszących się” nad obrazem. Można je zaznaczać i edytować.

Przy każdym odświeżeniu program robi **kopię obrazu**, rysuje na niej kształty
i wyświetla wynik. Oryginalny obraz pozostaje nietknięty.

Przycisk **„Spłaszcz kształty”** na stałe wtapia kształty w obraz.

### 3.2. Zasada „nie zmieniaj, zwróć nowe”

Funkcje przetwarzania **nie modyfikują** obrazu, który dostają – zawsze
tworzą nowy. Podobnie kształty: przesunięcie linii tworzy nową linię.

Dzięki temu historia „Cofnij” jest prosta: wystarczy zapamiętać poprzedni
obraz i poprzednią listę kształtów (stare wersje nigdy się nie zmieniają).

### 3.3. Cykl życia jednej operacji

Prawie każda akcja przechodzi tę samą drogę:

```
kliknięcie przycisku
   → funkcja z imageProcessing.js liczy NOWY obraz
   → commit(): stary stan trafia na stos Cofnij, nowy staje się aktualnym
   → render(): kopia obrazu + kształty → histogram → uchwyty → ekran
   → updateControls(): które przyciski mają być aktywne
   → pasek statusu: co zrobiono i ile to trwało
```

### 3.4. Kolejność wczytywania skryptów

W `index.html` skrypty są wczytywane w tej kolejności:

1. `imageIO.js`, `imageProcessing.js`, `histogram.js` – biometria,
2. `colorSpaces.js`, `raster.js`, `shapes.js` – algorytmy grafiki,
3. `ui.js`, `colorPicker.js`, `drawingTool.js`, `shapeForm.js` – interfejs,
4. `main.js` – na końcu, bo korzysta ze wszystkich poprzednich.

Używamy zwykłych `<script src>`, a nie „modułów ES”, bo moduły nie działają
przy otwieraniu pliku `index.html` prosto z dysku (blokada bezpieczeństwa
przeglądarki).

---

## 4. Opis plików i funkcji

Przy każdej funkcji podano:
- **Wejście** – co funkcja dostaje,
- **Wyjście** – co zwraca,
- **Jak działa** – kroki,
- **Gdzie używana** – kto ją wywołuje.

---

### 4.1. `imageIO.js` – wczytanie, wyświetlenie, zapis

Moduł: `BioEditor.ImageIO`. Odpowiada za kontakt z „zewnętrznym światem”:
plikami na dysku i kanwą na ekranie. Używa wyłącznie dozwolonych mechanizmów
przeglądarki.

#### `loadImageData(file)`

- **Wejście:** `file` – plik wybrany przez użytkownika w oknie „Otwórz”.
- **Wyjście:** `Promise<ImageData>` – „obietnica”, że za chwilę dostaniemy
  obraz (wczytanie pliku chwilę trwa).
- **Jak działa:**
  1. `URL.createObjectURL(file)` tworzy tymczasowy adres do pliku
     (coś jak `blob:...`), który przeglądarka umie otworzyć.
  2. Tworzy niewidoczny obrazek `new Image()` i każe mu wczytać ten adres.
     Przeglądarka sama rozpoznaje format (PNG, JPG…) i dekoduje go.
  3. Gdy obrazek się wczyta (`img.onload`): tworzy niewidoczną kanwę o tym
     samym rozmiarze, rysuje na niej obrazek i odczytuje piksele przez
     `getImageData`.
  4. Zwalnia tymczasowy adres (`revokeObjectURL`) i zwraca piksele.
  5. Jeśli plik nie jest obrazem (`img.onerror`) – zgłasza błąd
     „Nie udało się wczytać pliku jako obrazu.”
- **Gdzie używana:** `main.js`, po wybraniu pliku.

#### `drawImageData(canvas, imageData)`

- **Wejście:** kanwa na stronie i obraz w pamięci.
- **Wyjście:** nic (rysuje na ekranie).
- **Jak działa:** jeśli kanwa ma inny rozmiar niż obraz, zmienia jej rozmiar,
  a potem jednym poleceniem `putImageData` wpisuje wszystkie piksele.
- **Gdzie używana:** `main.js` w `render()` oraz `saveImageDataAsPng`.

#### `saveCanvasAsPng(canvas, filename)`

- **Wejście:** kanwa i nazwa pliku.
- **Wyjście:** nic – przeglądarka pobiera plik.
- **Jak działa:**
  1. `canvas.toBlob(...)` koduje zawartość kanwy do formatu PNG.
  2. Tworzy niewidoczny link `<a download="nazwa.png">` wskazujący na ten
     plik i programowo go „klika” – przeglądarka zaczyna pobieranie.
  3. Usuwa link i po sekundzie zwalnia tymczasowy adres.

#### `saveImageDataAsPng(imageData, filename)`

- **Wejście:** obraz w pamięci i nazwa pliku.
- **Jak działa:** tworzy pomocniczą, niewidoczną kanwę, rysuje na niej obraz
  (`drawImageData`) i zapisuje ją (`saveCanvasAsPng`).
- **Po co:** żeby zapisać dokładnie obraz z kształtami, ale **bez** niebieskich
  uchwytów zaznaczenia widocznych na ekranie.
- **Gdzie używana:** przycisk „Zapisz jako PNG”.

#### `createBlankImage(width, height)`

- **Wejście:** szerokość i wysokość.
- **Wyjście:** nowy, biały obraz.
- **Jak działa:** `new ImageData(w, h)` daje obraz z samymi zerami
  (przezroczysta czerń), więc cały bufor wypełniamy liczbą 255 – wtedy
  R = G = B = 255 (biały) i A = 255 (nieprzezroczysty).
- **Gdzie używana:** przycisk „Nowa kanwa” (800×600).

---

### 4.2. `imageProcessing.js` – algorytmy przetwarzania obrazu

Moduł: `BioEditor.ImageProcessing`. Same obliczenia na pikselach – bez
przycisków i bez kanwy. Każda funkcja dostaje obraz i zwraca **nowy** obraz.

#### `CHANNEL_OFFSET` (stała)

Tabelka: który z czterech bajtów piksela odpowiada kanałowi:
`r → 0`, `g → 1`, `b → 2`, `avg → -1` (−1 oznacza „licz średnią z R, G, B”).

#### `binarize(src, { channel, threshold })` – binaryzacja progowa

- **Wejście:** obraz, kanał (`'r'`, `'g'`, `'b'` lub `'avg'`) i próg 0–255.
- **Wyjście:** nowy obraz czarno-biały.
- **Jak działa:**
  1. Buduje tablicę LUT o 256 polach: dla każdej możliwej wartości `v`
     od razu zapisuje wynik – 255 (biały), gdy `v ≥ próg`, inaczej 0 (czarny).
  2. Przechodzi raz po wszystkich pikselach. Dla każdego bierze wartość
     wybranego kanału albo średnią `(R + G + B) / 3` (zaokrągloną w dół
     przez `| 0`), sprawdza ją w LUT i wpisuje wynik do R, G i B.
     Przezroczystość A przepisuje bez zmian.
- **Dlaczego LUT:** zamiast porównywać z progiem milion razy, odczytujemy
  gotową odpowiedź z tabelki.

#### `identityLut()`

Zwraca LUT „bez zmian”: `lut[v] = v`. Używana, gdy operacji nie da się
wykonać (np. cały kanał ma jedną wartość) – obraz zostaje taki sam.

#### `applyLut(src, { r, g, b })` – zastosowanie tablic LUT

- **Wejście:** obraz i trzy tablice LUT (osobna dla R, G i B).
- **Wyjście:** nowy obraz.
- **Jak działa:** jedna pętla po pikselach: nowe R = `r[stare R]`,
  nowe G = `g[stare G]`, nowe B = `b[stare B]`, A bez zmian.
- **Dlaczego ważna:** wszystkie **operacje punktowe** (wynik piksela zależy
  tylko od jego wartości – nie od sąsiadów) da się sprowadzić do LUT.
  Rozciąganie, wyrównanie, jasność, kontrast i negatyw różnią się tylko
  tym, jak wypełniamy tablicę – sama pętla po obrazie jest wspólna.

#### `sameLut(lut)`

Skrót: ta sama tablica dla wszystkich trzech kanałów → `{ r: lut, g: lut, b: lut }`.

#### `histogramRange(hist)`

- **Wejście:** histogram (256 liczników).
- **Wyjście:** `{ min, max }` – najmniejsza i największa wartość, która
  w ogóle występuje w obrazie; `null`, gdy histogram jest pusty.
- **Jak działa:** idzie od 0 w górę, aż trafi na niezerowy licznik (to `min`),
  i od 255 w dół (to `max`).
- **Gdzie używana:** rozciąganie, wyrównanie, napis „Zakres w obrazie”.

#### `stretchHistogram(src, { low, high, mode })` – rozciąganie histogramu

- **Wejście:** obraz, zakres docelowy `[low, high]` (np. 0–255) i tryb
  (`'separate'` – kanały osobno, `'joint'` – wspólnie).
- **Wyjście:** nowy obraz.
- **Idea:** obraz o niskim kontraście ma wartości np. tylko od 60 do 180.
  Rozciągamy ten przedział, żeby zajął cały zakres 0–255:

  ```
  nowa = low + (stara − min) · (high − low) / (max − min)
  ```

  Przykład: min = 60, max = 180, zakres 0–255. Wartość 60 → 0,
  120 → 127,5 ≈ 128, 180 → 255.
- **Jak działa:**
  1. Liczy histogramy obrazu (`Histogram.compute`).
  2. Dla każdego kanału znajduje `min` i `max` (`histogramRange`).
  3. Tryb **osobno**: każdy kanał dostaje własną LUT z własnym min/max.
     Tryb **wspólnie**: bierze najmniejsze min i największe max ze wszystkich
     kanałów i robi jedną LUT dla wszystkich (barwy się nie przesuwają).
  4. Jeśli `min = max` (kanał ma jedną wartość) – LUT „bez zmian”
     (inaczej byłoby dzielenie przez zero).
  5. Stosuje LUT (`applyLut`).
- **Ciekawostka:** gdy `low > high` (np. od 255 do 0), obraz wychodzi
  dodatkowo w negatywie.

#### `equalizationLut(hist)` – LUT wyrównania dla jednego kanału

- **Wejście:** histogram jednego kanału.
- **Wyjście:** tablica LUT.
- **Idea – dystrybuanta (CDF):** `cdf[v]` = ile pikseli ma wartość **≤ v**
  (suma liczników od 0 do v). Rośnie od 0 do N (liczba wszystkich pikseli).
  Jeśli nowa wartość piksela będzie proporcjonalna do `cdf[v]`, to piksele
  rozłożą się możliwie równo na cały zakres:

  ```
  nowa = round( (cdf[v] − cdf_min) / (N − cdf_min) · 255 )
  ```

  `cdf_min` to wartość CDF dla najciemniejszego występującego koloru –
  odejmujemy ją, żeby najciemniejszy piksel trafił dokładnie w 0.
- **Jak działa:** liczy N, znajduje `cdf_min`, a potem w jednej pętli
  0..255 sumuje liczniki (to jest CDF) i od razu wpisuje wynik do LUT.
  Jeśli cały obraz ma jedną wartość – LUT „bez zmian”.

#### `equalizeHistogram(src, { mode })` – wyrównanie histogramu

- **Wejście:** obraz i tryb.
- **Wyjście:** nowy obraz.
- **Jak działa:** liczy histogramy, a potem:
  - tryb **osobno**: osobna LUT z CDF dla R, G i B,
  - tryb **wspólnie**: jedna LUT z CDF histogramu średniej, użyta dla
    wszystkich kanałów (wyrównuje głównie jasność, barwy zmieniają się mniej).
- **Efekt:** ciemne lub wyblakłe zdjęcia zyskują kontrast, histogram staje
  się bardziej „płaski”.

#### `otsuThreshold(hist)` – automatyczny próg metodą Otsu

- **Wejście:** histogram jednego kanału.
- **Wyjście:** próg 0–255 do użycia w `binarize`.
- **Idea:** próg k dzieli piksele na dwie grupy: ciemne `[0..k]` i jasne
  `[k+1..255]`. Szukamy k, przy którym grupy są **najbardziej od siebie
  różne**. Miarą jest wariancja międzyklasowa:

  ```
  σ²(k) = ω₀ · ω₁ · (μ₀ − μ₁)²
  ```

  - ω₀, ω₁ – ile pikseli jest w grupie ciemnej i jasnej,
  - μ₀, μ₁ – średnia wartość w każdej grupie.

  Wartość jest duża, gdy obie grupy są liczne **i** mają bardzo różne średnie.
- **Jak działa:**
  1. Liczy łączną liczbę pikseli i sumę wszystkich wartości.
  2. Idzie po k od 0 do 255, za każdym razem **dokładając** piksele z wartości
     k do grupy ciemnej (nie liczy wszystkiego od nowa – stąd szybkość).
  3. Liczy średnie obu grup i σ²(k); zapamiętuje k z największym wynikiem.
  4. Zwraca `k + 1`, bo `binarize` robi biały piksel, gdy `v ≥ próg`
     (czyli wartości ≤ k idą do czerni).
- **Koszt:** tylko 256 kroków (plus jedno przejście po obrazie, żeby policzyć
  histogram).

#### `adjustBrightnessContrast(src, { brightness, contrast })`

- **Wejście:** obraz, jasność (−255..255) i kontrast w procentach (−100..100).
- **Wyjście:** nowy obraz.
- **Wzór:**

  ```
  nowa = F · (stara − 128) + 128 + jasność
  F = 259 · (C + 255) / (255 · (259 − C)),   C = 2,55 · kontrast
  ```

  - **Jasność** po prostu dodaje lub odejmuje stałą.
  - **Kontrast** „rozsuwa” wartości od środka skali (128): przy F > 1 jasne
    stają się jaśniejsze, ciemne ciemniejsze; przy F < 1 wszystko zbliża się
    do szarości. Dla kontrastu 0 jest F = 1 (bez zmian).
- **Jak działa:** buduje jedną LUT według wzoru (wyniki poza 0–255 są
  automatycznie przycinane) i stosuje ją do wszystkich kanałów.

#### `invert(src)` – negatyw

LUT `nowa = 255 − stara` dla wszystkich kanałów: biały ↔ czarny, każdy kolor
zamienia się na „przeciwny”.

---

### 4.3. `histogram.js` – liczenie i rysowanie histogramu

Moduł: `BioEditor.Histogram`. **Histogram** to 256 liczników: `hist[v]` mówi,
ile pikseli ma wartość `v`. Na wykresie: oś pozioma to wartości 0–255,
wysokość słupka to liczba pikseli.

#### `CHANNELS`, `THEME_DEFAULTS` i `PAD` (stałe)

`CHANNELS` – etykiety i kolory słupków (R czerwony, G zielony, B niebieski,
średnia jasnoszara). `THEME_DEFAULTS` – zapasowe kolory tła, osi i opisów
wykresu. `PAD` – marginesy wykresu (miejsce na podpisy osi).

#### `readTheme(canvas)`

Odczytuje kolory wykresu ze zmiennych CSS (`--chart-bg`, `--chart-axis`,
`--chart-text`, `--chart-avg` w `css/style.css`) przez `getComputedStyle` –
funkcję przeglądarki, która zwraca końcowe style elementu. Gdy zmiennej
nie ma, bierze wartość z `THEME_DEFAULTS`. Dzięki temu zmiana motywu
(np. z ciemnego na jasny) to tylko zmiana w CSS.

#### `compute(imageData)`

- **Wejście:** obraz.
- **Wyjście:** obiekt z czterema histogramami: `{ r, g, b, avg }`
  (każdy to `Uint32Array` z 256 licznikami).
- **Jak działa:** jedna pętla po pikselach; dla każdego zwiększa o 1 licznik
  swojej wartości R w histogramie R, G w histogramie G, B w histogramie B
  i średniej `(R+G+B)/3` w histogramie średniej. Cztery histogramy za jednym
  przejściem.
- **Gdzie używana:** `render()` w `main.js` (po każdej zmianie obrazu),
  rozciąganie, wyrównanie, Otsu.

#### `draw(canvas, hist, view, { logScale })`

- **Wejście:** kanwa wykresu, histogramy (albo `null` = pusty wykres), który
  widok (`'r'`, `'g'`, `'b'`, `'avg'` lub `'all'`) i czy skala logarytmiczna.
- **Wyjście:** nic – rysuje wykres.
- **Jak działa:**
  1. Odczytuje kolory motywu (`readTheme`) i zamalowuje tło.
  2. Wybiera kanały do narysowania (dla „Wszystkie” – R, G i B naraz,
     półprzezroczyste, żeby było widać nakładanie).
  3. Szuka największego licznika – on wyznacza pełną wysokość wykresu.
  4. Dla każdej z 256 wartości rysuje prostokątny słupek o wysokości
     proporcjonalnej do licznika.
  5. W skali logarytmicznej wysokość to `log(1 + licznik)` – dzięki temu
     jeden ogromny słupek (np. białe tło) nie „spłaszcza” reszty wykresu.
  6. Rysuje oś poziomą z podziałką 0, 64, 128, 192, 255 i napis
     „maks. N” (największa liczba pikseli).
- **Uwaga:** wykres jest rysowany ręcznie (prostokąty i tekst), bez bibliotek
  do wykresów – zgodnie z wymaganiami.

---

### 4.4. `colorSpaces.js` – przeliczanie kolorów

Moduł: `BioEditor.ColorSpaces`. Czyste wzory matematyczne.

Zakresy: RGB – liczby 0–255; CMYK – ułamki 0–1 (na ekranie jako 0–100%);
HSV – odcień 0–360°, nasycenie i jasność 0–1.

**RGB** opisuje światło (monitor) – składowe się dodają: wszystkie na maksimum
dają biel. **CMYK** opisuje farbę (drukarka) – tusze pochłaniają światło:
cyjan (C) pochłania czerwony, magenta (M) zielony, żółty (Y) niebieski,
a czarny (K) przyciemnia wszystko.

#### `rgbToCmyk(R, G, B)`

```
r = R/255, g = G/255, b = B/255
K = 1 − max(r, g, b)
C = (1 − r − K) / (1 − K)
M = (1 − g − K) / (1 − K)
Y = (1 − b − K) / (1 − K)
```

Najpierw liczymy czarny tusz K (ile brakuje najjaśniejszej składowej do
bieli), a C, M, Y opisują już tylko odcień. Dla czystej czerni (K = 1)
mianownik byłby zerem – wtedy zwracamy C = M = Y = 0, K = 1.

Przykład: RGB(200, 100, 50) → K ≈ 21,6%, C = 0%, M = 50%, Y = 75%.

#### `cmykToRgb(c, m, y, k)`

```
R = 255 · (1 − C) · (1 − K)
G = 255 · (1 − M) · (1 − K)
B = 255 · (1 − Y) · (1 − K)
```

`(1 − C)` to część czerwonego światła, którą przepuszcza tusz cyjan;
`(1 − K)` – ile przepuszcza czarny. Wynik zaokrąglamy do liczby całkowitej.

#### `hsvToRgb(h, s, v)`

Pomocnicza – potrzebna do kwadratu wyboru koloru. Koło barw dzielimy na
6 części po 60° (czerwony, żółty, zielony, cyjan, niebieski, magenta).
W każdej części jedna składowa RGB jest największa (= v), jedna najmniejsza
(= v·(1−s)), a trzecia zmienia się płynnie między nimi.

#### `rgbToHsv(R, G, B)`

Odwrotność: jasność `v` = największa składowa, nasycenie `s` = (max − min) / max,
odcień `h` zależy od tego, która składowa jest największa. Dla szarości
odcień jest nieokreślony – zwracamy 0.

#### `rgbToHex(r, g, b)`

Zapis szesnastkowy, np. (255, 8, 0) → `#FF0800`. Każda liczba 0–255 zamienia
się na dwa znaki 00–FF.

---

### 4.5. `raster.js` – rysowanie linii, okręgów i prostokątów

Moduł: `BioEditor.Raster`. **Rasteryzacja** to zamiana opisu matematycznego
(„odcinek od A do B”) na konkretne piksele. Robimy to sami – bez gotowych
funkcji przeglądarki do rysowania linii.

**Ważne:** te funkcje **rysują bezpośrednio w podanym obrazie** (zmieniają go).
Dlatego wywołuje się je tylko na kopii (patrz `Shapes.composite`).

#### `createPlotter(img, color, width)`

- **Wejście:** obraz, kolor `{ r, g, b }`, grubość w pikselach.
- **Wyjście:** funkcja `plot(x, y)`, która „stawia kropkę” w punkcie (x, y).
- **Jak działa:**
  - Wewnętrzna `setPixel(x, y)` sprawdza, czy punkt jest wewnątrz obrazu
    (jeśli nie – nic nie robi; dzięki temu kształty mogą wychodzić poza
    kanwę), oblicza indeks `(y · szerokość + x) · 4` i wpisuje kolor.
  - Dla grubości 1 zwraca po prostu `setPixel`.
  - Dla większej grubości zwraca funkcję, która stawia **kwadrat**
    grubość × grubość pikseli wokół punktu – to nasz „pędzel”.
- **Uwaga:** to tzw. **domknięcie** (closure) – zwrócona funkcja „pamięta”
  obraz, kolor i grubość, z którymi została utworzona.

#### `drawLine(img, x0, y0, x1, y1, { color, width })` i `plotLine(plot, ...)`

**Algorytm Bresenhama.** `drawLine` tworzy „pędzel” i wywołuje `plotLine`.

- **Problem:** idealna prosta przechodzi zwykle *między* pikselami.
  Trzeba zdecydować, które piksele zamalować, żeby linia była ciągła i prosta.
- **Idea:** idziemy od początku do końca piksel po pikselu. W każdym kroku
  przesuwamy się o 1 w poziomie, o 1 w pionie albo po skosie. Decyzję
  podejmuje **zmienna błędu** `err` – mówi, jak daleko bieżący piksel jest
  od idealnej prostej.
- **Kroki:**
  1. `dx = |x1 − x0|`, `dy = −|y1 − y0|`, kierunki kroków `sx`, `sy` (±1).
  2. `err = dx + dy`.
  3. Powtarzaj: postaw piksel; jeśli doszliśmy do końca – stop;
     `e2 = 2·err`; jeśli `e2 ≥ dy` → krok w poziomie (`err += dy`);
     jeśli `e2 ≤ dx` → krok w pionie (`err += dx`).
- **Dlaczego tak:** używa **tylko dodawania liczb całkowitych** – bez ułamków,
  bez zaokrągleń, bardzo szybko. Działa dla linii w każdym kierunku.
- **Koszt:** tyle kroków, ile pikseli ma linia.

#### `drawCircle(img, cx, cy, r, { color, width })`

**Algorytm punktu środkowego (midpoint).**

- **Symetria:** okrąg jest symetryczny, więc liczymy tylko **1/8** okręgu
  (łuk od góry do przekątnej), a każdy wyliczony punkt (x, y) odbijamy
  na 8 sposobów: (±x, ±y) i (±y, ±x). Jeden krok = 8 pikseli.
- **Decyzja w każdym kroku:** x zawsze rośnie o 1, a y czasem maleje o 1.
  Sprawdzamy punkt **w połowie** między dwoma kandydatami: czy jest wewnątrz
  okręgu (`x² + y² − r² < 0`), czy na zewnątrz. Zmienna `d` przechowuje tę
  wartość i jest aktualizowana tylko dodawaniami:
  - start: `d = 1 − r`,
  - jeśli `d < 0`: zostajemy na tym samym y, `d += 2x + 3`,
  - w przeciwnym razie: schodzimy na `y − 1`, `d += 2(x − y) + 5`.
- **Koszt:** około r / 1,41 kroków.

#### `drawRect(img, x, y, w, h, { color, width })`

Prostokąt to cztery odcinki Bresenhama między rogami
(x, y) → (x+w, y) → (x+w, y+h) → (x, y+h) → (x, y).

#### `fillRect(img, x0, y0, x1, y1, color)`

Wypełniony prostokąt – używany do rysowania małych kwadracików (uchwytów
zaznaczenia). Najpierw przycina zakres do granic obrazu, potem dwie
zagnieżdżone pętle (wiersze i kolumny) wpisują kolor.

---

### 4.6. `shapes.js` – kształty jako obiekty

Moduł: `BioEditor.Shapes`.

**Dlaczego kształty są obiektami, a nie od razu pikselami?** Zamalowany piksel
„nie wie”, że należy do linii – nie dałoby się jej później zaznaczyć ani
przesunąć. Dlatego pamiętamy **opis** kształtu, np.:

```js
{ type: 'line',   x1: 10, y1: 20, x2: 200, y2: 80, color: {r:255,g:0,b:0}, width: 2 }
{ type: 'rect',   x: 50, y: 50, w: 100, h: 60, color: {...}, width: 1 }
{ type: 'circle', cx: 300, cy: 200, r: 40, color: {...}, width: 3 }
```

a piksele generujemy przy każdym odświeżeniu.

Kształty są **niezmienne** – każda zmiana tworzy nowy obiekt.

#### `COORD_LIMIT`, `TYPES` (stałe)

- `COORD_LIMIT = 20000` – współrzędne są ograniczone do ±20000. Bez tego
  wpisanie np. 1000000000 w pole kazałoby pętli rysującej wykonać miliard
  kroków i strona by się zawiesiła.
- `TYPES` – opis każdego typu: nazwa po polsku i lista pól do edycji
  w formularzu (np. okrąg: „Środek x”, „Środek y”, „Promień”).

#### `clamp(v, min, max)` i `toCoord(v)`

`clamp` przycina liczbę do przedziału. `toCoord` zamienia dowolną wartość
na liczbę całkowitą w dozwolonym zakresie (puste/niepoprawne → 0).

#### `create(type, params, { color, width })`

- **Wejście:** typ, parametry (np. z pól tekstowych) i styl.
- **Wyjście:** nowy kształt.
- **Jak działa:** zaokrągla wszystkie parametry; grubość ogranicza do 1–50;
  dla prostokąta z ujemną szerokością/wysokością przestawia punkt startowy
  (żeby `w` i `h` były zawsze dodatnie); dla okręgu bierze wartość bezwzględną
  promienia.

#### `fromPoints(type, a, b, style)`

Tworzy kształt z **dwóch kliknięć** myszą:
- linia – początek `a` i koniec `b`,
- prostokąt – dwa przeciwległe rogi,
- okrąg – środek `a`; promień to odległość do `b` (twierdzenie Pitagorasa,
  `Math.hypot`).

#### `params(shape)`

Wyciąga z kształtu same parametry geometryczne (bez koloru i grubości) –
do wpisania w pola tekstowe.

#### `defaultParams(type, W, H)`

Domyślne wartości nowego kształtu dopasowane do obrazu W×H, np. okrąg na
środku z promieniem 1/4 krótszego boku.

#### `withParams(shape, p)` i `withStyle(shape, style)`

Nowy kształt z innymi parametrami (ten sam kolor) / z innym stylem
(te same parametry).

#### `translate(shape, dx, dy)` – przesunięcie

Dodaje `dx` do wszystkich współrzędnych x i `dy` do wszystkich y.

#### `getHandles(shape)` – uchwyty

Zwraca listę punktów, za które można chwycić myszą:
- linia: oba końce (`p1`, `p2`),
- prostokąt: cztery rogi (`nw`, `ne`, `se`, `sw` – jak strony świata),
- okrąg: cztery punkty na obwodzie (`n`, `e`, `s`, `w`).

#### `handleAt(shape, x, y, tol)`

Sprawdza, czy punkt (x, y) leży w odległości `tol` od któregoś uchwytu;
zwraca jego nazwę albo `null`.

#### `dragHandle(origin, handleId, x, y)` – przeciąganie uchwytu

- **Wejście:** kształt **z chwili rozpoczęcia przeciągania**, nazwa uchwytu
  i bieżąca pozycja myszy.
- **Jak działa:**
  - linia: przesuwa wybrany koniec do pozycji myszy,
  - prostokąt: róg **przeciwległy** do chwyconego zostaje w miejscu
    („kotwica”), a prostokąt rozpina się między kotwicą a myszą,
  - okrąg: nowy promień = odległość myszy od środka.
- **Dlaczego od kształtu początkowego:** liczenie zawsze od tego samego punktu
  startowego sprawia, że błędy zaokrągleń się nie sumują.

#### `distanceToSegment(px, py, ax, ay, bx, by)`

Odległość punktu P od odcinka AB. Rzutujemy P na prostą AB (parametr `t`
mówi, w którym miejscu odcinka wypada rzut), przycinamy `t` do 0–1, żeby
zostać na odcinku, i liczymy odległość.

#### `distanceToOutline(shape, x, y)`

Odległość punktu od **obrysu** kształtu:
- linia – od odcinka,
- prostokąt – najmniejsza z odległości od czterech boków,
- okrąg – `|odległość od środka − promień|`.

#### `hitTest(shape, x, y, tol)`

Czy kliknięcie trafiło w kształt? Tak, gdy odległość od obrysu ≤ tolerancja
+ połowa grubości linii.

#### `equals(a, b)`

Czy dwa kształty są identyczne (porównuje ich zapis tekstowy). Używane, żeby
nie zapisywać w historii „przesunięcia o 0”.

#### `draw(shape, img)`

Wybiera właściwą funkcję z `raster.js` (linia / prostokąt / okrąg) i rysuje
kształt w obrazie.

#### `composite(base, shapes)` – nałożenie kształtów na obraz

- **Wejście:** obraz bazowy i lista kształtów.
- **Wyjście:** **nowy** obraz z narysowanymi kształtami.
- **Jak działa:** kopiuje cały bufor pikseli (`new Uint8ClampedArray(...)` –
  jedna szybka operacja), a potem rysuje na kopii każdy kształt po kolei.
  Obraz bazowy pozostaje nietknięty.

---

### 4.7. `ui.js` – drobne elementy interfejsu

Moduł: `BioEditor.UI`.

#### `createSegmented(container, onChange)`

Obsługuje **przełącznik segmentowy** – rząd przycisków, z których aktywny
jest dokładnie jeden (np. R | G | B | Średnia).
- Każdemu przyciskowi podpina kliknięcie: kliknięty dostaje klasę `active`
  (niebieskie tło), pozostałe ją tracą; potem wywołuje `onChange(wartość)`.
- Wartość przycisku pochodzi z atrybutu HTML `data-value`.
- Zwraca obiekt z polem `value` – zawsze aktualnie wybrana wartość.

#### `createTabs(tablist, root, { storageKey, onChange })`

Obsługuje **zakładki narzędzi** (pionowy pasek po lewej).
- Przyciski mają atrybut `data-tab="nazwa"`, a panele `data-tab-panel="nazwa"`.
- Kliknięcie zakładki: przycisk dostaje klasę `active`, widoczny zostaje tylko
  panel o tej samej nazwie (pozostałe dostają atrybut `hidden`).
- `storageKey` – pod tą nazwą wybór jest zapisywany w `localStorage`
  (pamięć przeglądarki, która przetrwa odświeżenie strony). Po ponownym
  otwarciu aplikacji wraca ostatnio używana zakładka. Dostęp jest w `try/catch`,
  bo przeglądarka może go zablokować (np. tryb prywatny) – wtedy wybór po prostu
  nie jest pamiętany.
- Zwraca obiekt z polem `value` (bieżąca zakładka) i funkcją `select(nazwa)`
  do przełączania z kodu.

#### `setEnabled(elements, enabled)`

Włącza lub wyłącza (szarzy) listę przycisków / suwaków przez atrybut `disabled`.

#### `setStatus(element, text)`

Wpisuje tekst do paska statusu na dole ekranu.

---

### 4.8. `colorPicker.js` – panel wyboru koloru

Moduł: `BioEditor.ColorPicker`. Panel „Kolor” w stylu programów graficznych.

**Stan panelu** przechowuje kolor jednocześnie w RGB i w CMYK oraz pomocniczo
w HSV. W trybie RGB źródłem jest RGB (CMYK jest wyliczane), w trybie CMYK –
odwrotnie. Gdybyśmy pamiętali tylko RGB, wpisane CMYK „rozjeżdżałoby się”
(wiele kombinacji CMYK daje ten sam kolor RGB).

#### Funkcje pomocnicze

- `clamp` – przycinanie do zakresu,
- `toPercent(v)` – ułamek → procent z jednym miejscem po przecinku (0,2157 → 21,6),
- `fmt(n)` – liczba po polsku (przecinek dziesiętny),
- `css({r,g,b})` – tekst `rgb(r, g, b)` zrozumiały dla CSS.

#### `renderSaturationValue(canvas, h)` – kwadrat koloru

Rysuje kwadrat: w poziomie nasycenie (od szarości do czystej barwy), w pionie
jasność (od pełnej na górze do czerni na dole), dla wybranego odcienia `h`.
Zamiast liczyć `hsvToRgb` dla każdego z ~40 tys. pikseli, liczy czystą barwę
raz i korzysta z prostego wzoru `kolor = v · ((1 − s)·biały + s·barwa)`.

#### `renderHueBar(canvas)` – pasek odcieni

Rysuje tęczowy pasek 0–360°. Kanwa ma wysokość 1 piksela, a CSS rozciąga
ją do 14 px – wystarczy więc policzyć jeden wiersz.

#### `bindPointerDrag(el, onPick)` – przeciąganie myszą

Podpina mysz do elementu: przy wciśnięciu i przy każdym ruchu (dopóki
przycisk jest wciśnięty) wywołuje `onPick(fx, fy)`, gdzie fx, fy to pozycja
kursora jako ułamek 0–1 szerokości/wysokości elementu.
`setPointerCapture` sprawia, że przeciąganie działa nawet po wyjechaniu
kursorem poza kwadrat.

#### `create(root, { onChange, initial })` – utworzenie panelu

Wyszukuje elementy panelu po atrybutach `data-role` i `data-channel`,
tworzy stan i podpina zdarzenia. Wewnątrz:

- `syncHsvFromRgb()` – przelicza HSV z RGB, ale dla szarości zachowuje
  poprzedni odcień (żeby znacznik na pasku nie skakał na czerwony).
- `setRgb(rgb, skip)` – ustawia RGB, przelicza CMYK i HSV, odświeża.
- `setCmyk(cmyk, skip)` – ustawia CMYK, przelicza RGB i HSV, odświeża.
- `setHsv(hsv)` – wybór z kwadratu/paska: HSV → RGB → CMYK, odświeża.
- `update(skip)` – odświeża cały panel: rysuje kwadrat (tylko gdy zmienił się
  odcień), ustawia znaczniki, suwaki i pola, gradienty na suwakach (pokazują,
  jak zmieni się kolor po przesunięciu danego suwaka), pokazuje właściwe pola
  (RGB albo CMYK), próbkę koloru, wartości „Wybrany” i „Po konwersji” oraz HEX.
  Parametr `skip` to pole, w którym użytkownik właśnie pisze – nie nadpisujemy
  go, żeby nie przeszkadzać w pisaniu.
- `setField(...)` – wpisuje wartość do suwaka i pola liczbowego.
- `bindChannel(key, max, apply)` – podpina suwak i pole jednej składowej:
  zdarzenie `input` zmienia kolor na żywo, `change` (Enter / wyjście z pola)
  poprawia wpisaną wartość, np. 300 → 255.

Zwraca obiekt z polem `rgb` – aktualny kolor, z którego korzystają kształty.

---

### 4.9. `drawingTool.js` – mysz na obrazie

Moduł: `BioEditor.DrawingTool`. Obsługuje rysowanie i edycję kształtów myszą.
**Nie przechowuje** listy kształtów – pobiera ją od `main.js` i zgłasza mu
zmiany. Sam pamięta tylko stan „w trakcie”:

| Zmienna | Znaczenie |
|---------|-----------|
| `tool` | wybrane narzędzie: `'select'`, `'line'`, `'rect'`, `'circle'` |
| `selected` | numer zaznaczonego kształtu (−1 = brak) |
| `pending` | pierwszy kliknięty punkt rysowanego kształtu |
| `preview` | podgląd rysowanego kształtu (podąża za myszą) |
| `drag` | trwające przeciąganie: co, od którego punktu, kształt początkowy |

#### Stałe

`HIT_TOLERANCE = 6` (jak blisko trzeba kliknąć), `HANDLE_HALF = 4` (połowa
rozmiaru uchwytu), `DRAG_THRESHOLD = 4` (od ilu pikseli przeciągnięcie liczy
się jako rysowanie) – wszystkie w pikselach ekranu. Kolory uchwytów:
niebieska ramka i białe wnętrze.

#### `create(canvas, hooks)`

`hooks` to „telefony” do `main.js`: `getShapes` (daj listę kształtów),
`getStyle` (daj kolor i grubość), `isEnabled` (czy jest obraz),
`requestRender` (odśwież ekran), `onCommit` (zapisz zmianę),
`onSelectionChange` (zaznaczenie się zmieniło). Wewnątrz:

- `scale()` – ile pikseli obrazu przypada na piksel ekranu (kanwa może być
  pomniejszona/powiększona).
- `toImage(e)` – zamienia pozycję myszy na ekranie na współrzędne piksela
  w obrazie.
- `select(index)` – zmienia zaznaczenie, powiadamia `main.js`, odświeża.
- `cancel()` – przerywa rysowanie/przeciąganie (np. klawisz Esc).
- `setTool(next)` – zmienia narzędzie; przy narzędziu rysującym zdejmuje
  zaznaczenie i zmienia kursor na krzyżyk.
- `getVisibleShapes()` – lista kształtów do wyświetlenia: z podmienionym
  kształtem, który właśnie jest przeciągany, i z doklejonym podglądem.
- `drawOverlay(img)` – dorysowuje na obrazie ekranowym uchwyty zaznaczonego
  kształtu i znacznik pierwszego kliknięcia (nie trafiają do zapisu PNG).
- `commit(shapes, select, label)` – przekazuje nową listę kształtów do `main.js`.
- `deleteSelected()` – usuwa zaznaczony kształt (nowa lista bez niego).
- `finishShape(p)` – kończy rysowanie: tworzy kształt z punktu `pending`
  i `p`, dokleja go do listy i zgłasza zmianę.
- `startSelectDrag(p)` – narzędzie „Zaznacz” po wciśnięciu myszy:
  1. trafiono w uchwyt zaznaczonego kształtu → zaczyna zmianę rozmiaru,
  2. trafiono w obrys jakiegoś kształtu (szuka od ostatniego, bo ten leży
     na wierzchu) → zaznacza go i zaczyna przesuwanie,
  3. puste miejsce → odznacza.
- `updateCursor(p)` – zmienia kursor: krzyżyk nad uchwytem, strzałki „przesuń”
  nad obrysem.

**Zdarzenia myszy:**

- `pointerdown` (wciśnięcie): w trybie „Zaznacz” → `startSelectDrag`;
  w trybie rysowania pierwsze kliknięcie zapamiętuje punkt i tworzy podgląd,
  drugie kończy kształt.
- `pointermove` (ruch): podczas przeciągania liczy nowy kształt
  (`translate` albo `dragHandle`) i odświeża; podczas rysowania aktualizuje
  podgląd; w pozostałych przypadkach zmienia kursor.
- `pointerup` (puszczenie): kończy przeciąganie i zapisuje zmianę (jeśli
  kształt naprawdę się zmienił); w trybie rysowania – jeśli mysz odjechała
  od pierwszego punktu – od razu kończy kształt (rysowanie przeciągnięciem).
- `pointercancel` – przerwanie (np. utrata kursora) → `cancel()`.

---

### 4.10. `shapeForm.js` – pola tekstowe kształtu

Moduł: `BioEditor.ShapeForm`. Formularz ma dwa tryby:

- **nic nie zaznaczono** → pola dla **nowego** kształtu i przycisk „Dodaj”,
- **zaznaczono kształt** → jego parametry oraz przyciski „Zastosuj zmiany”,
  „Dodaj jako nowy”, „Nadaj bieżący styl”, „Usuń”.

#### `create(root, handlers)`

`handlers` to funkcje z `main.js`: `onAdd`, `onApply`, `onRestyle`, `onDelete`.
Wewnątrz:

- `buildFields(nextType)` – buduje pola (etykieta + pole liczbowe) na
  podstawie `Shapes.TYPES` – nowy typ kształtu nie wymaga zmian w HTML.
- `show(view, hint)` – pokazuje formularz dla danego typu i wartości albo
  (gdy `view` = `null`) samą podpowiedź. Wartości wpisane ręcznie dla nowego
  kształtu zostają, dopóki użytkownik nie zmieni typu ani nie zaznaczy obiektu.
  Ustawia tytuł („Nowy: okrąg” / „Zaznaczony: okrąg”) i widoczność przycisków.
- `read()` – odczytuje pola; niepoprawne (puste, nie-liczba) podświetla na
  czerwono i zwraca `null`.
- `submit(apply)` – odczytuje pola i wywołuje `onApply` (zmień zaznaczony)
  albo `onAdd` (dodaj nowy).

Podpięte zdarzenia: kliknięcia przycisków oraz **Enter** w polu
(= zatwierdzenie).

---

### 4.11. `main.js` – serce aplikacji

Ten plik nie wystawia modułu – od razu uruchamia aplikację. Łączy wszystkie
moduły, trzyma stan dokumentu i obsługuje przyciski.

#### Stałe i stan

- `MAX_UNDO = 30` – ile kroków pamięta „Cofnij”.
- `BLANK_SIZE` – rozmiar nowej kanwy (800×600).
- `state` – stan aplikacji:

| Pole | Znaczenie |
|------|-----------|
| `fileName` | nazwa pliku (do nazwy przy zapisie) |
| `original` | obraz zaraz po wczytaniu (nigdy się nie zmienia) |
| `current` | aktualny obraz (warstwa rastrowa) |
| `shapes` | aktualna lista kształtów |
| `undoStack` | poprzednie stany `{ image, shapes }` do cofania |
| `preview` | niezatwierdzony podgląd jasności/kontrastu (albo `null`) |
| `histogram` | ostatnio policzony histogram (żeby nie liczyć go przy każdej zmianie widoku wykresu) |

- `el` – zebrane w jednym miejscu elementy strony (przyciski, suwaki, kanwy).
- `TOOL_HINTS` – teksty podpowiedzi dla każdego narzędzia rysowania.
- `binChannel`, `histView`, `histOpsMode`, `toolSelector` – przełączniki
  segmentowe (kanał binaryzacji, widok histogramu, tryb operacji, narzędzie).
- `tabs` – zakładki narzędzi (`UI.createTabs`, zapamiętywane w przeglądarce).
- `colorPicker`, `drawing`, `shapeForm` – utworzone panele i narzędzia.

#### Funkcje

- **`showDrawingColor(rgb)`** – wywoływana przez panel „Kolor” po każdej
  zmianie koloru; aktualizuje próbkę „Kolor rysowania” w zakładce Kształty.
  Kliknięcie tej próbki przełącza na zakładkę „Kolor”.
- **`currentStyle()`** – styl nowych kształtów: kolor z panelu „Kolor”
  i grubość z pola „Grubość linii” (ograniczona do 1–50).
- **`redrawHistogram()`** – rysuje wykres z zapamiętanego histogramu (np. po
  przełączeniu R/G/B) bez ponownego liczenia.
- **`render({ histogram })`** – najważniejsza funkcja wyświetlania:
  1. bierze podgląd (jeśli jest) albo aktualny obraz,
  2. nakłada kształty (`Shapes.composite`),
  3. jeśli trzeba – liczy histogram, rysuje go i wypisuje zakres wartości,
  4. dorysowuje uchwyty zaznaczenia,
  5. wyświetla wynik na kanwie.
- **`scheduleRender(withHistogram)`** – „odśwież przy najbliższej klatce”.
  Mysz potrafi zgłosić kilkaset ruchów na sekundę, a ekran odświeża się ~60
  razy – ta funkcja łączy wiele próśb w jedno rysowanie.
- **`showImageRange()`** – napis „Zakres w obrazie: R 12–240 · G … · B …”.
- **`updateControls()`** – włącza/wyłącza przyciski zależnie od stanu
  (np. „Cofnij” tylko gdy jest co cofać; operacje tylko gdy jest obraz)
  i pokazuje kanwę albo napis „Otwórz obraz, aby zacząć pracę”.
- **`syncShapeForm()`** – decyduje, co pokazać w formularzu kształtu:
  parametry zaznaczonego, domyślne dla nowego, albo podpowiedź.
- **`describe(extra)`** – tekst paska statusu: nazwa, rozmiar, liczba kształtów
  i opis ostatniej akcji.
- **`clearPreview()`** – porzuca podgląd jasności/kontrastu i zeruje suwaki.
- **`commit(image, shapes)`** – zapisuje nowy stan dokumentu: obecny stan
  odkłada na stos „Cofnij” (najstarszy usuwa po przekroczeniu 30),
  a nowy obraz i kształty stają się aktualne. Porzuca podgląd.
- **`commitShapes(shapes, selectIndex, label)`** – zapis zmiany kształtów:
  `commit`, zaznaczenie, odświeżenie, status.
- **`replaceSelected(transform, label)`** – podmienia zaznaczony kształt na
  jego zmienioną wersję (np. z nowymi parametrami z formularza).
- **`openDocument(imageData, fileName)`** – nowy dokument (wczytany plik albo
  pusta kanwa): czyści kształty, historię i podgląd, odświeża.
- **`applyOperation(operation, label)`** – wspólny schemat operacji na
  obrazie: mierzy czas, liczy nowy obraz, `commit`, `render`,
  `updateControls`, status „opis: X ms”.
- **`readLevel(input)`** – odczytuje liczbę 0–255 z pola (rozciąganie);
  niepoprawne pole podświetla na czerwono.
- **`updateAdjustPreview()`** – po ruchu suwaka jasności/kontrastu liczy
  podgląd (bez zapisywania w historii) i odświeża obraz razem z histogramem.

#### Obsługa przycisków (zdarzenia)

| Element | Co robi |
|---------|---------|
| „Otwórz obraz…” | otwiera okno wyboru pliku; po wyborze `loadImageData` → `openDocument` |
| „Nowa kanwa” | `createBlankImage(800, 600)` → `openDocument` |
| „Zapisz jako PNG” | obraz (lub podgląd) + kształty → `saveImageDataAsPng` |
| suwak „Próg” | aktualizuje liczbę obok suwaka |
| „Zastosuj próg” | `binarize` z wybranym kanałem i progiem |
| „Metoda Otsu” | histogram obrazu → `otsuThreshold` → `binarize`; ustawia suwak na wyznaczony próg |
| „Rozciągnij” | `stretchHistogram` z zakresem z pól „od”/„do” i wybranym trybem |
| „Wyrównaj” | `equalizeHistogram` z wybranym trybem |
| „Negatyw” | `invert` |
| suwaki jasności i kontrastu | `updateAdjustPreview` (podgląd na żywo) |
| „Zastosuj” (jasność) | zapisuje podgląd jako nowy obraz w historii |
| „Wyzeruj” | porzuca podgląd |
| „Spłaszcz kształty” | wtapia kształty w obraz (`composite`), lista kształtów pusta |
| „Cofnij” | zdejmuje ostatni stan ze stosu i przywraca go |
| „Przywróć oryginał” | wraca do obrazu po wczytaniu, bez kształtów (też można cofnąć) |
| „Skala logarytmiczna” | przerysowuje histogram |
| klawisz Esc | przerywa rysowanie / odznacza kształt |
| klawisz Delete / Backspace | usuwa zaznaczony kształt |

Skróty klawiszowe są ignorowane, gdy kursor jest w polu tekstowym (żeby
Backspace kasował znaki, a nie kształt).

#### Start aplikacji

Na końcu pliku: ustawienie podpowiedzi narzędzia, narysowanie pustego
histogramu z osią, przygotowanie formularza kształtów i stanu przycisków.

---

## 5. Scenariusze: co się dzieje po kliknięciu

### 5.1. Wczytanie zdjęcia

1. Klik „Otwórz obraz…” → `main.js` programowo klika ukryte pole wyboru pliku.
2. Użytkownik wybiera plik → zdarzenie `change`.
3. `ImageIO.loadImageData(file)` dekoduje plik i zwraca piksele.
4. `openDocument`: `original` = `current` = wczytany obraz, brak kształtów,
   pusta historia.
5. `render()`: kopia obrazu → `Histogram.compute` → wykres → kanwa.
6. `updateControls()` włącza przyciski; pasek statusu: „zdjecie • 512×512 px”.

### 5.2. Binaryzacja metodą Otsu

1. Wybór kanału (np. „Średnia”) i klik „Metoda Otsu”.
2. `applyOperation` uruchamia stoper.
3. `Histogram.compute(current)` → histogram średniej.
4. `otsuThreshold` sprawdza wszystkie progi 0–255 i wybiera najlepszy, np. 117.
5. `binarize(current, { channel: 'avg', threshold: 117 })` → nowy obraz.
6. `commit`: stary obraz na stos „Cofnij”, nowy jako aktualny.
7. `render` + `updateControls`; status: „binaryzacja Otsu (avg, wyznaczony
   próg 117): 9.3 ms”; suwak progu przesuwa się na 117.

### 5.3. Rysowanie linii myszą

1. Wybór narzędzia „Linia” → `drawing.setTool('line')`, kursor-krzyżyk,
   formularz pokazuje pola nowej linii.
2. Pierwsze kliknięcie → `pending` = punkt, `preview` = linia o długości 0.
3. Ruch myszy → `preview` = linia od `pending` do kursora → `scheduleRender`
   (płynny podgląd).
4. Drugie kliknięcie → `finishShape`: `Shapes.fromPoints('line', ...)`
   z kolorem z panelu „Kolor” → nowa lista kształtów → `main.js`
   `commitShapes` → linia zaznaczona, formularz pokazuje jej współrzędne.
5. `render` → `composite` → `Raster.drawLine` (Bresenham) maluje piksele.

### 5.4. Przesunięcie i zmiana rozmiaru okręgu

1. Narzędzie „Zaznacz”, wciśnięcie myszy na obrysie okręgu →
   `hitTest` = prawda → zaznaczenie i `drag = { kind: 'move', ... }`.
2. Ruch → `Shapes.translate(origin, dx, dy)` → podgląd.
3. Puszczenie → zapis zmiany w historii.
4. Wciśnięcie na kwadraciku po prawej (`e`) → `drag = { kind: 'handle' }`.
5. Ruch → `Shapes.dragHandle` → promień = odległość kursora od środka.

### 5.5. Wybór koloru w CMYK

1. Przełącznik „CMYK” → widać pola C, M, Y, K.
2. Wpisanie M = 100 → `setCmyk` → `cmykToRgb` → np. przy C = Y = K = 0 wychodzi RGB(255, 0, 255).
3. `update()` odświeża panel: próbka, „Wybrany (CMYK)”, „Po konwersji (RGB)”,
   HEX, gradienty na suwakach, położenie znacznika w kwadracie.
4. Następny rysowany kształt dostaje ten kolor (`currentStyle()`).

### 5.6. Suwak jasności

1. Przesunięcie suwaka → `updateAdjustPreview` → `state.preview` =
   `adjustBrightnessContrast(current, ...)`.
2. `scheduleRender(true)` → na ekranie i w histogramie widać podgląd;
   historia się nie zmienia.
3. „Zastosuj” → podgląd staje się nowym obrazem (`applyOperation`);
   „Wyzeruj” albo dowolna inna operacja → podgląd znika.

### 5.7. Cofnij

1. Klik „Cofnij” → zdjęcie ostatniego `{ image, shapes }` ze stosu.
2. Przywrócenie obrazu i kształtów, zdjęcie zaznaczenia, `render`.

---

## 6. Słowniczek pojęć

| Pojęcie | Wyjaśnienie |
|---------|-------------|
| **Zakładka** | Przycisk w pionowym pasku po lewej; pokazuje jeden panel narzędzi. |
| **Zmienna CSS** | Nazwana wartość w stylach, np. `--accent: #4f8cff`; zmiana w jednym miejscu zmienia kolor w całej aplikacji. |
| **Piksel** | Najmniejszy punkt obrazu; ma kolor zapisany jako R, G, B (+ A). |
| **Kanał** | Jedna składowa koloru dla wszystkich pikseli (np. kanał R = same wartości czerwieni). |
| **Bufor** | Tablica w pamięci z liczbami pikseli. |
| **Kanwa (canvas)** | Element strony, na którym wyświetlamy piksele. |
| **Histogram** | Ile pikseli ma każdą z wartości 0–255. |
| **Binaryzacja** | Zamiana obrazu na dwa kolory: czarny i biały, według progu. |
| **Próg** | Wartość graniczna: powyżej (lub równo) – biały, poniżej – czarny. |
| **Metoda Otsu** | Automatyczny wybór progu, który najlepiej rozdziela ciemne i jasne piksele. |
| **Rozciąganie histogramu** | Liniowe przeskalowanie zakresu wartości obrazu na zadany zakres – poprawia kontrast. |
| **Wyrównanie histogramu** | Przekształcenie, po którym wartości są rozłożone możliwie równomiernie (na podstawie dystrybuanty). |
| **Dystrybuanta (CDF)** | Dla wartości v: ile pikseli ma wartość ≤ v. |
| **LUT** | Tabela 256 gotowych wyników – „dla wartości v wynik to lut[v]”. |
| **Operacja punktowa** | Przekształcenie, w którym nowy piksel zależy tylko od jego starej wartości. |
| **Rasteryzacja** | Zamiana opisu geometrycznego (linia, okrąg) na konkretne piksele. |
| **Algorytm Bresenhama** | Rysowanie odcinka tylko na liczbach całkowitych. |
| **Algorytm midpoint** | Rysowanie okręgu z decyzją na podstawie punktu środkowego i symetrii 8-krotnej. |
| **Uchwyt** | Kwadracik na kształcie, za który chwyta się myszą, żeby zmienić kształt. |
| **Hit-test** | Sprawdzenie, czy kliknięcie trafiło w obiekt. |
| **RGB / CMYK / HSV** | Sposoby opisu koloru: światło / farba / odcień-nasycenie-jasność. |
| **Stos Cofnij** | Lista poprzednich stanów; „Cofnij” zdejmuje ostatni. |
| **Podgląd (preview)** | Wynik pokazany na ekranie, ale jeszcze niezapisany w historii. |
| **Zdarzenie** | Sygnał od przeglądarki, że coś się stało (klik, ruch myszy, klawisz). |
| **Moduł** | Plik JS wystawiający zestaw funkcji pod jedną nazwą w `BioEditor`. |
