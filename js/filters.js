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
   * Zasięg okna o długości n wokół piksela: ile pól na lewo/w górę (before)
   * i na prawo/w dół (after). Dla n nieparzystego okno jest symetryczne
   * (n = 5 → 2 + 1 + 2); dla parzystego przesunięte o pół piksela
   * w prawo/w dół (n = 4 → 1 + 1 + 2), bo piksel nie ma "środka między polami".
   */
  function windowExtent(n) {
    const before = (n - 1) >> 1;
    return { before, after: n - 1 - before };
  }

  /**
   * Filtr medianowy z oknem width × height (każdy kanał osobno).
   * Okno może mieć dowolne wymiary – także prostokątne (np. 9×1 usuwa
   * zakłócenia tylko w poziomie) i parzyste.
   *
   * Mediana = wartość środkowa po posortowaniu wartości z okna. Dobrze
   * usuwa szum typu "sól i pieprz" (pojedyncze białe/czarne piksele),
   * bo skrajne wartości trafiają na koniec listy i nie wpływają na wynik,
   * a przy tym – inaczej niż średnia – nie rozmywa krawędzi.
   * Przy parzystej liczbie pól bierzemy górną z dwóch wartości środkowych.
   *
   * Sortowanie okna w każdym pikselu byłoby drogie. Używamy algorytmu
   * Huanga: dla okna trzymamy HISTOGRAM jego wartości (256 liczników).
   * Przesuwając okno o 1 piksel w prawo, usuwamy z histogramu kolumnę,
   * która wypadła, i dodajemy kolumnę, która weszła (2·height operacji).
   * Medianę śledzimy wskaźnikiem `med` i licznikiem `lt` = ile wartości
   * w oknie jest mniejszych od `med`; po każdym przesunięciu wskaźnik
   * przesuwa się zwykle tylko o kilka pozycji.
   *
   * Koszt: O(W·H·height) zamiast O(W·H·width·height·log(width·height)).
   *
   * @param {ImageData} src
   * @param {{size?: number, width?: number, height?: number}} options
   *   wymiary okna (>= 1); `size` = okno kwadratowe size × size
   * @returns {ImageData} nowy obraz
   */
  function medianFilter(src, { size, width = size, height = size }) {
    const W = src.width;
    const H = src.height;
    const ex = windowExtent(width);
    const ey = windowExtent(height);
    const half = (width * height) >> 1; // mediana = wartość, przed którą jest `half` mniejszych
    const s = src.data;
    const out = new Uint8ClampedArray(s.length);
    const hist = new Uint32Array(256);
    const px = (x, y, c) => s[(clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)) * 4 + c];

    for (let c = 0; c < 3; c++) {
      for (let y = 0; y < H; y++) {
        // Histogram pierwszego okna w wierszu
        hist.fill(0);
        for (let dy = -ey.before; dy <= ey.after; dy++) {
          for (let dx = -ex.before; dx <= ex.after; dx++) hist[px(dx, y + dy, c)]++;
        }
        let med = 0;
        let lt = 0;
        while (lt + hist[med] <= half) lt += hist[med++];

        for (let x = 0; x < W; x++) {
          out[(y * W + x) * 4 + c] = med;
          if (x === W - 1) break;

          // Przesunięcie okna: kolumna x − before wypada, kolumna x + after + 1 wchodzi
          for (let dy = -ey.before; dy <= ey.after; dy++) {
            const vOut = px(x - ex.before, y + dy, c);
            const vIn = px(x + ex.after + 1, y + dy, c);
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

  // ---------- Pikselizacja, Kuwahara, MinRGB, Predator ----------

  /**
   * Pikselizacja: obraz dzielimy na prostokątne bloki blockW × blockH
   * (od lewego górnego rogu) i każdy blok wypełniamy ŚREDNIM kolorem jego
   * pikseli. Bloki przy prawym i dolnym brzegu mogą być mniejsze.
   *
   * Dwa przebiegi: najpierw sumujemy R, G, B w każdym bloku (tablice sum
   * o rozmiarze liczby bloków), potem wpisujemy średnie. Koszt: O(W·H),
   * niezależnie od rozmiaru bloku.
   *
   * @param {ImageData} src
   * @param {{blockW: number, blockH: number}} options rozmiar bloku (>= 1)
   * @returns {ImageData} nowy obraz
   */
  function pixelate(src, { blockW, blockH }) {
    const W = src.width;
    const H = src.height;
    const s = src.data;
    const bx = Math.ceil(W / blockW);
    const by = Math.ceil(H / blockH);
    const sums = new Float64Array(bx * by * 3);
    const counts = new Uint32Array(bx * by);

    for (let y = 0; y < H; y++) {
      const rowBlock = ((y / blockH) | 0) * bx;
      for (let x = 0; x < W; x++) {
        const b = rowBlock + ((x / blockW) | 0);
        const i = (y * W + x) * 4;
        sums[b * 3] += s[i];
        sums[b * 3 + 1] += s[i + 1];
        sums[b * 3 + 2] += s[i + 2];
        counts[b]++;
      }
    }

    const out = new Uint8ClampedArray(s.length);
    for (let y = 0; y < H; y++) {
      const rowBlock = ((y / blockH) | 0) * bx;
      for (let x = 0; x < W; x++) {
        const b = rowBlock + ((x / blockW) | 0);
        const i = (y * W + x) * 4;
        out[i] = sums[b * 3] / counts[b];
        out[i + 1] = sums[b * 3 + 1] / counts[b];
        out[i + 2] = sums[b * 3 + 2] / counts[b];
        out[i + 3] = s[i + 3];
      }
    }
    return new ImageData(out, W, H);
  }

  /**
   * Filtr Kuwahary – wygładzanie, które ZACHOWUJE krawędzie (efekt
   * "obrazu malowanego farbą").
   *
   * Okno size × size wokół piksela (size = 2r + 1) dzielimy na 4 nakładające
   * się kwadraty (r + 1) × (r + 1), każdy zawiera piksel środkowy:
   *
   *   ┌───┬───┐
   *   │ A │ B │   A – lewy górny, B – prawy górny,
   *   ├───●───┤   C – lewy dolny, D – prawy dolny
   *   │ C │ D │   (● – piksel środkowy, należy do wszystkich czterech)
   *   └───┴───┘
   *
   * Dla każdego kwadratu liczymy średnią i wariancję jasności. Wynik =
   * średni kolor kwadratu o NAJMNIEJSZEJ wariancji, czyli najbardziej
   * jednolitego. Przy krawędzi kwadrat leżący w poprzek krawędzi ma dużą
   * wariancję i zostaje pominięty – dlatego krawędź się nie rozmywa.
   *
   * Średnie i wariancje liczymy z obrazów całkowych (sumy R, G, B, jasności
   * i kwadratów jasności): suma dowolnego prostokąta = 4 odczyty.
   * Koszt: O(W·H), niezależnie od rozmiaru okna.
   *
   * @param {ImageData} src
   * @param {{size: number}} options rozmiar okna (nieparzysty, >= 3)
   * @returns {ImageData} nowy obraz
   */
  function kuwahara(src, { size }) {
    const W = src.width;
    const H = src.height;
    const r = size >> 1;
    const s = src.data;
    const W1 = W + 1;
    const n1 = W1 * (H + 1);
    const iR = new Float64Array(n1);
    const iG = new Float64Array(n1);
    const iB = new Float64Array(n1);
    const iY = new Float64Array(n1);
    const iY2 = new Float64Array(n1);

    // Obrazy całkowe: I(x+1, y+1) = suma pikseli w [0..x] × [0..y]
    for (let y = 0; y < H; y++) {
      let sr = 0, sg = 0, sb = 0, sy = 0, sy2 = 0;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const lum = (s[i] + s[i + 1] + s[i + 2]) / 3;
        sr += s[i];
        sg += s[i + 1];
        sb += s[i + 2];
        sy += lum;
        sy2 += lum * lum;
        const k = (y + 1) * W1 + x + 1;
        const up = y * W1 + x + 1;
        iR[k] = iR[up] + sr;
        iG[k] = iG[up] + sg;
        iB[k] = iB[up] + sb;
        iY[k] = iY[up] + sy;
        iY2[k] = iY2[up] + sy2;
      }
    }
    // Suma prostokąta [x0, x1] × [y0, y1] (włącznie, już przycięte do obrazu)
    const rect = (I, x0, y0, x1, y1) =>
      I[(y1 + 1) * W1 + x1 + 1] - I[y0 * W1 + x1 + 1] - I[(y1 + 1) * W1 + x0] + I[y0 * W1 + x0];

    const out = new Uint8ClampedArray(s.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const xl = Math.max(0, x - r);
        const xr = Math.min(W - 1, x + r);
        const yt = Math.max(0, y - r);
        const yb = Math.min(H - 1, y + r);
        // Cztery kwadraty: [x0, y0, x1, y1]
        const quads = [
          [xl, yt, x, y],
          [x, yt, xr, y],
          [xl, y, x, yb],
          [x, y, xr, yb],
        ];
        let best = 0;
        let bestVar = Infinity;
        for (let q = 0; q < 4; q++) {
          const [x0, y0, x1, y1] = quads[q];
          const n = (x1 - x0 + 1) * (y1 - y0 + 1);
          const m = rect(iY, x0, y0, x1, y1) / n;
          const v = rect(iY2, x0, y0, x1, y1) / n - m * m;
          if (v < bestVar) {
            bestVar = v;
            best = q;
          }
        }
        const [x0, y0, x1, y1] = quads[best];
        const n = (x1 - x0 + 1) * (y1 - y0 + 1);
        const i = (y * W + x) * 4;
        out[i] = rect(iR, x0, y0, x1, y1) / n;
        out[i + 1] = rect(iG, x0, y0, x1, y1) / n;
        out[i + 2] = rect(iB, x0, y0, x1, y1) / n;
        out[i + 3] = s[i + 3];
      }
    }
    return new ImageData(out, W, H);
  }

  /**
   * MinRGB (w GIMP-ie: "Maximum RGB" w trybie minimum): w każdym pikselu
   * zostaje tylko kanał o NAJMNIEJSZEJ wartości, pozostałe są zerowane.
   * Np. (200, 50, 120) → (0, 50, 0). Przy remisie zostają wszystkie
   * kanały o tej samej najmniejszej wartości (szary piksel się nie zmienia).
   *
   * @param {ImageData} src
   * @returns {ImageData} nowy obraz
   */
  function minRgb(src) {
    const s = src.data;
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < s.length; i += 4) {
      const m = Math.min(s[i], s[i + 1], s[i + 2]);
      out[i] = s[i] === m ? m : 0;
      out[i + 1] = s[i + 1] === m ? m : 0;
      out[i + 2] = s[i + 2] === m ? m : 0;
      out[i + 3] = s[i + 3];
    }
    return new ImageData(out, src.width, src.height);
  }

  /**
   * Sobel osobno dla każdego kanału R, G, B (krawędzie kolorowe),
   * siła krawędzi mnożona przez `amount` i przycinana do 255.
   * Te same maski co w sobel(), ale bez zamiany na szarość.
   */
  function sobelRgb(src, { amount }) {
    const W = src.width;
    const H = src.height;
    const s = src.data;
    const out = new Uint8ClampedArray(s.length);
    for (let y = 0; y < H; y++) {
      const ym = (y > 0 ? y - 1 : 0) * W;
      const y0 = y * W;
      const yp = (y < H - 1 ? y + 1 : y) * W;
      for (let x = 0; x < W; x++) {
        const xm = x > 0 ? x - 1 : 0;
        const xp = x < W - 1 ? x + 1 : x;
        for (let c = 0; c < 3; c++) {
          const v = (p) => s[p * 4 + c];
          const gx = (v(ym + xp) + 2 * v(y0 + xp) + v(yp + xp)) - (v(ym + xm) + 2 * v(y0 + xm) + v(yp + xm));
          const gy = (v(yp + xm) + 2 * v(yp + x) + v(yp + xp)) - (v(ym + xm) + 2 * v(ym + x) + v(ym + xp));
          out[(y0 + x) * 4 + c] = amount * Math.sqrt(gx * gx + gy * gy);
        }
        out[(y0 + x) * 4 + 3] = s[(y0 + x) * 4 + 3];
      }
    }
    return new ImageData(out, W, H);
  }

  /**
   * Filtr Predatora (jak skrypt "Predator" z GIMP-a) – efekt "widzenia
   * termowizyjnego" z filmu. Trzy kroki w tej kolejności:
   *   1. pikselizacja (bloki pixelSize × pixelSize) – uproszczenie obrazu
   *      do dużych plam koloru,
   *   2. MinRGB – w każdym pikselu zostaje tylko najsłabszy kanał, przez
   *      co plamy dostają czyste, nasycone barwy (czerwień, zieleń, błękit),
   *   3. Sobel na każdym kanale osobno – zostają świecące, kolorowe
   *      krawędzie plam na czarnym tle (wzmocnione `amount` razy).
   * pixelSize <= 1 pomija pikselizację.
   *
   * @param {ImageData} src
   * @param {{pixelSize: number, amount: number}} options
   * @returns {ImageData} nowy obraz
   */
  function predator(src, { pixelSize, amount }) {
    const pixelated = pixelSize > 1 ? pixelate(src, { blockW: pixelSize, blockH: pixelSize }) : src;
    return sobelRgb(minRgb(pixelated), { amount });
  }

  BioEditor.Filters = {
    toGray,
    fromGray,
    meanFilter,
    medianFilter,
    sobel,
    sobelRgb,
    pixelate,
    kuwahara,
    minRgb,
    predator,
    createStructuringElement,
    morphology,
  };
})(typeof window !== 'undefined' ? window : globalThis);
