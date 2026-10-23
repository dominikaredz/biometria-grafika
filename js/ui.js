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

  /** Włącza/wyłącza przyciski (atrybut disabled). */
  function setEnabled(elements, enabled) {
    elements.forEach((el) => { el.disabled = !enabled; });
  }

  /** Ustawia tekst na pasku statusu. */
  function setStatus(element, text) {
    element.textContent = text;
  }

  BioEditor.UI = { createSegmented, createTabs, setEnabled, setStatus };
})(window);
