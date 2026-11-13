import { evaluate, looksLikeMath, format, tryCalc } from '../../shared/calc.js';
const cases = [['12*3+4', 40], ['2^10', 1024], ['(1+2)*3', 9], ['10/4', 2.5], ['-3^2', -9], ['sqrt(16)+1', 5], ['√9', 3], ['50%', 0.5], ['200*15%', 30], ['7%3', 1], ['2π', 2 * Math.PI], ['sin(30)', 0.5], ['5!', 120], ['3,5+1,5', 5], ['2(3+4)', 14], ['log(1000)', 3], ['12÷4×3', 9], ['1e3+1', 1001], ['2^-1', 0.5], ['-(2+3)*2', -10], ['2^3^2', 512]];
let bad = 0;
for (const [e, want] of cases) { const got = evaluate(e); const ok = Math.abs(got - want) < 1e-9; if (!ok) bad++; console.log(ok ? 'ok ' : 'XX ', e, '=', got); }
for (const s of ['hallo welt', 'youtube.com', '2024', 'iphone 15', '12*3', 'pi*2', '3+', 'gh electron']) console.log('math?', JSON.stringify(s), looksLikeMath(s), tryCalc(s));
console.log(format(1234567.891), format(1 / 3), format(1e20));
console.log(bad ? bad + ' FEHLER' : 'alle richtig');
