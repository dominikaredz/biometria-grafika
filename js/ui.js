(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

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
        try { localStorage.setItem(storageKey, tab); } catch (e) {  }
      }
      if (onChange) onChange(tab);
    }

    buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.tab)));

    if (storageKey) {
      let saved = null;
      try { saved = localStorage.getItem(storageKey); } catch (e) {  }
      if (saved) select(saved);
    }

    return {
      get value() { return current; },
      select,
    };
  }

  function setEnabled(elements, enabled) {
    elements.forEach((el) => { el.disabled = !enabled; });
  }

  function setStatus(element, text) {
    element.textContent = text;
  }

  BioEditor.UI = { createSegmented, createTabs, setEnabled, setStatus };
})(window);
