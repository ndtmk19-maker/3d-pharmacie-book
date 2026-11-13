import { esc, eq } from './panel.js';
import { t, lang, rtl } from '../i18n.js';

// A full text version of the lesson, hidden until focused; every interaction is reachable from it.
export function mountA11y(main, lesson, actions, jarName = {}) {
  main.setAttribute('aria-label', t('textVersion'));
  main.dir = rtl ? 'rtl' : 'ltr';
  main.lang = lang;
  main.innerHTML = `
    <h1>${esc(lesson.kicker)}: ${esc(lesson.title)}</h1>
    ${lesson.explanation.map((p) => `<p>${esc(p)}</p>`).join('')}
    ${lesson.equation ? `<p><span dir="ltr">${eq(lesson.equation.symbols)}</span>: ${esc(lesson.equation.words)}</p>` : ''}
    ${lesson.things.length ? `<h2>${t('molecules')}</h2>` : ''}
    <ul>${lesson.things.map((th) => `<li><button data-tap="${esc(th.id)}">${esc(th.name)}</button> (<span dir="ltr">${esc(th.formula ?? '')}</span>): ${esc(jarName[th.store] ?? th.store)}. ${esc(th.note ?? '')}</li>`).join('')}</ul>
    ${lesson.reaction ? `<h2>${t('theaterTitle')}</h2><ol>${lesson.reaction.steps.map((st) => `<li><button data-rx="${st.n}">${esc(st.name)}</button></li>`).join('')}</ol>` : ''}
    ${lesson.event ? `<p><button data-event>${esc(lesson.event.label)}</button></p>` : ''}
    ${lesson.explain ? `<h2>${t('why')}</h2><p>${esc(lesson.explain)}</p>` : ''}
    ${lesson.challenge ? `<h2>${t('challenge')}</h2><p>${esc(lesson.challenge.text)}</p>` : ''}`;
  main.querySelectorAll('[data-tap]').forEach((b) => b.addEventListener('click', () => actions.tap(b.dataset.tap)));
  main.querySelectorAll('[data-rx]').forEach((b) => b.addEventListener('click', () => actions.theaterStep(Number(b.dataset.rx))));
  main.querySelector('[data-event]')?.addEventListener('click', () => actions.startEvent());
}
