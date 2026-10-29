/* Dulidan Web · calc.js – sicherer Rechen-Parser (kein eval) + Rechner-Panel
   Kann: + − × ÷ % ^ ( ), Komma oder Punkt, √ sqrt, sin cos tan (Grad), log ln, π pi, e */

const FUN = {
  sqrt: Math.sqrt, '√': Math.sqrt, ln: Math.log, log: Math.log10, abs: Math.abs,
  sin: x => Math.sin(x * Math.PI / 180), cos: x => Math.cos(x * Math.PI / 180), tan: x => Math.tan(x * Math.PI / 180)
};

function tokenize(src) {
  const s = src.replace(/\s+/g, '').replace(/×|x(?=[\d(])/g, '*').replace(/÷|:/g, '/').replace(/−/g, '-').replace(/,/g, '.');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const num = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (/[\d.]/.test(c) && num) { out.push({ t: 'n', v: parseFloat(num[0]) }); i += num[0].length; continue; }
    const word = /^(sqrt|sin|cos|tan|log|ln|abs|pi|π|e|√)/i.exec(s.slice(i));
    if (word) {
      const w = word[0].toLowerCase();
      if (w === 'pi' || w === 'π') out.push({ t: 'n', v: Math.PI });
      else if (w === 'e') out.push({ t: 'n', v: Math.E });
      else out.push({ t: 'f', v: w });
      i += word[0].length; continue;
    }
    if ('+-*/%^()!'.includes(c)) { out.push({ t: 'o', v: c }); i++; continue; }
    throw new Error('Zeichen ' + c);
  }
  return out;
}

/* Rekursiver Abstieg: Summe → Produkt → Vorzeichen → Potenz → Fakultät → Faktor (−3^2 = −9) */
export function evaluate(src) {
  const tk = tokenize(src);
  let p = 0;
  const peek = () => tk[p], take = () => tk[p++];
  const isOp = v => peek() && peek().t === 'o' && peek().v === v;
  function sum() {
    let v = prod();
    while (isOp('+') || isOp('-')) v = take().v === '+' ? v + prod() : v - prod();
    return v;
  }
  function prod() {
    let v = unary();
    for (;;) {
      if (isOp('*')) { take(); v *= unary(); }
      else if (isOp('/')) { take(); v /= unary(); }
      else if (isOp('%')) { take(); v = peek() && (peek().t === 'n' || peek().t === 'f' || isOp('(')) ? v % unary() : v / 100; }
      else if (peek() && (peek().t === 'n' || peek().t === 'f' || isOp('('))) v *= pow();   /* 2π, 3(4+1) */
      else return v;
    }
  }
  function unary() { if (isOp('-')) { take(); return -unary(); } if (isOp('+')) { take(); return unary(); } return pow(); }
  function pow() { const b = post(); return isOp('^') ? (take(), Math.pow(b, unary())) : b; }
  function post() {
    let v = atom();
    while (isOp('!')) { take(); if (v < 0 || v > 170 || v % 1) throw new Error('!'); let f = 1; for (let i = 2; i <= v; i++) f *= i; v = f; }
    return v;
  }
  function atom() {
    const t = take();
    if (!t) throw new Error('Ende');
    if (t.t === 'n') return t.v;
    if (t.t === 'f') return FUN[t.v](isOp('(') ? atom() : unary());
    if (t.v === '(') { const v = sum(); if (isOp(')')) take(); return v; }
    throw new Error('Unerwartet ' + t.v);
  }
  const v = sum();
  if (p < tk.length) throw new Error('Rest');
  if (!isFinite(v)) throw new Error('Unendlich');
  return v;
}

/* Sieht der Text nach einer Rechnung aus? (mindestens ein Operator oder eine Funktion, nur Rechen-Zeichen) */
export function looksLikeMath(s) {
  const t = s.trim();
  return t.length > 1 && /^[\d\s.,+\-*/×÷:%^()!πe√]*(sqrt|sin|cos|tan|log|ln|abs|pi)?[\d\s.,+\-*/×÷:%^()!πe√a-z]*$/i.test(t)
    && /\d/.test(t) && /[+\-*/×÷:%^!√]|sqrt|sin|cos|tan|log|ln|pi|π/i.test(t.replace(/^-/, ''));
}

export function format(v) {
  if (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v !== 0)) return v.toExponential(6).replace('.', ',');
  return (+v.toPrecision(12)).toLocaleString('de-DE', { maximumFractionDigits: 10 });
}
export function tryCalc(s) { try { return looksLikeMath(s) ? evaluate(s) : null; } catch { return null; } }
