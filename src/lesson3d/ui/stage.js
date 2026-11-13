import { esc } from './panel.js';
import { t, rtl, lang } from '../i18n.js';

// Controls for the reaction theatre: the four steps, the caption of the current moment, its reaction type,
// previous / play-pause / next, and the way back to the book.
const ICON = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
};

export function mountStage(root, { steps, types }, theater, actions) {
  const el = document.createElement('section');
  el.className = 'stage';
  el.hidden = true;
  el.dir = rtl ? 'rtl' : 'ltr';
  el.lang = lang;
  el.setAttribute('aria-label', t('theaterTitle'));
  el.innerHTML = `
    <div class="stage-top">
      <div class="steps" role="tablist">${steps.map((s) => `<button role="tab" data-step="${s.n}"><b>${s.n}</b><span>${esc(s.name)}</span></button>`).join('')}</div>
      <button class="icon close" data-x="close" aria-label="${esc(t('back'))}" title="${esc(t('back'))}">${ICON.close}</button>
    </div>
    <div class="stage-main">
      <p class="step-name"></p>
      <span class="badge"></span>
      <p class="caption" aria-live="polite"></p>
    </div>
    <div class="stage-bottom">
      <div class="ctl">
        <button class="icon" data-x="prev" aria-label="${esc(t('prev'))}">${rtl ? ICON.next : ICON.prev}</button>
        <button class="icon main" data-x="toggle" aria-label="${esc(t('play'))}">${ICON.play}</button>
        <button class="icon" data-x="next" aria-label="${esc(t('next'))}">${rtl ? ICON.prev : ICON.next}</button>
      </div>
      <div class="dots" aria-hidden="true"></div>
      <div class="legend"><span class="sw gold"></span>${esc(t('forms'))}<span class="sw red"></span>${esc(t('breaks'))}</div>
    </div>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);

  el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => theater.playStep(Number(b.dataset.step))));
  $('[data-x=close]').addEventListener('click', () => actions.exit());
  $('[data-x=prev]').addEventListener('click', () => { theater.pause(); theater.prev(); });
  $('[data-x=next]').addEventListener('click', () => { theater.pause(); theater.next(); });
  $('[data-x=toggle]').addEventListener('click', () => theater.toggle());

  function render(key, k) {
    const ty = types[key.type];
    $('.badge').textContent = ty.name;
    $('.badge').style.setProperty('--c', ty.color);
    $('.caption').textContent = key.text;
    const st = steps.find((x) => x.n === key.step);
    $('.step-name').textContent = st ? `${t('step')} ${st.n} · ${st.name}` : '';
    el.querySelectorAll('[data-step]').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.step) === key.step)));
    const inStep = theater.keys.map((x, i) => [x, i]).filter(([x]) => x.step === key.step);
    $('.dots').innerHTML = inStep.map(([x, i]) => `<i class="${i === k ? 'on' : i < k ? 'past' : ''}" style="--c:${types[x.type].color}"></i>`).join('');
    const tg = $('[data-x=toggle]');
    tg.innerHTML = theater.playing ? ICON.pause : ICON.play;
    tg.setAttribute('aria-label', theater.playing ? t('pause') : t('play'));
    actions.onKey?.(key);
  }
  theater.onChange = render;

  return {
    el,
    show(on) { el.hidden = !on; if (on) render(theater.key, theater.k); },
    get height() { return el.hidden ? 0 : el.getBoundingClientRect().height; },
  };
}
