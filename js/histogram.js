(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  const CHANNELS = {
    r:   { label: 'R',       color: '#ef5350' },
    g:   { label: 'G',       color: '#66bb6a' },
    b:   { label: 'B',       color: '#42a5f5' },
    avg: { label: 'Średnia', color: '#ced4da' },
  };

  const THEME_DEFAULTS = {
    '--chart-bg': '#15181d',
    '--chart-axis': '#4b5563',
    '--chart-text': '#9aa3af',
    '--chart-avg': '#ced4da',
  };

  function readTheme(canvas) {
    const style = getComputedStyle(canvas);
    const theme = {};
    for (const name in THEME_DEFAULTS) {
      theme[name] = style.getPropertyValue(name).trim() || THEME_DEFAULTS[name];
    }
    return theme;
  }

  const PAD = { left: 8, right: 8, top: 8, bottom: 22 };

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
      avg[((R + G + B) / 3) | 0]++;
    }
    return { r, g, b, avg };
  }

  function draw(canvas, hist, view, { logScale = false } = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const plotX = PAD.left;
    const plotY = PAD.top;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const baseY = plotY + plotH;
    const theme = readTheme(canvas);

    ctx.fillStyle = theme['--chart-bg'];
    ctx.fillRect(0, 0, W, H);

    const binW = plotW / 256;

    if (hist) {
      const keys = view === 'all' ? ['r', 'g', 'b'] : [view];

      const scale = logScale ? Math.log1p : (n) => n;

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

      ctx.globalAlpha = keys.length > 1 ? 0.55 : 1;
      for (const k of keys) {
        ctx.fillStyle = k === 'avg' ? theme['--chart-avg'] : CHANNELS[k].color;
        for (let i = 0; i < 256; i++) {
          const h = (scale(hist[k][i]) / max) * plotH;
          if (h <= 0) continue;

          const x0 = plotX + Math.floor(i * binW);
          const x1 = plotX + Math.floor((i + 1) * binW);
          ctx.fillRect(x0, baseY - h, Math.max(1, x1 - x0), h);
        }
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = theme['--chart-text'];
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('maks. ' + maxCount + (logScale ? ' (skala log.)' : ''), W - PAD.right, plotY);
    }

    ctx.strokeStyle = theme['--chart-axis'];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, baseY + 0.5);
    ctx.lineTo(plotX + plotW, baseY + 0.5);
    ctx.stroke();

    ctx.fillStyle = theme['--chart-text'];
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
