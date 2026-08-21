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
const GEN_NAMES = ['genAdd5', 'genSub5', 'genMake10', 'genMix10', 'genCarry', 'genShare'];
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

// ---------- 活动清单结构（六个活动，按难度递增） ----------
assert.equal(ACTS.length, 6);
eq(ACTS.map((a) => a.id), ['add5', 'sub5', 'mix10', 'share', 'make10', 'carry']);
for (const act of ACTS) {
  assert.ok(typeof act.name === 'string' && act.name.length >= 2 && act.name.length <= 6, act.id);
  assert.ok(typeof act.tip === 'string' && act.tip.length >= 3, act.id + ' tip');
  assert.equal(typeof act.gen, 'function', act.id + ' gen');
  // 点卡片后的语音介绍（孩子不识字，靠听）
  assert.ok(typeof act.speech === 'string' && act.speech.length >= 8, act.id + ' speech');
  assert.ok(act.speech.replace(/[！？，]/g, '').startsWith(act.name.replace(/[！？，]/g, '')), act.id + ' speech 以活动名开头');
}
// 已移除的活动不应残留在代码里
assert.doesNotMatch(kids, /genCount|genNumber|genMore|'count'|'number'|'more'/);
assert.doesNotMatch(kids, /digit-card|group-choice|groupPick|'compare'/);

// ---------- 选项生成 ----------
for (let i = 0; i < 2000; i += 1) {
  const answer = Math.floor(Math.random() * 13);
  const opts = numOptions(answer, 0, 12);
  assert.equal(opts.length, 3, `answer=${answer}`);
  assert.equal(new Set(opts).size, 3, `answer=${answer}`);
  assert.ok(opts.includes(answer), `answer=${answer}`);
  opts.forEach((v) => assert.ok(v >= 0 && v <= 12, `answer=${answer}`));
}
for (const answer of [0, 1, 11, 12]) {
  const opts = numOptions(answer, 0, 12);
  assert.equal(opts.length, 3);
  assert.ok(opts.includes(answer));
}

const ROUNDS = 3000;
const assertQuestionBase = (q) => {
  assert.ok(typeof q.prompt === 'string' && q.prompt.length >= 3, 'prompt');
  assert.ok(typeof q.speech === 'string' && q.speech.length >= 2, 'speech');
  const hasEmoji = typeof q.emoji === 'string'
    || (Array.isArray(q.fill) && q.fill.every((g) => typeof g.emoji === 'string' && g.emoji.length >= 1));
  assert.ok(hasEmoji, 'emoji');
};

// ---------- 1. 5 以内加法 ----------
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

// ---------- 2. 5 以内减法（喂小吃货） ----------
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genSub5();
  assertQuestionBase(q);
  assert.equal(q.type, 'feed');
  assert.ok(q.total >= 3 && q.total <= 5, 'sub5 total range');
  assert.ok(q.toEat >= 1 && q.toEat <= q.total, 'sub5 toEat range');
  assert.equal(q.answer, q.total - q.toEat);
  assert.ok(q.answer >= 0, 'sub5 answer >= 0（含吃光剩 0）');
  assert.ok(q.options.includes(q.answer));
  // 题面必须写明要吃几个（语音与文字一致）
  assert.ok(q.prompt.includes(String(q.toEat)), 'sub5 prompt mentions toEat');
}

// ---------- 3. 凑十（十格盘：装满盘 / 还差几个） ----------
{
  let sawFull = false;
  let sawMissing = false;
  for (let i = 0; i < ROUNDS; i += 1) {
    const q = ctx.API.genMake10();
    assertQuestionBase(q);
    assert.equal(q.type, 'tenframe');
    assert.ok(q.fill.length >= 1 && q.fill.length <= 2, 'fill groups');
    const total = q.fill.reduce((s, g) => s + g.count, 0);
    q.fill.forEach((g) => assert.ok(g.count >= 1 && g.count <= 9, 'fill count range'));
    if (q.fill.length === 2) {
      sawFull = true;
      assert.equal(total, 10, '装满盘：两组正好 10');
      assert.notEqual(q.fill[0].emoji, q.fill[1].emoji, '两种实物代表两个加数');
      assert.equal(q.answer, 10);
    } else {
      sawMissing = true;
      assert.ok(total >= 1 && total <= 9, '还差几个：已装 1~9 个');
      assert.equal(q.answer, 10 - total);
      assert.ok(q.answer >= 1 && q.answer <= 9, '补数在 1~9');
    }
    assert.ok(q.options.includes(q.answer));
    assert.equal(new Set(q.options).size, 3);
  }
  assert.ok(sawFull && sawMissing, '凑十两种题型都应出现');
}

// ---------- 4. 10 以内混合 ----------
{
  let sawAdd = false;
  let sawFeed = false;
  for (let i = 0; i < ROUNDS; i += 1) {
    const q = ctx.API.genMix10();
    assertQuestionBase(q);
    if (q.type === 'objects') {
      sawAdd = true;
      const [a, b] = q.groups.map((g) => g.count);
      assert.ok(a >= 2 && b >= 1, 'mix10 add operands');
      assert.ok(a + b <= 10, 'mix10 sum <= 10');
      assert.equal(q.answer, a + b);
    } else {
      sawFeed = true;
      assert.equal(q.type, 'feed');
      assert.ok(q.total >= 5 && q.total <= 10, 'mix10 sub total range');
      assert.ok(q.toEat >= 1 && q.toEat <= q.total - 1, 'mix10 toEat range');
      assert.equal(q.answer, q.total - q.toEat);
      assert.ok(q.answer >= 1, 'mix10 sub answer >= 1');
    }
    assert.ok(q.options.includes(q.answer));
  }
  assert.ok(sawAdd && sawFeed, '大冒险加减两种题型都应出现');
}

