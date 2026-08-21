import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const game = fs.readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

new Function(game);   // 语法检查
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

const GEN_NAMES = ['genScrollTen', 'genScrollSubProp', 'genScrollNear100', 'genScrollFold',
  'genScrollDistr', 'genScrollEleven', 'genScrollHeadTen', 'genScrollGauss'];

// 在 vm 中运行 game.js 里真实的出题器 / 秘籍清单 / 存档校验
const apiSource = `
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
${GEN_NAMES.map((n) => extractFunction(game, n)).join('\n')}
${extractConstArray(game, 'SCROLLS')}
${extractFunction(game, 'normalizeScrollStars')}
globalThis.API = { SCROLLS, normalizeScrollStars, ${GEN_NAMES.join(', ')} };
`;
const ctx = {};
vm.runInNewContext(apiSource, ctx);
const { SCROLLS, normalizeScrollStars } = ctx.API;

const eq = (actual, expected, msg) =>
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);

// ---------- 秘籍清单结构 ----------
assert.equal(SCROLLS.length, 8);
const ids = new Set();
for (const sc of SCROLLS) {
  assert.ok(sc.id && !ids.has(sc.id), `dup/missing id on ${sc.name}`);
  ids.add(sc.id);
  assert.ok(typeof sc.name === 'string' && sc.name.length >= 2 && sc.name.length <= 12, sc.name);
  assert.ok(typeof sc.mantra === 'string' && sc.mantra.length >= 6 && sc.mantra.length <= 20, sc.id + ' mantra');
  assert.ok(['入门', '进阶', '高手'].includes(sc.tier), sc.id + ' tier');
  assert.ok(sc.demos.length >= 1 && sc.demos.length <= 2, sc.id + ' demos');
  for (const demo of sc.demos) {
    assert.ok(demo.q.length >= 3, sc.id + ' demo q');
    assert.ok(demo.steps.length >= 2, sc.id + ' demo steps');
    for (const step of demo.steps) {
      assert.equal(step.length, 2, sc.id + ' step pair');
      assert.ok(step[0].length >= 2 && step[1].length >= 1, sc.id + ' step content');
    }
  }
  assert.equal(typeof sc.gen, 'function', sc.id + ' gen');
}

// ---------- 出题器不变量（题目必须真的符合技巧特征） ----------
const ROUNDS = 3000;
const numsOf = (text) => text.split(' ').filter((t) => /^\d+$/.test(t)).map(Number);
const opsOf = (text) => text.split(' ').filter((t) => /^[+−×÷]$/.test(t));
const assertHint = (q) => {
  assert.ok(Array.isArray(q.hint) && q.hint.length >= 2, q.text + ' hint');
  q.hint.forEach((line) => assert.ok(typeof line === 'string' && line.length >= 3, q.text + ' hint line'));
};

// 1. 凑十与凑整
{
  let sawPlain = false;
  let sawTriple = false;
  for (let i = 0; i < ROUNDS; i += 1) {
    const q = ctx.API.genScrollTen();
    assertHint(q);
    const nums = numsOf(q.text);
    const ops = opsOf(q.text);
    if (ops.length === 1) {
      sawPlain = true;
      const [a, b] = nums;
      assert.equal(ops[0], '+');
      assert.ok(a >= 5 && a <= 9 && b >= 6 && b <= 9, q.text);
      assert.ok(a + b >= 11, q.text);            // 一定进位，凑十才有意义
      assert.equal(q.answer, a + b);
    } else {
      sawTriple = true;
      assert.equal(ops.join(''), '++');
      const [a, b, c] = nums;
      assert.equal(a + c, 100, q.text);          // 首尾凑整
      [a, b, c].forEach((n) => assert.ok(n >= 11 && n <= 89, q.text));
      assert.equal(q.answer, 100 + b);
    }
  }
  assert.ok(sawPlain && sawTriple, '凑十法与连加凑整两种题型都应出现');
}

