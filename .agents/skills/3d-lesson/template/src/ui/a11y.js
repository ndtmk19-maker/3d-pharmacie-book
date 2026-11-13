import { esc, eq } from './panel.js';
import { fmt } from '../stores.js';

// A full text version of the lesson, hidden until focused; every interaction is reachable from it.
export function mountA11y(main, lesson, actions) {
  main.innerHTML = `
    <h1>Lesson ${lesson.n}: ${esc(lesson.title)}</h1>
    ${lesson.explanation.map((p) => `<p>${esc(p)}</p>`).join('')}
    ${lesson.equation ? `<p>${eq(lesson.equation.symbols)}: ${esc(lesson.equation.words)}</p>` : ''}
    <h2>The drawings</h2>
    <ul>${lesson.things.map((t) => `<li><button data-tap="${esc(t.id)}">${esc(t.name)}</button>: ${esc(t.store)} store${t.work?.J != null ? `, ${esc(fmt(t.work.J))}` : ''}${t.work?.note ? `. ${esc(t.work.note)}` : ''}</li>`).join('')}</ul>
    ${lesson.event ? `<p><button data-event>${esc(lesson.event.label)}</button></p>` : ''}
    <h2>Why?</h2><p>${esc(lesson.explain)}</p>
    <h2>Challenge</h2><p>${esc(lesson.challenge.text)}</p>`;
  main.querySelectorAll('[data-tap]').forEach((b) => b.addEventListener('click', () => actions.tap(b.dataset.tap)));
  main.querySelector('[data-event]')?.addEventListener('click', () => actions.startEvent());
}
