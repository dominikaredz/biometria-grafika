/**
 * main.js – "klej" aplikacji: stan, obsługa zdarzeń, łączenie modułów.
 *
 * Dokument składa się z dwóch warstw:
 *   - current – obraz rastrowy (ImageData), na nim działają operacje
 *               z biometrii (binaryzacja itd.),
 *   - shapes  – lista kształtów wektorowych rysowanych NAD obrazem.
 * Na ekranie i w zapisanym pliku widać ich złożenie (Shapes.composite).
 *
 * Ponieważ ani funkcje przetwarzania, ani operacje na kształtach nie
 * modyfikują danych wejściowych (zwracają nowe obiekty), historia Cofnij
 * to po prostu stos par { image, shapes } – bez klonowania.
 *   - original  – obraz po wczytaniu (nigdy się nie zmienia),
 *   - undoStack – poprzednie stany (max MAX_UNDO),
 *   - preview   – niezatwierdzony podgląd (suwaki jasności/kontrastu);
 *                 gdy jest ustawiony, wyświetlamy go zamiast current.
 */
(function () {
  'use strict';

  const {
    ImageIO, ImageProcessing, Histogram, Shapes, UI, ColorPicker, DrawingTool, ShapeForm,
  } = window.BioEditor;

  const MAX_UNDO = 30;
  const BLANK_SIZE = { width: 800, height: 600 };

  const state = {
    fileName: 'obraz',
    original: null,
    current: null,
    shapes: [],
    undoStack: [],
    preview: null,
    histogram: null, // zbuforowany wynik Histogram.compute dla wyświetlanego obrazu
  };

  // ---------- Elementy DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    fileInput: $('file-input'),
    btnOpen: $('btn-open'),
    btnNew: $('btn-new'),
    btnSave: $('btn-save'),
    btnUndo: $('btn-undo'),
    btnReset: $('btn-reset'),
    btnBinarize: $('btn-binarize'),
    btnOtsu: $('btn-otsu'),
    btnStretch: $('btn-stretch'),
    btnEqualize: $('btn-equalize'),
    stretchLow: $('stretch-low'),
    stretchHigh: $('stretch-high'),
    imageRange: $('image-range'),
    brightness: $('brightness'),
    brightnessValue: $('brightness-value'),
    contrast: $('contrast'),
    contrastValue: $('contrast-value'),
    btnAdjustApply: $('btn-adjust-apply'),
    btnAdjustCancel: $('btn-adjust-cancel'),
    btnInvert: $('btn-invert'),
    btnFlatten: $('btn-flatten'),
    threshold: $('threshold'),
    thresholdValue: $('threshold-value'),
    imageCanvas: $('image-canvas'),
    placeholder: $('placeholder'),
    histCanvas: $('histogram'),
    histLog: $('hist-log'),
    shapeWidth: $('shape-width'),
    shapeToolHint: $('shape-tool-hint'),
    status: $('status'),
  };

  const TOOL_HINTS = {
    select: 'Kliknij krawędź kształtu, aby go zaznaczyć. Przeciągnij krawędź – przesunięcie, '
      + 'uchwyt (kwadracik) – zmiana kształtu. Delete – usuń.',
    line: 'Kliknij początek i koniec linii (albo przeciągnij). Esc – anuluj.',
    rect: 'Kliknij dwa przeciwległe rogi (albo przeciągnij). Esc – anuluj.',
    circle: 'Kliknij środek, potem punkt na okręgu (albo przeciągnij). Esc – anuluj.',
  };

  const binChannel = UI.createSegmented($('bin-channel'));
  const histView = UI.createSegmented($('hist-channel'), redrawHistogram);
  const histOpsMode = UI.createSegmented($('hist-ops-mode'));
  const colorPicker = ColorPicker.create($('panel-color'));

  /** Styl nowych kształtów: kolor z selektora + grubość z pola. */
  function currentStyle() {
    const width = Math.round(Number(el.shapeWidth.value));
    return { color: colorPicker.rgb, width: Number.isFinite(width) ? Math.min(Math.max(width, 1), 50) : 1 };
  }

  const drawing = DrawingTool.create(el.imageCanvas, {
    getShapes: () => state.shapes,
    getStyle: currentStyle,
    isEnabled: () => state.current !== null,
    requestRender: scheduleRender,
    onCommit: (shapes, { select, label }) => commitShapes(shapes, select, label),
    onSelectionChange: syncShapeForm,
  });

  const toolSelector = UI.createSegmented($('shape-tool'), (tool) => {
    drawing.setTool(tool);
    el.shapeToolHint.textContent = TOOL_HINTS[tool];
    syncShapeForm();
  });

  const shapeForm = ShapeForm.create($('shape-form'), {
    onAdd(type, params) {
      const shapes = state.shapes.concat(Shapes.create(type, params, currentStyle()));
      commitShapes(shapes, shapes.length - 1, 'dodano: ' + Shapes.TYPES[type].label.toLowerCase());
    },
    onApply(params) {
      replaceSelected((s) => Shapes.withParams(s, params), 'zmieniono parametry kształtu');
    },
    onRestyle() {
      replaceSelected((s) => Shapes.withStyle(s, currentStyle()), 'zmieniono kolor i grubość');
    },
    onDelete: () => drawing.deleteSelected(),
  });

  // ---------- Renderowanie ----------

  /** Rysuje histogram z zapamiętanych danych (bez ponownego liczenia). */
  function redrawHistogram() {
    Histogram.draw(el.histCanvas, state.histogram, histView.value, {
      logScale: el.histLog.checked,
    });
  }

  /**
   * Wyświetla obraz złożony z warstwy rastrowej i kształtów.
   * Histogram liczymy z obrazu z kształtami, ale PRZED dorysowaniem
   * uchwytów zaznaczenia (te są tylko pomocą na ekranie).
   *
   * @param {{histogram?: boolean}} [options] histogram: false – szybkie
   *   odświeżenie w trakcie przeciągania myszą (histogram liczymy na końcu)
   */
  function render({ histogram = true } = {}) {
    if (!state.current) return;
    const img = Shapes.composite(state.preview || state.current, drawing.getVisibleShapes());
    if (histogram) {
      state.histogram = Histogram.compute(img);
      redrawHistogram();
      showImageRange();
    }
    drawing.drawOverlay(img);
    ImageIO.drawImageData(el.imageCanvas, img);
  }

  /**
   * Odświeżenie "przy najbliższej klatce". Zdarzeń pointermove może być
   * kilkaset na sekundę, a ekran odświeża się ~60 razy – requestAnimationFrame
   * łączy je w jedno rysowanie na klatkę.
   */
  let renderQueued = false;
  let renderHistogramQueued = false;
  function scheduleRender(withHistogram = false) {
    renderHistogramQueued = renderHistogramQueued || withHistogram;
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      const histogram = renderHistogramQueued;
      renderQueued = false;
      renderHistogramQueued = false;
      render({ histogram });
    });
  }

  /** Wypisuje zakres wartości (min–max) kanałów wyświetlanego obrazu. */
  function showImageRange() {
    const parts = ['r', 'g', 'b'].map((k) => {
      const range = ImageProcessing.histogramRange(state.histogram[k]);
      return range ? `${k.toUpperCase()} ${range.min}–${range.max}` : '';
    });
    el.imageRange.textContent = 'Zakres w obrazie: ' + parts.join(' · ');
  }

  /** Włącza/wyłącza przyciski zależnie od stanu aplikacji. */
  function updateControls() {
    const hasImage = state.current !== null;
    UI.setEnabled([
      el.btnSave, el.btnBinarize, el.btnOtsu, el.btnStretch, el.btnEqualize,
      el.btnInvert, el.brightness, el.contrast,
    ], hasImage);
    UI.setEnabled([el.btnAdjustApply, el.btnAdjustCancel], state.preview !== null);
    UI.setEnabled([el.btnUndo], state.undoStack.length > 0);
    UI.setEnabled([el.btnReset], hasImage && (state.current !== state.original || state.shapes.length > 0));
    UI.setEnabled([el.btnFlatten], state.shapes.length > 0);
    el.imageCanvas.hidden = !hasImage;
    el.placeholder.hidden = hasImage;
  }

  /** Pokazuje w polach tekstowych parametry zaznaczonego albo nowego kształtu. */
  function syncShapeForm() {
    if (!state.current) {
      shapeForm.show(null, 'Otwórz obraz albo utwórz nową kanwę, aby rysować.');
      return;
    }
    const shape = state.shapes[drawing.selected];
    if (shape) {
      shapeForm.show({ type: shape.type, values: Shapes.params(shape), selected: true });
    } else if (drawing.tool !== 'select') {
      const { width, height } = state.current;
      const values = Shapes.defaultParams(drawing.tool, width, height);
      shapeForm.show({ type: drawing.tool, values, selected: false });
    } else {
      shapeForm.show(null, 'Zaznacz kształt myszą albo wybierz narzędzie, aby dodać nowy.');
    }
  }

  function describe(extra) {
    const { width, height } = state.current;
    const shapes = state.shapes.length ? ` • kształty: ${state.shapes.length}` : '';
    return `${state.fileName} • ${width}×${height} px${shapes}` + (extra ? ' • ' + extra : '');
  }

  /** Odrzuca niezatwierdzony podgląd jasności/kontrastu i zeruje suwaki. */
  function clearPreview() {
    state.preview = null;
    el.brightness.value = '0';
    el.contrast.value = '0';
    el.brightnessValue.textContent = '0';
    el.contrastValue.textContent = '0';
  }

  /** Zapisuje nowy stan dokumentu, odkładając poprzedni na stos Cofnij. */
  function commit(image, shapes = state.shapes) {
    clearPreview();
    state.undoStack.push({ image: state.current, shapes: state.shapes });
    if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
    state.current = image;
    state.shapes = shapes;
  }

  /** Zmiana listy kształtów (z myszy lub z pól tekstowych). */
  function commitShapes(shapes, selectIndex, label) {
    commit(state.current, shapes);
    drawing.select(selectIndex);
    render();
    updateControls();
    UI.setStatus(el.status, describe(label));
  }

  function replaceSelected(transform, label) {
    const i = drawing.selected;
    if (!state.shapes[i]) return;
    const shapes = state.shapes.slice();
    shapes[i] = transform(shapes[i]);
    commitShapes(shapes, i, label);
  }

  /** Ustawia nowy dokument (wczytany plik lub pusta kanwa). */
  function openDocument(imageData, fileName) {
    state.fileName = fileName;
    state.original = imageData;
    state.current = imageData;
    state.shapes = [];
    state.undoStack = [];
    clearPreview();
    drawing.cancel();
    drawing.select(-1);
    render();
    updateControls();
    UI.setStatus(el.status, describe());
  }

  // ---------- Obsługa zdarzeń ----------

  el.btnOpen.addEventListener('click', () => el.fileInput.click());

  el.fileInput.addEventListener('change', async () => {
    const file = el.fileInput.files[0];
    if (!file) return;

    try {
      const imageData = await ImageIO.loadImageData(file);
      openDocument(imageData, file.name.replace(/\.[^.]+$/, '') || 'obraz');
    } catch (err) {
      UI.setStatus(el.status, 'Błąd: ' + err.message);
    }
    el.fileInput.value = ''; // pozwala wczytać ten sam plik ponownie
  });

  el.btnNew.addEventListener('click', () => {
    openDocument(ImageIO.createBlankImage(BLANK_SIZE.width, BLANK_SIZE.height), 'kanwa');
  });

  el.btnSave.addEventListener('click', () => {
    // Zapisujemy obraz z kształtami (i podglądem), ale bez uchwytów zaznaczenia
    const img = Shapes.composite(state.preview || state.current, state.shapes);
    ImageIO.saveImageDataAsPng(img, state.fileName + '_edit.png');
  });

  el.threshold.addEventListener('input', () => {
    el.thresholdValue.textContent = el.threshold.value;
  });

  /**
   * Wykonuje operację na warstwie obrazu (kształty zostają nad nim),
   * zapisuje wynik w historii i wypisuje czas na pasku statusu.
   *
   * @param {(src: ImageData) => ImageData} operation
   * @param {string | (() => string)} label opis do paska statusu
   */
  function applyOperation(operation, label) {
    const t0 = performance.now();
    const result = operation(state.current);
    commit(result);
    render();
    updateControls();
    const ms = (performance.now() - t0).toFixed(1);
    UI.setStatus(el.status, describe(`${typeof label === 'function' ? label() : label}: ${ms} ms`));
  }

  /** Odczytuje liczbę 0–255 z pola; przy błędzie podświetla pole i zwraca null. */
  function readLevel(input) {
    const v = Number(input.value);
    const ok = input.value.trim() !== '' && Number.isFinite(v) && v >= 0 && v <= 255;
    input.classList.toggle('invalid', !ok);
    return ok ? Math.round(v) : null;
  }

  el.btnBinarize.addEventListener('click', () => {
    const channel = binChannel.value;
    const threshold = Number(el.threshold.value);
    applyOperation(
      (src) => ImageProcessing.binarize(src, { channel, threshold }),
      `binaryzacja (${channel}, próg ${threshold})`
    );
  });

  el.btnOtsu.addEventListener('click', () => {
    const channel = binChannel.value;
    let threshold;
    applyOperation((src) => {
      // Histogram liczymy z warstwy obrazu (bez kształtów), tak jak binaryzację
      threshold = ImageProcessing.otsuThreshold(Histogram.compute(src)[channel]);
      return ImageProcessing.binarize(src, { channel, threshold });
    }, () => `binaryzacja Otsu (${channel}, wyznaczony próg ${threshold})`);
    el.threshold.value = String(threshold);
    el.thresholdValue.textContent = String(threshold);
  });

  el.btnStretch.addEventListener('click', () => {
    const low = readLevel(el.stretchLow);
    const high = readLevel(el.stretchHigh);
    if (low === null || high === null) return;
    const mode = histOpsMode.value;
    applyOperation(
      (src) => ImageProcessing.stretchHistogram(src, { low, high, mode }),
      `rozciąganie histogramu do ${low}–${high} (${mode === 'joint' ? 'wspólnie' : 'kanały osobno'})`
    );
  });

  el.btnEqualize.addEventListener('click', () => {
    const mode = histOpsMode.value;
    applyOperation(
      (src) => ImageProcessing.equalizeHistogram(src, { mode }),
      `wyrównanie histogramu (${mode === 'joint' ? 'wspólnie' : 'kanały osobno'})`
    );
  });

  el.btnInvert.addEventListener('click', () => {
    applyOperation(ImageProcessing.invert, 'negatyw');
  });

  /** Podgląd na żywo: liczymy obraz z suwaków, ale nie zapisujemy go w historii. */
  function updateAdjustPreview() {
    const brightness = Number(el.brightness.value);
    const contrast = Number(el.contrast.value);
    el.brightnessValue.textContent = String(brightness);
    el.contrastValue.textContent = String(contrast);
    state.preview = brightness === 0 && contrast === 0
      ? null
      : ImageProcessing.adjustBrightnessContrast(state.current, { brightness, contrast });
    scheduleRender(true);
    updateControls();
    UI.setStatus(el.status, describe(state.preview
      ? `podgląd: jasność ${brightness}, kontrast ${contrast}% (niezatwierdzone)` : ''));
  }

  el.brightness.addEventListener('input', updateAdjustPreview);
  el.contrast.addEventListener('input', updateAdjustPreview);

  el.btnAdjustApply.addEventListener('click', () => {
    if (!state.preview) return;
    const label = `jasność ${el.brightness.value}, kontrast ${el.contrast.value}%`;
    const preview = state.preview;
    applyOperation(() => preview, label);
  });

  el.btnAdjustCancel.addEventListener('click', () => {
    clearPreview();
    render();
    updateControls();
  });

  el.btnFlatten.addEventListener('click', () => {
    if (state.shapes.length === 0) return;
    commit(Shapes.composite(state.current, state.shapes), []);
    drawing.select(-1);
    render();
    updateControls();
    UI.setStatus(el.status, describe('kształty wtopione w obraz'));
  });

  el.btnUndo.addEventListener('click', () => {
    if (state.undoStack.length === 0) return;
    const prev = state.undoStack.pop();
    state.current = prev.image;
    state.shapes = prev.shapes;
    clearPreview();
    drawing.cancel();
    drawing.select(-1);
    render();
    updateControls();
    UI.setStatus(el.status, describe('cofnięto'));
  });

  el.btnReset.addEventListener('click', () => {
    if (state.current === state.original && state.shapes.length === 0) return;
    commit(state.original, []); // reset też można cofnąć
    drawing.select(-1);
    render();
    updateControls();
    UI.setStatus(el.status, describe('przywrócono oryginał'));
  });

  el.histLog.addEventListener('change', redrawHistogram);

  // Skróty klawiszowe kanwy (pomijamy, gdy użytkownik pisze w polu tekstowym)
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'Escape') {
      drawing.cancel();
      if (drawing.selected !== -1) drawing.select(-1);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && drawing.selected !== -1) {
      e.preventDefault();
      drawing.deleteSelected();
    }
  });

  // ---------- Start ----------
  el.shapeToolHint.textContent = TOOL_HINTS[toolSelector.value];
  redrawHistogram(); // pusty wykres z osią, zanim wczytamy obraz
  syncShapeForm();
  updateControls();
})();
