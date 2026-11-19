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
    ImageIO, ImageProcessing, Histogram, Shapes, UI, ColorPicker, DrawingTool, ShapeForm, ColorSpaces,
    Filters, Thresholding, StructuringElementEditor, Convolution,
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
    thrMethod: $('thr-method'),
    thrHint: $('thr-hint'),
    thrParams: $('thr-params'),
    btnThrApply: $('btn-thr-apply'),
    blurSize: $('blur-size'),
    btnBlur: $('btn-blur'),
    medianSize: $('median-size'),
    btnMedian: $('btn-median'),
    btnSobel: $('btn-sobel'),
    convPreset: $('conv-preset'),
    convGauss: $('conv-gauss'),
    convGaussSize: $('conv-gauss-size'),
    convGaussSigma: $('conv-gauss-sigma'),
    convKernel: $('conv-kernel'),
    convInfo: $('conv-info'),
    convDivisor: $('conv-divisor'),
    convOffset: $('conv-offset'),
    convAbs: $('conv-abs'),
    btnConv: $('btn-conv'),
    medW: $('med-w'),
    medH: $('med-h'),
    btnMedRect: $('btn-med-rect'),
    pixW: $('pix-w'),
    pixH: $('pix-h'),
    btnPixelate: $('btn-pixelate'),
    kuwSize: $('kuw-size'),
    btnKuwahara: $('btn-kuwahara'),
    predSize: $('pred-size'),
    predAmount: $('pred-amount'),
    btnPredator: $('btn-predator'),
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
  const sobelMode = UI.createSegmented($('sobel-mode'));
  const seEditor = StructuringElementEditor.create($('se-editor'));
  const morphButtons = Array.from(document.querySelectorAll('[data-morph]'));
  const tabs = UI.createTabs($('tool-tabs'), document.querySelector('.sidebar'), {
    storageKey: 'bioEditor.tab',
  });
  const colorPicker = ColorPicker.create($('panel-color'), { onChange: showDrawingColor });

  /** Próbka bieżącego koloru w panelu Kształty (kliknięcie otwiera zakładkę Kolor). */
  function showDrawingColor({ r, g, b }) {
    $('shape-color-swatch').style.background = `rgb(${r}, ${g}, ${b})`;
    $('shape-color-hex').textContent = ColorSpaces.rgbToHex(r, g, b);
  }
  $('shape-color').addEventListener('click', () => tabs.select('color'));

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
      el.btnThrApply, el.btnBlur, el.btnMedian, el.btnSobel, ...morphButtons,
      el.btnConv, el.btnMedRect, el.btnPixelate, el.btnKuwahara, el.btnPredator,
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

  // ---------- Binaryzacja – metody (Biometria, zad. 3) ----------

  const THRESHOLD_HINTS = {
    kapur: 'Próg globalny maksymalizujący sumę entropii tła i obiektu.',
    niblack: 'T = m + k·s (m, s – średnia i odchylenie w oknie). k < 0 dla ciemnego tekstu na jasnym tle.',
    sauvola: 'T = m·(1 + k·(s/R − 1)). Mniej szumu w tle niż Niblack – dobra dla dokumentów.',
    phansalkar: 'T = m·(1 + p·e^(−q·m) + k·(s/R − 1)) na wartościach 0–1. Dla obrazów o niskim kontraście.',
    bernsen: 'T = (min + max)/2 w oknie, gdy kontrast max − min ≥ L; jednolite okna wg progu globalnego.',
    compensated: 'Usuwa nierówne oświetlenie (średnia z dużego okna), potem jeden próg Otsu.',
  };

  for (const [key, m] of Object.entries(Thresholding.METHODS)) {
    el.thrMethod.add(new Option(m.label, key));
  }
  let thrFields = null;
  function showThresholdParams() {
    const method = el.thrMethod.value;
    thrFields = UI.createParamFields(el.thrParams, Thresholding.METHODS[method].params, 'thr');
    el.thrHint.textContent = THRESHOLD_HINTS[method];
  }
  el.thrMethod.addEventListener('change', showThresholdParams);
  showThresholdParams();

  el.btnThrApply.addEventListener('click', () => {
    const params = thrFields.read();
    if (!params) return;
    const method = el.thrMethod.value;
    let info = '';
    applyOperation((src) => {
      const result = Thresholding.binarize(src, method, params);
      info = result.info;
      return result.image;
    }, () => `${Thresholding.METHODS[method].label} (${info})`);
  });

  // ---------- Filtry i morfologia (Grafika, zad. 2) ----------

  /** Rozmiar okna z pola: liczba nieparzysta 3–51; przy błędzie podświetla pole. */
  function readWindowSize(input) {
    const v = Number(input.value);
    const ok = input.value.trim() !== '' && Number.isInteger(v) && v >= 3 && v <= 51 && v % 2 === 1;
    input.classList.toggle('invalid', !ok);
    return ok ? v : null;
  }

  el.btnBlur.addEventListener('click', () => {
    const size = readWindowSize(el.blurSize);
    if (size === null) return;
    applyOperation((src) => Filters.meanFilter(src, { size }), `filtr uśredniający ${size}×${size}`);
  });

  el.btnMedian.addEventListener('click', () => {
    const size = readWindowSize(el.medianSize);
    if (size === null) return;
    applyOperation((src) => Filters.medianFilter(src, { size }), `filtr medianowy ${size}×${size}`);
  });

  el.btnSobel.addEventListener('click', () => {
    const mode = sobelMode.value;
    const name = { magnitude: '|G|', x: 'Gx', y: 'Gy' }[mode];
    applyOperation((src) => Filters.sobel(src, { mode }), `Sobel (${name})`);
  });

  const MORPH_LABELS = { dilate: 'dylatacja', erode: 'erozja', open: 'otwarcie', close: 'zamknięcie' };
  morphButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const operation = btn.dataset.morph;
      const element = seEditor.element;
      applyOperation(
        (src) => Filters.morphology(src, { operation, element }),
        `${MORPH_LABELS[operation]} (element ${element.width}×${element.height})`
      );
    });
  });

  // ---------- Splot i efekty (Biometria, zad. 4) ----------

  /**
   * Odczytuje liczbę z pola i sprawdza zakres (opcjonalnie: całkowita,
   * nieparzysta). Przy błędzie podświetla pole na czerwono i zwraca null.
   */
  function readNumber(input, { min, max, integer = false, odd = false }) {
    const v = Number(input.value);
    const ok = input.value.trim() !== '' && Number.isFinite(v) && v >= min && v <= max
      && (!integer || Number.isInteger(v)) && (!odd || v % 2 === 1);
    input.classList.toggle('invalid', !ok);
    return ok ? v : null;
  }

  el.convPreset.add(new Option('Własna maska', 'custom'));
  for (const [key, preset] of Object.entries(Convolution.PRESETS)) {
    el.convPreset.add(new Option(preset.label, key));
  }

  /** Opis maski pod polem tekstowym: rozmiar, suma wag i użyty dzielnik. */
  function showKernelInfo() {
    const { kernel, error } = Convolution.parseKernel(el.convKernel.value);
    el.convKernel.classList.toggle('invalid', Boolean(error));
    if (error) {
      el.convInfo.textContent = error;
      return null;
    }
    const sum = Math.round(Convolution.kernelSum(kernel) * 1e4) / 1e4;
    const div = el.convDivisor.value.trim() === '' ? `auto = ${sum !== 0 ? sum : 1}` : el.convDivisor.value;
    el.convInfo.textContent = `Maska ${kernel.width}×${kernel.height}, suma wag ${sum}, dzielnik ${div}.`;
    return kernel;
  }

  /** Wstawia gotową maskę (dla Gaussa – z rozmiaru i σ z pól). */
  function loadPreset() {
    const key = el.convPreset.value;
    const preset = Convolution.PRESETS[key];
    el.convGauss.hidden = !(preset && preset.gaussian);
    if (!preset) return; // „Własna maska” – zostawiamy to, co jest w polu
    let rows = preset.rows;
    if (preset.gaussian) {
      const size = readNumber(el.convGaussSize, { min: 3, max: 25, integer: true, odd: true });
      const sigma = readNumber(el.convGaussSigma, { min: 0.3, max: 10 });
      if (size === null || sigma === null) return;
      rows = Convolution.gaussianKernel(size, sigma);
    }
    el.convKernel.value = Convolution.formatKernel(rows);
    el.convDivisor.value = '';
    el.convOffset.value = '0';
    el.convAbs.checked = Boolean(preset.absolute);
    showKernelInfo();
  }

  el.convPreset.addEventListener('change', loadPreset);
  el.convGaussSize.addEventListener('change', loadPreset);
  el.convGaussSigma.addEventListener('change', loadPreset);
  el.convKernel.addEventListener('input', () => {
    el.convPreset.value = 'custom'; // ręczna zmiana = własna maska
    el.convGauss.hidden = true;
    showKernelInfo();
  });
  el.convDivisor.addEventListener('input', showKernelInfo);
  el.convPreset.value = 'gauss';
  loadPreset();

  el.btnConv.addEventListener('click', () => {
    const kernel = showKernelInfo();
    const divisorText = el.convDivisor.value.trim();
    const divisor = divisorText === '' ? undefined : readNumber(el.convDivisor, { min: -1e9, max: 1e9 });
    const offset = readNumber(el.convOffset, { min: -255, max: 255 });
    if (!kernel || divisor === null || divisor === 0 || offset === null) {
      if (divisor === 0) el.convDivisor.classList.add('invalid');
      return;
    }
    const absolute = el.convAbs.checked;
    const name = el.convPreset.value === 'custom' ? 'własna maska' : Convolution.PRESETS[el.convPreset.value].label;
    applyOperation(
      (src) => Convolution.convolve(src, { kernel, divisor, offset, absolute }),
      `splot: ${name} ${kernel.width}×${kernel.height}`
    );
  });

  el.btnMedRect.addEventListener('click', () => {
    const width = readNumber(el.medW, { min: 1, max: 51, integer: true });
    const height = readNumber(el.medH, { min: 1, max: 51, integer: true });
    if (width === null || height === null) return;
    applyOperation((src) => Filters.medianFilter(src, { width, height }), `filtr medianowy ${width}×${height}`);
  });

  el.btnPixelate.addEventListener('click', () => {
    const blockW = readNumber(el.pixW, { min: 1, max: 256, integer: true });
    const blockH = readNumber(el.pixH, { min: 1, max: 256, integer: true });
    if (blockW === null || blockH === null) return;
    applyOperation((src) => Filters.pixelate(src, { blockW, blockH }), `pikselizacja ${blockW}×${blockH}`);
  });

  el.btnKuwahara.addEventListener('click', () => {
    const size = readNumber(el.kuwSize, { min: 3, max: 51, integer: true, odd: true });
    if (size === null) return;
    applyOperation((src) => Filters.kuwahara(src, { size }), `filtr Kuwahary ${size}×${size}`);
  });

  el.btnPredator.addEventListener('click', () => {
    const pixelSize = readNumber(el.predSize, { min: 1, max: 64, integer: true });
    const amount = readNumber(el.predAmount, { min: 0.5, max: 10 });
    if (pixelSize === null || amount === null) return;
    applyOperation(
      (src) => Filters.predator(src, { pixelSize, amount }),
      `filtr Predatora (piksel ${pixelSize}, siła ${amount})`
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
