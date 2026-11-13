// The studio (#/new): a student types a reaction or drops a picture of a scheme; Gemini writes the script,
// RDKit checks it, and the lesson opens in the book's reaction theatre. Lessons are kept in this browser.
import '../ui/style.css';
import './studio.css';
import { lang, rtl, LANGS, setLang, tr } from '../i18n.js';
import { esc } from '../ui/panel.js';
import { generate, hasKey, getKey, setKey } from './gemini.js';
import { listLessons, saveLesson, deleteLesson, quotaLeft, useQuota, DAILY_LIMIT } from './store.js';

const L = (fr, ar, en) => ({ fr, ar, en })[lang] ?? fr;
const EXAMPLES = [
  L('Estérification de Fischer : acide acétique + éthanol → acétate d’éthyle + eau', 'أسترة فيشر: حمض الأسيتيك + الإيثانول ← أسيتات الإيثيل + ماء', 'Fischer esterification: acetic acid + ethanol → ethyl acetate + water'),
  L('Synthèse de l’aspirine : acide salicylique + anhydride acétique → acide acétylsalicylique + acide acétique', 'تحضير الأسبرين: حمض الساليسيليك + أنهيدريد الأسيتيك ← حمض أسيتيل الساليسيليك + حمض الأسيتيك', 'Aspirin: salicylic acid + acetic anhydride → acetylsalicylic acid + acetic acid'),
  L('SN2 : bromométhane + ion hydroxyde → méthanol + ion bromure', 'SN2: بروموميثان + أيون الهيدروكسيد ← ميثانول + أيون البروميد', 'SN2: bromomethane + hydroxide → methanol + bromide'),
];
const STAGES = ['image', 'chem', 'ask', 'check', 'build'];
const STAGE_TEXT = {
  image: L('Préparation de l’image', 'تجهيز الصورة', 'Preparing the image'),
  chem: L('Chargement de la chimie (RDKit)', 'تحميل أدوات الكيمياء (RDKit)', 'Loading the chemistry toolkit (RDKit)'),
  ask: L('Gemini écrit les étapes et les explications', 'Gemini يكتب الخطوات والشرح', 'Gemini is writing the steps and explanations'),
  retry: L('Gemini corrige les erreurs trouvées', 'Gemini يصحّح الأخطاء التي وُجدت', 'Gemini is fixing the errors found'),
  check: L('Vérification : molécules et suivi des atomes', 'التحقق: الجزيئات وتتبّع الذرات', 'Checking molecules and atom tracking'),
  build: L('Construction du film 3D', 'بناء الفيلم ثلاثي الأبعاد', 'Building the 3D film'),
};
const BUSY = (n) => L(`Gemini est surchargé chez Google, nouvel essai dans ${n} s…`, `خوادم Gemini لدى Google مزدحمة، إعادة المحاولة بعد ${n} ثوانٍ…`, `Gemini is overloaded at Google, retrying in ${n} s…`);
const PROGRESS = (p) => p.frames
  ? L(`Gemini écrit… ${p.steps} étape(s), ${p.frames} scène(s) reçue(s)`, `Gemini يكتب… وصلت ${p.steps} خطوة و${p.frames} مشهد`, `Gemini is writing… ${p.steps} step(s), ${p.frames} scene(s) received`)
  : L(`Gemini écrit… ${p.chars} caractères reçus`, `Gemini يكتب… وصل ${p.chars} حرفاً`, `Gemini is writing… ${p.chars} characters received`);
const SWITCH = (m) => L(`Passage à un autre modèle (${m})…`, `الانتقال إلى نموذج آخر (${m})…`, `Switching to another model (${m})…`);

