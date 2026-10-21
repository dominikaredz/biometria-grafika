/**
 * histogram.js – obliczanie i rysowanie histogramu (bez bibliotek do wykresów).
 *
 * Histogram to tablica 256 liczników: hist[v] = ile pikseli ma wartość v.
 * Liczymy cztery histogramy naraz, w jednej pętli po buforze:
 * R, G, B oraz średnią kanałów.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  const CHANNELS = {
    r:   { label: 'R',       color: '#e53935' },
    g:   { label: 'G',       color: '#43a047' },
    b:   { label: 'B',       color: '#1e88e5' },
    avg: { label: 'Średnia', color: '#495057' },
  };

  // Marginesy wykresu (miejsce na opisy osi)
  const PAD = { left: 8, right: 8, top: 8, bottom: 22 };

  /**
   * Oblicza histogramy czterech kanałów.
   * Uint32Array: licznik może przekroczyć 255 (obraz ma wiele pikseli).
   *
   * @param {ImageData} imageData
   * @returns {{r: Uint32Array, g: Uint32Array, b: Uint32Array, avg: Uint32Array}}
   */
  function compute(imageData) {
    const d = imageData.data;
    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    const avg = new Uint32Array(256);

    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      r[R]++;
      g[G]++;
      b[B]++;
      avg[((R + G + B) / 3) | 0]++; // ta sama definicja średniej co w binaryzacji
    }
    return { r, g, b, avg };
  }

  /**
   * Rysuje histogram na canvasie (ręcznie, przez fillRect/fillText/stroke).
   *
   * @param {HTMLCanvasElement} canvas
   * @param {object|null} hist     wynik compute() lub null (pusty wykres)
   * @param {'r'|'g'|'b'|'avg'|'all'} view  który histogram pokazać
   * @param {{logScale?: boolean}} [options]
   */
  function draw(canvas, hist, view, { logScale = false } = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const plotX = PAD.left;
    const plotY = PAD.top;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const baseY = plotY + plotH; // linia osi X

    // Tło
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    const binW = plotW / 256; // szerokość jednego słupka (ok. 1 px)

    if (hist) {
      const keys = view === 'all' ? ['r', 'g', 'b'] : [view];
      // Skala log: log(1 + n) – zera zostają zerami, a dominujący słupek
      // (np. białe tło) nie "spłaszcza" reszty wykresu.
      const scale = logScale ? Math.log1p : (n) => n;

      // Maksimum do normalizacji wysokości (wspólne dla wszystkich rysowanych kanałów)
      let max = 0;
      let maxCount = 0;
      for (const k of keys) {
        for (let i = 0; i < 256; i++) {
          const n = hist[k][i];
          if (n > maxCount) maxCount = n;
          const s = scale(n);
          if (s > max) max = s;
        }
      }
      if (max === 0) max = 1;

      // Przy nakładaniu trzech kanałów używamy półprzezroczystości
      ctx.globalAlpha = keys.length > 1 ? 0.55 : 1;
      for (const k of keys) {
        ctx.fillStyle = CHANNELS[k].color;
        for (let i = 0; i < 256; i++) {
          const h = (scale(hist[k][i]) / max) * plotH;
          if (h <= 0) continue;
          // Całkowite współrzędne x0/x1 -> słupki układają się bez szczelin
          const x0 = plotX + Math.floor(i * binW);
          const x1 = plotX + Math.floor((i + 1) * binW);
          ctx.fillRect(x0, baseY - h, Math.max(1, x1 - x0), h);
        }
      }
      ctx.globalAlpha = 1;

      // Informacja o skali pionowej
      ctx.fillStyle = '#6c757d';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('maks. ' + maxCount + (logScale ? ' (skala log.)' : ''), W - PAD.right, plotY);
    }

    // Oś X i podziałka
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, baseY + 0.5);
    ctx.lineTo(plotX + plotW, baseY + 0.5);
    ctx.stroke();

    ctx.fillStyle = '#6c757d';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    for (const v of [0, 64, 128, 192, 255]) {
      const x = plotX + (v + 0.5) * binW;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, baseY);
      ctx.lineTo(Math.round(x) + 0.5, baseY + 4);
      ctx.stroke();
      ctx.textAlign = v === 0 ? 'left' : v === 255 ? 'right' : 'center';
      ctx.fillText(String(v), x, baseY + 6);
    }
  }

  BioEditor.Histogram = { compute, draw };
})(typeof window !== 'undefined' ? window : globalThis);
