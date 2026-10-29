/**
 * colorSpaces.js – konwersje między przestrzeniami barw (bez DOM).
 *
 * Konwencje zakresów:
 *   RGB  – liczby całkowite 0–255 (tak jak w buforze pikseli),
 *   CMYK – ułamki 0–1 (w UI pokazujemy je jako procenty 0–100),
 *   HSV  – h w stopniach [0, 360), s i v jako ułamki 0–1.
 *
 * RGB to model ADDYTYWNY (światło: monitor) – składowe dodajemy do czerni.
 * CMYK to model SUBTRAKTYWNY (farba: drukarka) – tusze C, M, Y "odejmują"
 * odpowiednio R, G, B od białego papieru, a K (czarny) przyciemnia całość.
 * Dlatego C jest dopełnieniem R, M dopełnieniem G, Y dopełnieniem B.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  /**
   * RGB -> CMYK.
   *
   * Wzory:
   *   r = R/255, g = G/255, b = B/255
   *   K = 1 − max(r, g, b)
   *   C = (1 − r − K) / (1 − K)
   *   M = (1 − g − K) / (1 − K)
   *   Y = (1 − b − K) / (1 − K)
   *
   * Intuicja: najpierw wyciągamy całą "szarość" do czarnego tuszu K
   * (ile brakuje najjaśniejszej składowej do bieli), a C/M/Y opisują już
   * tylko odcień – po podzieleniu przez (1 − K) są znormalizowane do 0–1.
   * Dla czystej czerni K = 1 i mianownik byłby zerem – wtedy C = M = Y = 0.
   *
   * @param {number} R 0–255
   * @param {number} G 0–255
   * @param {number} B 0–255
   * @returns {{c: number, m: number, y: number, k: number}} wartości 0–1
   */
  function rgbToCmyk(R, G, B) {
    const r = R / 255, g = G / 255, b = B / 255;
    const k = 1 - Math.max(r, g, b);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
    const d = 1 - k;
    return {
      c: (1 - r - k) / d,
      m: (1 - g - k) / d,
      y: (1 - b - k) / d,
      k,
    };
  }

  /**
   * CMYK -> RGB.
   *
   * Wzory:
   *   R = 255 · (1 − C) · (1 − K)
   *   G = 255 · (1 − M) · (1 − K)
   *   B = 255 · (1 − Y) · (1 − K)
   *
   * (1 − C) to ilość czerwonego światła, którą przepuszcza tusz cyjan,
   * (1 − K) – ile światła przepuszcza dodatkowo czarny tusz. Wynik
   * zaokrąglamy do liczby całkowitej, bo piksel przechowuje 0–255.
   *
   * @param {number} c 0–1
   * @param {number} m 0–1
   * @param {number} y 0–1
   * @param {number} k 0–1
   * @returns {{r: number, g: number, b: number}} wartości całkowite 0–255
   */
  function cmykToRgb(c, m, y, k) {
    const w = 255 * (1 - k);
    return {
      r: Math.round(w * (1 - c)),
      g: Math.round(w * (1 - m)),
      b: Math.round(w * (1 - y)),
    };
  }

  /**
   * HSV -> RGB (pomocniczo: kwadrat wyboru koloru jak w programach graficznych).
   *
   * Algorytm: odcień h dzielimy na 6 sektorów po 60° (czerwony, żółty,
   * zielony, cyjan, niebieski, magenta). W każdym sektorze jedna składowa
   * jest maksymalna (= v), jedna minimalna (= v·(1−s)), a trzecia zmienia się
   * liniowo między nimi.
   *
   * @param {number} h 0–360
   * @param {number} s 0–1
   * @param {number} v 0–1
   * @returns {{r: number, g: number, b: number}} wartości całkowite 0–255
   */
  function hsvToRgb(h, s, v) {
    const hh = ((h % 360) + 360) % 360 / 60; // 0..6
    const sector = Math.floor(hh);
    const f = hh - sector;               // położenie wewnątrz sektora 0..1
    const max = v;
    const min = v * (1 - s);
    const up = min + (max - min) * f;    // składowa rosnąca
    const down = max - (max - min) * f;  // składowa malejąca

    let r, g, b;
    switch (sector) {
      case 0: r = max; g = up; b = min; break;
      case 1: r = down; g = max; b = min; break;
      case 2: r = min; g = max; b = up; break;
      case 3: r = min; g = down; b = max; break;
      case 4: r = up; g = min; b = max; break;
      default: r = max; g = min; b = down; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  /**
   * RGB -> HSV (odwrotność powyższego).
   * v = max, s = (max − min) / max, h zależy od tego, która składowa jest max.
   *
   * @param {number} R 0–255
   * @param {number} G 0–255
   * @param {number} B 0–255
   * @returns {{h: number, s: number, v: number}} h=0 dla szarości (odcień nieokreślony)
   */
  function rgbToHsv(R, G, B) {
    const r = R / 255, g = G / 255, b = B / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta > 0) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
      if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : delta / max, v: max };
  }

  /**
   * RGB -> zapis szesnastkowy #RRGGBB.
   * @returns {string}
   */
  function rgbToHex(r, g, b) {
    const hex = (n) => n.toString(16).padStart(2, '0');
    return ('#' + hex(r) + hex(g) + hex(b)).toUpperCase();
  }

  BioEditor.ColorSpaces = { rgbToCmyk, cmykToRgb, hsvToRgb, rgbToHsv, rgbToHex };
})(typeof window !== 'undefined' ? window : globalThis);
