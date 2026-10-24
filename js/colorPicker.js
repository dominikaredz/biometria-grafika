(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});
  const { rgbToCmyk, cmykToRgb, hsvToRgb, rgbToHsv, rgbToHex } = BioEditor.ColorSpaces;

  const RGB_KEYS = ['r', 'g', 'b'];
  const CMYK_KEYS = ['c', 'm', 'y', 'k'];

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

  const toPercent = (v) => Math.round(v * 1000) / 10;
  const fmt = (n) => n.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
  const css = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`;

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

        d[i] = v * (255 + s * (pure.r - 255));
        d[i + 1] = v * (255 + s * (pure.g - 255));
        d[i + 2] = v * (255 + s * (pure.b - 255));
        d[i + 3] = 255;
        i += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

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
      cmyk: rgbToCmyk(initial.r, initial.g, initial.b),
      hsv: rgbToHsv(initial.r, initial.g, initial.b),
      renderedHue: null,
    };

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

    function setHsv(hsv) {
      state.hsv = hsv;
      const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
      state.rgb = rgb;
      state.cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
      update();
    }

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

      for (const k of RGB_KEYS) setField(channels[k], rgb[k], skip);
      for (const k of CMYK_KEYS) setField(channels[k], toPercent(cmyk[k]), skip);

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

    BioEditor.UI.createSegmented(root.querySelector('[data-role="mode"]'), (mode) => {
      state.mode = mode;
      update();
    });

    bindPointerDrag(el.svArea, (fx, fy) => setHsv({ h: state.hsv.h, s: fx, v: 1 - fy }));

    bindPointerDrag(el.hueArea, (fx) => setHsv({ ...state.hsv, h: Math.min(fx * 360, 359.99) }));

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
