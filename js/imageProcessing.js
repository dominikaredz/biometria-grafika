/**
 * imageProcessing.js – algorytmy przetwarzania obrazu.
 *
 * Zasady:
 *  - zero zależności od DOM i Canvas: funkcje przyjmują i zwracają ImageData,
 *    więc łatwo je przenieść do innego projektu lub przetestować w Node,
 *  - funkcje są "czyste": NIE modyfikują obrazu wejściowego, zwracają nowy
 *    (dzięki temu działa Cofnij / Przywróć oryginał i łatwo łączyć operacje),
 *  - praca na Uint8ClampedArray, jedna pętla po buforze.
 *
 * Układ bufora ImageData.data: [R, G, B, A, R, G, B, A, ...]
 * czyli piksel nr p zaczyna się pod indeksem i = p * 4.
 * Uint8ClampedArray "przycina" wartości do 0–255 (nie zawija ich jak Uint8Array).
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  /** Przesunięcie kanału w obrębie piksela; -1 oznacza "średnia z kanałów". */
  const CHANNEL_OFFSET = { r: 0, g: 1, b: 2, avg: -1 };

  /**
   * Binaryzacja progowa.
   *
   * Algorytm: dla każdego piksela bierzemy jedną wartość v (0–255):
   *   - kanał R, G lub B  -> v = wartość tego kanału,
   *   - średnia           -> v = floor((R + G + B) / 3),
   * a następnie:
   *   wynik = 255 (biały)  gdy v >= próg,
   *   wynik = 0   (czarny) w przeciwnym razie.
   * Wynik zapisujemy we wszystkich trzech kanałach (obraz czarno-biały).
   * Kanał alfa przepisujemy bez zmian.
   *
   * Optymalizacja: zamiast porównywać z progiem w każdym pikselu, budujemy
   * tablicę LUT (look-up table) o 256 elementach: lut[v] -> 0 lub 255.
   * W pętli zostaje jedno odczytanie z tablicy.
   *
   * @param {ImageData} src
   * @param {{channel: 'r'|'g'|'b'|'avg', threshold: number}} options
   * @returns {ImageData} nowy obraz
   */
  function binarize(src, { channel, threshold }) {
    const offset = CHANNEL_OFFSET[channel];
    if (offset === undefined) throw new Error('Nieznany kanał: ' + channel);

    // LUT: dla każdej możliwej wartości 0..255 od razu znamy wynik
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = v >= threshold ? 255 : 0;

    const s = src.data;
    const out = new Uint8ClampedArray(s.length);

    for (let i = 0; i < s.length; i += 4) {
      // offset >= 0: pojedynczy kanał, inaczej średnia (|0 = zaokrąglenie w dół)
      const v = offset >= 0 ? s[i + offset] : ((s[i] + s[i + 1] + s[i + 2]) / 3) | 0;
      const bw = lut[v];
      out[i] = bw;
      out[i + 1] = bw;
      out[i + 2] = bw;
      out[i + 3] = s[i + 3]; // alfa bez zmian
    }

    return new ImageData(out, src.width, src.height);
  }

  // ---------- Operacje punktowe (LUT) ----------

  /** Tablica LUT "bez zmian": lut[v] = v. */
  function identityLut() {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = v;
    return lut;
  }

  /**
   * Stosuje tablice LUT do kanałów R, G, B (alfa bez zmian).
   *
   * Operacja punktowa to taka, w której nowa wartość piksela zależy tylko od
   * jego starej wartości (a nie np. od sąsiadów). Kanał ma tylko 256 możliwych
   * wartości, więc wynik można policzyć z góry dla każdej z nich – to jest
   * tablica LUT (look-up table). Potem obróbka obrazu to jedna pętla po
   * buforze z trzema odczytami z tablicy, niezależnie od tego, jak złożony
   * był wzór (rozciąganie, wyrównanie, jasność...).
   *
   * @param {ImageData} src
   * @param {{r: Uint8ClampedArray, g: Uint8ClampedArray, b: Uint8ClampedArray}} luts
   * @returns {ImageData} nowy obraz
   */
  function applyLut(src, { r, g, b }) {
    const s = src.data;
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < s.length; i += 4) {
      out[i] = r[s[i]];
      out[i + 1] = g[s[i + 1]];
      out[i + 2] = b[s[i + 2]];
      out[i + 3] = s[i + 3];
    }
    return new ImageData(out, src.width, src.height);
  }

  /** Ta sama LUT dla wszystkich trzech kanałów. */
  const sameLut = (lut) => ({ r: lut, g: lut, b: lut });

  /** Najmniejsza i największa wartość obecna w histogramie (null dla pustego). */
  function histogramRange(hist) {
    let min = 0;
    let max = 255;
    while (min < 256 && hist[min] === 0) min++;
    if (min === 256) return null;
    while (hist[max] === 0) max--;
    return { min, max };
  }

  /**
   * Rozciąganie histogramu do zakresu [low, high].
   *
   * Wartości z obrazu leżą w przedziale [min, max] (np. 60–180 dla zdjęcia
   * o niskim kontraście). Odwzorowujemy ten przedział liniowo na [low, high]:
   *
   *   v' = low + (v − min) · (high − low) / (max − min)
   *
   * Dla low = 0, high = 255 histogram "rozjeżdża się" na cały zakres i obraz
   * zyskuje kontrast. Kształt histogramu się nie zmienia – słupki tylko się
   * rozsuwają (pojawiają się między nimi przerwy). low > high daje negatyw.
   *
   * Tryb 'separate': każdy kanał ma własne min/max (silniejszy efekt, ale
   * barwy mogą się przesunąć). Tryb 'joint': wspólne min/max ze wszystkich
   * kanałów – ta sama LUT dla R, G i B, proporcje barw zostają zachowane.
   *
   * @param {ImageData} src
   * @param {{low: number, high: number, mode: 'separate'|'joint'}} options
   * @returns {ImageData} nowy obraz
   */
  function stretchHistogram(src, { low, high, mode }) {
    const hist = BioEditor.Histogram.compute(src);

    const makeLut = (min, max) => {
      if (max === min) return identityLut(); // jedna wartość w kanale – nie ma czego rozciągać
      const lut = new Uint8ClampedArray(256);
      const k = (high - low) / (max - min);
      for (let v = 0; v < 256; v++) lut[v] = Math.round(low + (v - min) * k);
      return lut;
    };

    const ranges = { r: histogramRange(hist.r), g: histogramRange(hist.g), b: histogramRange(hist.b) };
    if (!ranges.r) return src; // pusty obraz (0 pikseli)

    if (mode === 'joint') {
      const min = Math.min(ranges.r.min, ranges.g.min, ranges.b.min);
      const max = Math.max(ranges.r.max, ranges.g.max, ranges.b.max);
      return applyLut(src, sameLut(makeLut(min, max)));
    }
    return applyLut(src, {
      r: makeLut(ranges.r.min, ranges.r.max),
      g: makeLut(ranges.g.min, ranges.g.max),
      b: makeLut(ranges.b.min, ranges.b.max),
    });
  }

  /**
   * LUT wyrównania dla jednego histogramu.
   *
   * Dystrybuanta (CDF): cdf[v] = h[0] + ... + h[v] – ile pikseli ma wartość <= v.
   * Jeśli jako nową wartość weźmiemy cdf[v] przeskalowane do 0–255, to
   * piksele rozłożą się możliwie równo na cały zakres (histogram "spłaszczy się").
   * Odejmujemy cdf_min (CDF pierwszej niepustej wartości), żeby najciemniejszy
   * kolor w obrazie trafił dokładnie w 0:
   *
   *   v' = round( (cdf[v] − cdf_min) / (N − cdf_min) · 255 )
   */
  function equalizationLut(hist) {
    let total = 0;
    for (let v = 0; v < 256; v++) total += hist[v];
    const range = histogramRange(hist);
    if (!range) return identityLut();

    const cdfMin = hist[range.min];
    if (total === cdfMin) return identityLut(); // jedna wartość w całym obrazie

    const lut = new Uint8ClampedArray(256);
    let cdf = 0;
    for (let v = 0; v < 256; v++) {
      cdf += hist[v];
      lut[v] = Math.round(((cdf - cdfMin) / (total - cdfMin)) * 255);
    }
    return lut;
  }

  /**
   * Wyrównanie (equalizacja) histogramu.
   *
   * Tryb 'separate': osobna CDF dla R, G i B (może zmienić barwy).
   * Tryb 'joint': CDF histogramu średniej kanałów, ta sama LUT dla R, G, B
   * – wyrównuje głównie jasność, barwy zmieniają się mniej.
   *
   * Złożoność: jedno przejście po obrazie (histogram) + 256 kroków (CDF)
   * + jedno przejście (LUT).
   *
   * @param {ImageData} src
   * @param {{mode: 'separate'|'joint'}} options
   * @returns {ImageData} nowy obraz
   */
  function equalizeHistogram(src, { mode }) {
    const hist = BioEditor.Histogram.compute(src);
    if (mode === 'joint') return applyLut(src, sameLut(equalizationLut(hist.avg)));
    return applyLut(src, {
      r: equalizationLut(hist.r),
      g: equalizationLut(hist.g),
      b: equalizationLut(hist.b),
    });
  }

  /**
   * Metoda Otsu – automatyczny wybór progu binaryzacji z histogramu.
   *
   * Próg k dzieli piksele na dwie klasy: tło [0..k] i obiekt [k+1..255].
   * Otsu wybiera k, dla którego klasy są "najlepiej rozdzielone", czyli
   * wariancja MIĘDZYKLASOWA jest największa:
   *
   *   σ²_B(k) = ω₀ · ω₁ · (μ₀ − μ₁)²
   *
   * ω₀, ω₁ – liczby pikseli w klasach, μ₀, μ₁ – średnie wartości w klasach.
   * (Jest to równoważne minimalizacji wariancji wewnątrz klas, ale liczy
   * się prościej.) Wszystkie k sprawdzamy w jednej pętli, aktualizując
   * ω₀ i sumę wartości klasy 0 przyrostowo – O(256), bez ponownego
   * przechodzenia po obrazie.
   *
   * Zwracany próg jest zgodny z binarize (biały, gdy v >= próg),
   * dlatego to k + 1: wartości <= k idą do czerni, > k do bieli.
   *
   * @param {Uint32Array} hist histogram 256 wartości
   * @returns {number} próg 0–255
   */
  function otsuThreshold(hist) {
    let total = 0;
    let sumAll = 0;
    for (let v = 0; v < 256; v++) {
      total += hist[v];
      sumAll += v * hist[v];
    }

    let w0 = 0;     // liczba pikseli w klasie 0 (<= k)
    let sum0 = 0;   // suma wartości w klasie 0
    let best = -1;
    let bestK = 127;

    for (let k = 0; k < 256; k++) {
      w0 += hist[k];
      if (w0 === 0) continue;
      const w1 = total - w0;
      if (w1 === 0) break;
      sum0 += k * hist[k];
      const mu0 = sum0 / w0;
      const mu1 = (sumAll - sum0) / w1;
      const between = w0 * w1 * (mu0 - mu1) * (mu0 - mu1);
      if (between > best) {
        best = between;
        bestK = k;
      }
    }
    return Math.min(bestK + 1, 255);
  }

  /**
   * Jasność i kontrast (operacja punktowa przez LUT).
   *
   *   v' = F · (v − 128) + 128 + jasność
   *
   * Kontrast "rozciąga" wartości od środka skali (128): F > 1 zwiększa
   * różnice między jasnymi i ciemnymi pikselami, F < 1 je zmniejsza.
   * Współczynnik liczymy popularnym wzorem z C ∈ [−255, 255]:
   *   F = 259 · (C + 255) / (255 · (259 − C))
   * (C = 0 -> F = 1, C = 255 -> F ≈ 130, C = −255 -> F = 0).
   * Uint8ClampedArray przycina wyniki do 0–255.
   *
   * @param {ImageData} src
   * @param {{brightness: number, contrast: number}} options
   *   brightness −255..255, contrast −100..100 (procent; mapowany na C = 2,55·contrast)
   * @returns {ImageData} nowy obraz
   */
  function adjustBrightnessContrast(src, { brightness, contrast }) {
    const c = contrast * 2.55;
    const f = (259 * (c + 255)) / (255 * (259 - c));
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.round(f * (v - 128) + 128 + brightness);
    return applyLut(src, sameLut(lut));
  }

  /** Negatyw: v' = 255 − v. */
  function invert(src) {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = 255 - v;
    return applyLut(src, sameLut(lut));
  }

  BioEditor.ImageProcessing = {
    binarize,
    applyLut,
    histogramRange,
    stretchHistogram,
    equalizeHistogram,
    otsuThreshold,
    adjustBrightnessContrast,
    invert,
  };
})(typeof window !== 'undefined' ? window : globalThis);
