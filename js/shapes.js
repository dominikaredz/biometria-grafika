(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  const COORD_LIMIT = 20000;

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

  function params(shape) {
    const p = {};
    for (const f of TYPES[shape.type].fields) p[f.key] = shape[f.key];
    return p;
  }

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

  function handleAt(shape, x, y, tol) {
    for (const h of getHandles(shape)) {
      if (Math.abs(h.x - x) <= tol && Math.abs(h.y - y) <= tol) return h.id;
    }
    return null;
  }

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

  function distanceToSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = len2 === 0 ? 0 : clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
    return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
  }

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

        return Math.abs(Math.hypot(x - shape.cx, y - shape.cy) - shape.r);
    }
  }

  function hitTest(shape, x, y, tol) {
    return distanceToOutline(shape, x, y) <= tol + shape.width / 2;
  }

  function equals(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function draw(shape, img) {
    const { Raster } = BioEditor;
    switch (shape.type) {
      case 'line': Raster.drawLine(img, shape.x1, shape.y1, shape.x2, shape.y2, shape); break;
      case 'rect': Raster.drawRect(img, shape.x, shape.y, shape.w, shape.h, shape); break;
      default: Raster.drawCircle(img, shape.cx, shape.cy, shape.r, shape); break;
    }
  }

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
