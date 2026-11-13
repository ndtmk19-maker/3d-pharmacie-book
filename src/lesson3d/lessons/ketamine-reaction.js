// The four steps as a 3D movie: every atom keeps its identity, so the viewer sees which bonds form,
// which break, which groups leave and how the ring grows. Conceptual mechanism only (no conditions).
// Hydrogens are drawn only where they move; ring hydrogens are omitted, as in a skeletal formula.
import { tr } from '../i18n.js';

const L = (fr, ar, en) => tr({ fr, ar, en });
const D = Math.PI / 180;
const dir = (p, deg, len) => [p[0] + Math.cos(deg * D) * len, p[1] + Math.sin(deg * D) * len, p[2] ?? 0];
const add = (p, v) => [p[0] + v[0], p[1] + v[1], (p[2] ?? 0) + (v[2] ?? 0)];

export const TYPES = {
  approach: { color: '#4a5161', name: L('Approche', 'اقتراب', 'Approach') },
  combination: { color: '#26a04f', name: L('Combinaison (addition)', 'اتحاد (إضافة)', 'Combination (addition)') },
  substitution: { color: '#2f6bdc', name: L('Substitution', 'استبدال', 'Substitution') },
  cleavage: { color: '#c0392b', name: L('Départ (rupture)', 'انقسام (خروج جزيء)', 'Cleavage (a group leaves)') },
  rearrangement: { color: '#8a4dff', name: L('Réarrangement', 'إعادة ترتيب', 'Rearrangement') },
  product: { color: '#9a3b2a', name: L('Produit', 'الناتج', 'Product') },
};

export const STEPS = [
  { n: 1, name: L('Grignard + nitrile → cétone', 'غرينيارد + نتريل → كيتون', 'Grignard + nitrile → ketone'), types: ['combination', 'substitution', 'cleavage'] },
  { n: 2, name: L('α-bromation (Br₂)', 'هلجنة ألفا (Br₂)', 'α-bromination (Br₂)'), types: ['substitution', 'cleavage'] },
  { n: 3, name: L('CH₃NH₂ → α-hydroxy-imine', 'CH₃NH₂ → ألفا-هيدروكسي إيمين', 'CH₃NH₂ → α-hydroxy imine'), types: ['combination', 'substitution', 'cleavage'] },
  { n: 4, name: L('Chauffage → kétamine', 'تسخين → كيتامين', 'Heat → ketamine'), types: ['rearrangement'] },
];

const atoms = {
  a1: { el: 'C' }, a2: { el: 'C' }, a3: { el: 'C' }, a4: { el: 'C' }, a5: { el: 'C' }, a6: { el: 'C' }, cl: { el: 'Cl' },
  cs: { el: 'C', label: 'C*', tagDir: -105 }, n1: { el: 'N' },
  ca: { el: 'C', label: 'Cα', tagDir: -147 }, r2: { el: 'C' }, r3: { el: 'C' }, r4: { el: 'C' }, r5: { el: 'C' },
  ha: { el: 'H' }, mg: { el: 'Mg' }, br1: { el: 'Br' },
  ow: { el: 'O' }, hw1: { el: 'H' }, hw2: { el: 'H' },
  bx: { el: 'Br' }, by: { el: 'Br' },
  n2: { el: 'N' }, cm: { el: 'Me' }, hn1: { el: 'H' }, hn2: { el: 'H' },
};

// --- a running state; each snap() records one keyframe ---
const st = { pos: {}, bonds: new Map(), vis: new Set() };
const keys = [];
const P = (id, p) => { st.pos[id] = p.length === 2 ? [...p, 0] : p; };
const B = (a, b, o) => { const k = [a, b].sort().join('|'); if (o) st.bonds.set(k, o); else st.bonds.delete(k); };
const show = (...ids) => ids.forEach((i) => st.vis.add(i));
const hide = (...ids) => ids.forEach((i) => st.vis.delete(i));
const snap = (meta) => keys.push({
  ...meta,
  pos: Object.fromEntries(Object.entries(st.pos).map(([k, v]) => [k, [...v]])),
  bonds: [...st.bonds].map(([k, o]) => [...k.split('|'), o]),
  vis: [...st.vis],
});

