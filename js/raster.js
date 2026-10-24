(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  function createPlotter(img, color, width) {
    const d = img.data;
    const W = img.width;
    const H = img.height;
    const { r, g, b } = color;

    const setPixel = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    };

    if (width <= 1) return setPixel;

    const before = (width - 1) >> 1;
    return (x, y) => {
      const x0 = x - before;
      const y0 = y - before;
      for (let yy = y0; yy < y0 + width; yy++) {
        for (let xx = x0; xx < x0 + width; xx++) setPixel(xx, yy);
      }
    };
  }

  function drawLine(img, x0, y0, x1, y1, { color, width = 1 }) {
    plotLine(createPlotter(img, color, width), x0, y0, x1, y1);
  }

  function plotLine(plot, x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;

    for (;;) {
      plot(x, y);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  function drawCircle(img, cx, cy, r, { color, width = 1 }) {
    const plot = createPlotter(img, color, width);
    let x = 0;
    let y = r;
    let d = 1 - r;

    while (x <= y) {
      plot(cx + x, cy + y);
      plot(cx - x, cy + y);
      plot(cx + x, cy - y);
      plot(cx - x, cy - y);
      plot(cx + y, cy + x);
      plot(cx - y, cy + x);
      plot(cx + y, cy - x);
      plot(cx - y, cy - x);

      if (d < 0) {
        d += 2 * x + 3;
      } else {
        d += 2 * (x - y) + 5;
        y--;
      }
      x++;
    }
  }

  function drawRect(img, x, y, w, h, { color, width = 1 }) {
    const plot = createPlotter(img, color, width);
    const x2 = x + w;
    const y2 = y + h;
    plotLine(plot, x, y, x2, y);
    plotLine(plot, x2, y, x2, y2);
    plotLine(plot, x2, y2, x, y2);
    plotLine(plot, x, y2, x, y);
  }

  function fillRect(img, x0, y0, x1, y1, color) {
    const d = img.data;
    const W = img.width;
    const xa = Math.max(0, Math.min(x0, x1));
    const xb = Math.min(W - 1, Math.max(x0, x1));
    const ya = Math.max(0, Math.min(y0, y1));
    const yb = Math.min(img.height - 1, Math.max(y0, y1));

    for (let y = ya; y <= yb; y++) {
      let i = (y * W + xa) * 4;
      for (let x = xa; x <= xb; x++, i += 4) {
        d[i] = color.r;
        d[i + 1] = color.g;
        d[i + 2] = color.b;
        d[i + 3] = 255;
      }
    }
  }

  BioEditor.Raster = { drawLine, drawCircle, drawRect, fillRect };
})(typeof window !== 'undefined' ? window : globalThis);
