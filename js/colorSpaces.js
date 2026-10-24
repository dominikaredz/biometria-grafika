(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

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

  function cmykToRgb(c, m, y, k) {
    const w = 255 * (1 - k);
    return {
      r: Math.round(w * (1 - c)),
      g: Math.round(w * (1 - m)),
      b: Math.round(w * (1 - y)),
    };
  }

  function hsvToRgb(h, s, v) {
    const hh = ((h % 360) + 360) % 360 / 60;
    const sector = Math.floor(hh);
    const f = hh - sector;
    const max = v;
    const min = v * (1 - s);
    const up = min + (max - min) * f;
    const down = max - (max - min) * f;

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

  function rgbToHex(r, g, b) {
    const hex = (n) => n.toString(16).padStart(2, '0');
    return ('#' + hex(r) + hex(g) + hex(b)).toUpperCase();
  }

  BioEditor.ColorSpaces = { rgbToCmyk, cmykToRgb, hsvToRgb, rgbToHsv, rgbToHex };
})(typeof window !== 'undefined' ? window : globalThis);
