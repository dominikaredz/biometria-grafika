(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  const CHANNEL_OFFSET = { r: 0, g: 1, b: 2, avg: -1 };

  function binarize(src, { channel, threshold }) {
    const offset = CHANNEL_OFFSET[channel];
    if (offset === undefined) throw new Error('Nieznany kanał: ' + channel);

    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = v >= threshold ? 255 : 0;

    const s = src.data;
    const out = new Uint8ClampedArray(s.length);

    for (let i = 0; i < s.length; i += 4) {
      const v = offset >= 0 ? s[i + offset] : ((s[i] + s[i + 1] + s[i + 2]) / 3) | 0;
      const bw = lut[v];
      out[i] = bw;
      out[i + 1] = bw;
      out[i + 2] = bw;
      out[i + 3] = s[i + 3];
    }

    return new ImageData(out, src.width, src.height);
  }

  function identityLut() {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = v;
    return lut;
  }

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

  const sameLut = (lut) => ({ r: lut, g: lut, b: lut });

  function histogramRange(hist) {
    let min = 0;
    let max = 255;
    while (min < 256 && hist[min] === 0) min++;
    if (min === 256) return null;
    while (hist[max] === 0) max--;
    return { min, max };
  }

  function stretchHistogram(src, { low, high, mode }) {
    const hist = BioEditor.Histogram.compute(src);

    const makeLut = (min, max) => {
      if (max === min) return identityLut();
      const lut = new Uint8ClampedArray(256);
      const k = (high - low) / (max - min);
      for (let v = 0; v < 256; v++) lut[v] = Math.round(low + (v - min) * k);
      return lut;
    };

    const ranges = { r: histogramRange(hist.r), g: histogramRange(hist.g), b: histogramRange(hist.b) };
    if (!ranges.r) return src;

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

  function equalizationLut(hist) {
    let total = 0;
    for (let v = 0; v < 256; v++) total += hist[v];
    const range = histogramRange(hist);
    if (!range) return identityLut();

    const cdfMin = hist[range.min];
    if (total === cdfMin) return identityLut();

    const lut = new Uint8ClampedArray(256);
    let cdf = 0;
    for (let v = 0; v < 256; v++) {
      cdf += hist[v];
      lut[v] = Math.round(((cdf - cdfMin) / (total - cdfMin)) * 255);
    }
    return lut;
  }

  function equalizeHistogram(src, { mode }) {
    const hist = BioEditor.Histogram.compute(src);
    if (mode === 'joint') return applyLut(src, sameLut(equalizationLut(hist.avg)));
    return applyLut(src, {
      r: equalizationLut(hist.r),
      g: equalizationLut(hist.g),
      b: equalizationLut(hist.b),
    });
  }

  function otsuThreshold(hist) {
    let total = 0;
    let sumAll = 0;
    for (let v = 0; v < 256; v++) {
      total += hist[v];
      sumAll += v * hist[v];
    }

    let w0 = 0;
    let sum0 = 0;
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

  function adjustBrightnessContrast(src, { brightness, contrast }) {
    const c = contrast * 2.55;
    const f = (259 * (c + 255)) / (255 * (259 - c));
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.round(f * (v - 128) + 128 + brightness);
    return applyLut(src, sameLut(lut));
  }

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
