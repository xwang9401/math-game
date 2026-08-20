import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const kids = fs.readFileSync(new URL('../kids.js', import.meta.url), 'utf8');
const game = fs.readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const kidsHtml = fs.readFileSync(new URL('../kids.html', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

new Function(kids);   // 语法检查
new Function(game);

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

function extractConstArray(source, name) {
  const marker = `const ${name} = [`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const open = source.indexOf('[', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1) + ';';
    }
  }
  throw new Error(`unterminated ${name}`);
}

// 在 vm 中运行 kids.js 里真实的出题器 / 活动清单 / 存档校验
const GEN_NAMES = ['genCount', 'genNumber', 'genMore', 'genAdd5', 'genSub5', 'genMix10'];
const apiSource = `
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const EMOJIS = ['🍎', '🍓', '🐥', '🦋', '⭐', '🌸', '🐞', '🐟', '🍇', '🎈'];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
${GEN_NAMES.map((n) => extractFunction(kids, n)).join('\n')}
${extractFunction(kids, 'numOptions')}
${extractConstArray(kids, 'ACTS')}
${extractFunction(kids, 'normalizeKidsStars')}
globalThis.API = { ACTS, normalizeKidsStars, numOptions, ${GEN_NAMES.join(', ')} };
`;
const ctx = {};
vm.runInNewContext(apiSource, ctx);
const { ACTS, normalizeKidsStars, numOptions } = ctx.API;

const eq = (actual, expected, msg) =>
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);

// ---------- 活动清单结构 ----------
assert.equal(ACTS.length, 6);
const ids = new Set();
for (const act of ACTS) {
  assert.ok(act.id && !ids.has(act.id));
  ids.add(act.id);
  assert.ok(typeof act.name === 'string' && act.name.length >= 2 && act.name.length <= 6, act.id);
  assert.ok(typeof act.tip === 'string' && act.tip.length >= 3, act.id + ' tip');
  assert.equal(typeof act.gen, 'function', act.id + ' gen');
}

// ---------- 选项生成 ----------
for (let i = 0; i < 2000; i += 1) {
  const answer = Math.floor(Math.random() * 13);
  const opts = numOptions(answer, 0, 12);
  assert.equal(opts.length, 3, `answer=${answer}`);
  assert.equal(new Set(opts).size, 3, `answer=${answer}`);
  assert.ok(opts.includes(answer), `answer=${answer}`);
  opts.forEach((v) => assert.ok(v >= 0 && v <= 12, `answer=${answer}`));
}
// 极端值也能凑满 3 个选项
for (const answer of [0, 1, 11, 12]) {
  const opts = numOptions(answer, 0, 12);
  assert.equal(opts.length, 3);
  assert.ok(opts.includes(answer));
}

const ROUNDS = 3000;
const assertQuestionBase = (q) => {
  assert.ok(typeof q.prompt === 'string' && q.prompt.length >= 3, 'prompt');
  assert.ok(typeof q.speech === 'string' && q.speech.length >= 2, 'speech');
  assert.ok(typeof q.emoji === 'string' && q.emoji.length >= 1, 'emoji');
};

// ---------- 1. 数一数 ----------
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genCount();
  assertQuestionBase(q);
  assert.equal(q.type, 'objects');
  assert.equal(q.tapCount, true);
  assert.equal(q.groups.length, 1);
  const n = q.groups[0].count;
  assert.ok(n >= 3 && n <= 10, 'count range');
  assert.equal(q.answer, n);
  assert.equal(q.options.length, 3);
  assert.ok(q.options.includes(n));
}

// ---------- 2. 认数字（双向） ----------
{
  let sawObjects = false;
  let sawGroupPick = false;
  for (let i = 0; i < ROUNDS; i += 1) {
    const q = ctx.API.genNumber();
    assertQuestionBase(q);
    if (q.type === 'objects') {
      sawObjects = true;
      const n = q.groups[0].count;
      assert.ok(n >= 1 && n <= 10, 'number range');
      assert.equal(q.answer, n);
      assert.ok(q.options.includes(n));
    } else {
      sawGroupPick = true;
      assert.equal(q.type, 'groupPick');
      assert.ok(q.digit >= 1 && q.digit <= 9, 'digit range');
      assert.equal(q.groups.length, 3, 'three groups');
      const counts = q.groups.map((g) => g.count);
      assert.equal(new Set(counts).size, 3, 'groups distinct');
      counts.forEach((c) => assert.ok(c >= 1 && c <= 10, 'group count range'));
      assert.equal(counts[q.answer], q.digit, 'answer points to matching group');
    }
  }
  assert.ok(sawObjects && sawGroupPick, '认数字两个方向都应出现');
}

