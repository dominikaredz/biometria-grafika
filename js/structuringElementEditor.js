/**
 * structuringElementEditor.js – edytor elementu strukturyzującego
 * (maski) dla dylatacji i erozji.
 *
 * Użytkownik ustawia rozmiar (szerokość × wysokość, dowolny w zakresie
 * 1–MAX_SIZE), wybiera gotowy kształt (kwadrat, krzyż, koło) albo sam
 * zaznacza pola myszą – kliknięcie przełącza pole, a przeciąganie
 * "maluje" kolejne pola tą samą wartością. Pole środkowe (punkt
 * odniesienia elementu) jest wyróżnione ramką.
 *
 * Elementy panelu wyszukujemy po atrybutach data-role wewnątrz kontenera.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  const MAX_SIZE = 31;
  /** Szerokość siatki w px – pola zmniejszają się przy dużych elementach. */
  const GRID_PX = 280;

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

  /**
   * @param {HTMLElement} root  kontener z elementami data-role
   * @returns {{ readonly element: {width: number, height: number, data: Uint8Array} }}
   */
  function create(root) {
    const ref = (name) => root.querySelector(`[data-role="${name}"]`);
    const el = {
      width: ref('se-width'),
      height: ref('se-height'),
      grid: ref('se-grid'),
      info: ref('se-info'),
    };

    let preset = 'square';
    let element = BioEditor.Filters.createStructuringElement(3, 3, preset);
    let cells = [];

    /** Rysuje siatkę pól jako elementy <div> (CSS grid). */
    function render() {
      const { width, height, data } = element;
      const cell = clamp(Math.floor(GRID_PX / Math.max(width, height)), 6, 24);
      el.grid.style.gridTemplateColumns = `repeat(${width}, ${cell}px)`;
      el.grid.style.gridAutoRows = `${cell}px`;

      cells = [];
      const frag = document.createDocumentFragment();
      const cx = width >> 1;
      const cy = height >> 1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const div = document.createElement('div');
          div.className = 'se-cell';
          div.dataset.index = String(y * width + x);
          if (x === cx && y === cy) div.classList.add('origin');
          frag.append(div);
          cells.push(div);
        }
      }
      el.grid.replaceChildren(frag);
      el.width.value = String(width);
      el.height.value = String(height);
      refresh();
    }

    /** Odświeża kolory pól i licznik aktywnych pól. */
    function refresh() {
      let active = 0;
      element.data.forEach((v, i) => {
        cells[i].classList.toggle('on', v === 1);
        active += v;
      });
      el.info.textContent = `${element.width}×${element.height}, aktywne pola: ${active}`
        + (active === 0 ? ' – pusty element nie zmieni obrazu' : '');
    }

    function rebuild() {
      const w = clamp(Math.round(Number(el.width.value)) || 1, 1, MAX_SIZE);
      const h = clamp(Math.round(Number(el.height.value)) || 1, 1, MAX_SIZE);
      element = BioEditor.Filters.createStructuringElement(w, h, preset);
      render();
    }

    // Zmiana rozmiaru – nowy element w ostatnio wybranym kształcie
    el.width.addEventListener('change', rebuild);
    el.height.addEventListener('change', rebuild);

    root.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        preset = btn.dataset.preset;
        rebuild();
      });
    });

    // Malowanie myszą: wartość ustala pierwsze kliknięte pole (włącz/wyłącz)
    let paintValue = null;
    const paint = (target) => {
      if (!target || !target.classList || !target.classList.contains('se-cell')) return;
      const i = Number(target.dataset.index);
      if (element.data[i] === paintValue) return;
      element.data[i] = paintValue;
      refresh();
    };
    el.grid.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.target.classList.contains('se-cell')) return;
      e.preventDefault();
      el.grid.setPointerCapture(e.pointerId);
      paintValue = element.data[Number(e.target.dataset.index)] ? 0 : 1;
      paint(e.target);
    });
    el.grid.addEventListener('pointermove', (e) => {
      // Przy przechwyceniu wskaźnika e.target to zawsze siatka – pole pod
      // kursorem znajdujemy po współrzędnych
      if (paintValue !== null) paint(document.elementFromPoint(e.clientX, e.clientY));
    });
    const stop = () => { paintValue = null; };
    el.grid.addEventListener('pointerup', stop);
    el.grid.addEventListener('pointercancel', stop);

    render();

    return {
      get element() {
        return { width: element.width, height: element.height, data: element.data.slice() };
      },
    };
  }

  BioEditor.StructuringElementEditor = { create, MAX_SIZE };
})(window);
