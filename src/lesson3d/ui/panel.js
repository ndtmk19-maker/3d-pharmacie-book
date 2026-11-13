import { t, LANGS, lang, rtl, setLang } from '../i18n.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// "E_p = m g h" -> E<sub>p</sub> = m g h ; "v^2" -> v²
export const eq = (s) => esc(s).replace(/_([A-Za-z0-9]+)/g, '<sub>$1</sub>').replace(/\^2/g, '²').replace(/\^3/g, '³');

// The lesson card: Predict → Try it → Why? (flap) → Challenge (stamp), with a margin note for the tapped thing.
export function mountPanel(root, lesson, actions, saved, jarName = {}) {
  const el = document.createElement('aside');
  el.className = 'panel';
  el.dir = rtl ? 'rtl' : 'ltr';
  el.lang = lang;
  el.setAttribute('aria-label', `${lesson.kicker}: ${lesson.title}`);
  el.innerHTML = `
    <button class="sheet" aria-expanded="true" aria-controls="panelBody">${esc(lesson.kicker)} · ${esc(lesson.title)}</button>
    <div id="panelBody" class="body">
      <nav class="langs" aria-label="${esc(t('language'))}">${LANGS.map((l) =>
        `<button type="button" data-lang="${l.id}" lang="${l.id}" aria-pressed="${l.id === lang}" title="${esc(l.label)}">${esc(l.label)}</button>`).join('')}</nav>
      <nav class="nav"><a href="#/" ${lesson.generated ? '' : 'aria-current="page"'}>${esc(t('exampleLesson'))}</a><a href="#/new" class="ai">${esc(t('newLesson'))}</a></nav>
      <header><div class="kicker">${esc(lesson.kicker)}</div><h1>${esc(lesson.title)}</h1>
        <p class="fig">${lesson.generated ? '' : `${t('figure')} ${lesson.n} · `}${esc(lesson.figure)}</p></header>
      ${lesson.explanation.map((p) => `<p>${esc(p)}</p>`).join('')}
      ${lesson.equation ? `<div class="eq"><div class="sym" dir="ltr">${eq(lesson.equation.symbols)}</div><div class="words">${esc(lesson.equation.words)}</div></div>` : ''}
      ${lesson.reaction ? `<h2>${t('theaterTitle')}</h2><p>${esc(t('theaterIntro'))}</p>
        <button class="theater-cta" data-act="theater">${esc(t('theater'))}</button>
        <ol class="rx">${lesson.reaction.steps.map((st) => `<li><button data-rx="${st.n}"><b>${st.n}</b><span><span>${esc(st.name)}</span>
          <span class="tys">${st.types.map((ty) => `<span class="ty" style="--c:${lesson.reaction.types[ty].color}">${esc(lesson.reaction.types[ty].name)}</span>`).join('')}</span></span></button></li>`).join('')}</ol>` : ''}
      ${lesson.predict ? `<h2>${t('predict')}</h2><p>${esc(lesson.predict.question)}</p>
      <div class="opts" role="radiogroup">${lesson.predict.options.map((o, i) =>
        `<label><input type="radio" name="predict" value="${i}"> <span>${esc(o)}</span></label>`).join('')}</div>` : ''}
      ${lesson.things.length ? `<h2>${t('tryIt')}</h2><p>${esc(lesson.tryHint)}</p>` : ''}
      <div class="actions">
        ${lesson.event ? `<button data-act="event">${esc(lesson.event.label)}</button>` : ''}
        ${lesson.watch ? `<button data-act="watch">${t('watch')}</button>` : ''}
        <button data-act="reset" class="quiet">${t('reset')}</button>
      </div>
      ${lesson.things.length ? `<div class="margin" aria-live="polite"><p class="hint">${t('tapHint')}</p></div>` : '<div class="margin" hidden></div>'}
      <p class="readout" aria-live="off"></p>
      ${lesson.explain ? `<h2>${t('why')}</h2>
      <details class="flap"><summary>${t('flap')}</summary><p class="verdict"></p><p>${esc(lesson.explain)}</p></details>` : ''}
      ${lesson.challenge ? `<h2>${t('challenge')}</h2><p>${esc(lesson.challenge.text)} <span class="prog"></span></p>
      <div class="stamp" hidden>✓ ${esc(lesson.challenge.done)}</div>` : ''}
      ${lesson.keywords.length ? `<h2>${t('keywords')}</h2><dl>${lesson.keywords.map((k) => `<dt>${esc(k.term)}</dt><dd>${esc(k.definition)}</dd>`).join('')}</dl>` : ''}
      ${lesson.sources ? `<h2>${t('sources')}</h2><ol class="sources">${lesson.sources.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
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
  el.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.lang !== lang) setLang(b.dataset.lang); }));
  let pick = saved.predict ?? null;
  const verdict = () => {
    if (!lesson.predict || !$('.verdict')) return;
    $('.verdict').textContent = pick == null ? t('predictFirst')
      : pick === lesson.predict.answer ? t('right') : `${t('notQuite')} « ${lesson.predict.options[lesson.predict.answer]} ».`;
  };
  el.querySelectorAll('input[name=predict]').forEach((r) => {
    if (Number(r.value) === pick) r.checked = true;
    r.addEventListener('change', () => { pick = Number(r.value); actions.onPredict(pick); verdict(); });
  });
  flap?.addEventListener('toggle', () => { if (flap.open && pick == null) { flap.open = false; $('.margin').innerHTML = `<p class="hint">${t('tickFirst')}</p>`; } verdict(); });
  el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]()));
  el.querySelectorAll('[data-rx]').forEach((b) => b.addEventListener('click', () => actions.theaterStep(Number(b.dataset.rx))));

  return {
    el,
    margin(thing) {
      const d = thing.def;
      $('.margin').innerHTML = `<p class="who"><b>${esc(d.name)}</b></p>
        ${d.formula ? `<p class="sym" dir="ltr">${esc(d.formula)}</p>` : ''}
        <p class="res">→ ${esc(jarName[d.store] ?? d.store)}</p>
        ${d.note ? `<p class="note">${esc(d.note)}</p>` : ''}`;
    },
    readout(text) { $('.readout').textContent = text ?? ''; },
    progress(found, total, met) {
      if (!$('.prog')) return;
      $('.prog').textContent = `(${found} ${t('of')} ${total})`;
      $('.stamp').hidden = !met;
    },
    collapse(on) {
      if (el.classList.contains('collapsed') === on) return;
      el.classList.toggle('collapsed', on);
      sheet.setAttribute('aria-expanded', String(!on));
      actions.onLayout?.();
    },
    currentStep(n) { el.querySelectorAll('[data-rx]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.rx) === n))); },
    get height() { return el.getBoundingClientRect().height; },
    get collapsed() { return el.classList.contains('collapsed'); },
  };
}
