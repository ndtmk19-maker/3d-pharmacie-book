// Every joule is accounted for: sims move energy between accounts, and the jars and flows read only this.
export class Ledger {
  constructor(accounts) {
    this.J = Object.fromEntries(accounts.map((a) => [a, 0]));
    this._w = new Map();
  }
  set(account, J) { this.J[account] = J; }
  beginStep() { this._w.clear(); }
  move(from, to, J, dt) {
    if (!J) return;
    this.J[from] -= J;
    this.J[to] += J;
    const k = `${from}>${to}`;
    this._w.set(k, (this._w.get(k) ?? 0) + J / dt);
  }
  // [{ from, to, watts }] for the step just taken
  flows() { return [...this._w].map(([k, watts]) => { const [from, to] = k.split('>'); return { from, to, watts }; }); }
  total() { return Object.values(this.J).reduce((a, b) => a + b, 0); }
}
