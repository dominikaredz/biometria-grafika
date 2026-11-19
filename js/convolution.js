/**
 * convolution.js – filtry liniowe oparte o splot (konwolucję) z dowolną maską.
 *
 * Splot obrazu I z maską (jądrem, ang. kernel) K:
 *
 *   wynik(x, y) = offset + ( Σ_i Σ_j K(i, j) · I(x − i, y − j) ) / dzielnik
 *
 * gdzie (i, j) przebiega pola maski liczone względem jej środka.
 * Każdy piksel wyniku to więc ważona suma sąsiadów – wagi to liczby
 * w masce. Zmieniając same liczby, dostajemy zupełnie różne filtry:
 * rozmycie (wszystkie wagi dodatnie), wykrywanie krawędzi (wagi dodatnie
 * i ujemne o sumie 0), wyostrzanie (duży środek, ujemne otoczenie)…
 *
 * "x − i" (a nie "x + i") to odwrócenie maski, które odróżnia splot od
 * korelacji. Dla masek symetrycznych (Gauss, Laplasjan) nie ma znaczenia;
 * dla Sobela/Prewitta zmienia tylko znak wyniku.
 *
 * Moduł bez DOM – funkcje są czyste i dają się testować w Node.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

  /**
   * Maska: { width, height, data } – data to wiersze wag ułożone kolejno
   * (data[y · width + x]). Środek maski to pole (⌊(w−1)/2⌋, ⌊(h−1)/2⌋),
   * więc maski parzyste też działają (środek przesunięty o pół piksela).
   */
  function makeKernel(rows) {
    const height = rows.length;
    const width = rows[0].length;
    return { width, height, data: Float64Array.from(rows.flat()) };
  }

  /** Suma wag maski – domyślny dzielnik (żeby rozmycie nie zmieniało jasności). */
  function kernelSum(kernel) {
    let sum = 0;
    for (let i = 0; i < kernel.data.length; i++) sum += kernel.data[i];
    return sum;
  }

  /**
   * Splot obrazu z maską (każdy kanał R, G, B osobno).
   *
   * Optymalizacja: najpierw zbieramy listę NIEZEROWYCH pól maski (wraz
   * z przesunięciem w buforze), więc np. Laplasjan "+" 3×3 kosztuje
   * 5 mnożeń na piksel zamiast 9. Brakujących sąsiadów za brzegiem
   * zastępuje najbliższy piksel brzegowy (powielenie brzegu).
   * Koszt: O(W·H·liczba_niezerowych_wag).
   *
   * @param {ImageData} src
   * @param {{kernel: {width: number, height: number, data: ArrayLike<number>},
   *          divisor?: number, offset?: number, absolute?: boolean}} options
   *   divisor – przez co dzielić sumę (domyślnie suma wag, a gdy ta wynosi 0 – 1),
   *   offset – stała dodawana do wyniku (np. 128, żeby pokazać wartości ujemne),
   *   absolute – brać wartość bezwzględną (dla detektorów krawędzi)
   * @returns {ImageData} nowy obraz
   */
  function convolve(src, { kernel, divisor, offset = 0, absolute = false }) {
    const W = src.width;
    const H = src.height;
    const s = src.data;
    const sum = kernelSum(kernel);
    const div = divisor || (sum !== 0 ? sum : 1);

    const cx = (kernel.width - 1) >> 1;
    const cy = (kernel.height - 1) >> 1;
    const taps = [];
    for (let j = 0; j < kernel.height; j++) {
      for (let i = 0; i < kernel.width; i++) {
        const w = kernel.data[j * kernel.width + i];
        // Odwrócenie maski: pole (i, j) pobiera piksel (x − (i − cx), y − (j − cy))
        if (w !== 0) taps.push({ dx: cx - i, dy: cy - j, w: w / div });
      }
    }

    // Zasięg maski w pikselach – piksel jest "wewnątrz", gdy cała maska mieści się w obrazie
    let minDx = 0, maxDx = 0, minDy = 0, maxDy = 0;
    for (const t of taps) {
      minDx = Math.min(minDx, t.dx);
      maxDx = Math.max(maxDx, t.dx);
      minDy = Math.min(minDy, t.dy);
      maxDy = Math.max(maxDy, t.dy);
    }
    const out = new Uint8ClampedArray(s.length);
    const inside = (x, y) => x + minDx >= 0 && y + minDy >= 0 && x + maxDx < W && y + maxDy < H;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let r = 0, g = 0, b = 0;
        if (inside(x, y)) {
          // Szybka ścieżka dla wnętrza obrazu – bez przycinania współrzędnych
          for (let t = 0; t < taps.length; t++) {
            const k = ((y + taps[t].dy) * W + x + taps[t].dx) * 4;
            r += s[k] * taps[t].w;
            g += s[k + 1] * taps[t].w;
            b += s[k + 2] * taps[t].w;
          }
        } else {
          for (let t = 0; t < taps.length; t++) {
            const k = (clamp(y + taps[t].dy, 0, H - 1) * W + clamp(x + taps[t].dx, 0, W - 1)) * 4;
            r += s[k] * taps[t].w;
            g += s[k + 1] * taps[t].w;
            b += s[k + 2] * taps[t].w;
          }
        }
        const i = (y * W + x) * 4;
        out[i] = (absolute ? Math.abs(r) : r) + offset;
        out[i + 1] = (absolute ? Math.abs(g) : g) + offset;
        out[i + 2] = (absolute ? Math.abs(b) : b) + offset;
        out[i + 3] = s[i + 3];
      }
    }
    return new ImageData(out, W, H);
  }

  /**
   * Maska Gaussa size × size dla odchylenia σ:
   *   G(x, y) = e^(−(x² + y²) / (2σ²))
   * (stałą normalizującą pomijamy – i tak dzielimy przez sumę wag).
   * Wagi maleją z odległością od środka jak "dzwon", więc bliscy sąsiedzi
   * ważą więcej niż dalecy – rozmycie jest łagodniejsze i bardziej
   * naturalne niż w filtrze uśredniającym. Rozsądny rozmiar ≈ 6σ (± 3σ).
   *
   * @returns {number[][]} wiersze maski
   */
  function gaussianKernel(size, sigma) {
    const c = (size - 1) / 2;
    const rows = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        const d2 = (x - c) * (x - c) + (y - c) * (y - c);
        row.push(Math.round(Math.exp(-d2 / (2 * sigma * sigma)) * 10000) / 10000);
      }
      rows.push(row);
    }
    return rows;
  }

  /**
   * Gotowe maski. absolute: true – detektory krawędzi (wynik może być
   * ujemny, a krawędź "z ciemnego w jasne" i "z jasnego w ciemne" ma być
   * tak samo widoczna).
   */
  const PRESETS = {
    box: {
      label: 'Uśredniający (box)',
      rows: [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    },
    gauss: {
      label: 'Rozmycie Gaussa',
      gaussian: true,
      rows: gaussianKernel(5, 1),
    },
    prewittX: {
      label: 'Prewitt – krawędzie pionowe (X)',
      rows: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
      absolute: true,
    },
    prewittY: {
      label: 'Prewitt – krawędzie poziome (Y)',
      rows: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
      absolute: true,
    },
    sobelX: {
      label: 'Sobel – krawędzie pionowe (X)',
      rows: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
      absolute: true,
    },
    sobelY: {
      label: 'Sobel – krawędzie poziome (Y)',
      rows: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
      absolute: true,
    },
    laplace4: {
      label: 'Laplasjan (4-sąsiedztwo)',
      rows: [[0, 1, 0], [1, -4, 1], [0, 1, 0]],
      absolute: true,
    },
    laplace8: {
      label: 'Laplasjan (8-sąsiedztwo)',
      rows: [[1, 1, 1], [1, -8, 1], [1, 1, 1]],
      absolute: true,
    },
    log: {
      label: 'Laplasjan Gaussa (LoG)',
      rows: [
        [0, 0, -1, 0, 0],
        [0, -1, -2, -1, 0],
        [-1, -2, 16, -2, -1],
        [0, -1, -2, -1, 0],
        [0, 0, -1, 0, 0],
      ],
      absolute: true,
    },
    sharpen: {
      label: 'Wyostrzanie',
      rows: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
    },
    emboss: {
      label: 'Płaskorzeźba',
      rows: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
    },
  };

  /** Maska → tekst (wiersze w liniach, wagi rozdzielone spacjami). */
  function formatKernel(rows) {
    return rows.map((row) => row.map((v) => String(v)).join(' ')).join('\n');
  }

  /**
   * Tekst → maska. Wiersze w osobnych liniach, wagi rozdzielone spacjami,
   * przecinkami lub średnikami; dopuszczalne ułamki zapisane jako "1/16".
   * Wszystkie wiersze muszą mieć tyle samo wag.
   *
   * @returns {{kernel?: object, error?: string}}
   */
  function parseKernel(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    if (lines.length === 0) return { error: 'Maska jest pusta.' };
    if (lines.length > 51) return { error: 'Maska może mieć najwyżej 51 wierszy.' };

    const rows = [];
    for (let y = 0; y < lines.length; y++) {
      const row = [];
      for (const token of lines[y].split(/[\s,;]+/)) {
        const parts = token.split('/');
        const v = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(token);
        if (parts.length > 2 || !Number.isFinite(v)) {
          return { error: `Wiersz ${y + 1}: „${token}” nie jest liczbą.` };
        }
        row.push(v);
      }
      if (row.length > 51) return { error: 'Maska może mieć najwyżej 51 kolumn.' };
      if (y > 0 && row.length !== rows[0].length) {
        return { error: `Wiersz ${y + 1} ma ${row.length} wag, a pierwszy ${rows[0].length}.` };
      }
      rows.push(row);
    }
    return { kernel: makeKernel(rows) };
  }

  BioEditor.Convolution = {
    PRESETS,
    convolve,
    makeKernel,
    kernelSum,
    gaussianKernel,
    formatKernel,
    parseKernel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
