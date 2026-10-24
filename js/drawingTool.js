(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});
  const { Shapes, Raster } = BioEditor;

  const HIT_TOLERANCE = 6;
  const HANDLE_HALF = 4;

  const DRAG_THRESHOLD = 4;

  const HANDLE_BORDER = { r: 79, g: 140, b: 255 };
  const HANDLE_FILL = { r: 255, g: 255, b: 255 };

  function create(canvas, hooks) {
    let tool = 'select';
    let selected = -1;

    let pending = null;

    let preview = null;

    let drag = null;

    function scale() {
      const rect = canvas.getBoundingClientRect();
      return rect.width > 0 ? canvas.width / rect.width : 1;
    }

    function toImage(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.floor(((e.clientX - rect.left) * canvas.width) / rect.width),
        y: Math.floor(((e.clientY - rect.top) * canvas.height) / rect.height),
      };
    }

    function select(index) {
      selected = index;
      hooks.onSelectionChange();
      hooks.requestRender();
    }

    function cancel() {
      pending = null;
      preview = null;
      drag = null;
      hooks.requestRender();
    }

    function setTool(next) {
      tool = next;
      cancel();

      if (tool !== 'select' && selected !== -1) select(-1);
      canvas.style.cursor = tool === 'select' ? '' : 'crosshair';
    }

    function getVisibleShapes() {
      let shapes = hooks.getShapes();
      if (drag && drag.current) {
        shapes = shapes.slice();
        shapes[drag.index] = drag.current;
      }
      if (preview) shapes = shapes.concat(preview);
      return shapes;
    }

    function drawOverlay(img) {
      const half = Math.max(2, Math.round(HANDLE_HALF * scale()));
      const drawHandle = (x, y) => {
        Raster.fillRect(img, x - half, y - half, x + half, y + half, HANDLE_BORDER);
        Raster.fillRect(img, x - half + 1, y - half + 1, x + half - 1, y + half - 1, HANDLE_FILL);
      };
      const shapes = getVisibleShapes();
      if (selected >= 0 && shapes[selected]) {
        for (const h of Shapes.getHandles(shapes[selected])) drawHandle(h.x, h.y);
      }
      if (pending) drawHandle(pending.x, pending.y);
    }

    function commit(shapes, select, label) {
      hooks.onCommit(shapes, { select, label });
    }

    function deleteSelected() {
      if (selected < 0) return;
      const shapes = hooks.getShapes().filter((_, i) => i !== selected);
      commit(shapes, -1, 'usunięto kształt');
    }

    function finishShape(p) {
      const shape = Shapes.fromPoints(tool, pending, p, hooks.getStyle());
      pending = null;
      preview = null;
      const shapes = hooks.getShapes().concat(shape);
      commit(shapes, shapes.length - 1, 'dodano: ' + Shapes.TYPES[tool].label.toLowerCase());
    }

    function startSelectDrag(p) {
      const tol = HIT_TOLERANCE * scale();
      const shapes = hooks.getShapes();

      if (selected >= 0) {
        const handle = Shapes.handleAt(shapes[selected], p.x, p.y, tol);
        if (handle) {
          drag = { kind: 'handle', handle, index: selected, origin: shapes[selected], start: p, current: null };
          return;
        }
      }

      for (let i = shapes.length - 1; i >= 0; i--) {
        if (Shapes.hitTest(shapes[i], p.x, p.y, tol)) {
          if (i !== selected) select(i);
          drag = { kind: 'move', index: i, origin: shapes[i], start: p, current: null };
          return;
        }
      }

      if (selected !== -1) select(-1);
    }

    function updateCursor(p) {
      if (tool !== 'select') return;
      const tol = HIT_TOLERANCE * scale();
      const shapes = hooks.getShapes();
      let cursor = '';
      if (selected >= 0 && Shapes.handleAt(shapes[selected], p.x, p.y, tol)) cursor = 'crosshair';
      else if (shapes.some((s) => Shapes.hitTest(s, p.x, p.y, tol))) cursor = 'move';
      canvas.style.cursor = cursor;
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !hooks.isEnabled()) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const p = toImage(e);

      if (tool === 'select') {
        startSelectDrag(p);
      } else if (!pending) {
        pending = p;
        preview = Shapes.fromPoints(tool, p, p, hooks.getStyle());
        hooks.requestRender();
      } else {
        finishShape(p);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!hooks.isEnabled()) return;
      const p = toImage(e);

      if (drag) {
        drag.current = drag.kind === 'move'
          ? Shapes.translate(drag.origin, p.x - drag.start.x, p.y - drag.start.y)
          : Shapes.dragHandle(drag.origin, drag.handle, p.x, p.y);
        hooks.requestRender();
      } else if (pending) {
        preview = Shapes.fromPoints(tool, pending, p, hooks.getStyle());
        hooks.requestRender();
      } else {
        updateCursor(p);
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (drag) {
        const d = drag;
        drag = null;
        if (d.current && !Shapes.equals(d.current, d.origin)) {
          const shapes = hooks.getShapes().slice();
          shapes[d.index] = d.current;
          commit(shapes, d.index, d.kind === 'move' ? 'przesunięto kształt' : 'zmieniono kształt');
        }
        return;
      }

      if (pending) {
        const p = toImage(e);
        const dist = Math.hypot(p.x - pending.x, p.y - pending.y);
        if (dist > DRAG_THRESHOLD * scale()) finishShape(p);
      }
    });

    canvas.addEventListener('pointercancel', cancel);

    return {
      get tool() { return tool; },
      get selected() { return selected; },
      setTool,
      select,
      cancel,
      deleteSelected,
      getVisibleShapes,
      drawOverlay,
    };
  }

  BioEditor.DrawingTool = { create };
})(window);
