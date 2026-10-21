/**
 * main.js – "klej" aplikacji: stan, obsługa zdarzeń, łączenie modułów.
 *
 * Stan trzymamy jako referencje do obiektów ImageData. Ponieważ funkcje
 * przetwarzania nigdy nie modyfikują wejścia (zwracają nowy obraz), nie
 * musimy niczego klonować:
 *   - original  – obraz po wczytaniu (nigdy się nie zmienia),
 *   - current   – obraz aktualnie wyświetlany,
 *   - undoStack – poprzednie wersje (max MAX_UNDO).
 */
(function () {
  'use strict';

  const { ImageIO, ImageProcessing, Histogram, UI } = window.BioEditor;

  const MAX_UNDO = 10;

  const state = {
    fileName: 'obraz',
    original: null,
    current: null,
    undoStack: [],
    histogram: null, // zbuforowany wynik Histogram.compute dla current
  };

  // ---------- Elementy DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    fileInput: $('file-input'),
    btnOpen: $('btn-open'),
    btnSave: $('btn-save'),
    btnUndo: $('btn-undo'),
    btnReset: $('btn-reset'),
    btnBinarize: $('btn-binarize'),
    threshold: $('threshold'),
    thresholdValue: $('threshold-value'),
    imageCanvas: $('image-canvas'),
    placeholder: $('placeholder'),
    histCanvas: $('histogram'),
    histLog: $('hist-log'),
    status: $('status'),
  };

  const binChannel = UI.createSegmented($('bin-channel'));
  const histView = UI.createSegmented($('hist-channel'), redrawHistogram);

  // ---------- Renderowanie ----------

  /** Rysuje histogram z zapamiętanych danych (bez ponownego liczenia). */
  function redrawHistogram() {
    Histogram.draw(el.histCanvas, state.histogram, histView.value, {
      logScale: el.histLog.checked,
    });
  }

  /** Wyświetla aktualny obraz i przelicza histogram. */
  function render() {
    ImageIO.drawImageData(el.imageCanvas, state.current);
    state.histogram = Histogram.compute(state.current);
    redrawHistogram();
  }

  /** Włącza/wyłącza przyciski zależnie od stanu aplikacji. */
  function updateControls() {
    const hasImage = state.current !== null;
    UI.setEnabled([el.btnSave, el.btnBinarize], hasImage);
    UI.setEnabled([el.btnUndo], state.undoStack.length > 0);
    UI.setEnabled([el.btnReset], hasImage && state.current !== state.original);
    el.imageCanvas.hidden = !hasImage;
    el.placeholder.hidden = hasImage;
  }

  function describe(extra) {
    const { width, height } = state.current;
    return `${state.fileName} • ${width}×${height} px` + (extra ? ' • ' + extra : '');
  }

  /** Zamienia bieżący obraz na nowy, zapamiętując poprzedni do cofania. */
  function setCurrent(next) {
    state.undoStack.push(state.current);
    if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
    state.current = next;
  }

  // ---------- Obsługa zdarzeń ----------

  el.btnOpen.addEventListener('click', () => el.fileInput.click());

  el.fileInput.addEventListener('change', async () => {
    const file = el.fileInput.files[0];
    if (!file) return;

    try {
      const imageData = await ImageIO.loadImageData(file);
      state.fileName = file.name.replace(/\.[^.]+$/, '') || 'obraz';
      state.original = imageData;
      state.current = imageData;
      state.undoStack = [];
      render();
      updateControls();
      UI.setStatus(el.status, describe());
    } catch (err) {
      UI.setStatus(el.status, 'Błąd: ' + err.message);
    }
    el.fileInput.value = ''; // pozwala wczytać ten sam plik ponownie
  });

  el.btnSave.addEventListener('click', () => {
    ImageIO.saveCanvasAsPng(el.imageCanvas, state.fileName + '_edit.png');
  });

  el.threshold.addEventListener('input', () => {
    el.thresholdValue.textContent = el.threshold.value;
  });

  el.btnBinarize.addEventListener('click', () => {
    const t0 = performance.now();

    const result = ImageProcessing.binarize(state.current, {
      channel: binChannel.value,
      threshold: Number(el.threshold.value),
    });
    setCurrent(result);
    render();
    updateControls();

    const ms = (performance.now() - t0).toFixed(1);
    UI.setStatus(el.status, describe(`binaryzacja (${binChannel.value}, próg ${el.threshold.value}): ${ms} ms`));
  });

  el.btnUndo.addEventListener('click', () => {
    if (state.undoStack.length === 0) return;
    state.current = state.undoStack.pop();
    render();
    updateControls();
    UI.setStatus(el.status, describe('cofnięto'));
  });

  el.btnReset.addEventListener('click', () => {
    if (state.current === state.original) return;
    setCurrent(state.original); // reset też można cofnąć
    render();
    updateControls();
    UI.setStatus(el.status, describe('przywrócono oryginał'));
  });

  el.histLog.addEventListener('change', redrawHistogram);

  // ---------- Start ----------
  redrawHistogram(); // pusty wykres z osią, zanim wczytamy obraz
  updateControls();
})();
