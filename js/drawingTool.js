/**
 * drawingTool.js – interakcja myszą z kształtami na kanwie obrazu.
 *
 * Narzędzia:
 *   'select'                 – zaznaczanie, przesuwanie (chwyt za krawędź)
 *                              i zmiana kształtu (chwyt za uchwyt),
 *   'line' | 'rect' | 'circle' – tworzenie kształtu dwoma kliknięciami
 *                              (albo przeciągnięciem: wciśnij – przeciągnij – puść).
 *
 * Moduł NIE przechowuje listy kształtów – czyta ją przez hooks.getShapes(),
 * a gotową zmianę zgłasza przez hooks.onCommit(noweKształty, ...).
 * Właścicielem stanu (i historii Cofnij) pozostaje main.js.
 * Sam trzyma tylko stan "w trakcie": zaznaczenie, przeciąganie, podgląd.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});
  const { Shapes, Raster } = BioEditor;

  /** Tolerancja trafienia i rozmiar uchwytów – w pikselach EKRANU. */
  const HIT_TOLERANCE = 6;
  const HANDLE_HALF = 4;
  /** Minimalne przesunięcie (px ekranu), od którego wciśnij-przeciągnij-puść tworzy kształt. */
  const DRAG_THRESHOLD = 4;

  const HANDLE_BORDER = { r: 37, g: 99, b: 235 }; // --accent
  const HANDLE_FILL = { r: 255, g: 255, b: 255 };

  /**
   * @param {HTMLCanvasElement} canvas  kanwa, na której wyświetlany jest obraz
   * @param {object} hooks
   * @param {() => object[]} hooks.getShapes
   * @param {() => {color: object, width: number}} hooks.getStyle  styl nowych kształtów
   * @param {() => boolean} hooks.isEnabled  czy jest obraz, na którym można rysować
   * @param {() => void} hooks.requestRender  odśwież widok (podgląd w trakcie ruchu)
   * @param {(shapes: object[], info: {select: number, label: string}) => void} hooks.onCommit
   * @param {() => void} hooks.onSelectionChange
   */
  function create(canvas, hooks) {
    let tool = 'select';
    let selected = -1;
    /** Pierwszy kliknięty punkt tworzonego kształtu (null = nic nie tworzymy). */
    let pending = null;
    /** Podgląd tworzonego kształtu, podążający za kursorem. */
    let preview = null;
    /** Przeciąganie: { kind: 'move'|'handle', index, origin, start, handle?, current } */
    let drag = null;

    // ---------- Współrzędne ----------

    /**
     * Ile pikseli obrazu przypada na piksel ekranu. Kanwa może być
     * przeskalowana (CSS, zoom przeglądarki, ekran HiDPI), więc współrzędne
     * myszy (clientX/Y – piksele ekranu) przeliczamy przez stosunek
     * rozmiaru bufora (canvas.width) do rozmiaru na ekranie (rect.width).
     */
    function scale() {
      const rect = canvas.getBoundingClientRect();
      return rect.width > 0 ? canvas.width / rect.width : 1;
    }

    /** Pozycja kursora w pikselach obrazu (liczby całkowite). */
    function toImage(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.floor(((e.clientX - rect.left) * canvas.width) / rect.width),
        y: Math.floor(((e.clientY - rect.top) * canvas.height) / rect.height),
      };
    }

    // ---------- Stan ----------

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
      // Nowe narzędzie rysujące = nowy kształt, więc zdejmujemy zaznaczenie
      if (tool !== 'select' && selected !== -1) select(-1);
      canvas.style.cursor = tool === 'select' ? '' : 'crosshair';
    }

    /** Kształty do wyświetlenia: z uwzględnieniem przeciąganego i podglądu. */
    function getVisibleShapes() {
      let shapes = hooks.getShapes();
      if (drag && drag.current) {
        shapes = shapes.slice();
        shapes[drag.index] = drag.current;
      }
      if (preview) shapes = shapes.concat(preview);
      return shapes;
    }

    /**
     * Dorysowuje na buforze img elementy pomocnicze (niezapisywane do pliku):
     * uchwyty zaznaczonego kształtu i znacznik pierwszego klikniętego punktu.
     */
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

    // ---------- Tworzenie kształtu ----------

    function finishShape(p) {
      const shape = Shapes.fromPoints(tool, pending, p, hooks.getStyle());
      pending = null;
      preview = null;
      const shapes = hooks.getShapes().concat(shape);
      commit(shapes, shapes.length - 1, 'dodano: ' + Shapes.TYPES[tool].label.toLowerCase());
    }

    // ---------- Zaznaczanie i przeciąganie ----------

    function startSelectDrag(p) {
      const tol = HIT_TOLERANCE * scale();
      const shapes = hooks.getShapes();

      // 1. Uchwyt już zaznaczonego kształtu -> zmiana kształtu/rozmiaru
      if (selected >= 0) {
        const handle = Shapes.handleAt(shapes[selected], p.x, p.y, tol);
        if (handle) {
          drag = { kind: 'handle', handle, index: selected, origin: shapes[selected], start: p, current: null };
          return;
        }
      }
      // 2. Kontur dowolnego kształtu -> zaznaczenie + przesuwanie.
      //    Od końca listy, bo ostatnio dodany kształt leży na wierzchu.
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (Shapes.hitTest(shapes[i], p.x, p.y, tol)) {
          if (i !== selected) select(i);
          drag = { kind: 'move', index: i, origin: shapes[i], start: p, current: null };
          return;
        }
      }
      // 3. Puste miejsce -> odznaczenie
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

    // ---------- Zdarzenia wskaźnika ----------

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
        finishShape(p); // drugie kliknięcie
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
      // Wciśnij – przeciągnij – puść: jeśli kursor odjechał od pierwszego
      // punktu, kończymy kształt od razu (bez drugiego kliknięcia).
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
