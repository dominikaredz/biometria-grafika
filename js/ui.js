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

  /** Włącza/wyłącza przyciski (atrybut disabled). */
  function setEnabled(elements, enabled) {
    elements.forEach((el) => { el.disabled = !enabled; });
  }

  /** Ustawia tekst na pasku statusu. */
  function setStatus(element, text) {
    element.textContent = text;
  }

  BioEditor.UI = { createSegmented, setEnabled, setStatus };
})(window);
