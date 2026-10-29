/**
 * raster.js – rasteryzacja prymitywów: zamiana opisu geometrycznego
 * (odcinek, okrąg, prostokąt) na konkretne piksele w buforze.
 *
 * Wszystko liczymy sami na liczbach całkowitych i wpisujemy bezpośrednio
 * do Uint8ClampedArray – bez ctx.lineTo / ctx.arc / ctx.strokeRect.
 *
 * UWAGA: w odróżnieniu od imageProcessing.js te funkcje MODYFIKUJĄ
 * przekazany bufor (rysują "na" nim). Wywołujący odpowiada za to, żeby
 * był to bufor roboczy, a nie oryginał – zob. Shapes.composite.
 *
 * Bufor docelowy: dowolny obiekt { data, width, height } (np. ImageData).
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  /**
   * Tworzy funkcję plot(x, y) stawiającą "punkt pędzla" w buforze.
   *
   * Grubość linii realizujemy najprościej: w każdym punkcie wyznaczonym przez
   * algorytm stawiamy kwadrat width × width pikseli wycentrowany na tym
   * punkcie. Punkty poza obrazem są pomijane (obcinanie / clipping), więc
   * kształty mogą częściowo wychodzić poza kanwę.
   *
   * @param {{data: Uint8ClampedArray, width: number, height: number}} img
   * @param {{r: number, g: number, b: number}} color
   * @param {number} width grubość w pikselach (>= 1)
   * @returns {(x: number, y: number) => void}
   */
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

    if (width <= 1) return setPixel; // najczęstszy przypadek – bez dodatkowej pętli

    const before = (width - 1) >> 1; // ile pikseli w lewo/górę od środka
    return (x, y) => {
      const x0 = x - before;
      const y0 = y - before;
      for (let yy = y0; yy < y0 + width; yy++) {
        for (let xx = x0; xx < x0 + width; xx++) setPixel(xx, yy);
      }
    };
  }

  /**
   * Odcinek – algorytm Bresenhama (wersja całkowitoliczbowa, wszystkie oktanty).
   *
   * Idea: idziemy piksel po pikselu od (x0, y0) do (x1, y1). W każdym kroku
   * przesuwamy się o 1 w osi X, w osi Y albo w obu naraz – wybór zależy od
   * zmiennej błędu `err`, która mówi, jak daleko bieżący piksel odbiega od
   * idealnej prostej. Wzór na prostą y = y0 + (dy/dx)(x − x0) przemnożono
   * przez dx, żeby pozbyć się ułamków – zostają tylko dodawania
   * i porównania liczb całkowitych (szybkie i bez błędów zaokrągleń).
   *
   *   dx = |x1 − x0|,  dy = −|y1 − y0|,  err = dx + dy
   *   e2 = 2·err
   *   e2 >= dy  -> krok w X (err += dy)
   *   e2 <= dx  -> krok w Y (err += dx)
   *
   * Złożoność: O(max(|dx|, |dy|)) – jeden piksel na krok.
   *
   * @param {{data: Uint8ClampedArray, width: number, height: number}} img
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {{color: {r: number, g: number, b: number}, width?: number}} style
   */
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

  /**
   * Okrąg – algorytm punktu środkowego (midpoint circle, wariant Bresenhama).
   *
   * Idea: liczymy tylko 1/8 okręgu (łuk od góry do przekątnej, gdzie x <= y),
   * a pozostałe 7 części dostajemy z symetrii: (±x, ±y) oraz (±y, ±x).
   * Na tym łuku x zawsze rośnie o 1, a y czasem maleje o 1. O tym, czy
   * zmniejszyć y, decyduje znak funkcji f(x, y) = x² + y² − r² policzonej
   * w punkcie środkowym między dwoma kandydatami (y i y − 1):
   *   d < 0  -> punkt środkowy wewnątrz okręgu, zostajemy na y,
   *   d >= 0 -> punkt środkowy na zewnątrz, schodzimy na y − 1.
   * Wartość d aktualizujemy przyrostowo (tylko dodawania liczb całkowitych):
   *   start: d = 1 − r
   *   d < 0:  d += 2x + 3
   *   d >= 0: d += 2(x − y) + 5, y−−
   *
   * Złożoność: O(r) – ok. r/√2 kroków, w każdym 8 pikseli.
   *
   * @param {{data: Uint8ClampedArray, width: number, height: number}} img
   * @param {number} cx środek x
   * @param {number} cy środek y
   * @param {number} r  promień (>= 0)
   * @param {{color: {r: number, g: number, b: number}, width?: number}} style
   */
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

  /**
   * Prostokąt (osiowo wyrównany) – cztery odcinki Bresenhama między rogami.
   * Rogi: (x, y) i (x + w, y + h).
   *
   * @param {{data: Uint8ClampedArray, width: number, height: number}} img
   * @param {number} x
   * @param {number} y
   * @param {number} w szerokość (>= 0)
   * @param {number} h wysokość (>= 0)
   * @param {{color: {r: number, g: number, b: number}, width?: number}} style
   */
  function drawRect(img, x, y, w, h, { color, width = 1 }) {
    const plot = createPlotter(img, color, width);
    const x2 = x + w;
    const y2 = y + h;
    plotLine(plot, x, y, x2, y);
    plotLine(plot, x2, y, x2, y2);
    plotLine(plot, x2, y2, x, y2);
    plotLine(plot, x, y2, x, y);
  }

  /**
   * Wypełniony prostokąt od (x0, y0) do (x1, y1) włącznie – używany do
   * rysowania uchwytów zaznaczenia. Zakres przycinamy do obrazu raz, przed
   * pętlą, więc w środku nie ma już sprawdzania granic.
   */
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