// 2. 减法性质
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genScrollSubProp();
  assertHint(q);
  assert.equal(opsOf(q.text).join(''), '−−');
  const [a, b, c] = numsOf(q.text);
  assert.equal(b + c, 100, q.text);
  assert.ok(b >= 21 && b <= 79 && c >= 21 && c <= 79, q.text);
  assert.ok(a >= 150 && a <= 699, q.text);
  assert.equal(q.answer, a - 100);
  assert.equal(q.answer, a - b - c);
}

// 3. 接近整百
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genScrollNear100();
  assertHint(q);
  assert.ok(q.hint.length >= 3, q.text);
  const ops = opsOf(q.text);
  const [a, b] = numsOf(q.text);
  assert.equal(ops.length, 1);
  if (ops[0] === '+') {
    const near = Math.abs(a - Math.round(a / 100) * 100);
    assert.ok(near >= 1 && near <= 3, q.text);   // 第一个数接近整百但不等于整百
    assert.ok(b >= 21 && b <= 499, q.text);
    assert.equal(q.answer, a + b);
  } else {
    assert.equal(ops[0], '−');
    const near = Math.abs(b - Math.round(b / 100) * 100);
    assert.ok(near >= 1 && near <= 3, q.text);   // 减数接近整百
    assert.ok(a - b >= 10, q.text);
    assert.equal(q.answer, a - b);
  }
}

// 4. ×5 与 ×25
{
  let saw5 = false;
  let saw25 = false;
  for (let i = 0; i < ROUNDS; i += 1) {
    const q = ctx.API.genScrollFold();
    assertHint(q);
    const [a, m] = numsOf(q.text);
    assert.equal(opsOf(q.text)[0], '×');
    if (m === 5) {
      saw5 = true;
      assert.equal(a % 2, 0, q.text);            // 偶数才能"折半"
      assert.ok(a >= 12 && a <= 98, q.text);
      assert.equal(q.answer, a * 5);
    } else {
      saw25 = true;
      assert.equal(m, 25);
      assert.equal(a % 4, 0, q.text);            // 4 的倍数才能"除四"
      assert.ok(a >= 12 && a <= 96, q.text);
      assert.equal(q.answer, a * 25);
    }
  }
  assert.ok(saw5 && saw25);
}

// 5. ×99 与 ×101
{
  let saw99 = false;
  let saw101 = false;
  for (let i = 0; i < ROUNDS; i += 1) {
    const q = ctx.API.genScrollDistr();
    assertHint(q);
    const [a, m] = numsOf(q.text);
    assert.equal(opsOf(q.text)[0], '×');
    assert.ok(a >= 13 && a <= 89, q.text);
    if (m === 99) saw99 = true;
    else if (m === 101) saw101 = true;
    else assert.fail('unexpected multiplier ' + m);
    assert.equal(q.answer, a * m);
  }
  assert.ok(saw99 && saw101);
}

// 6. ×11 秘技（进位与不进位都要出现）
{
  let sawCarry = false;
  let sawNoCarry = false;
  for (let i = 0; i < ROUNDS; i += 1) {
    const q = ctx.API.genScrollEleven();
    assertHint(q);
    const [a, m] = numsOf(q.text);
    assert.equal(m, 11, q.text);
    assert.ok(a >= 10 && a <= 99, q.text);
    assert.equal(q.answer, a * 11);
    const s = Math.floor(a / 10) + (a % 10);
    if (s >= 10) sawCarry = true; else sawNoCarry = true;
    // 口诀结果必须写进提示
    assert.ok(q.hint.join('\n').includes(String(s)), q.text + ' hint missing digit sum');
  }
  assert.ok(sawCarry && sawNoCarry);
}

