(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});
  const { Shapes } = BioEditor;

  function create(root, handlers) {
    const ref = (name) => root.querySelector(`[data-role="${name}"]`);
    const el = {
      title: ref('title'),
      hint: ref('hint'),
      body: ref('body'),
      fields: ref('fields'),
      add: ref('add'),
      apply: ref('apply'),
      restyle: ref('restyle'),
      remove: ref('delete'),
    };

    let type = null;
    let hasSelection = false;

    let inputs = {};

    function buildFields(nextType) {
      el.fields.replaceChildren();
      inputs = {};
      for (const f of Shapes.TYPES[nextType].fields) {
        const id = `shape-field-${f.key}`;
        const label = document.createElement('label');
        label.className = 'label';
        label.htmlFor = id;
        label.textContent = f.label;

        const input = document.createElement('input');
        input.id = id;
        input.type = 'number';
        input.step = '1';
        input.className = 'input';
        if (f.min !== undefined) input.min = String(f.min);
        input.addEventListener('input', () => input.classList.remove('invalid'));

        el.fields.append(label, input);
        inputs[f.key] = input;
      }
      type = nextType;
    }

    function show(view, hint = '') {
      el.hint.textContent = hint;
      el.hint.hidden = !hint;
      el.body.hidden = !view;
      if (!view) {
        el.title.textContent = 'Parametry';
        type = null;
        hasSelection = false;
        return;
      }

      const keepTyped = !view.selected && !hasSelection && view.type === type;
      if (view.type !== type) buildFields(view.type);
      if (!keepTyped) {
        for (const key in inputs) {
          inputs[key].value = view.values[key];
          inputs[key].classList.remove('invalid');
        }
      }

      hasSelection = view.selected;
      const label = Shapes.TYPES[view.type].label;
      el.title.textContent = view.selected ? `Zaznaczony: ${label.toLowerCase()}` : `Nowy: ${label.toLowerCase()}`;
      el.add.textContent = view.selected ? 'Dodaj jako nowy' : 'Dodaj';
      el.apply.hidden = !view.selected;
      el.restyle.hidden = !view.selected;
      el.remove.hidden = !view.selected;
    }

    function read() {
      const params = {};
      let ok = true;
      for (const key in inputs) {
        const input = inputs[key];
        const v = Number(input.value);
        const valid = input.value.trim() !== '' && Number.isFinite(v);
        input.classList.toggle('invalid', !valid);
        if (!valid) ok = false;
        params[key] = v;
      }
      return ok ? params : null;
    }

    function submit(apply) {
      const params = read();
      if (!params) return;
      if (apply) handlers.onApply(params);
      else handlers.onAdd(type, params);
    }

    el.add.addEventListener('click', () => submit(false));
    el.apply.addEventListener('click', () => submit(true));
    el.restyle.addEventListener('click', () => handlers.onRestyle());
    el.remove.addEventListener('click', () => handlers.onDelete());

    el.fields.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit(hasSelection);
    });

    return { show };
  }

  BioEditor.ShapeForm = { create };
})(window);
