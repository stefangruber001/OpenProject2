/* Canei Subirats — the application's own question box.
 *
 * WHY THIS FILE EXISTS. prompt(), confirm() and alert() are the only parts of
 * this product drawn by somebody else. They arrive in the browser's own
 * typeface, quote the site's address above the question ("...github.io dice"),
 * cannot show a list of choices, cannot validate before they close, and cannot
 * ask two things at once. Every one of them is replaced by `ask()`.
 *
 * It is its own file rather than more inline script because the same boxes
 * appear on four pages — the workspace, master data, the financial ledgers and
 * the journey. A question box copied four times is a question box that only
 * ever gets fixed once.
 *
 * Colours and type come from the host page's CSS variables, so the box always
 * belongs to the page that opened it rather than to this file.
 *
 * Publishes: ask, askText, askChoice, askConfirm, say, ErpModal.
 */
(function () {
  "use strict";

  var CSS = `/* ---------------------------- modal ----------------------------
   The browser's own prompt() and confirm() are the only part of this
   application drawn by somebody else: another typeface, another set of
   colours, the address bar quoted above the question, and no room for a
   list of choices. Every one of them is replaced by this.

   It sits ABOVE the drawer on purpose (z-index 90 against the drawer's
   70): most of these questions are asked from inside a drawer — the
   chapter name in the presupuestador, the actions on an alert — and a
   modal that opened behind the panel that raised it would be worse than
   the browser box it replaces. */
.mscrim {
  position: fixed;
  inset: 0;
  background: rgba(20, 26, 14, 0.42);
  opacity: 0;
  pointer-events: none;
  transition: 0.16s;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.mscrim.on {
  opacity: 1;
  pointer-events: auto;
}
.modal {
  background: var(--paper);
  border-radius: 14px;
  box-shadow: 0 30px 70px -30px rgba(20, 26, 14, 0.55);
  width: min(460px, 100%);
  max-height: min(86vh, 720px);
  display: flex;
  flex-direction: column;
  transform: translateY(10px) scale(0.985);
  transition: 0.16s;
}
.mscrim.on .modal {
  transform: none;
}
.modal.wide {
  width: min(640px, 100%);
}
.modal h3 {
  margin: 0;
  font: 600 17px/1.3 var(--serif);
  color: var(--ink);
}
.modal .mh {
  padding: 16px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.modal .mh p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--body);
}
.modal .mb {
  padding: 14px 20px 4px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.modal .mf {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.modal .mf > span {
  font: 600 11px var(--sans);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
/* Direct children only — the radios inside .mopts are inputs too, and a
   100%-wide radio button pushes its own label off the row. */
.modal .mf > input,
.modal .mf > select,
.modal .mf > textarea {
  font: 14px var(--sans);
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 9px 11px;
  outline: 0;
  width: 100%;
}
.modal .mf textarea {
  min-height: 86px;
  resize: vertical;
  line-height: 1.5;
}
.modal .mf input:focus,
.modal .mf select:focus,
.modal .mf textarea:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px var(--greenSoft);
}
.modal .mhint {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
}
.modal .merr {
  font: 600 12px var(--sans);
  color: var(--danger);
  min-height: 0;
}
.modal .ma {
  padding: 14px 20px 16px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}
.modal .ma .sp {
  flex: 1;
}
/* A grouped list of choices — the shape a "why was this lost?" question
   actually has, and the one a text box cannot express. */
.modal .mopts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px;
}
.modal .mopts .og {
  font: 600 10.5px var(--sans);
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--faint);
  padding: 10px 2px 4px;
}
.modal .mopts label {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  cursor: pointer;
  font-size: 14px;
  color: var(--ink);
  transition: 0.12s;
}
.modal .mopts label:hover {
  border-color: var(--greenLt);
  background: var(--greenSoft);
}
.modal .mopts label.on {
  border-color: var(--green);
  background: var(--greenSoft);
}
.modal .mopts label input {
  margin: 3px 0 0;
  accent-color: var(--green);
  flex: none;
  width: auto;
}
.modal .mopts label > div {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.modal .mopts label i {
  display: block;
  font-style: normal;
  font-size: 12px;
  color: var(--muted);
  margin-top: 1px;
}
@media (max-width: 560px) {
  .mscrim {
    align-items: flex-end;
    padding: 0;
  }
  .modal {
    width: 100%;
    max-height: 92vh;
    border-radius: 16px 16px 0 0;
  }
}
/* THE LANGUAGE PILL STANDS DOWN WHILE A DIALOG IS OPEN.
   It is fixed to the bottom-left corner, and on a phone the modal is a bottom
   sheet — so the pill sat on top of the sheet's own footer, covering the count
   of what had been selected and half of "Cancelar". The pill is a preference
   that can wait; the buttons in front of the operator cannot. */
body:has(.mscrim.on) #canei-lang-pill {
  opacity: 0;
  pointer-events: none;
}`;

  function injectStyle() {
    if (document.getElementById("erp-modal-style")) return;
    var st = document.createElement("style");
    st.id = "erp-modal-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  /* The host page does not have to carry the markup: the scrim is created on
     first use and reused after that. */
  function scrimEl() {
    injectStyle();
    var s = document.getElementById("mscrim");
    if (!s) {
      s = document.createElement("div");
      s.id = "mscrim";
      s.className = "mscrim";
      s.setAttribute("role", "dialog");
      s.setAttribute("aria-modal", "true");
      s.setAttribute("aria-labelledby", "mttl");
      document.body.appendChild(s);
    }
    return s;
  }
  function el(t, c, h) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (h != null) e.innerHTML = h;
    return e;
  }

  /* =============================== modals ===============================
  One primitive, `ask()`, and four wrappers over it. Everything returns a
  promise that resolves to the answer or to null when the person backs out,
  so a call site reads almost exactly like the prompt() it replaces:

      const reason = await askText("Motivo de la anulación");
      if (reason === null) return;

  Why promises rather than a callback: the twenty-seven call sites this
  replaces are all written as `const x = prompt(); if (!x) return;` inside a
  handler. `await` keeps that shape — and keeps the guard clause — where a
  callback would have forced every one of them inside out.

  Two rules the browser dialog got right and this has to keep: it takes the
  keyboard (Esc cancels, Enter accepts) and it blocks until answered. What it
  gets to add: the application's own typeface and colour, a real list of
  choices, validation before it closes, and more than one field at a time. */
  const MODAL = { open: null, lastFocus: null };
  function closeModal(result) {
    if (!MODAL.open) return;
    const done = MODAL.open;
    MODAL.open = null;
    scrimEl().classList.remove("on");
    setTimeout(() => {
      if (!MODAL.open) scrimEl().innerHTML = "";
    }, 200);
    if (MODAL.lastFocus && MODAL.lastFocus.focus) {
      try {
        MODAL.lastFocus.focus();
      } catch (e) {
        /* the element may be gone after a re-render */
      }
    }
    done(result);
  }

  /**
   * fields: [{ key, label, type, value, placeholder, hint, required,
   *            options, min, max, step, rows }]
   *   type: text | textarea | number | date | time | select | choice
   *   `choice` renders the options as a radio list, optionally grouped by
   *   `group`, because a reason code is a decision and a select hides the
   *   alternatives behind a click.
   * opts: { body, okLabel, cancelLabel, danger, wide, validate }
   *   validate(values) returns an error string, or null to accept.
   * Resolves to an object keyed by field key, or null if cancelled.
   */
  function ask(title, fields, opts) {
    opts = opts || {};
    fields = fields || [];
    if (MODAL.open) closeModal(null); // never stack two questions
    MODAL.lastFocus = document.activeElement;
    const scrim = scrimEl();
    const box = el("div", "modal" + (opts.wide ? " wide" : ""));
    const head = el("div", "mh");
    const h = el("h3");
    h.id = "mttl";
    h.textContent = title;
    head.appendChild(h);
    if (opts.body) {
      const p = el("p");
      p.textContent = opts.body;
      head.appendChild(p);
    }
    box.appendChild(head);

    const body = el("div", "mb");
    const inputs = {};
    fields.forEach((f) => {
      const wrap = el("div", "mf");
      if (f.label) {
        const s = el("span");
        s.textContent = f.label;
        wrap.appendChild(s);
      }
      if (f.type === "choice") {
        const list = el("div", "mopts");
        let lastGroup = null;
        (f.options || []).forEach((o, i) => {
          if (o.group && o.group !== lastGroup) {
            lastGroup = o.group;
            const g = el("div", "og");
            g.textContent = o.group;
            list.appendChild(g);
          }
          const lab = el("label");
          const r = el("input");
          r.type = "radio";
          r.name = "m_" + f.key;
          r.value = o.value;
          if (o.value === f.value) {
            r.checked = true;
            lab.className = "on";
          }
          r.onchange = () => {
            list.querySelectorAll("label").forEach((x) => x.classList.remove("on"));
            if (r.checked) lab.classList.add("on");
          };
          const txt = el("div");
          txt.appendChild(document.createTextNode(o.label));
          if (o.hint) {
            const i2 = el("i");
            i2.textContent = o.hint;
            txt.appendChild(i2);
          }
          lab.appendChild(r);
          lab.appendChild(txt);
          list.appendChild(lab);
          if (i === 0 && f.value === undefined) r.setAttribute("data-first", "1");
        });
        wrap.appendChild(list);
        inputs[f.key] = () => {
          const c = list.querySelector("input:checked");
          return c ? c.value : "";
        };
      } else if (f.type === "select") {
        const sel = el("select");
        (f.options || []).forEach((o) => {
          const op = el("option");
          op.value = o.value;
          op.textContent = o.label;
          if (o.value === f.value) op.selected = true;
          sel.appendChild(op);
        });
        wrap.appendChild(sel);
        inputs[f.key] = () => sel.value;
      } else if (f.type === "textarea") {
        const ta = el("textarea");
        ta.value = f.value || "";
        if (f.placeholder) ta.placeholder = f.placeholder;
        if (f.rows) ta.rows = f.rows;
        wrap.appendChild(ta);
        inputs[f.key] = () => ta.value;
      } else {
        const inp = el("input");
        inp.type = f.type || "text";
        inp.value = f.value === undefined || f.value === null ? "" : String(f.value);
        if (f.placeholder) inp.placeholder = f.placeholder;
        if (f.min !== undefined) inp.min = f.min;
        if (f.max !== undefined) inp.max = f.max;
        if (f.step !== undefined) inp.step = f.step;
        wrap.appendChild(inp);
        inputs[f.key] = () => inp.value;
      }
      if (f.hint) {
        const hint = el("div", "mhint");
        hint.textContent = f.hint;
        wrap.appendChild(hint);
      }
      body.appendChild(wrap);
    });
    const err = el("div", "merr");
    body.appendChild(err);
    box.appendChild(body);

    const act = el("div", "ma");
    act.appendChild(el("span", "sp"));
    // `cancelLabel: null` means there is nothing to cancel — say() has one
    // button, and offering "Cancelar" beside it would imply a choice.
    let cancel = null;
    if (opts.cancelLabel !== null) {
      cancel = el("button", "btn sm");
      cancel.type = "button";
      cancel.textContent = opts.cancelLabel || "Cancelar";
      act.appendChild(cancel);
    }
    const ok = el("button", "btn sm " + (opts.danger ? "danger" : "primary"));
    ok.type = "button";
    ok.textContent = opts.okLabel || "Aceptar";
    act.appendChild(ok);
    box.appendChild(act);

    function values() {
      const out = {};
      for (const k in inputs) out[k] = inputs[k]();
      return out;
    }
    function submit() {
      const v = values();
      for (const f of fields)
        if (f.required && !String(v[f.key] || "").trim()) {
          err.textContent = f.requiredMsg || "«" + (f.label || "Este campo") + "» es obligatorio.";
          return;
        }
      if (opts.validate) {
        const msg = opts.validate(v);
        if (msg) {
          err.textContent = msg;
          return;
        }
      }
      closeModal(v);
    }
    ok.onclick = submit;
    if (cancel) cancel.onclick = () => closeModal(null);
    box.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        submit();
      }
    };
    box.onclick = (e) => e.stopPropagation();

    scrim.innerHTML = "";
    scrim.appendChild(box);
    scrim.onclick = () => closeModal(null);
    requestAnimationFrame(() => scrim.classList.add("on"));
    const first = box.querySelector(
      "input:not([type=radio]), textarea, select, input[data-first], input[type=radio]",
    );
    setTimeout(() => (first || ok).focus(), 60);

    return new Promise((resolve) => {
      MODAL.open = resolve;
    });
  }

  /** prompt() — resolves to the string, or null when cancelled. */
  async function askText(title, opts) {
    opts = opts || {};
    const r = await ask(
      title,
      [
        {
          key: "v",
          label: opts.label || null,
          type: opts.multiline ? "textarea" : opts.type || "text",
          value: opts.value,
          placeholder: opts.placeholder,
          hint: opts.hint,
          required: opts.required,
          min: opts.min,
          max: opts.max,
        },
      ],
      { body: opts.body, okLabel: opts.okLabel, danger: opts.danger, validate: opts.validate },
    );
    return r === null ? null : r.v;
  }

  /** A reason code picked from a list. Resolves to the value, or null. */
  async function askChoice(title, options, opts) {
    opts = opts || {};
    const r = await ask(
      title,
      [
        {
          key: "v",
          label: opts.label || null,
          type: "choice",
          options,
          value: opts.value,
          required: opts.required !== false,
        },
      ],
      { body: opts.body, okLabel: opts.okLabel, danger: opts.danger, wide: opts.wide },
    );
    return r === null ? null : r.v;
  }

  /** confirm() — resolves to true or false, never rejects. */
  async function askConfirm(title, opts) {
    opts = opts || {};
    const r = await ask(title, [], {
      body: opts.body,
      okLabel: opts.okLabel || "Continuar",
      cancelLabel: opts.cancelLabel,
      danger: opts.danger,
    });
    return r !== null;
  }

  /** alert() — one button, resolves when acknowledged. */
  async function say(title, body) {
    await ask(title, [], { body, okLabel: "Entendido", cancelLabel: null });
  }

  /* Escape closes the question and nothing else. The host page's own Escape
     handler (a drawer, a full-screen builder) must not also fire, or answering
     "no" to a question would dismiss the panel that asked it. */
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Escape" && MODAL.open) {
        e.stopPropagation();
        closeModal(null);
      }
    },
    true,
  );

  window.ask = ask;
  window.askText = askText;
  window.askChoice = askChoice;
  window.askConfirm = askConfirm;
  window.say = say;
  window.ErpModal = {
    isOpen: function () {
      return !!MODAL.open;
    },
    close: function () {
      closeModal(null);
    },
    /**
     * Publish the modal stylesheet without opening anything.
     *
     * IT USED TO BE INJECTED ONLY BY `scrimEl()`, which only runs when this
     * module opens a dialog — so a caller that builds its OWN `.mscrim`, as the
     * catalogue picker does, got no CSS at all. `position: fixed` fell back to
     * `static` and the picker rendered as a plain block in normal flow, at the
     * bottom of the page: on a phone, pressing "+ partida del catálogo" looked
     * like it had done nothing, and the catalogue was sitting a screen and a
     * half further down. Intermittent, too — it worked for the rest of a
     * session as soon as any other dialog had been opened first.
     *
     * Exposed rather than fixed only inside the picker: the next hand-rolled
     * overlay would have hit exactly the same thing.
     */
    ensureStyle: injectStyle,
  };
})();
