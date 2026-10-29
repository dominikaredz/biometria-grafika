/**
 * thresholding.js – zaawansowane metody binaryzacji (na obrazie szarości).
 *
 * Dwie rodziny:
 *   - GLOBALNE (Kapur): jeden próg dla całego obrazu, wyznaczony z histogramu,
 *   - LOKALNE (Niblack, Sauvola, Phansalkar, Bernsen): osobny próg T(x, y)
 *     dla każdego piksela, liczony z jego otoczenia (okna w × w). Radzą sobie
 *     z nierównym oświetleniem (np. cień na skanie dokumentu), z którym
 *     pojedynczy próg globalny sobie nie poradzi.
 *
 * Konwencja wyniku (jak w ImageProcessing.binarize): biały (255), gdy
 * wartość piksela >= próg, inaczej czarny (0). Szarość = średnia kanałów.
 *
 * Wszystkie funkcje są czyste – zwracają nowy obraz.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

  // ---------- Narzędzia ----------

  function toGray(src) {
    const s = src.data;
    const gray = new Uint8Array(src.width * src.height);
    for (let i = 0, p = 0; i < s.length; i += 4, p++) gray[p] = ((s[i] + s[i + 1] + s[i + 2]) / 3) | 0;
    return gray;
  }

  function grayHistogram(gray) {
    const hist = new Uint32Array(256);
    for (let p = 0; p < gray.length; p++) hist[gray[p]]++;
    return hist;
  }

  /**
   * Zamienia obraz szarości na binarny według progu z funkcji threshold(p)
   * (p – numer piksela). Kanał alfa przepisujemy z obrazu źródłowego.
   */
  function applyThreshold(src, gray, threshold) {
    const s = src.data;
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0, p = 0; i < s.length; i += 4, p++) {
      const v = gray[p] >= threshold(p) ? 255 : 0;
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = s[i + 3];
    }
    return new ImageData(out, src.width, src.height);
  }

  /**
   * Lokalna średnia i odchylenie standardowe w oknie size × size dla
   * każdego piksela – w czasie O(W·H), niezależnie od rozmiaru okna.
   *
   * Obraz całkowy (integral image, "summed-area table"):
   *   I(x, y) = suma wszystkich pikseli w prostokącie od (0, 0) do (x−1, y−1).
   * Sumę dowolnego prostokąta [x0, x1) × [y0, y1) liczymy wtedy z 4 odczytów:
   *   S = I(x1, y1) − I(x0, y1) − I(x1, y0) + I(x0, y0).
   * Robimy dwa takie obrazy: z wartości v i z kwadratów v². Wtedy:
   *   średnia  m = S / n,
   *   wariancja σ² = S² / n − m²   (średnia kwadratów minus kwadrat średniej),
   *   odchylenie s = √σ².
   * Przy brzegu okno jest przycinane do obrazu (n = faktyczna liczba pikseli).
   * Float64Array: sumy kwadratów dużych obrazów przekraczają zakres 32 bitów.
   */
  function localStats(gray, W, H, size) {
    const r = size >> 1;
    const W1 = W + 1;
    const sum = new Float64Array(W1 * (H + 1));
    const sq = new Float64Array(W1 * (H + 1));
    for (let y = 0; y < H; y++) {
      let rowSum = 0;
      let rowSq = 0;
      for (let x = 0; x < W; x++) {
        const v = gray[y * W + x];
        rowSum += v;
        rowSq += v * v;
        sum[(y + 1) * W1 + x + 1] = sum[y * W1 + x + 1] + rowSum;
        sq[(y + 1) * W1 + x + 1] = sq[y * W1 + x + 1] + rowSq;
      }
    }

    const mean = new Float32Array(W * H);
    const std = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(H, y + r + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(W, x + r + 1);
        const n = (x1 - x0) * (y1 - y0);
        const a = y1 * W1 + x1, b = y0 * W1 + x1, c = y1 * W1 + x0, d = y0 * W1 + x0;
        const m = (sum[a] - sum[b] - sum[c] + sum[d]) / n;
        const variance = (sq[a] - sq[b] - sq[c] + sq[d]) / n - m * m;
        mean[y * W + x] = m;
        std[y * W + x] = Math.sqrt(variance > 0 ? variance : 0);
      }
    }
    return { mean, std };
  }

  /**
   * Minimum albo maksimum w oknie 1-wymiarowym [i − r, i + r] dla każdej
   * pozycji linii (wiersza albo kolumny) – algorytm "monotonicznej kolejki".
   *
   * Kolejka trzyma indeksy kandydatów na maksimum w kolejności malejących
   * wartości. Nowa wartość wyrzuca z końca wszystkie mniejsze (nigdy już nie
   * będą maksimum, bo nowa jest większa i dłużej zostanie w oknie). Z początku
   * usuwamy indeksy, które wypadły z okna. Maksimum = początek kolejki.
   * Każdy indeks wchodzi i wychodzi raz, więc koszt to O(długość linii).
   */
  function extreme1D(src, dst, start, stride, len, r, isMax, queue) {
    let head = 0;
    let tail = 0;
    let next = 0;
    for (let i = 0; i < len; i++) {
      const last = Math.min(len - 1, i + r);
      while (next <= last) {
        const v = src[start + next * stride];
        while (tail > head) {
          const q = src[start + queue[tail - 1] * stride];
          if (isMax ? q <= v : q >= v) tail--;
          else break;
        }
        queue[tail++] = next++;
      }
      while (queue[head] < i - r) head++;
      dst[start + i * stride] = src[start + queue[head] * stride];
    }
  }

  /** Minimum / maksimum w oknie size × size: rozdzielnie – wiersze, potem kolumny. */
  function localExtreme(gray, W, H, size, isMax) {
    const r = size >> 1;
    const tmp = new Uint8Array(W * H);
    const out = new Uint8Array(W * H);
    const queue = new Int32Array(Math.max(W, H));
    for (let y = 0; y < H; y++) extreme1D(gray, tmp, y * W, 1, W, r, isMax, queue);
    for (let x = 0; x < W; x++) extreme1D(tmp, out, x, W, H, r, isMax, queue);
    return out;
  }

  // ---------- Metody ----------

  /**
   * Niblack: T = m + k · s
   * Próg = lokalna średnia przesunięta o k odchyleń standardowych.
   * k < 0 (typowo −0,2) obniża próg, więc ciemny tekst na jasnym tle
   * zostaje czarny. Wada: w jednolitych obszarach (s ≈ 0) próg ≈ średnia,
   * więc nawet drobny szum tła daje czarne plamki.
   */
  function niblack(gray, W, H, { window, k }) {
    const { mean, std } = localStats(gray, W, H, window);
    return (p) => mean[p] + k * std[p];
  }

  /**
   * Sauvola: T = m · (1 + k · (s / R − 1))
   * Poprawka Niblacka dla dokumentów. R – maksymalne możliwe odchylenie
   * (128 dla obrazów 8-bitowych). W gładkim tle (s małe) nawias jest
   * ujemny, więc próg spada poniżej średniej i tło zostaje białe – znika
   * szum, z którym miał problem Niblack. Przy tekście (s duże) próg rośnie
   * w stronę średniej. Typowo k = 0,5 (artykuł), często też 0,2–0,34.
   */
  function sauvola(gray, W, H, { window, k, R }) {
    const { mean, std } = localStats(gray, W, H, window);
    return (p) => mean[p] * (1 + k * (std[p] / R - 1));
  }

  /**
   * Phansalkar: T = m · (1 + p · e^(−q·m) + k · (s / R − 1))
   * Rozwinięcie Sauvoli dla obrazów o niskim kontraście (np. preparaty
   * mikroskopowe). Liczone na wartościach znormalizowanych do 0–1
   * (m, s, R = 0,5). Składnik p·e^(−q·m) podnosi próg w CIEMNYCH obszarach
   * (małe m), gdzie Sauvola gubi obiekty. Domyślnie p = 2, q = 10, k = 0,25.
   */
  function phansalkar(gray, W, H, { window, k, p: pp, q }) {
    const { mean, std } = localStats(gray, W, H, window);
    const R = 0.5;
    return (p) => {
      const m = mean[p] / 255;
      const s = std[p] / 255;
      return 255 * m * (1 + pp * Math.exp(-q * m) + k * (s / R - 1));
    };
  }

  /**
   * Bernsen: próg z lokalnego kontrastu.
   *   zmin, zmax – minimum i maksimum w oknie,
   *   kontrast C = zmax − zmin,  środek T = (zmin + zmax) / 2.
   * Jeśli C >= L (okno zawiera krawędź obiektu), próg = T.
   * Jeśli C < L (okno jednolite), piksel należy w całości do jednej klasy:
   * do obiektu (biały), gdy środek T >= próg globalny, inaczej do tła.
   */
  function bernsen(gray, W, H, { window, contrast, global: globalT }) {
    const mn = localExtreme(gray, W, H, window, false);
    const mx = localExtreme(gray, W, H, window, true);
    return (p) => {
      const mid = (mn[p] + mx[p]) / 2;
      if (mx[p] - mn[p] >= contrast) return mid;
      return mid >= globalT ? 0 : 256; // 0 – zawsze biały, 256 – zawsze czarny
    };
  }

  /**
   * Kapur (maksymalizacja entropii): próg globalny z histogramu.
   *
   * Próg t dzieli histogram na tło [0..t] i obiekt [t+1..255]. Każdą klasę
   * traktujemy jak osobny rozkład prawdopodobieństwa (p_i / P, gdzie P –
   * łączne prawdopodobieństwo klasy) i liczymy jego entropię (miarę
   * "ilości informacji"):  H = −Σ (p_i/P) · ln(p_i/P).
   * Kapur wybiera t, dla którego H_tła + H_obiektu jest NAJWIĘKSZA –
   * obie klasy są wtedy możliwie "bogate w informację".
   *
   * Przekształcenie H = ln P − (Σ p_i ln p_i) / P pozwala liczyć entropie
   * z sum narastających – jedna pętla po 256 wartościach.
   *
   * @returns {number} próg dla konwencji "biały, gdy v >= próg" (czyli t + 1)
   */
  function kapurThreshold(hist) {
    let total = 0;
    for (let v = 0; v < 256; v++) total += hist[v];
    const p = new Float64Array(256);
    for (let v = 0; v < 256; v++) p[v] = hist[v] / total;

    // Sumy narastające: P(t) = Σ p_i, E(t) = Σ p_i·ln p_i (dla i <= t)
    const P = new Float64Array(256);
    const E = new Float64Array(256);
    let accP = 0;
    let accE = 0;
    for (let v = 0; v < 256; v++) {
      accP += p[v];
      if (p[v] > 0) accE += p[v] * Math.log(p[v]);
      P[v] = accP;
      E[v] = accE;
    }

    let best = -Infinity;
    let bestT = 127;
    for (let t = 0; t < 255; t++) {
      const P0 = P[t];
      const P1 = 1 - P0;
      if (P0 <= 0 || P1 <= 0) continue;
      const H0 = Math.log(P0) - E[t] / P0;
      const H1 = Math.log(P1) - (E[255] - E[t]) / P1;
      if (H0 + H1 > best) {
        best = H0 + H1;
        bestT = t;
      }
    }
    return bestT + 1;
  }

  /**
   * Własny algorytm: "Otsu z kompensacją oświetlenia".
   *
   * Problem: Otsu (próg globalny) zawodzi przy nierównym oświetleniu –
   * jasna strona tła ma inne wartości niż ciemna, więc jeden próg tnie tło.
   * Metody lokalne (Niblack, Sauvola) radzą sobie z oświetleniem, ale
   * "wydrążają" duże obiekty – wnętrze obiektu większego niż okno wygląda
   * dla nich jak jednolite tło.
   *
   * Pomysł: najpierw usuwamy z obrazu wolnozmienne oświetlenie, a dopiero
   * potem stosujemy jeden próg Otsu:
   *   1. B(x, y) = średnia w DUŻYM oknie (np. 61×61) – szacunek oświetlenia,
   *   2. G = średnia całego obrazu,
   *   3. obraz wyrównany: v'(x, y) = v(x, y) − β · (B(x, y) − G),
   *      tzn. miejsca jaśniejsze od przeciętnej przyciemniamy, ciemniejsze
   *      rozjaśniamy (β – siła kompensacji, 0 = czysty Otsu),
   *   4. próg T = Otsu(histogram v'),  wynik: biały, gdy v' >= T.
   * β < 1 zostawia część lokalnego kontrastu – dzięki temu duży ciemny
   * obiekt (który też obniża B) nie zostaje "wyrównany" do koloru tła.
   * Koszt: O(W·H) (obraz całkowy + jeden histogram).
   */
  function compensatedOtsu(gray, W, H, { window, strength }) {
    const { mean } = localStats(gray, W, H, window);
    let G = 0;
    for (let p = 0; p < gray.length; p++) G += gray[p];
    G /= gray.length;

    const flat = new Uint8ClampedArray(gray.length);
    for (let p = 0; p < gray.length; p++) flat[p] = gray[p] - strength * (mean[p] - G);
    const t = BioEditor.ImageProcessing.otsuThreshold(grayHistogram(flat));
    // Próg w skali oryginalnego obrazu: v >= v − v' + T  ⇔  v' >= T
    return { threshold: (p) => gray[p] - flat[p] + t, otsu: t };
  }

  // ---------- Rejestr metod (opis dla interfejsu) ----------

  const WINDOW = { key: 'window', label: 'Okno (px, nieparzyste)', min: 3, max: 151, step: 2, value: 15 };

  const METHODS = {
    kapur: {
      label: 'Kapur (entropia, globalna)',
      params: [],
    },
    niblack: {
      label: 'Niblack (lokalna)',
      params: [WINDOW, { key: 'k', label: 'k', min: -2, max: 2, step: 0.05, value: -0.2 }],
    },
    sauvola: {
      label: 'Sauvola (lokalna)',
      params: [
        WINDOW,
        { key: 'k', label: 'k', min: 0, max: 1, step: 0.05, value: 0.5 },
        { key: 'R', label: 'R (zakres odchylenia)', min: 1, max: 255, step: 1, value: 128 },
      ],
    },
    phansalkar: {
      label: 'Phansalkar (lokalna)',
      params: [
        WINDOW,
        { key: 'k', label: 'k', min: 0, max: 1, step: 0.05, value: 0.25 },
        { key: 'p', label: 'p', min: 0, max: 10, step: 0.5, value: 2 },
        { key: 'q', label: 'q', min: 0, max: 50, step: 1, value: 10 },
      ],
    },
    bernsen: {
      label: 'Bernsen (kontrast lokalny)',
      params: [
        { ...WINDOW, value: 31 },
        { key: 'contrast', label: 'Min. kontrast L', min: 0, max: 255, step: 1, value: 15 },
        { key: 'global', label: 'Próg dla jednolitych okien', min: 0, max: 255, step: 1, value: 128 },
      ],
    },
    compensated: {
      label: 'Własny: Otsu z kompensacją oświetlenia',
      params: [
        { ...WINDOW, label: 'Okno oświetlenia (px)', value: 61 },
        { key: 'strength', label: 'β (siła kompensacji)', min: 0, max: 1, step: 0.05, value: 0.8 },
      ],
    },
  };

  const LOCAL = {
    niblack,
    sauvola,
    phansalkar,
    bernsen,
    compensated: (gray, W, H, p) => compensatedOtsu(gray, W, H, p).threshold,
  };

  /**
   * Binaryzacja wybraną metodą.
   *
   * @param {ImageData} src
   * @param {keyof METHODS} method
   * @param {object} params wartości parametrów z METHODS[method].params
   * @returns {{image: ImageData, info: string}} obraz i opis do paska statusu
   */
  function binarize(src, method, params) {
    const W = src.width;
    const H = src.height;
    const gray = toGray(src);

    if (method === 'kapur') {
      const t = kapurThreshold(grayHistogram(gray));
      return { image: applyThreshold(src, gray, () => t), info: `próg ${t}` };
    }

    const p = { ...params };
    if (p.window !== undefined) p.window = clamp(Math.round(p.window) | 1, 3, 151); // okno nieparzyste
    const threshold = LOCAL[method](gray, W, H, p);
    const info = METHODS[method].params.map((f) => `${f.key}=${p[f.key]}`).join(', ');
    return { image: applyThreshold(src, gray, threshold), info };
  }

  BioEditor.Thresholding = { METHODS, binarize, kapurThreshold, localStats };
})(typeof window !== 'undefined' ? window : globalThis);
