/**
 * ui.js – drobne, wielokrotnego użytku elementy interfejsu.
 * Nic tu nie wie o przetwarzaniu obrazu – tylko o DOM.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  /**
   * Przełącznik segmentowy (grupa przycisków, z których aktywny jest jeden).
   * Wartość każdego przycisku bierzemy z atrybutu data-value.
   *
   * @param {HTMLElement} container  element zawierający <button data-value="...">
   * @param {(value: string) => void} [onChange]  wywoływane po zmianie wyboru
   * @returns {{ readonly value: string }}
   */
  function createSegmented(container, onChange) {
    const buttons = Array.from(container.querySelectorAll('button'));

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.toggle('active', b === btn));
        if (onChange) onChange(btn.dataset.value);
      });
    });

    return {
      get value() {
        return container.querySelector('button.active').dataset.value;
      },
    };
  }

  /**
   * Zakładki: przyciski z atrybutem data-tab przełączają panele
   * z pasującym atrybutem data-tab-panel (widoczny jest tylko jeden).
   *
   * Ostatnio wybraną zakładkę zapamiętujemy w localStorage – pamięci
   * przeglądarki, która przetrwa odświeżenie strony. Dostęp opakowujemy
   * w try/catch, bo w niektórych trybach (np. prywatnym, plik z dysku)
   * przeglądarka może go zablokować – wtedy po prostu nie pamiętamy wyboru.
   *
   * @param {HTMLElement} tablist  kontener z <button data-tab="...">
   * @param {HTMLElement} root     kontener z panelami [data-tab-panel]
   * @param {{storageKey?: string, onChange?: (tab: string) => void}} [options]
   * @returns {{ readonly value: string, select: (tab: string) => void }}
   */
  function createTabs(tablist, root, { storageKey, onChange } = {}) {
    const buttons = Array.from(tablist.querySelectorAll('[data-tab]'));
    const panels = Array.from(root.querySelectorAll('[data-tab-panel]'));
    let current = buttons.find((b) => b.classList.contains('active')).dataset.tab;

    function select(tab) {
      if (!buttons.some((b) => b.dataset.tab === tab)) return;
      current = tab;
      buttons.forEach((b) => {
        const active = b.dataset.tab === tab;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });
      panels.forEach((p) => { p.hidden = p.dataset.tabPanel !== tab; });
      if (storageKey) {
        try { localStorage.setItem(storageKey, tab); } catch (e) { /* brak dostępu – trudno */ }
      }
      if (onChange) onChange(tab);
    }

    buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.tab)));

    if (storageKey) {
      let saved = null;
      try { saved = localStorage.getItem(storageKey); } catch (e) { /* jw. */ }
      if (saved) select(saved);
    }

    return {
      get value() { return current; },
      select,
    };
  }

  /**
   * Buduje siatkę pól liczbowych (etykieta + <input type="number">) z opisu
   * parametrów, np. [{ key: 'k', label: 'k', min: 0, max: 1, step: 0.05, value: 0.5 }].
   * Poprzednia zawartość kontenera jest usuwana.
   *
   * @param {HTMLElement} container  element z klasą .param-grid
   * @param {{key: string, label: string, min?: number, max?: number, step?: number, value: number}[]} params
   * @param {string} idPrefix  przedrostek atrybutów id pól (etykiety muszą wskazywać pole)
   * @returns {{ read: () => (object|null) }} read() zwraca { key: liczba } albo null,
   *   gdy któreś pole jest puste lub poza zakresem (to pole dostaje klasę .invalid)
   */
  function createParamFields(container, params, idPrefix) {
    container.replaceChildren();
    const inputs = {};
    for (const f of params) {
      const label = document.createElement('label');
      label.className = 'label';
      label.htmlFor = `${idPrefix}-${f.key}`;
      label.textContent = f.label;

      const input = document.createElement('input');
      input.id = `${idPrefix}-${f.key}`;
      input.type = 'number';
      input.className = 'input';
      input.value = String(f.value);
      if (f.min !== undefined) input.min = String(f.min);
      if (f.max !== undefined) input.max = String(f.max);
      if (f.step !== undefined) input.step = String(f.step);
      input.addEventListener('input', () => input.classList.remove('invalid'));

      container.append(label, input);
      inputs[f.key] = { input, f };
    }

    function read() {
      const values = {};
      let ok = true;
      for (const key in inputs) {
        const { input, f } = inputs[key];
        const v = Number(input.value);
        const valid = input.value.trim() !== '' && Number.isFinite(v)
          && (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max);
        input.classList.toggle('invalid', !valid);
        if (!valid) ok = false;
        values[key] = v;
      }
      return ok ? values : null;
    }

    return { read };
  }

  /** Włącza/wyłącza przyciski (atrybut disabled). */
  function setEnabled(elements, enabled) {
    elements.forEach((el) => { el.disabled = !enabled; });
  }

  /** Ustawia tekst na pasku statusu. */
  function setStatus(element, text) {
    element.textContent = text;
  }

  BioEditor.UI = { createSegmented, createTabs, createParamFields, setEnabled, setStatus };
})(window);