export function mountStudio() {
  document.documentElement.lang = lang;
  document.title = L('Nouvelle leçon 3D', 'درس ثلاثي الأبعاد جديد', 'New 3D lesson');
  document.body.classList.add('ready', 'studio-page');
  const root = document.createElement('div');
  root.className = 'studio';
  root.dir = rtl ? 'rtl' : 'ltr';
  document.body.appendChild(root);

  root.innerHTML = `
    <div class="col">
      <header class="top">
        <a class="back" href="#/">${esc(L('← Exemple : kétamine', '→ مثال: الكيتامين', '← Example: ketamine'))}</a>
        <nav class="langs">${LANGS.map((l) => `<button type="button" data-lang="${l.id}" lang="${l.id}" aria-pressed="${l.id === lang}">${esc(l.label)}</button>`).join('')}</nav>
      </header>
      <div class="kicker">${esc(L('Atelier IA', 'ورشة الذكاء الاصطناعي', 'AI studio'))}</div>
      <h1>${esc(L('Transformez une réaction en leçon 3D', 'حوّل تفاعلاً إلى درس ثلاثي الأبعاد', 'Turn a reaction into a 3D lesson'))}</h1>
      <p class="lead">${esc(L('Écrivez les étapes d’une réaction ou déposez une photo du schéma. L’IA décrit chaque étape, la chimie est vérifiée, puis vous regardez les atomes bouger : combinaison, substitution, départ, réarrangement.',
        'اكتب خطوات التفاعل أو ضع صورة المخطط. يصف الذكاء الاصطناعي كل خطوة، ثم يُتحقَّق من الكيمياء، وبعدها تشاهد الذرات تتحرك: اتحاد، استبدال، انقسام، إعادة ترتيب.',
        'Type the steps of a reaction or drop a photo of the scheme. The AI describes each step, the chemistry is checked, then you watch the atoms move: combination, substitution, cleavage, rearrangement.'))}</p>

      <form class="card" novalidate>
        <label class="lbl" for="rx">${esc(L('La réaction', 'التفاعل', 'The reaction'))}</label>
        <textarea id="rx" rows="4" dir="auto" placeholder="${esc(L('Ex. : 2-chlorobenzonitrile + bromure de cyclopentylmagnésium → cétone → Br₂ → …', 'مثال: 2-كلوروبنزونتريل + بروميد سيكلوبنتيل المغنيسيوم ← كيتون ← Br₂ ← …', 'e.g. 2-chlorobenzonitrile + cyclopentylmagnesium bromide → ketone → Br₂ → …'))}"></textarea>
        <div class="ex">${esc(L('Essayer :', 'جرّب:', 'Try:'))} ${EXAMPLES.map((e, i) => `<button type="button" data-ex="${i}">${esc(e.split(':')[0])}</button>`).join('')}</div>

        <div class="drop" tabindex="0" role="button" aria-label="${esc(L('Ajouter une image du schéma', 'أضف صورة المخطط', 'Add an image of the scheme'))}">
          <input type="file" accept="image/*" hidden>
          <div class="empty">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l4.5-4.5 3 3L16 10l4 4M4 5h16v14H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
            <span>${esc(L('Déposez une image du schéma, ou cliquez pour choisir (facultatif)', 'ضع صورة المخطط هنا أو اضغط للاختيار (اختياري)', 'Drop an image of the scheme, or click to choose (optional)'))}</span>
          </div>
          <div class="full" hidden><img alt=""><button type="button" class="rm">${esc(L('Retirer', 'إزالة', 'Remove'))}</button></div>
        </div>

        <div class="go">
          <button type="submit" class="primary">${esc(L('Générer la leçon 3D', 'أنشئ الدرس ثلاثي الأبعاد', 'Generate the 3D lesson'))}</button>
          <span class="quota"></span>
        </div>
        <ol class="stages" hidden>${STAGES.map((s) => `<li data-s="${s}"><i></i><span>${esc(STAGE_TEXT[s])}</span></li>`).join('')}</ol>
        <div class="err" role="alert" hidden></div>
      </form>

      <section class="mine">
        <h2>${esc(L('Mes leçons', 'دروسي', 'My lessons'))}</h2>
        <ul class="list"></ul>
      </section>
      <p class="fine">${esc(L('Les leçons sont enregistrées dans ce navigateur uniquement. L’IA peut se tromper : comparez toujours le mécanisme avec votre cours. Les conditions de laboratoire ne sont jamais données.',
        'تُحفظ الدروس في هذا المتصفح فقط. قد يخطئ الذكاء الاصطناعي، فقارن الآلية دائماً بدرسك. لا تُعطى شروط مخبرية أبداً.',
        'Lessons are saved in this browser only. The AI can be wrong: always compare the mechanism with your course. Laboratory conditions are never given.'))}</p>
    </div>`;

  const $ = (s) => root.querySelector(s);
  root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => b.dataset.lang !== lang && setLang(b.dataset.lang)));
  root.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { $('#rx').value = EXAMPLES[b.dataset.ex]; $('#rx').focus(); }));

  // --- image: pick, drop or paste; downscaled before sending ---
  let image = null;
  const drop = $('.drop'), input = drop.querySelector('input');
  const setImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.9);
    image = { mime: 'image/jpeg', base64: url.split(',')[1] };
    drop.querySelector('img').src = url;
    drop.querySelector('.empty').hidden = true; drop.querySelector('.full').hidden = false;
  };
  drop.addEventListener('click', (e) => { if (!e.target.closest('.rm')) input.click(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => setImage(input.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); setImage(e.dataTransfer.files[0]); });
  addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/')); if (f) setImage(f); });
  drop.querySelector('.rm').addEventListener('click', (e) => {
    e.stopPropagation(); image = null; input.value = '';
    drop.querySelector('.empty').hidden = false; drop.querySelector('.full').hidden = true;
  });

  // --- quota and saved lessons ---
  const showQuota = () => {
    const left = quotaLeft();
    $('.quota').textContent = hasKey()
      ? L(`${left} / ${DAILY_LIMIT} générations restantes aujourd’hui`, `متبقٍ اليوم ${left} من ${DAILY_LIMIT} عمليات توليد`, `${left} of ${DAILY_LIMIT} generations left today`)
      : L('Clé Gemini manquante', 'مفتاح Gemini غير موجود', 'Gemini key missing');
    $('.primary').disabled = !hasKey() || left <= 0;
  };
  const showList = () => {
    const items = listLessons();
    $('.list').innerHTML = items.length ? items.map((l) => `
      <li><a href="#/g/${l.id}"><b>${esc(tr(l.data.title) ?? '—')}</b><span>${esc(new Date(l.created).toLocaleString(lang === 'ar' ? 'ar' : lang))} · ${l.data.steps?.length ?? 0} ${esc(L('étapes', 'خطوات', 'steps'))}</span></a>
      <button type="button" data-del="${l.id}" aria-label="${esc(L('Supprimer', 'حذف', 'Delete'))}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></li>`).join('')
      : `<li class="none">${esc(L('Aucune leçon pour l’instant.', 'لا توجد دروس بعد.', 'No lessons yet.'))}</li>`;
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { deleteLesson(b.dataset.del); showList(); }));
  };
  showQuota(); showList();

  // --- generation ---
  const stage = (s, state) => {
    const li = $(`[data-s="${s === 'retry' ? 'ask' : s}"]`);
    if (!li) return;
    if (s === 'retry') li.querySelector('span').textContent = STAGE_TEXT.retry;
    li.dataset.state = state;
  };
  const fail = (msg, detail) => {
    $('.err').hidden = false;
    $('.err').innerHTML = `<b>${esc(msg)}</b>${detail ? `<small>${esc(detail)}</small>` : ''}`;
  };

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('#rx').value;
    if (!text.trim() && !image) { fail(L('Écrivez une réaction ou ajoutez une image.', 'اكتب تفاعلاً أو أضف صورة.', 'Type a reaction or add an image.')); return; }
    if (quotaLeft() <= 0) { fail(L('Limite du jour atteinte.', 'تم بلوغ الحد اليومي.', 'Daily limit reached.')); return; }
    $('.err').hidden = true;
    $('.primary').disabled = true;
    $('.stages').hidden = false;
    root.querySelectorAll('.stages li').forEach((li) => { delete li.dataset.state; });
    $('[data-s="ask"] span').textContent = STAGE_TEXT.ask;
    let current = null;
    const go = (s) => { if (current) stage(current, 'done'); current = s; stage(s, 'run'); };
    const t0 = performance.now();
    $('.elapsed')?.remove();
    const clock = document.createElement('span'); clock.className = 'elapsed';
    $('.go').appendChild(clock);
    const tick = setInterval(() => { clock.textContent = `${Math.round((performance.now() - t0) / 1000)} s`; }, 500);
    try {
      if (image) go('image');
      go('chem');
      const [{ loadRDKit }, { validateScript, buildReaction }] = await Promise.all([import('../chem/rdkit.js'), import('../chem/build.js')]);
      const RD = await loadRDKit();
      const validate = (data) => {
        const v = validateScript(RD, data);
        if (v.refused) return [];
        if (v.errors.some((e) => !e.soft)) return v.errors;
        try { buildReaction(RD, data); } catch (err) { return [...v.errors, { msg: `layout failed: ${err.message}` }]; }
        return v.errors;
      };
      const data = await generate({ text, image, lang }, validate, (s, arg) => {
        if (s === 'progress') { $('[data-s="ask"] span').textContent = PROGRESS(arg); return; }
        if (s === 'busy') { $('[data-s="ask"] span').textContent = BUSY(arg); return; }
        if (s === 'timeout') { $('[data-s="ask"] span').textContent = L('Pas de réponse à temps : nouvel essai avec un autre modèle…', 'لا رد في الوقت المحدد: محاولة جديدة بنموذج آخر…', 'No answer in time: trying another model…'); return; }
        if (s === 'switch') { $('[data-s="ask"] span').textContent = SWITCH(arg); return; }
        if (s === 'ask') { if (current === 'ask') { $('[data-s="ask"] span').textContent = STAGE_TEXT.ask; return; } go('ask'); }
        else if (s === 'retry') { stage('check', ''); current = 'ask'; stage('retry', 'run'); }
        else if (s === 'check') go('check');
      });
      if (data.refused) {
        clearInterval(tick);
        stage(current, 'fail');
        fail(L('L’IA n’a pas pu faire cette leçon.', 'لم يستطع الذكاء الاصطناعي إنشاء هذا الدرس.', 'The AI could not make this lesson.'), data.reason);
        $('.primary').disabled = false;
        return;
      }
      go('build');
      useQuota();                        // only successful lessons count towards the daily limit
      const id = saveLesson(data, { text, hadImage: Boolean(image) });
      stage('build', 'done');
      clearInterval(tick);
      location.hash = `#/g/${id}`;
    } catch (err) {
      clearInterval(tick);
      if (current) stage(current, 'fail');
      const s = err.status;
      const msg = s === 'nokey' ? L('Clé Gemini manquante.', 'مفتاح Gemini غير موجود.', 'Gemini key missing.')
        : (s === 400 || s === 401 || s === 403) && /api key|permission|unauth|credential/i.test(err.message) ? L('Gemini a refusé la clé (clé invalide ou restreinte).', 'رفض Gemini المفتاح (غير صالح أو مقيَّد).', 'Gemini rejected the key (invalid or restricted).')
        : s === 429 ? L('Quota Gemini dépassé, réessayez plus tard.', 'تم تجاوز حصة Gemini، حاول لاحقاً.', 'Gemini quota exceeded, try again later.')
        : s === 'timeout' ? L('Gemini n’a pas répondu à temps, même après plusieurs essais. Réessayez avec une réaction plus courte (moins d’étapes).', 'لم يُجب Gemini في الوقت المحدد حتى بعد عدة محاولات. أعد المحاولة بتفاعل أقصر (خطوات أقل).', 'Gemini did not answer in time, even after several tries. Try a shorter reaction (fewer steps).')
        : s === 503 || s === 500 || s === 502 ? L('Les serveurs Gemini de Google sont surchargés en ce moment (ce n’est pas votre faute). Réessayez dans quelques minutes : cet essai n’a pas été décompté.', 'خوادم Gemini لدى Google مزدحمة حالياً (ليس الخطأ منك). حاول بعد بضع دقائق، ولم تُحتسب هذه المحاولة.', 'Google’s Gemini servers are overloaded right now (not your fault). Try again in a few minutes: this attempt was not counted.')
        : s === 'invalid' ? L('La chimie générée n’a pas passé la vérification. Reformulez ou ajoutez une image plus nette.', 'لم تنجح الكيمياء المولَّدة في التحقق. أعد الصياغة أو أضف صورة أوضح.', 'The generated chemistry failed the check. Rephrase or add a clearer image.')
        : err instanceof TypeError ? L('Problème de réseau.', 'مشكلة في الاتصال.', 'Network problem.')
        : L('La génération a échoué.', 'فشل التوليد.', 'Generation failed.');
      fail(msg, err.message);
      showQuota();
    }
  });
}
