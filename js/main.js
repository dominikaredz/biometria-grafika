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
 *   - undoStack – poprzednie stany (max MAX_UNDO).
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
    const img = Shapes.composite(state.current, drawing.getVisibleShapes());
    if (histogram) {
      state.histogram = Histogram.compute(img);
      redrawHistogram();
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
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render({ histogram: false });
    });
  }

  /** Włącza/wyłącza przyciski zależnie od stanu aplikacji. */
  function updateControls() {
    const hasImage = state.current !== null;
    UI.setEnabled([el.btnSave, el.btnBinarize], hasImage);
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

  /** Zapisuje nowy stan dokumentu, odkładając poprzedni na stos Cofnij. */
  function commit(image, shapes = state.shapes) {
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
    // Zapisujemy obraz z kształtami, ale bez uchwytów zaznaczenia
    const img = Shapes.composite(state.current, state.shapes);
    ImageIO.saveImageDataAsPng(img, state.fileName + '_edit.png');
  });

  el.threshold.addEventListener('input', () => {
    el.thresholdValue.textContent = el.threshold.value;
  });

  el.btnBinarize.addEventListener('click', () => {
    const t0 = performance.now();

    // Binaryzacja działa na warstwie obrazu – kształty zostają nad nim
    const result = ImageProcessing.binarize(state.current, {
      channel: binChannel.value,
      threshold: Number(el.threshold.value),
    });
    commit(result);
    render();
    updateControls();

    const ms = (performance.now() - t0).toFixed(1);
    UI.setStatus(el.status, describe(`binaryzacja (${binChannel.value}, próg ${el.threshold.value}): ${ms} ms`));
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
