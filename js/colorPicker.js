/**
 * colorPicker.js – panel wyboru koloru w modelu RGB lub CMYK
 * (wzorowany na selektorach z programów graficznych).
 *
 * Wybór myszą:
 *   - kwadrat nasycenie (oś X) / jasność (oś Y) dla bieżącego odcienia,
 *   - pasek odcienia (hue) pod kwadratem,
 *   - suwaki składowych (R, G, B albo C, M, Y, K) z gradientem podglądu.
 * Wybór z klawiatury: pola liczbowe obok suwaków.
 *
 * Stan przechowujemy w OBU modelach naraz:
 *   - w trybie RGB źródłem jest RGB, a CMYK liczymy wzorem rgbToCmyk,
 *   - w trybie CMYK źródłem jest CMYK, a RGB liczymy wzorem cmykToRgb.
 * Gdybyśmy trzymali tylko RGB, wpisane CMYK by się "rozjeżdżało" –
 * np. C=50%, K=50% po konwersji tam i z powrotem dałoby inne C i K
 * (wiele kombinacji CMYK daje ten sam kolor RGB).
 *
 * Elementy panelu wyszukujemy po atrybutach data-role / data-channel
 * wewnątrz kontenera, więc komponent nie zależy od globalnych id.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});
  const { rgbToCmyk, cmykToRgb, hsvToRgb, rgbToHsv, rgbToHex } = BioEditor.ColorSpaces;

  const RGB_KEYS = ['r', 'g', 'b'];
  const CMYK_KEYS = ['c', 'm', 'y', 'k'];

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  /** Ułamek 0–1 -> procent z jednym miejscem po przecinku (np. 0.2157 -> 21.6). */
  const toPercent = (v) => Math.round(v * 1000) / 10;
  const fmt = (n) => n.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
  const css = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`;

  /**
   * Rysuje kwadrat nasycenie/jasność dla odcienia h – ręcznie, do bufora pikseli.
   *
   * Zamiast wołać hsvToRgb dla każdego piksela korzystamy z tego, że przy
   * stałym odcieniu kolor HSV jest liniową mieszanką:
   *   kolor = v · ((1 − s) · biały + s · czysty_odcień)
   * Czysty odcień (s = 1, v = 1) liczymy raz, a w pętli zostają mnożenia.
   */
  function renderSaturationValue(canvas, h) {
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const pure = hsvToRgb(h, 1, 1);

    let i = 0;
    for (let y = 0; y < H; y++) {
      const v = 1 - y / (H - 1);
      for (let x = 0; x < W; x++) {
        const s = x / (W - 1);
        // Uint8ClampedArray sam zaokrągla i przycina do 0–255
        d[i] = v * (255 + s * (pure.r - 255));
        d[i + 1] = v * (255 + s * (pure.g - 255));
        d[i + 2] = v * (255 + s * (pure.b - 255));
        d[i + 3] = 255;
        i += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /**
   * Rysuje pasek odcieni (0–360°). Canvas ma wysokość 1 px – CSS rozciąga
   * go w pionie, więc liczymy tylko jeden wiersz pikseli.
   */
  function renderHueBar(canvas) {
    const W = canvas.width;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, canvas.height);
    const d = img.data;
    for (let x = 0; x < W; x++) {
      const { r, g, b } = hsvToRgb((x / W) * 360, 1, 1);
      d[x * 4] = r;
      d[x * 4 + 1] = g;
      d[x * 4 + 2] = b;
      d[x * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  /**
   * Obsługa przeciągania myszą po elemencie. onPick dostaje położenie
   * kursora jako ułamki 0–1 względem elementu.
   *
   * setPointerCapture "przypina" kolejne zdarzenia wskaźnika do elementu,
   * więc przeciąganie działa także, gdy kursor wyjedzie poza kwadrat.
   */
  function bindPointerDrag(el, onPick) {
    const pick = (e) => {
      const rect = el.getBoundingClientRect();
      onPick(
        clamp((e.clientX - rect.left) / rect.width, 0, 1),
        clamp((e.clientY - rect.top) / rect.height, 0, 1)
      );
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      pick(e);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (el.hasPointerCapture(e.pointerId)) pick(e);
    });
  }

  /**
   * Tworzy selektor koloru w podanym kontenerze.
   *
   * @param {HTMLElement} root  sekcja panelu z elementami data-role
   * @param {{onChange?: (rgb: {r: number, g: number, b: number}) => void,
   *          initial?: {r: number, g: number, b: number}}} [options]
   * @returns {{ readonly rgb: {r: number, g: number, b: number} }}
   */
  function create(root, { onChange, initial = { r: 0, g: 0, b: 0 } } = {}) {
    const ref = (name) => root.querySelector(`[data-role="${name}"]`);
    const el = {
      svArea: ref('sv-area'),
      sv: ref('sv'),
      svMarker: ref('sv-marker'),
      hueArea: ref('hue-area'),
      hue: ref('hue'),
      hueMarker: ref('hue-marker'),
      rgbFields: ref('rgb-fields'),
      cmykFields: ref('cmyk-fields'),
      swatch: ref('swatch'),
      chosenLabel: ref('chosen-label'),
      chosen: ref('chosen'),
      convertedLabel: ref('converted-label'),
      converted: ref('converted'),
      hex: ref('hex'),
    };

    /** Para (suwak, pole liczbowe) dla każdej składowej: channels.r, channels.c, ... */
    const channels = {};
    root.querySelectorAll('[data-channel]').forEach((row) => {
      channels[row.dataset.channel] = {
        range: row.querySelector('input[type="range"]'),
        number: row.querySelector('input[type="number"]'),
      };
    });

    const state = {
      mode: 'rgb',
      rgb: { ...initial },
      cmyk: rgbToCmyk(initial.r, initial.g, initial.b), // ułamki 0–1
      hsv: rgbToHsv(initial.r, initial.g, initial.b),
      renderedHue: null, // dla jakiego odcienia narysowano kwadrat (unikamy zbędnego rysowania)
    };

    // ---------- Zmiana stanu ----------

    /**
     * Przelicza HSV z RGB, zachowując odcień dla szarości (s = 0) i nasycenie
     * dla czerni (v = 0) – inaczej marker na pasku odcienia "skakałby" na 0°.
     */
    function syncHsvFromRgb() {
      const { r, g, b } = state.rgb;
      const hsv = rgbToHsv(r, g, b);
      if (hsv.s === 0 || hsv.v === 0) hsv.h = state.hsv.h;
      if (hsv.v === 0) hsv.s = state.hsv.s;
      state.hsv = hsv;
    }

    function setRgb(rgb, skip) {
      state.rgb = rgb;
      state.cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
      syncHsvFromRgb();
      update(skip);
    }

    function setCmyk(cmyk, skip) {
      state.cmyk = cmyk;
      state.rgb = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
      syncHsvFromRgb();
      update(skip);
    }

    /** Wybór myszą z kwadratu / paska odcienia (HSV -> RGB -> CMYK). */
    function setHsv(hsv) {
      state.hsv = hsv;
      const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
      state.rgb = rgb;
      state.cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
      update();
    }

    // ---------- Odświeżanie widoku ----------

    /**
     * Aktualizuje wszystkie elementy panelu na podstawie stanu.
     * @param {HTMLInputElement} [skip] pole, które użytkownik właśnie edytuje –
     *   nie nadpisujemy go, żeby nie przeszkadzać w pisaniu (np. "12," -> "12").
     */
    function update(skip) {
      const { rgb, cmyk, hsv } = state;

      if (state.renderedHue !== hsv.h) {
        renderSaturationValue(el.sv, hsv.h);
        state.renderedHue = hsv.h;
      }
      el.svMarker.style.left = hsv.s * 100 + '%';
      el.svMarker.style.top = (1 - hsv.v) * 100 + '%';
      el.svMarker.style.background = css(rgb);
      el.hueMarker.style.left = (hsv.h / 360) * 100 + '%';

      // Wartości suwaków i pól
      for (const k of RGB_KEYS) setField(channels[k], rgb[k], skip);
      for (const k of CMYK_KEYS) setField(channels[k], toPercent(cmyk[k]), skip);

      // Gradienty na suwakach: jak zmieni się kolor, gdy ruszymy tylko tę składową
      for (const k of RGB_KEYS) {
        const from = { ...rgb, [k]: 0 };
        const to = { ...rgb, [k]: 255 };
        channels[k].range.style.background = `linear-gradient(to right, ${css(from)}, ${css(to)})`;
      }
      for (const k of CMYK_KEYS) {
        const at = (v) => {
          const x = { ...cmyk, [k]: v };
          return css(cmykToRgb(x.c, x.m, x.y, x.k));
        };
        channels[k].range.style.background = `linear-gradient(to right, ${at(0)}, ${at(1)})`;
      }

      // Tryb: które pola widać i co jest "wybrane", a co "po konwersji"
      const rgbText = `R ${rgb.r} · G ${rgb.g} · B ${rgb.b}`;
      const cmykText = CMYK_KEYS.map((k) => `${k.toUpperCase()} ${fmt(toPercent(cmyk[k]))}%`).join(' · ');
      const isRgb = state.mode === 'rgb';
      el.rgbFields.hidden = !isRgb;
      el.cmykFields.hidden = isRgb;
      el.chosenLabel.textContent = isRgb ? 'Wybrany (RGB)' : 'Wybrany (CMYK)';
      el.chosen.textContent = isRgb ? rgbText : cmykText;
      el.convertedLabel.textContent = isRgb ? 'Po konwersji (CMYK)' : 'Po konwersji (RGB)';
      el.converted.textContent = isRgb ? cmykText : rgbText;
      el.hex.textContent = rgbToHex(rgb.r, rgb.g, rgb.b);
      el.swatch.style.background = css(rgb);

      if (onChange) onChange({ ...rgb });
    }

    function setField({ range, number }, value, skip) {
      range.value = value;
      if (number !== skip) number.value = value;
    }

    // ---------- Zdarzenia ----------

    BioEditor.UI.createSegmented(root.querySelector('[data-role="mode"]'), (mode) => {
      state.mode = mode;
      update();
    });

    bindPointerDrag(el.svArea, (fx, fy) => setHsv({ h: state.hsv.h, s: fx, v: 1 - fy }));
    // 359.99 zamiast 360: odcień 360° to znów 0°, a marker skoczyłby na lewo
    bindPointerDrag(el.hueArea, (fx) => setHsv({ ...state.hsv, h: Math.min(fx * 360, 359.99) }));

    /**
     * Podpina suwak i pole liczbowe składowej.
     * 'input' – zmiana na żywo (z pominięciem edytowanego pola),
     * 'change' – po zatwierdzeniu (Enter / opuszczenie pola) wpisujemy
     *            poprawioną wartość, np. 300 -> 255.
     */
    function bindChannel(key, max, apply) {
      const { range, number } = channels[key];
      const read = (input) => {
        if (input.value.trim() === '') return null;
        const v = Number(input.value);
        return Number.isFinite(v) ? clamp(v, 0, max) : null;
      };
      range.addEventListener('input', () => apply(key, read(range)));
      number.addEventListener('input', () => {
        const v = read(number);
        if (v !== null) apply(key, v, number);
      });
      number.addEventListener('change', () => update());
    }

    for (const k of RGB_KEYS) {
      bindChannel(k, 255, (key, v, skip) => setRgb({ ...state.rgb, [key]: Math.round(v) }, skip));
    }
    for (const k of CMYK_KEYS) {
      bindChannel(k, 100, (key, v, skip) => setCmyk({ ...state.cmyk, [key]: v / 100 }, skip));
    }

    renderHueBar(el.hue);
    update();

    return {
      get rgb() {
        return { ...state.rgb };
      },
    };
  }

  BioEditor.ColorPicker = { create };
})(window);