// 7. 头同尾合十
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genScrollHeadTen();
  assertHint(q);
  assert.equal(opsOf(q.text)[0], '×');
  const [a, b] = numsOf(q.text);
  assert.equal(Math.floor(a / 10), Math.floor(b / 10), q.text);   // 头同
  assert.equal((a % 10) + (b % 10), 10, q.text);                  // 尾合十
  assert.ok(a % 10 >= 1 && b % 10 >= 1, q.text);
  assert.equal(q.answer, a * b);
  const x = Math.floor(a / 10);
  const y = a % 10;
  assert.equal(q.answer, x * (x + 1) * 100 + y * (10 - y));
}

// 8. 高斯求和（答案 = 区间真实总和，且必须用省略号展示）
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genScrollGauss();
  assertHint(q);
  assert.ok(q.text.includes('…'), q.text);
  const nums = numsOf(q.text);
  const first = nums[0];
  const last = nums[nums.length - 1];
  assert.equal(nums[1], first + 1, q.text);
  assert.equal(nums[2], first + 2, q.text);     // 展示前三项
  const n = last - first + 1;
  assert.ok(n >= 5, q.text);
  let sum = 0;
  for (let v = first; v <= last; v += 1) sum += v;
  assert.equal(q.answer, sum, q.text);
  assert.equal(q.answer, ((first + last) * n) / 2, q.text);
}

// ---------- 存档校验（防篡改：必须从头连续学会） ----------
eq(normalizeScrollStars(null), {});
eq(normalizeScrollStars('x'), {});
eq(normalizeScrollStars([]), {});
eq(normalizeScrollStars({}), {});
eq(normalizeScrollStars({ ten: 1 }), { ten: 1 });
eq(normalizeScrollStars({ ten: 3, subprop: 2 }), { ten: 3, subprop: 2 });
eq(normalizeScrollStars({ ten: 1, subprop: 1, near100: 3 }), { ten: 1, subprop: 1, near100: 3 });
eq(normalizeScrollStars({ subprop: 2 }), {});                    // 跳学第一张
eq(normalizeScrollStars({ ten: 1, near100: 3 }), { ten: 1 });     // 中间断档，后面不采用
eq(normalizeScrollStars({ unknown: 3, ten: 1 }), { ten: 1 });     // 未知 id 丢弃
eq(normalizeScrollStars({ ten: 0 }), {});                        // 0 星 = 未学会
eq(normalizeScrollStars({ ten: 4 }), {});                        // 超范围
eq(normalizeScrollStars({ ten: 2.7 }), { ten: 2 });              // 截断
eq(normalizeScrollStars({ ten: '2', subprop: '1' }), { ten: 2, subprop: 1 });
eq(normalizeScrollStars(SCROLLS.reduce((m, s, i) => { m[s.id] = i < 4 ? 3 : 1; return m; }, {})),
  SCROLLS.reduce((m, s, i) => { m[s.id] = i < 4 ? 3 : 1; return m; }, {}));   // 连续进度完整保留
eq(normalizeScrollStars({ ten: 3, subprop: 3, near100: 3, fold: 1, eleven: 2 }),
  { ten: 3, subprop: 3, near100: 3, fold: 1 });                              // distr 断档，之后不采用

// ---------- 结构性回归守卫 ----------
assert.match(game, /function cancelScrollRun\(/);
assert.match(game, /function scheduleScrollEnd\(/);
assert.match(game, /state\.scrollRunSeq/);
assert.match(game, /state\.scroll\.runId !== runId/);
assert.match(game, /q\.hint\.join\('\\n'\)/);          // 答错必须展示分步提示
assert.match(game, /mode !== 'scroll' \|\| state\.screen !== 'game'/);
assert.match(game, /normalizeScrollStars\(loadBest\('sxd_scrolls'\)\)/);
assert.match(sw, /const CACHE = 'sxd-v12'/);
assert.match(html, /data-mode="scrolls"/);
assert.match(html, /id="scrollShelf"/);
assert.match(html, /id="scrollBtns"/);
assert.match(html, /id="scrollLearn"|"screen-scrollLearn"/);

console.log('scrolls.test.mjs: all checks passed');
