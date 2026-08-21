from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}\n--- old ---\n{old}")
    write(path, content.replace(old, new, 1))


# 1. Scroll test: pressing Enter/✓ after the last wrong answer must end the run,
# not cancel settlement and generate a ninth question.
replace_once(
    "game.js",
    """      if (state.mode === 'scroll' && state.scroll && state.scroll.awaitSkip) {
        state.scroll.awaitSkip = false;
        clearNextTimer();
        nextQuestion();
      }
""",
    """      if (state.mode === 'scroll' && state.scroll && state.scroll.awaitSkip) {
        state.scroll.awaitSkip = false;
        clearNextTimer();
        if (state.scroll.qIndex >= scrollRunTotal()) endScrollRun();
        else nextQuestion();
      }
""",
)

# 2. Scroll test: do not stop the per-question timer until input is valid, and
# reject answers submitted after the deadline even if the interval callback is late.
replace_once(
    "game.js",
    """    if (state.mode === 'scroll') stopScrollQTimer();
    if (state.mode === 'challenge' && Date.now() >= state.deadline) {
      endChallenge();
      return;
    }
    const q = state.question;
""",
    """    if (state.mode === 'challenge' && Date.now() >= state.deadline) {
      endChallenge();
      return;
    }
    if (state.mode === 'scroll' && state.scroll && state.scroll.kind === 'test'
      && Date.now() >= state.scroll.qDeadline) {
      stopScrollQTimer();
      onScrollTimeout();
      return;
    }
    const q = state.question;
""",
)
replace_once(
    "game.js",
    """    if (remVisible && !box2.value) {
      focusBox(2);
      showFeedback('还差余数哦，接着填～', 'hint');
      return;
    }

    const v1 = parseInt(box1.value, 10);
""",
    """    if (remVisible && !box2.value) {
      focusBox(2);
      showFeedback('还差余数哦，接着填～', 'hint');
      return;
    }

    if (state.mode === 'scroll') stopScrollQTimer();
    const v1 = parseInt(box1.value, 10);
""",
)

# 3. Correct the compensation direction in the near-hundred addition lesson.
replace_once(
    "game.js",
    """          (low ? '少算了 ' : '多算了 ') + d + '，' + (low ? '补上' : '减去')
            + '：' + mid + (low ? ' + ' : ' − ') + d + ' = ' + (a + b)],
""",
    """          (low ? '多算了 ' : '少算了 ') + d + '，' + (low ? '减去' : '补上')
            + '：' + mid + (low ? ' − ' : ' + ') + d + ' = ' + (a + b)],
""",
)

# 4. Feed questions: keep number choices disabled until the requested objects
# have actually been fed, with a defensive guard in chooseNumber as well.
replace_once(
    "kids.js",
    """  function buildNumberChoices(q) {
    const choices = $('#kChoices');
    choices.textContent = '';
    q.options.forEach((v) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bubble';
      b.textContent = String(v);
      b.addEventListener('click', () => chooseNumber(b, v));
      choices.appendChild(b);
    });
  }
""",
    """  function setNumberChoicesEnabled(enabled) {
    $$('#kChoices .bubble').forEach((button) => {
      button.disabled = !enabled;
      button.setAttribute('aria-disabled', String(!enabled));
    });
  }

  function buildNumberChoices(q) {
    const choices = $('#kChoices');
    choices.textContent = '';
    q.options.forEach((v) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bubble';
      b.textContent = String(v);
      b.addEventListener('click', () => chooseNumber(b, v));
      choices.appendChild(b);
    });
    setNumberChoicesEnabled(q.type !== 'feed' || q.feedComplete);
  }
""",
)
replace_once(
    "kids.js",
    """    const q = act.gen();
    state.question = q;
    state.locked = false;
""",
    """    const q = act.gen();
    q.feedComplete = q.type !== 'feed';
    state.question = q;
    state.locked = false;
""",
)
replace_once(
    "kids.js",
    """        if (fed === q.toEat) {
          appetite.classList.add('done');   // 喂饱后停止脉动提醒
          const seq = state.runSeq;
""",
    """        if (fed === q.toEat) {
          q.feedComplete = true;
          setNumberChoicesEnabled(true);
          appetite.classList.add('done');   // 喂饱后停止脉动提醒
          const seq = state.runSeq;
""",
)
replace_once(
    "kids.js",
    """  function chooseNumber(btn, value) {
    if (state.locked) return;
    if (value === state.question.answer) acceptAnswer(btn);
""",
    """  function chooseNumber(btn, value) {
    if (state.locked) return;
    if (state.question.type === 'feed' && !state.question.feedComplete) {
      speak('先喂饱小吃货哦');
      return;
    }
    if (value === state.question.answer) acceptAnswer(btn);
""",
)

# 5. Service Worker: only delete caches owned by this app.
replace_once(
    "sw.js",
    """const CACHE = 'sxd-v11';
""",
    """const CACHE_PREFIX = 'sxd-';
const CACHE = 'sxd-v12';
""",
)
replace_once(
    "sw.js",
    """    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
""",
    """    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map((key) => caches.delete(key)));
""",
)

# Keep existing structural tests aligned with the cache version.
for test_path in [
    "tests/review-fixes.test.mjs",
    "tests/scrolls.test.mjs",
    "tests/kids.test.mjs",
]:
    content = read(test_path)
    count = content.count("const CACHE = 'sxd-v11'")
    if count != 1:
        raise RuntimeError(f"{test_path}: expected one cache-version assertion, found {count}")
    write(test_path, content.replace("const CACHE = 'sxd-v11'", "const CACHE = 'sxd-v12'", 1))

# Dedicated behavioral regressions for the five review findings.
write(
    "tests/review-regressions.test.mjs",
    r"""import assert from 'node:assert/strict';
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
assert.match(sw, /const CACHE = 'sxd-v12'/);
assert.match(sw, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE/);
assert.doesNotMatch(sw, /keys\.filter\(\(key\) => key !== CACHE\)/);

console.log('review-regressions.test.mjs: all checks passed');
""",
)

# Document the additional regression command.
replace_once(
    "README.md",
    """node tests/review-fixes.test.mjs
node tests/scrolls.test.mjs
node tests/kids.test.mjs
""",
    """node tests/review-fixes.test.mjs
node tests/scrolls.test.mjs
node tests/kids.test.mjs
node tests/review-regressions.test.mjs
""",
)

print("Applied all code-review fixes and regression coverage.")
