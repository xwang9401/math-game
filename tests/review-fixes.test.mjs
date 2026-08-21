import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const game = fs.readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Syntax checks without executing browser-only initialization.
new Function(game);
new Function(sw);

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

// Exercise the actual generator functions extracted from game.js.
const generatorSource = `
const CONFIG = { divExactRatio: 0.85 };
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
${extractFunction(game, 'genAdd')}
${extractFunction(game, 'genSub')}
${extractFunction(game, 'genMul')}
${extractFunction(game, 'genDiv')}
globalThis.generators = { genAdd, genSub, genMul, genDiv };
`;
const generatorContext = {};
vm.runInNewContext(generatorSource, generatorContext);
const { genAdd, genSub, genMul, genDiv } = generatorContext.generators;

for (const diff of ['basic', 'advanced']) {
  for (let i = 0; i < 4000; i += 1) {
    const add = genAdd(diff);
    const [addA, addB] = add.text.split(' + ').map(Number);
    assert.equal(add.answer, addA + addB);
    assert.ok(add.answer <= (diff === 'basic' ? 100 : 1000));

    const sub = genSub(diff);
    const [subA, subB] = sub.text.split(' − ').map(Number);
    assert.equal(sub.answer, subA - subB);
    assert.ok(sub.answer >= (diff === 'basic' ? 0 : 10));

    const mul = genMul(diff);
    const [mulA, mulB] = mul.text.split(' × ').map(Number);
    assert.equal(mul.answer, mulA * mulB);
    assert.ok(mulB >= 2 && mulB <= 9);

    const div = genDiv(diff);
    const [dividend, divisor] = div.text.split(' ÷ ').map(Number);
    assert.ok(dividend >= 10 && dividend <= 99);
    assert.ok(divisor >= 2 && divisor <= 9);
    assert.ok(div.remainder >= 0 && div.remainder < divisor);
    assert.equal(dividend, divisor * div.quotient + div.remainder);
  }
}

// Exercise the guarded delayed transition using the actual implementation.
const transitionSource = `
let nextCount = 0;
let loseReason = null;
const state = {
  mode: 'adventure', screen: 'game', nextTimer: null,
  adv: { runId: 1, qIndex: 8, cancelled: false, ending: false }
};
const advLevel = () => ({ count: 8 });
const nextQuestion = () => { nextCount += 1; };
const loseAdventure = (reason) => { loseReason = reason; };
${extractFunction(game, 'clearNextTimer')}
${extractFunction(game, 'scheduleNextQuestion')}
globalThis.transition = { state, scheduleNextQuestion, values: () => ({ nextCount, loseReason }) };
`;
const transitionContext = { setTimeout, clearTimeout };
vm.runInNewContext(transitionSource, transitionContext);
transitionContext.transition.scheduleNextQuestion(0);
await new Promise((resolve) => setTimeout(resolve, 10));
const exhausted = transitionContext.transition.values();
assert.equal(exhausted.nextCount, 0);
assert.equal(exhausted.loseReason, 'exhausted');

transitionContext.transition.state.adv.qIndex = 7;
transitionContext.transition.state.adv.ending = false;
transitionContext.transition.scheduleNextQuestion(0);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(transitionContext.transition.values().nextCount, 1);

transitionContext.transition.state.adv.cancelled = true;
transitionContext.transition.scheduleNextQuestion(0);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(transitionContext.transition.values().nextCount, 1);

// Structural regression guards for bugs that depend on browser event timing.
assert.match(game, /Date\.now\(\) >= state\.deadline/);
assert.match(game, /const TOTAL_LEVELS = LEVELS\.length/);
assert.match(game, /function cancelAdventureRun\(/);
assert.match(game, /state\.adv\.runId !== runId/);
assert.doesNotMatch(game, /e\.key === 'Tab' \|\|/);
assert.doesNotMatch(game, /soundOn: localStorage\.getItem/);
assert.match(html, /id="feedback" role="status" aria-live="polite"/);
assert.match(html, /id="soundBtn"[^>]+aria-pressed="true"/);
assert.match(sw, /const CACHE = 'sxd-v11'/);
assert.match(sw, /url\.origin !== self\.location\.origin \|\| !response\.ok/);
assert.match(sw, /await cacheSuccessfulSameOrigin/);

console.log('review-fixes.test.mjs: all checks passed');
