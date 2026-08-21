import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const game = fs.readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const kids = fs.readFileSync(new URL('../kids.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

new Function(game);
new Function(kids);
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

// ---------- Scroll submit state-machine regressions ----------
function makeSubmitApi(overrides = {}) {
  let stopCount = 0;
  let nextCount = 0;
  let endCount = 0;
  let timeoutCount = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let challengeEndCount = 0;
  let feedback = '';

  const elements = {
    '#box1': { value: overrides.box1 ?? '' },
    '#box2': { value: overrides.box2 ?? '' },
    '#remSlot': { hidden: overrides.remHidden ?? true },
  };
  const state = {
    locked: overrides.locked ?? false,
    mode: overrides.mode ?? 'scroll',
    question: overrides.question ?? { answer: 5 },
    scroll: overrides.scroll ?? {
      kind: 'test', qDeadline: Date.now() + 60_000, awaitSkip: false, qIndex: 0,
    },
    adv: { qIndex: 0 },
  };

  const source = `
const state = globalThis.input.state;
const $ = (selector) => globalThis.input.elements[selector];
const scrollRunTotal = () => 8;
const clearNextTimer = () => {};
const nextQuestion = () => { globalThis.counts.next += 1; };
const endScrollRun = () => { globalThis.counts.end += 1; };
const stopScrollQTimer = () => { globalThis.counts.stop += 1; };
const onScrollTimeout = () => { globalThis.counts.timeout += 1; };
const endChallenge = () => { globalThis.counts.challengeEnd += 1; };
const showFeedback = (msg) => { globalThis.counts.feedback = msg; };
const focusBox = () => {};
const onCorrect = () => { globalThis.counts.correct += 1; };
const onWrong = () => { globalThis.counts.wrong += 1; };
${extractFunction(game, 'submitAnswer')}
globalThis.api = { submitAnswer };
`;
  const context = {
    input: { state, elements },
    counts: {
      stop: stopCount, next: nextCount, end: endCount, timeout: timeoutCount,
      correct: correctCount, wrong: wrongCount, challengeEnd: challengeEndCount,
      feedback,
    },
    Date,
    parseInt,
  };
  vm.runInNewContext(source, context);
  return context;
}

{
  const ctx = makeSubmitApi({ box1: '' });
  ctx.api.submitAnswer();
  assert.equal(ctx.counts.stop, 0, 'blank answer must not stop the scroll timer');
  assert.match(ctx.counts.feedback, /先写答案/);
}

{
  const ctx = makeSubmitApi({
    locked: true,
    scroll: { kind: 'test', qDeadline: 0, awaitSkip: true, qIndex: 8 },
  });
  ctx.api.submitAnswer();
  assert.equal(ctx.counts.next, 0, 'last-question skip must not create a ninth question');
  assert.equal(ctx.counts.end, 1, 'last-question skip should settle immediately');
}

{
  const ctx = makeSubmitApi({
    box1: '5',
    scroll: { kind: 'test', qDeadline: Date.now() - 1, awaitSkip: false, qIndex: 0 },
  });
  ctx.api.submitAnswer();
  assert.equal(ctx.counts.timeout, 1, 'an answer after the deadline must time out');
  assert.equal(ctx.counts.correct, 0);
  assert.equal(ctx.counts.wrong, 0);
}

// ---------- Near-hundred addition explanation ----------
{
  const source = `
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
${extractFunction(game, 'genScrollNear100')}
globalThis.gen = genScrollNear100;
`;
  const ctx = {};
  vm.runInNewContext(source, ctx);
  let sawBelow = false;
  let sawAbove = false;
  for (let i = 0; i < 5000; i += 1) {
    const q = ctx.gen();
    if (!q.text.includes(' + ')) continue;
    const [a, b] = q.text.split(' + ').map(Number);
    const base = Math.round(a / 100) * 100;
    const d = Math.abs(a - base);
    const last = q.hint.at(-1);
    const match = /^(多算了|少算了) (\d+)，(减去|补上)：(\d+) ([+−]) (\d+) = (\d+)$/.exec(last);
    assert.ok(match, last);
    const [, label, shownD, action, midText, op, operandText, answerText] = match;
    const mid = Number(midText);
    const operand = Number(operandText);
    const shownAnswer = Number(answerText);
    assert.equal(Number(shownD), d);
    assert.equal(operand, d);
    assert.equal(shownAnswer, q.answer);
    assert.equal(q.answer, a + b);
    if (a < base) {
      sawBelow = true;
      assert.equal(label, '多算了');
      assert.equal(action, '减去');
      assert.equal(op, '−');
      assert.equal(mid - operand, shownAnswer);
    } else {
      sawAbove = true;
      assert.equal(label, '少算了');
      assert.equal(action, '补上');
      assert.equal(op, '+');
      assert.equal(mid + operand, shownAnswer);
    }
  }
  assert.ok(sawBelow && sawAbove, 'both compensation directions should be generated');
}

// ---------- Feed interaction cannot be bypassed ----------
{
  const source = `
const state = globalThis.input.state;
const speak = (msg) => { globalThis.counts.spoken = msg; };
const acceptAnswer = () => { globalThis.counts.accept += 1; };
const rejectAnswer = () => { globalThis.counts.reject += 1; };
${extractFunction(kids, 'chooseNumber')}
globalThis.api = { chooseNumber };
`;
  const ctx = {
    input: { state: { locked: false, question: { type: 'feed', feedComplete: false, answer: 2 } } },
    counts: { spoken: '', accept: 0, reject: 0 },
  };
  vm.runInNewContext(source, ctx);
  ctx.api.chooseNumber({}, 2);
  assert.equal(ctx.counts.accept, 0);
  assert.equal(ctx.counts.reject, 0);
  assert.match(ctx.counts.spoken, /先喂饱/);
  ctx.input.state.question.feedComplete = true;
  ctx.api.chooseNumber({}, 2);
  assert.equal(ctx.counts.accept, 1);
}
assert.match(kids, /setNumberChoicesEnabled\(q\.type !== 'feed' \|\| q\.feedComplete\)/);
assert.match(kids, /q\.feedComplete = true;\s*setNumberChoicesEnabled\(true\)/);

// ---------- Cache cleanup is namespaced ----------
assert.match(sw, /const CACHE_PREFIX = 'sxd-'/);
assert.match(sw, /const CACHE = 'sxd-v14'/);
assert.match(sw, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE/);
assert.doesNotMatch(sw, /keys\.filter\(\(key\) => key !== CACHE\)/);

console.log('review-regressions.test.mjs: all checks passed');
