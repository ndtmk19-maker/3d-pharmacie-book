// The default jars: the eight energy stores, in the book's order and colours.
// A lesson about something other than energy passes its own `jars` list with the same shape.
export const ENERGY_STORES = [
  { id: 'kinetic', name: 'kinetic', color: '#2f7bff' },
  { id: 'gravitational', name: 'gravitational', color: '#8a4dff' },
  { id: 'elastic', name: 'elastic', color: '#ff3fb4' },
  { id: 'thermal', name: 'thermal', color: '#ff7a1c' },
  { id: 'chemical', name: 'chemical', color: '#26c75a' },
  { id: 'magnetic', name: 'magnetic', color: '#e8233a' },
  { id: 'electrostatic', name: 'electrostatic', color: '#18c4dc' },
  { id: 'nuclear', name: 'nuclear', color: '#ffcf1a' },
];

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

// 875 -> "875 J", 63000 -> "63,000 J", 3.8e26 -> "3.8 × 10²⁶ J"
export function fmt(value, unit = 'J', sig = 3) {
  if (value == null) return 'no number';
  if (value !== 0 && (Math.abs(value) >= 1e7 || Math.abs(value) < 1e-3)) {
    const [m, e] = value.toExponential(sig - 1).split('e');
    return `${Number(m)} × 10${String(Number(e)).replace(/./g, (c) => SUP[c])} ${unit}`;
  }
  return `${Number(value.toPrecision(sig)).toLocaleString('en-GB')} ${unit}`;
}