// fixed frame: the chlorophenyl ring (bond length 1) and C*
const ARYL = [30, 90, 150, 210, 270, 330].map((a) => [Math.cos(a * D), Math.sin(a * D), 0]);
['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].forEach((id, i) => P(id, ARYL[i]));
P('cl', [1.732, -1, 0]);
P('cs', [1.732, 1, 0]);
// the cyclopentyl ring, relative to Cα
const PENT = { r2: [0.105, -0.994], r3: [1.083, -1.202], r4: [1.583, -0.336], r5: [0.914, 0.407] };
const placeRing = (ca) => { P('ca', ca); for (const [id, v] of Object.entries(PENT)) P(id, add(ca, v)); };
const placeGrignard = (ca) => { placeRing(ca); P('ha', dir(ca, 85, 0.75)); P('mg', dir(ca, 150, 1.3)); P('br1', add(st.pos.mg, [0, 1.5, 0])); };
const CA = [2.598, 0.5, 0];

// ================= step 1: Grignard + nitrile → ketone =================
for (const [a, b, o] of [['a1', 'a2', 1], ['a2', 'a3', 2], ['a3', 'a4', 1], ['a4', 'a5', 2], ['a5', 'a6', 1], ['a6', 'a1', 2],
  ['a6', 'cl', 1], ['a1', 'cs', 1], ['cs', 'n1', 3],
  ['ca', 'r2', 1], ['r2', 'r3', 1], ['r3', 'r4', 1], ['r4', 'r5', 1], ['r5', 'ca', 1], ['ca', 'ha', 1], ['ca', 'mg', 1], ['mg', 'br1', 1]]) B(a, b, o);
P('n1', [2.598, 1.5, 0]);
placeGrignard([6.6, 0.2, 0]);
show('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'cl', 'cs', 'n1', 'ca', 'r2', 'r3', 'r4', 'r5', 'ha', 'mg', 'br1');
snap({ step: 1, type: 'approach', focus: ['cs', 'ca'], jars: ['c_nitrile', 'a_h'], hold: 3.2,
  text: L('Les réactifs : à gauche le 2-chlorobenzonitrile, à droite le bromure de cyclopentylmagnésium. La liaison C–Mg rend Cα riche en électrons ; C*, le carbone du nitrile, est pauvre en électrons.',
    'المتفاعلات: على اليسار 2-كلوروبنزونتريل، وعلى اليمين بروميد سيكلوبنتيل المغنيسيوم. الرابطة C–Mg تجعل Cα غنياً بالإلكترونات، أما C* (كربون النتريل) ففقير بها.',
    'The reactants: 2-chlorobenzonitrile on the left, cyclopentylmagnesium bromide on the right. The C–Mg bond makes Cα electron-rich; C*, the nitrile carbon, is electron-poor.') });

placeGrignard([4.8, 0.3, 0]);
snap({ step: 1, type: 'approach', focus: ['cs', 'ca'], jars: ['c_nitrile', 'a_h'],
  text: L('Cα (nucléophile) s’approche de C* (électrophile).', 'يقترب Cα (النيوكليوفيل) من C* (الإلكتروفيل).', 'Cα (the nucleophile) approaches C* (the electrophile).') });

placeRing(CA); P('ha', dir(CA, 85, 0.75));
P('n1', [1.732, 2, 0]); P('mg', [2.38, 3.13, 0]); P('br1', [3.88, 3.13, 0]);
B('ca', 'mg', 0); B('ca', 'cs', 1); B('cs', 'n1', 2); B('n1', 'mg', 1);
snap({ step: 1, type: 'combination', focus: ['cs', 'ca', 'n1', 'mg'], jars: ['c_nitrile', 'a_h'], dur: 2.4, hold: 3.4,
  text: L('Combinaison : la liaison C*–Cα se forme (en or) et la liaison C–Mg se rompt (en rouge). Les deux molécules n’en font plus qu’une ; MgBr passe sur l’azote et C≡N devient C=N–MgBr.',
    'اتحاد: تتكوّن الرابطة C*–Cα (باللون الذهبي) وتنكسر الرابطة C–Mg (باللون الأحمر). يصبح الجزيئان جزيئاً واحداً، وينتقل MgBr إلى النيتروجين فتصبح C≡N رابطة C=N–MgBr.',
    'Combination: the C*–Cα bond forms (gold) and the C–Mg bond breaks (red). The two molecules become one; MgBr moves to nitrogen and C≡N becomes C=N–MgBr.') });

P('ow', [0.5, 3.5, 1.2]); P('hw1', [-0.1, 4.0, 1.2]); P('hw2', [1.0, 4.1, 1.2]);
B('ow', 'hw1', 1); B('ow', 'hw2', 1); show('ow', 'hw1', 'hw2');
snap({ step: 1, type: 'approach', focus: ['ow', 'n1'], jars: ['c_nitrile', 'a_h'],
  text: L('Hydrolyse : on ajoute de l’eau (H₂O).', 'التحلل المائي: يُضاف الماء (H₂O).', 'Hydrolysis: water (H₂O) is added.') });

P('ow', [1.732, 2, 0]); P('n1', [0.0, 3.9, 1.4]); P('hw1', [-0.6, 4.4, 1.4]); P('hw2', [0.4, 4.6, 1.4]);
P('mg', [3.6, 4.3, -1]); P('br1', [5.1, 4.3, -1]);
B('cs', 'n1', 0); B('cs', 'ow', 2); B('ow', 'hw1', 0); B('ow', 'hw2', 0); B('n1', 'hw1', 1); B('n1', 'hw2', 1); B('n1', 'mg', 0);
snap({ step: 1, type: 'substitution', focus: ['ow', 'cs', 'n1'], jars: ['c_nitrile', 'a_h'], dur: 2.4, hold: 3.2,
  text: L('Substitution : l’oxygène de l’eau prend la place de l’azote sur C*. C=N devient C=O (étapes regroupées, simplifié).',
    'استبدال: يحل أكسجين الماء محل النيتروجين على C*، فتصبح C=N رابطة C=O (الخطوات مختصرة ومبسّطة).',
    'Substitution: the oxygen from water takes the place of nitrogen on C*. C=N becomes C=O (steps combined, simplified).') });

P('n1', [-1.0, 5.6, 2]); P('hw1', [-1.6, 6.1, 2]); P('hw2', [-0.6, 6.3, 2]); P('mg', [4.6, 5.7, -2]); P('br1', [6.1, 5.7, -2]);
hide('n1', 'hw1', 'hw2', 'mg', 'br1');
snap({ step: 1, type: 'cleavage', focus: ['ow'], jars: ['c_ketone', 'a_h'],
  text: L('Départ : l’azote s’en va (sous forme de NH₃) avec les sels de magnésium. Il reste la cétone : 2-chlorophényl cyclopentyl cétone.',
    'انقسام: يغادر النيتروجين (على شكل NH₃) مع أملاح المغنيسيوم. يبقى الكيتون: 2-كلوروفينيل سيكلوبنتيل كيتون.',
    'Cleavage: nitrogen leaves (as NH₃) with the magnesium salts. The ketone remains: 2-chlorophenyl cyclopentyl ketone.') });

// ================= step 2: α-bromination =================
P('bx', [3.7, 2.4, 1.0]); P('by', [5.0, 2.9, 1.0]); B('bx', 'by', 1); show('bx', 'by');
snap({ step: 2, type: 'approach', focus: ['ca', 'ha', 'bx'], jars: ['c_ketone', 'a_h'],
  text: L('Br₂ s’approche de Cα, le carbone voisin du C=O (position α).', 'يقترب Br₂ من Cα، الكربون المجاور لـ C=O (الموقع ألفا).', 'Br₂ approaches Cα, the carbon next to C=O (the α position).') });

P('bx', dir(CA, 85, 1.1)); P('ha', [4.0, 2.3, 1.0]); P('by', [5.3, 2.6, 1.0]);
B('ca', 'ha', 0); B('ca', 'bx', 1); B('bx', 'by', 0); B('ha', 'by', 1);
snap({ step: 2, type: 'substitution', focus: ['bx', 'ha', 'ca'], jars: ['c_ketone', 'a_br'], dur: 2.4, hold: 3.2,
  text: L('Substitution : un atome de Br prend la place du H sur Cα. La liaison Br–Br se rompt.',
    'استبدال: تحل ذرة Br محل ذرة H على Cα، وتنكسر الرابطة Br–Br.',
    'Substitution: a Br atom takes the place of the H on Cα. The Br–Br bond breaks.') });

P('ha', [5.2, 3.5, 1.5]); P('by', [6.5, 3.8, 1.5]); hide('ha', 'by');
snap({ step: 2, type: 'cleavage', focus: ['bx'], jars: ['c_ketone', 'a_br'],
  text: L('Départ : le H et l’autre Br partent ensemble (HBr). Il reste l’α-bromocétone.',
    'انقسام: تغادر ذرة H مع ذرة Br الأخرى معاً (HBr). يبقى ألفا-بروموكيتون.',
    'Cleavage: the H and the other Br leave together (HBr). The α-bromo ketone remains.') });

// ================= step 3: methylamine → α-hydroxy imine =================
P('n2', [0.4, 3.7, 1.0]); P('cm', [-0.8, 4.2, 1.0]); P('hn1', [0.9, 4.4, 1.0]); P('hn2', [1.1, 3.4, 1.6]);
B('n2', 'cm', 1); B('n2', 'hn1', 1); B('n2', 'hn2', 1); show('n2', 'cm', 'hn1', 'hn2');
snap({ step: 3, type: 'approach', focus: ['n2', 'cs'], jars: ['c_ketone', 'a_br'],
  text: L('La méthylamine CH₃NH₂ s’approche : son azote, riche en électrons, vise C*.',
    'يقترب الميثيل أمين CH₃NH₂: نيتروجينه الغني بالإلكترونات يتجه نحو C*.',
    'Methylamine, CH₃NH₂, approaches: its electron-rich nitrogen heads for C*.') });

P('n2', [1.232, 1.866, 0.3]); P('cm', [0.193, 2.466, 0.3]); P('hn1', [1.55, 2.6, -0.3]); P('hn2', [1.0, 2.5, 0.9]);
P('ow', dir([1.732, 1, 0], 60, 1));
B('cs', 'n2', 1); B('cs', 'ow', 1);
snap({ step: 3, type: 'combination', focus: ['n2', 'cs', 'ow'], jars: ['c_ketone', 'a_br'], dur: 2.2, hold: 3.2,
  text: L('Combinaison : l’azote se lie à C*. La double liaison C=O devient simple ; l’oxygène porte maintenant une charge négative.',
    'اتحاد: يرتبط النيتروجين بـ C*. تصبح الرابطة المزدوجة C=O أحادية، ويحمل الأكسجين الآن شحنة سالبة.',
    'Combination: nitrogen bonds to C*. The C=O double bond becomes single; the oxygen now carries a negative charge.') });

P('ow', [2.54, 1.40, 0]); P('bx', [4.4, 2.7, 0.8]); P('hn2', [3.5, 3.0, 0.8]);
B('ow', 'ca', 1); B('ca', 'bx', 0); B('n2', 'hn2', 0); B('bx', 'hn2', 1);
snap({ step: 3, type: 'substitution', focus: ['ow', 'ca', 'bx'], jars: ['c_ketone', 'a_br'], dur: 2.4, hold: 3.6,
  text: L('Substitution interne : l’oxygène attaque Cα et chasse le Br. Un petit cycle à trois (époxyde) relie C*, O et Cα ; HBr se détache (mécanisme proposé).',
    'استبدال داخلي: يهاجم الأكسجين Cα ويطرد ذرة Br. تتكوّن حلقة ثلاثية صغيرة (إيبوكسيد) تربط C* وO وCα، وينفصل HBr (آلية مقترحة).',
    'Internal substitution: the oxygen attacks Cα and pushes out Br. A small three-membered ring (epoxide) links C*, O and Cα; HBr breaks away (proposed mechanism).') });

P('ow', dir(CA, 85, 1)); P('n2', [1.732, 2, 0]); P('cm', [0.69, 2.6, 0]); P('hn1', add(dir(CA, 85, 1), [0.45, 0.6, 0]));
P('bx', [5.6, 3.7, 1.5]); P('hn2', [4.7, 4.0, 1.5]);
B('cs', 'ow', 0); B('cs', 'n2', 2); B('n2', 'hn1', 0); B('ow', 'hn1', 1);
hide('bx', 'hn2');
snap({ step: 3, type: 'rearrangement', focus: ['ow', 'n2', 'hn1'], jars: ['c_imine', 'a_oh'], dur: 2.4, hold: 3.4,
  text: L('Le petit cycle s’ouvre : la liaison C*–O se rompt, C*=N–CH₃ se forme (imine) et l’oxygène reste sur Cα sous forme de OH. HBr est parti.',
    'تنفتح الحلقة الصغيرة: تنكسر الرابطة C*–O وتتكوّن C*=N–CH₃ (إيمين)، ويبقى الأكسجين على Cα على شكل OH. وقد غادر HBr.',
    'The small ring opens: the C*–O bond breaks, C*=N–CH₃ forms (an imine) and the oxygen stays on Cα as OH. HBr has left.') });

snap({ step: 3, type: 'product', focus: [], jars: ['c_imine', 'a_oh'], dur: 0.6,
  text: L('Résultat : l’α-hydroxy-imine, C₁₃H₁₆ClNO. Au total, seul HBr a été perdu dans cette étape.',
    'النتيجة: ألفا-هيدروكسي إيمين، C₁₃H₁₆ClNO. في هذه الخطوة لم يُفقد سوى HBr.',
    'Result: the α-hydroxy imine, C₁₃H₁₆ClNO. Overall, only HBr was lost in this step.') });

// ================= step 4: heat → ring expansion =================
snap({ step: 4, type: 'approach', focus: ['ca', 'r2', 'cs'], hlBond: ['ca', 'r2'], jars: ['c_imine', 'a_oh'], dur: 0.6, hold: 3.4,
  text: L('Chauffage : regardez la liaison Cα–C du cycle qui clignote. C’est elle qui va changer de place.',
    'التسخين: انظر إلى رابطة Cα–C في الحلقة التي تومض. هي التي ستنتقل.',
    'Heat: watch the flashing ring bond Cα–C. This is the bond that will move.') });

P('ca', [2.232, 1.866, 0]); P('r2', [2.232, 0.134, 0]); P('r3', [3.232, 0.134, 0]); P('r4', [3.732, 1, 0]); P('r5', [3.232, 1.866, 0]);
P('ow', [1.732, 2.732, 0]); P('n2', [1.025, 1.707, 0.5]); P('cm', [-0.1, 2.35, 0.5]); P('hn1', [1.175, 2.43, 0.95]);
B('ca', 'r2', 0); B('cs', 'r2', 1); B('ca', 'ow', 2); B('ow', 'hn1', 0); B('n2', 'hn1', 1); B('cs', 'n2', 1);
snap({ step: 4, type: 'rearrangement', tags: { ca: 40 }, focus: ['cs', 'ca', 'r2'], jars: ['c_ring', 'a_co'], dur: 3.2, hold: 3.8,
  text: L('Réarrangement : la liaison C–C quitte Cα et se fixe sur C*. C* entre dans le cycle, qui passe de 5 à 6 atomes. O–H devient C=O, et le H passe sur l’azote (NH).',
    'إعادة ترتيب: تترك الرابطة C–C ذرة Cα وترتبط بـ C*. يدخل C* الحلقة فتصبح 6 ذرات بدل 5. تصبح O–H مجموعة C=O، وتنتقل ذرة H إلى النيتروجين (NH).',
    'Rearrangement: the C–C bond leaves Cα and attaches to C*. C* joins the ring, which grows from 5 to 6 atoms. O–H becomes C=O, and the H moves to nitrogen (NH).') });

snap({ step: 4, type: 'product', tags: { ca: 40 }, focus: [], jars: ['c_ring', 'a_co'], dur: 0.6, hold: 4,
  text: L('Résultat : la kétamine, avec la même formule C₁₃H₁₆ClNO. Rien n’a été ajouté ni retiré : les mêmes atomes, liés autrement.',
    'النتيجة: الكيتامين، بالصيغة نفسها C₁₃H₁₆ClNO. لم يُضَف شيء ولم يُحذف شيء: الذرات نفسها مرتبطة بطريقة مختلفة.',
    'Result: ketamine, with the same formula C₁₃H₁₆ClNO. Nothing was added or removed: the same atoms, bonded differently.') });

export default {
  atoms, keys,
  center: [2.6, 1.7],
  origin: [-15, 8.5, -1],
  scale: 2.1,
  view: { pos: [-13.5, 15, 27], look: [-14.6, 8.6, -1] },
  halfWidth: 12.5,   // half the width of the widest frame, in world units, so the camera can fit it
};