// ---------- 3. 比多少 ----------
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genMore();
  assertQuestionBase(q);
  assert.equal(q.type, 'compare');
  assert.equal(q.groups.length, 2);
  const [l, r] = q.groups.map((g) => g.count);
  assert.ok(l >= 1 && l <= 9 && r >= 1 && r <= 9, 'compare range');
  assert.notEqual(l, r, 'two sides must differ');
  assert.equal(q.answer, l > r ? 0 : 1, 'answer points to bigger side');
}

// ---------- 4. 5 以内加法 ----------
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genAdd5();
  assertQuestionBase(q);
  assert.equal(q.type, 'objects');
  assert.equal(q.plus, true);
  const [a, b] = q.groups.map((g) => g.count);
  assert.ok(a >= 1 && b >= 1, 'add5 operands >= 1');
  assert.ok(a + b <= 5, 'add5 sum <= 5');
  assert.equal(q.answer, a + b);
  assert.ok(q.options.includes(a + b));
}

// ---------- 5. 5 以内减法 ----------
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genSub5();
  assertQuestionBase(q);
  assert.equal(q.type, 'objects');
  const total = q.groups[0].count;
  const eaten = q.groups[0].eaten;
  assert.ok(total >= 2 && total <= 5, 'sub5 total range');
  assert.ok(eaten >= 1 && eaten <= total, 'sub5 eaten range');
  assert.equal(q.answer, total - eaten);
  assert.ok(q.answer >= 0, 'sub5 answer >= 0');
  assert.ok(q.options.includes(total - eaten));
}

// ---------- 6. 10 以内混合 ----------
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genMix10();
  assertQuestionBase(q);
  assert.equal(q.type, 'objects');
  if (q.plus) {
    const [a, b] = q.groups.map((g) => g.count);
    assert.ok(a >= 2 && b >= 1, 'mix10 add operands');
    assert.ok(a + b <= 10, 'mix10 sum <= 10');
    assert.equal(q.answer, a + b);
  } else {
    const total = q.groups[0].count;
    const eaten = q.groups[0].eaten;
    assert.ok(total >= 5 && total <= 10, 'mix10 sub total range');
    assert.ok(eaten >= 1 && eaten <= total - 1, 'mix10 eaten range');
    assert.equal(q.answer, total - eaten);
    assert.ok(q.answer >= 1, 'mix10 sub answer >= 1');
  }
  assert.ok(q.options.includes(q.answer));
}

// ---------- 存档校验（防篡改：必须从头连续玩过） ----------
eq(normalizeKidsStars(null), {});
eq(normalizeKidsStars('x'), {});
eq(normalizeKidsStars([]), {});
eq(normalizeKidsStars({ count: 1 }), { count: 1 });
eq(normalizeKidsStars({ count: 3, number: 2 }), { count: 3, number: 2 });
eq(normalizeKidsStars({ number: 2 }), {});                       // 跳过第一个活动
eq(normalizeKidsStars({ count: 1, more: 3 }), { count: 1 });      // 中间断档
eq(normalizeKidsStars({ unknown: 3, count: 1 }), { count: 1 });   // 未知 id 丢弃
eq(normalizeKidsStars({ count: 0 }), {});
eq(normalizeKidsStars({ count: 4 }), {});
eq(normalizeKidsStars({ count: 2.6 }), { count: 2 });
eq(normalizeKidsStars({ count: '3', number: '1' }), { count: 3, number: 1 });

// ---------- 结构性守卫 ----------
// 主应用未被改动混入幼儿逻辑（两个应用保持独立）
assert.doesNotMatch(game, /ACTS|normalizeKidsStars/);
// SW 收录幼儿版资源并升级版本
assert.match(sw, /const CACHE = 'sxd-v7'/);
assert.match(sw, /'\.\/kids\.html'/);
assert.match(sw, /'\.\/kids\.js'/);
assert.match(sw, /'\.\/manifest-kids\.json'/);
// 双向互链与独立 PWA 身份
assert.match(indexHtml, /href="kids\.html"/);
assert.match(kidsHtml, /manifest-kids\.json/);
assert.match(kidsHtml, /src="kids\.js"/);
assert.match(kidsHtml, /href="\.\/index\.html"/);
assert.match(kids, /register\('sw\.js'\)/);
// 语音读题与零压力设计标记
assert.match(kids, /function speak\(/);
assert.match(kids, /speechSynthesis/);
assert.doesNotMatch(kids, /setInterval/);          // 没有任何倒计时/计时器
assert.match(kids, /'sxd_kids_stars'/);

console.log('kids.test.mjs: all checks passed');
