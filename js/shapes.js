/**
 * shapes.js – model kształtów (scena wektorowa) i ich geometria.
 *
 * Kształt to zwykły obiekt z parametrami, np.:
 *   { type: 'line',   x1, y1, x2, y2, color, width }
 *   { type: 'rect',   x, y, w, h,     color, width }   (x, y – lewy górny róg)
 *   { type: 'circle', cx, cy, r,      color, width }
 *
 * Dlaczego wektorowo, a nie od razu w pikselach? Narysowany piksel "nie wie",
 * że należy do linii – nie dałoby się go zaznaczyć, przesunąć ani zmienić.
 * Trzymamy więc listę kształtów, a obraz z kształtami generujemy przy każdym
 * odświeżeniu (Shapes.composite) z obrazu bazowego + rasteryzacji.
 *
 * Kształty są niezmienne (immutable): każda operacja (przesunięcie, zmiana
 * rozmiaru) zwraca NOWY obiekt. Dzięki temu historia Cofnij może po prostu
 * pamiętać stare tablice kształtów.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  /** Ograniczenie wartości współrzędnych – chroni przed "zawieszeniem"
   *  pętli rysującej po wpisaniu np. 1e9 w pole tekstowe. */
  const COORD_LIMIT = 20000;

  /** Opis typów: etykieta i parametry edytowalne w polach tekstowych. */
  const TYPES = {
    line: {
      label: 'Linia',
      fields: [
        { key: 'x1', label: 'x₁' },
        { key: 'y1', label: 'y₁' },
        { key: 'x2', label: 'x₂' },
        { key: 'y2', label: 'y₂' },
      ],
    },
    rect: {
      label: 'Prostokąt',
      fields: [
        { key: 'x', label: 'x (lewy)' },
        { key: 'y', label: 'y (górny)' },
        { key: 'w', label: 'Szerokość', min: 0 },
        { key: 'h', label: 'Wysokość', min: 0 },
      ],
    },
    circle: {
      label: 'Okrąg',
      fields: [
        { key: 'cx', label: 'Środek x' },
        { key: 'cy', label: 'Środek y' },
        { key: 'r', label: 'Promień', min: 0 },
      ],
    },
  };

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const toCoord = (v) => clamp(Math.round(Number(v) || 0), -COORD_LIMIT, COORD_LIMIT);

  // ---------- Tworzenie ----------

  /**
   * Tworzy kształt z parametrów (np. wpisanych w pola tekstowe).
   * Wartości są zaokrąglane do całkowitych, a prostokąt normalizowany:
   * ujemna szerokość/wysokość oznacza "w drugą stronę" od punktu (x, y).
   *
   * @param {'line'|'rect'|'circle'} type
   * @param {object} params
   * @param {{color: {r: number, g: number, b: number}, width: number}} style
   * @returns {object} kształt
   */
  function create(type, params, { color, width }) {
    const style = { color: { ...color }, width: clamp(Math.round(width) || 1, 1, 50) };
    const p = {};
    for (const f of TYPES[type].fields) p[f.key] = toCoord(params[f.key]);

    if (type === 'rect') {
      if (p.w < 0) { p.x += p.w; p.w = -p.w; }
      if (p.h < 0) { p.y += p.h; p.h = -p.h; }
    } else if (type === 'circle') {
      p.r = Math.abs(p.r);
    }
    return { type, ...p, ...style };
  }

  /**
   * Tworzy kształt z dwóch punktów klikniętych myszą:
   *   linia     – początek i koniec,
   *   prostokąt – dwa przeciwległe rogi,
   *   okrąg     – środek i dowolny punkt na okręgu (wyznacza promień).
   */
  function fromPoints(type, a, b, style) {
    switch (type) {
      case 'line':
        return create(type, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, style);
      case 'rect':
        return create(type, { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }, style);
      case 'circle':
        return create(type, { cx: a.x, cy: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) }, style);
      default:
        throw new Error('Nieznany typ kształtu: ' + type);
    }
  }

  /** Parametry kształtu do wyświetlenia w polach tekstowych. */
  function params(shape) {
    const p = {};
    for (const f of TYPES[shape.type].fields) p[f.key] = shape[f.key];
    return p;
  }

  /** Domyślne parametry nowego kształtu – na środku obrazu W × H. */
  function defaultParams(type, W, H) {
    const q = (n) => Math.round(n);
    switch (type) {
      case 'line': return { x1: q(W / 4), y1: q(H / 4), x2: q((3 * W) / 4), y2: q((3 * H) / 4) };
      case 'rect': return { x: q(W / 4), y: q(H / 4), w: q(W / 2), h: q(H / 2) };
      case 'circle': return { cx: q(W / 2), cy: q(H / 2), r: q(Math.min(W, H) / 4) };
      default: return {};
    }
  }

  const withParams = (shape, p) => create(shape.type, p, shape);
  const withStyle = (shape, style) => create(shape.type, params(shape), style);

  // ---------- Przekształcenia myszą ----------

  /** Przesunięcie o wektor (dx, dy). */
  function translate(shape, dx, dy) {
    switch (shape.type) {
      case 'line':
        return withParams(shape, { x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy });
      case 'rect':
        return withParams(shape, { ...params(shape), x: shape.x + dx, y: shape.y + dy });
      default:
        return withParams(shape, { cx: shape.cx + dx, cy: shape.cy + dy, r: shape.r });
    }
  }

  /**
   * Uchwyty (punkty charakterystyczne), za które można chwycić myszą:
   *   linia     – oba końce,
   *   prostokąt – cztery rogi,
   *   okrąg     – cztery punkty na okręgu (góra, prawo, dół, lewo).
   *
   * @returns {{id: string, x: number, y: number}[]}
   */
  function getHandles(shape) {
    switch (shape.type) {
      case 'line':
        return [
          { id: 'p1', x: shape.x1, y: shape.y1 },
          { id: 'p2', x: shape.x2, y: shape.y2 },
        ];
      case 'rect': {
        const { x, y, w, h } = shape;
        return [
          { id: 'nw', x, y },
          { id: 'ne', x: x + w, y },
          { id: 'se', x: x + w, y: y + h },
          { id: 'sw', x, y: y + h },
        ];
      }
      default: {
        const { cx, cy, r } = shape;
        return [
          { id: 'n', x: cx, y: cy - r },
          { id: 'e', x: cx + r, y: cy },
          { id: 's', x: cx, y: cy + r },
          { id: 'w', x: cx - r, y: cy },
        ];
      }
    }
  }

  /** Zwraca id uchwytu w odległości <= tol od punktu (x, y) albo null. */
  function handleAt(shape, x, y, tol) {
    for (const h of getHandles(shape)) {
      if (Math.abs(h.x - x) <= tol && Math.abs(h.y - y) <= tol) return h.id;
    }
    return null;
  }

  /**
   * Przeciąganie uchwytu do punktu (x, y).
   *
   * Zawsze liczymy względem kształtu z CHWILI ROZPOCZĘCIA przeciągania
   * (origin), a nie poprzedniego kroku – błędy zaokrągleń się nie kumulują.
   * W prostokącie róg przeciwległy do chwyconego jest "kotwicą": zostaje
   * w miejscu, a prostokąt rozpina się między kotwicą a kursorem (można
   * nawet "przewinąć" go na drugą stronę).
   */
  function dragHandle(origin, handleId, x, y) {
    switch (origin.type) {
      case 'line':
        return handleId === 'p1'
          ? withParams(origin, { ...params(origin), x1: x, y1: y })
          : withParams(origin, { ...params(origin), x2: x, y2: y });
      case 'rect': {
        const opposite = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' }[handleId];
        const anchor = getHandles(origin).find((h) => h.id === opposite);
        return fromPoints('rect', anchor, { x, y }, origin);
      }
      default:
        return withParams(origin, { ...params(origin), r: Math.hypot(x - origin.cx, y - origin.cy) });
    }
  }

  // ---------- Trafienie myszą (hit-testing) ----------

  /**
   * Odległość punktu P od odcinka AB.
   * Rzutujemy P na prostą AB: t = (AP · AB) / |AB|², przycinamy t do [0, 1]
   * (żeby zostać na odcinku), i liczymy odległość P od punktu A + t·AB.
   */
  function distanceToSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = len2 === 0 ? 0 : clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
    return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
  }

  /** Odległość punktu od KONTURU kształtu (chwytamy za krawędź, nie za wnętrze). */
  function distanceToOutline(shape, x, y) {
    switch (shape.type) {
      case 'line':
        return distanceToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2);
      case 'rect': {
        const { x: rx, y: ry, w, h } = shape;
        return Math.min(
          distanceToSegment(x, y, rx, ry, rx + w, ry),
          distanceToSegment(x, y, rx + w, ry, rx + w, ry + h),
          distanceToSegment(x, y, rx + w, ry + h, rx, ry + h),
          distanceToSegment(x, y, rx, ry + h, rx, ry)
        );
      }
      default:
        // okrąg: |odległość od środka − promień|
        return Math.abs(Math.hypot(x - shape.cx, y - shape.cy) - shape.r);
    }
  }

  /** Czy punkt (x, y) trafia w kontur kształtu (z tolerancją tol pikseli)? */
  function hitTest(shape, x, y, tol) {
    return distanceToOutline(shape, x, y) <= tol + shape.width / 2;
  }

  /** Czy dwa kształty mają te same parametry i styl? */
  function equals(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // ---------- Rysowanie ----------

  /** Rasteryzuje kształt do bufora img (modyfikuje img). */
  function draw(shape, img) {
    const { Raster } = BioEditor;
    switch (shape.type) {
      case 'line': Raster.drawLine(img, shape.x1, shape.y1, shape.x2, shape.y2, shape); break;
      case 'rect': Raster.drawRect(img, shape.x, shape.y, shape.w, shape.h, shape); break;
      default: Raster.drawCircle(img, shape.cx, shape.cy, shape.r, shape); break;
    }
  }

  /**
   * Obraz bazowy + kształty -> NOWY obraz (baza zostaje nietknięta).
   * new Uint8ClampedArray(src) kopiuje cały bufor jedną szybką operacją.
   *
   * @param {ImageData} base
   * @param {object[]} shapes
   * @returns {ImageData}
   */
  function composite(base, shapes) {
    const out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    for (const s of shapes) draw(s, out);
    return out;
  }

  BioEditor.Shapes = {
    TYPES,
    create,
    fromPoints,
    params,
    defaultParams,
    withParams,
    withStyle,
    translate,
    getHandles,
    handleAt,
    dragHandle,
    hitTest,
    equals,
    draw,
    composite,
  };
})(typeof window !== 'undefined' ? window : globalThis);
