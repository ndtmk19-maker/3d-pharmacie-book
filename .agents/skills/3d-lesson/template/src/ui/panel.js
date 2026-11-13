import { fmt } from '../stores.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// "E_p = m g h" -> E<sub>p</sub> = m g h ; "v^2" -> v²
export const eq = (s) => esc(s).replace(/_([A-Za-z0-9]+)/g, '<sub>$1</sub>').replace(/\^2/g, '²').replace(/\^3/g, '³');

// The lesson card: Predict → Try it → Why? (flap) → Challenge (stamp), with a margin note for the tapped thing.
export function mountPanel(root, lesson, actions, saved) {
  const el = document.createElement('aside');
  el.className = 'panel';
  el.setAttribute('aria-label', `Lesson ${lesson.n}: ${lesson.title}`);
  el.innerHTML = `
    <button class="sheet" aria-expanded="true" aria-controls="panelBody">Lesson ${lesson.n} · ${esc(lesson.title)}</button>
    <div id="panelBody" class="body">
      <header><div class="kicker">Lesson ${lesson.n}</div><h1>${esc(lesson.title)}</h1>
        <p class="fig">Figure ${lesson.n} · ${esc(lesson.figure)}</p></header>
      ${lesson.explanation.map((p) => `<p>${esc(p)}</p>`).join('')}
      ${lesson.equation ? `<div class="eq"><div class="sym">${eq(lesson.equation.symbols)}</div><div class="words">${esc(lesson.equation.words)}</div></div>` : ''}
      <h2>Predict</h2><p>${esc(lesson.predict.question)}</p>
      <div class="opts" role="radiogroup">${lesson.predict.options.map((o, i) =>
        `<label><input type="radio" name="predict" value="${i}"> ${esc(o)}</label>`).join('')}</div>
      <h2>Try it</h2><p>${esc(lesson.tryHint)}</p>
      <div class="actions">
        ${lesson.event ? `<button data-act="event">${esc(lesson.event.label)}</button>` : ''}
        ${lesson.watch ? '<button data-act="watch">Watch the demonstration</button>' : ''}
        <button data-act="reset" class="quiet">Start again</button>
      </div>
      <div class="margin" aria-live="polite"><p class="hint">Tap a drawing.</p></div>
      <p class="readout" aria-live="off"></p>
      <h2>Why?</h2>
      <details class="flap"><summary>Lift the flap</summary><p class="verdict"></p><p>${esc(lesson.explain)}</p></details>
      <h2>Challenge</h2><p>${esc(lesson.challenge.text)} <span class="prog"></span></p>
      <div class="stamp" hidden>✓ ${esc(lesson.challenge.done)}</div>
      <h2>Key words</h2><dl>${lesson.keywords.map((k) => `<dt>${esc(k.term)}</dt><dd>${esc(k.definition)}</dd>`).join('')}</dl>
    </div>`;
  root.appendChild(el);

  const $ = (s) => el.querySelector(s);
  const flap = $('.flap');
  const sheet = $('.sheet');
  sheet.addEventListener('click', () => {
    const open = el.classList.toggle('collapsed') === false;
    sheet.setAttribute('aria-expanded', String(open));
    actions.onLayout?.();
  });
  let pick = saved.predict ?? null;
  const verdict = () => {
    $('.verdict').textContent = pick == null ? 'Make your prediction first.'
      : pick === lesson.predict.answer ? 'Your prediction was right.' : `Not quite: the answer is “${lesson.predict.options[lesson.predict.answer]}”.`;
  };
  el.querySelectorAll('input[name=predict]').forEach((r) => {
    if (Number(r.value) === pick) r.checked = true;
    r.addEventListener('change', () => { pick = Number(r.value); actions.onPredict(pick); verdict(); });
  });
  flap.addEventListener('toggle', () => { if (flap.open && pick == null) { flap.open = false; $('.margin').innerHTML = '<p class="hint">Tick a prediction before you lift the flap.</p>'; } verdict(); });
  el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]()));

  return {
    el,
    margin(thing) {
      const w = thing.def.work ?? {};
      const inputs = (w.inputs ?? []).map((i) => `<li><i>${esc(i.symbol)}</i> = ${esc(i.value.toLocaleString('en-GB'))} ${esc(i.unit)} <span>${esc(i.label)}${i.example ? ' (example)' : ''}</span></li>`).join('');
      $('.margin').innerHTML = `<p class="who"><b>${esc(thing.def.name)}</b>: ${esc(thing.def.store)} store</p>
        ${w.equation ? `<p class="sym">${eq(w.equation)}</p><ul>${inputs}</ul><p class="res">= ${esc(fmt(w.J))}</p>` : ''}
        ${w.note ? `<p class="note">${esc(w.note)}</p>` : ''}`;
    },
    readout(text) { $('.readout').textContent = text ?? ''; },
    progress(found, total, met) {
      $('.prog').textContent = `(${found} of ${total})`;
      $('.stamp').hidden = !met;
    },
    get height() { return el.getBoundingClientRect().height; },
    get collapsed() { return el.classList.contains('collapsed'); },
  };
}
