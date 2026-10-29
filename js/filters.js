/**
 * filters.js – filtry kontekstowe (sąsiedztwa) i morfologia matematyczna.
 *
 * W odróżnieniu od operacji punktowych (imageProcessing.js) wynik piksela
 * zależy tu od jego SĄSIADÓW – okna k × k wokół niego. Dlatego nie da się
 * ich sprowadzić do tablicy LUT, a koszt rośnie z rozmiarem okna; dla
 * każdego filtra stosujemy sztuczkę, która ten koszt ogranicza.
 *
 * Krawędzie obrazu: brakujących sąsiadów za brzegiem zastępujemy najbliższym
 * pikselem brzegowym ("powielenie brzegu", ang. clamp / replicate). Okno ma
 * wtedy zawsze pełne k × k elementów i brzeg nie ciemnieje.
 *
 * Wszystkie funkcje są czyste: nie zmieniają obrazu wejściowego, zwracają nowy.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

  /** Średnia kanałów jako obraz szarości (Uint8Array W·H). */
  function toGray(src) {
    const s = src.data;
    const gray = new Uint8Array(src.width * src.height);
    for (let i = 0, p = 0; i < s.length; i += 4, p++) gray[p] = ((s[i] + s[i + 1] + s[i + 2]) / 3) | 0;
    return gray;
  }

  /** Obraz szarości (W·H) -> ImageData (R = G = B), alfa z obrazu źródłowego. */
  function fromGray(gray, src) {
    const s = src.data;
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0, p = 0; i < s.length; i += 4, p++) {
      out[i] = out[i + 1] = out[i + 2] = gray[p];
      out[i + 3] = s[i + 3];
    }
    return new ImageData(out, src.width, src.height);
  }

  // ---------- Filtr uśredniający ----------

  /**
   * Filtr wygładzający (uśredniający, "box blur") z oknem size × size.
   *
   * Wynik piksela = średnia wartości w oknie wokół niego. Liczone wprost
   * kosztowałoby size² operacji na piksel. Korzystamy z dwóch obserwacji:
   *
   * 1. Rozdzielność: średnia w kwadracie = średnia (w pionie) ze średnich
   *    w poziomie. Robimy więc dwa przebiegi z oknem 1-wymiarowym:
   *    najpierw wiersze, potem kolumny.
   * 2. Suma krocząca: przesuwając okno o 1 piksel, dodajemy wartość, która
   *    weszła, i odejmujemy tę, która wypadła – zamiast sumować od nowa.
   *
   * Koszt: O(W·H) niezależnie od rozmiaru okna (okno 31×31 liczy się
   * tak samo szybko jak 3×3).
   *
   * @param {ImageData} src
   * @param {{size: number}} options rozmiar okna (nieparzysty, >= 1)
   * @returns {ImageData} nowy obraz
   */
  function meanFilter(src, { size }) {
    const W = src.width;
    const H = src.height;
    const r = size >> 1;
    const n = 2 * r + 1;
    const s = src.data;
    const tmp = new Float32Array(s.length); // sumy poziome
    const out = new Uint8ClampedArray(s.length);

    // Przebieg 1: suma krocząca w każdym wierszu
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += s[(row + clamp(k, 0, W - 1)) * 4 + c];
        for (let x = 0; x < W; x++) {
          tmp[(row + x) * 4 + c] = sum;
          const outX = clamp(x - r, 0, W - 1);     // wypada z okna
          const inX = clamp(x + r + 1, 0, W - 1);  // wchodzi do okna
          sum += s[(row + inX) * 4 + c] - s[(row + outX) * 4 + c];
        }
      }
    }

    // Przebieg 2: suma krocząca w każdej kolumnie (z sum poziomych) i dzielenie
    const area = n * n;
    for (let x = 0; x < W; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += tmp[(clamp(k, 0, H - 1) * W + x) * 4 + c];
        for (let y = 0; y < H; y++) {
          out[(y * W + x) * 4 + c] = sum / area;
          const outY = clamp(y - r, 0, H - 1);
          const inY = clamp(y + r + 1, 0, H - 1);
          sum += tmp[(inY * W + x) * 4 + c] - tmp[(outY * W + x) * 4 + c];
        }
      }
    }

    for (let i = 3; i < s.length; i += 4) out[i] = s[i];
    return new ImageData(out, W, H);
  }

  // ---------- Filtr medianowy ----------

  /**
   * Filtr medianowy z oknem size × size (każdy kanał osobno).
   *
   * Mediana = wartość środkowa po posortowaniu wartości z okna. Dobrze
   * usuwa szum typu "sól i pieprz" (pojedyncze białe/czarne piksele),
   * bo skrajne wartości trafiają na koniec listy i nie wpływają na wynik,
   * a przy tym – inaczej niż średnia – nie rozmywa krawędzi.
   *
   * Sortowanie okna w każdym pikselu byłoby drogie. Używamy algorytmu
   * Huanga: dla okna trzymamy HISTOGRAM jego wartości (256 liczników).
   * Przesuwając okno o 1 piksel w prawo, usuwamy z histogramu kolumnę,
   * która wypadła, i dodajemy kolumnę, która weszła (2·size operacji).
   * Medianę śledzimy wskaźnikiem `med` i licznikiem `lt` = ile wartości
   * w oknie jest mniejszych od `med`; po każdym przesunięciu wskaźnik
   * przesuwa się zwykle tylko o kilka pozycji.
   *
   * Koszt: O(W·H·size) zamiast O(W·H·size²·log size).
   *
   * @param {ImageData} src
   * @param {{size: number}} options rozmiar okna (nieparzysty, >= 1)
   * @returns {ImageData} nowy obraz
   */
  function medianFilter(src, { size }) {
    const W = src.width;
    const H = src.height;
    const r = size >> 1;
    const n = 2 * r + 1;
    const half = (n * n) >> 1; // mediana = wartość, przed którą jest `half` mniejszych
    const s = src.data;
    const out = new Uint8ClampedArray(s.length);
    const hist = new Uint32Array(256);
    const px = (x, y, c) => s[(clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)) * 4 + c];

    for (let c = 0; c < 3; c++) {
      for (let y = 0; y < H; y++) {
        // Histogram pierwszego okna w wierszu
        hist.fill(0);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) hist[px(dx, y + dy, c)]++;
        }
        let med = 0;
        let lt = 0;
        while (lt + hist[med] <= half) lt += hist[med++];

        for (let x = 0; x < W; x++) {
          out[(y * W + x) * 4 + c] = med;
          if (x === W - 1) break;

          // Przesunięcie okna: kolumna x − r wypada, kolumna x + r + 1 wchodzi
          for (let dy = -r; dy <= r; dy++) {
            const vOut = px(x - r, y + dy, c);
            const vIn = px(x + r + 1, y + dy, c);
            hist[vOut]--;
            if (vOut < med) lt--;
            hist[vIn]++;
            if (vIn < med) lt++;
          }
          // Korekta wskaźnika mediany
          while (lt > half) lt -= hist[--med];
          while (lt + hist[med] <= half) lt += hist[med++];
        }
      }
    }

    for (let i = 3; i < s.length; i += 4) out[i] = s[i];
    return new ImageData(out, W, H);
  }

  // ---------- Sobel ----------

  /**
   * Wykrywanie krawędzi operatorem Sobela (na obrazie szarości).
   *
   * Krawędź to miejsce, gdzie jasność szybko się zmienia, czyli gdzie
   * pochodna (gradient) jest duża. Sobel przybliża pochodne maskami 3×3:
   *
   *        Gx                Gy
   *   -1  0  +1        -1  -2  -1
   *   -2  0  +2         0   0   0
   *   -1  0  +1        +1  +2  +1
   *
   * Gx reaguje na krawędzie pionowe (zmiana w poziomie), Gy na poziome.
   * Środkowy wiersz/kolumna ma wagę 2 – to lekkie wygładzenie, dzięki
   * któremu Sobel jest mniej czuły na szum niż prosta różnica sąsiadów.
   * Siła krawędzi: |G| = √(Gx² + Gy²), przycięta do 0–255.
   *
   * @param {ImageData} src
   * @param {{mode: 'magnitude'|'x'|'y'}} options co pokazać: |G|, |Gx| lub |Gy|
   * @returns {ImageData} nowy obraz (szary)
   */
  function sobel(src, { mode }) {
    const W = src.width;
    const H = src.height;
    const g = toGray(src);
    const out = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      const ym = (y > 0 ? y - 1 : 0) * W;
      const y0 = y * W;
      const yp = (y < H - 1 ? y + 1 : y) * W;
      for (let x = 0; x < W; x++) {
        const xm = x > 0 ? x - 1 : 0;
        const xp = x < W - 1 ? x + 1 : x;
        const gx = (g[ym + xp] + 2 * g[y0 + xp] + g[yp + xp]) - (g[ym + xm] + 2 * g[y0 + xm] + g[yp + xm]);
        const gy = (g[yp + xm] + 2 * g[yp + x] + g[yp + xp]) - (g[ym + xm] + 2 * g[ym + x] + g[ym + xp]);
        const v = mode === 'x' ? Math.abs(gx) : mode === 'y' ? Math.abs(gy) : Math.sqrt(gx * gx + gy * gy);
        out[y0 + x] = v > 255 ? 255 : v;
      }
    }
    return fromGray(out, src);
  }

  // ---------- Morfologia ----------

  /**
   * Tworzy element strukturyzujący (maskę) w × h z gotowego kształtu.
   * Element: { width, height, data } – data[y·width + x] = 1 (aktywne) lub 0.
   * Punkt centralny (odniesienia) to (⌊w/2⌋, ⌊h/2⌋).
   *
   * @param {number} width
   * @param {number} height
   * @param {'square'|'cross'|'disk'|'empty'} shape
   * @returns {{width: number, height: number, data: Uint8Array}}
   */
  function createStructuringElement(width, height, shape) {
    const data = new Uint8Array(width * height);
    const cx = width >> 1;
    const cy = height >> 1;
    // Promienie elipsy wpisanej w prostokąt (dla 'disk')
    const rx = width / 2;
    const ry = height / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let on = 0;
        if (shape === 'square') on = 1;
        else if (shape === 'cross') on = x === cx || y === cy ? 1 : 0;
        else if (shape === 'disk') {
          const nx = (x + 0.5 - rx) / rx;
          const ny = (y + 0.5 - ry) / ry;
          on = nx * nx + ny * ny <= 1 ? 1 : 0;
        }
        data[y * width + x] = on;
      }
    }
    return { width, height, data };
  }

  /** Lista przesunięć (dx, dy) aktywnych pól elementu względem jego środka. */
  function elementOffsets(element) {
    const cx = element.width >> 1;
    const cy = element.height >> 1;
    const offsets = [];
    for (let y = 0; y < element.height; y++) {
      for (let x = 0; x < element.width; x++) {
        if (element.data[y * element.width + x]) offsets.push([x - cx, y - cy]);
      }
    }
    return offsets;
  }

  /**
   * Obraz binarny (Uint8Array 0/1) z dowolnego obrazu: obiekt (1) = biały,
   * czyli średnia kanałów >= 128. Obraz już zbinaryzowany (0 i 255)
   * przechodzi bez zmian, a kolorowy jest progowany w połowie skali.
   */
  function toBinary(src) {
    const g = toGray(src);
    for (let p = 0; p < g.length; p++) g[p] = g[p] >= 128 ? 1 : 0;
    return g;
  }

  function binaryToImage(bin, src) {
    for (let p = 0; p < bin.length; p++) bin[p] = bin[p] ? 255 : 0;
    return fromGray(bin, src);
  }

  /**
   * Wspólny rdzeń dylatacji i erozji.
   *
   * Dylatacja A ⊕ B: piksel staje się obiektem, jeśli element B (odbity
   * względem środka) przyłożony w tym miejscu trafia w CHOCIAŻ JEDEN piksel
   * obiektu:  wynik(p) = max po b ∈ B z A(p − b).
   * Erozja A ⊖ B: piksel zostaje obiektem tylko, jeśli element B przyłożony
   * w tym miejscu mieści się CAŁY w obiekcie:  wynik(p) = min po b ∈ B z A(p + b).
   *
   * Odbicie (p − b zamiast p + b) ma znaczenie tylko dla elementów
   * niesymetrycznych – dzięki niemu dylatacja i erozja są operacjami
   * dualnymi, a otwarcie/zamknięcie mają poprawne własności.
   * Piksele spoza obrazu są pomijane (nie są ani obiektem, ani tłem).
   *
   * Pętla kończy się wcześniej, gdy wynik jest już przesądzony
   * (dylatacja: znaleziono obiekt; erozja: znaleziono tło).
   * Koszt: O(W·H·|B|), gdzie |B| – liczba aktywnych pól elementu.
   */
  function morph(bin, W, H, offsets, isDilation) {
    const out = new Uint8Array(W * H);
    const sign = isDilation ? -1 : 1;
    const target = isDilation ? 1 : 0; // wartość, która przesądza o wyniku
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let result = 1 - target;
        for (let k = 0; k < offsets.length; k++) {
          const nx = x + sign * offsets[k][0];
          const ny = y + sign * offsets[k][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (bin[ny * W + nx] === target) {
            result = target;
            break;
          }
        }
        out[y * W + x] = result;
      }
    }
    return out;
  }

  /**
   * Operacja morfologiczna na obrazie (najpierw zamiana na binarny).
   *   'dilate' – dylatacja: obiekty się rozrastają, małe dziury znikają,
   *   'erode'  – erozja: obiekty się kurczą, drobne elementy znikają,
   *   'open'   – otwarcie = erozja, potem dylatacja (usuwa drobny szum),
   *   'close'  – zamknięcie = dylatacja, potem erozja (zamyka dziury i przerwy).
   *
   * @param {ImageData} src
   * @param {{operation: 'dilate'|'erode'|'open'|'close',
   *          element: {width: number, height: number, data: Uint8Array}}} options
   * @returns {ImageData} nowy obraz binarny (0 / 255)
   */
  function morphology(src, { operation, element }) {
    const W = src.width;
    const H = src.height;
    const offsets = elementOffsets(element);
    let bin = toBinary(src);
    if (offsets.length === 0) return binaryToImage(bin, src); // pusty element – nic do zrobienia

    const steps = { dilate: [true], erode: [false], open: [false, true], close: [true, false] }[operation];
    for (const isDilation of steps) bin = morph(bin, W, H, offsets, isDilation);
    return binaryToImage(bin, src);
  }

  BioEditor.Filters = {
    toGray,
    fromGray,
    meanFilter,
    medianFilter,
    sobel,
    createStructuringElement,
    morphology,
  };
})(typeof window !== 'undefined' ? window : globalThis);