// ---------- 5. 满十加（个位加法过十：5+7=12，凑十法的应用） ----------
for (let i = 0; i < ROUNDS; i += 1) {
  const q = ctx.API.genCarry();
  assertQuestionBase(q);
  assert.equal(q.type, 'carry');
  assert.ok(q.base >= 1 && q.base <= 9, 'carry base range');
  assert.ok(q.loose >= 2 && q.loose <= 9, 'carry loose range');
  assert.ok(q.base >= q.loose, 'carry 大数进盘做底');
  assert.equal(q.answer, q.base + q.loose);
  assert.ok(q.answer >= 11 && q.answer <= 18, 'carry 和过十且 ≤ 18');
  assert.ok(q.loose - (10 - q.base) >= 1, '装满盘后外面一定还有剩（凑十结构）');
  assert.ok(q.options.includes(q.answer));
}

// ---------- 6. 分果果（平均分 + 单双数意识） ----------
{
  let sawEach = false;
  let sawLeft = false;
  let sawOdd = false;
  let sawEven = false;
  for (let i = 0; i < ROUNDS; i += 1) {
    const q = ctx.API.genShare();
    assertQuestionBase(q);
    assert.equal(q.type, 'share');
    assert.ok(q.total >= 2 && q.total <= 10, 'share total range');
    const odd = q.total % 2 === 1;
    if (odd) sawOdd = true; else sawEven = true;
    if (q.ask === 'each') {
      sawEach = true;
      assert.equal(q.answer, (q.total - (q.total % 2)) / 2, '每人 = 平分后的盘内数');
      assert.ok(q.answer >= 1 && q.answer <= 5, 'each answer range');
    } else {
      sawLeft = true;
      assert.equal(q.ask, 'left');
      assert.equal(q.answer, q.total % 2, '剩余只能是 0 或 1');
      q.options.forEach((v) => assert.ok(v >= 0 && v <= 2, 'left options 0~2'));
    }
    assert.ok(q.options.includes(q.answer));
    assert.equal(new Set(q.options).size, 3);
    // 单双数结语必须与奇偶一致
    assert.ok(odd ? q.conclusion.includes('单数') : q.conclusion.includes('双数'), 'conclusion parity');
    assert.ok(q.conclusion.includes(String(q.total)), 'conclusion mentions total');
  }
  assert.ok(sawEach && sawLeft, '两种提问都应出现');
  assert.ok(sawOdd && sawEven, '奇数偶数总数都应出现');
}

// ---------- 存档校验（防篡改：必须从头连续玩过） ----------
eq(normalizeKidsStars(null), {});
eq(normalizeKidsStars('x'), {});
eq(normalizeKidsStars([]), {});
eq(normalizeKidsStars({ add5: 1 }), { add5: 1 });
eq(normalizeKidsStars({ add5: 3, sub5: 2 }), { add5: 3, sub5: 2 });
eq(normalizeKidsStars({ sub5: 2 }), {});                        // 跳过第一个活动
eq(normalizeKidsStars({ add5: 1, mix10: 3 }), { add5: 1 });      // 中间断档
eq(normalizeKidsStars({ unknown: 3, add5: 1 }), { add5: 1 });    // 未知 id 丢弃
eq(normalizeKidsStars({ count: 2, number: 3, add5: 1 }), { add5: 1 });   // 旧版存档：已移除的 id 被丢弃
eq(normalizeKidsStars({ count: 3, number: 3, more: 3, add5: 2, sub5: 1 }), { add5: 2, sub5: 1 });
eq(normalizeKidsStars({ add5: 0 }), {});
eq(normalizeKidsStars({ add5: 4 }), {});
eq(normalizeKidsStars({ add5: 2.6 }), { add5: 2 });
eq(normalizeKidsStars({ add5: '3', sub5: '1' }), { add5: 3, sub5: 1 });

// ---------- 结构性守卫 ----------
// 主应用未被改动混入幼儿逻辑（两个应用保持独立）
assert.doesNotMatch(game, /ACTS|normalizeKidsStars/);
// SW 收录幼儿版资源并升级版本
assert.match(sw, /const CACHE = 'sxd-v13'/);
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
// 喂小吃货 / 满十加 / 分果果交互的必要结构
assert.match(kids, /MONSTER_SVG/);
assert.match(kids, /appetite-slot/);          // 「想吃」气泡实物槽位
assert.match(kids, /classList\.add\('eaten'\)/);
assert.match(kids, /classList\.add\('moved'\)/);   // 满十加：搬走留下幽灵位
assert.match(kids, /carry-pile/);
assert.match(kids, /classList\.add\('leftover'\)/);   // 分果果：剩下的分不下去
assert.match(kids, /share-basket/);

console.log('kids.test.mjs: all checks passed');
