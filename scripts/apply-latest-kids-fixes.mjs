import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(path, oldText, newText) {
  const content = read(path);
  const count = content.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected exactly one match, found ${count}\n--- expected ---\n${oldText}`);
  }
  write(path, content.replace(oldText, newText));
}

// Keep the file header and timing configuration aligned with the six activities.
replaceOnce(
  'kids.js',
  " *   - 三个活动按序解锁：小加法 → 小减法 → 大冒险（10 以内混合）\n",
  " *   - 六个活动按序解锁：小加法 → 小减法 → 大冒险 → 分果果 → 凑十 → 满十加\n",
);
replaceOnce(
  'kids.js',
  `  const CONFIG = {\n    roundCount: 5,       // 每轮题数\n    advanceDelay: 1400,  // 答对后停留（毫秒）\n  };\n`,
  `  const CONFIG = {\n    roundCount: 5,         // 每轮题数\n    advanceDelay: 1400,    // 普通题答对后停留（毫秒）\n    conclusionDelay: 3200, // 含单双数语音总结时，留足播放时间\n  };\n`,
);

// Preserve all valid known activity stars. Unlocking still stops at the first gap,
// so an older save can retain make10/carry progress behind the newly inserted share activity.
replaceOnce(
  'kids.js',
  `  function normalizeKidsStars(value) {\n    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};\n    const candidate = {};\n    ACTS.forEach((act, idx) => {\n      const stars = Math.trunc(Number(value[act.id]));\n      if (Number.isInteger(stars) && stars >= 1 && stars <= 3) candidate[idx] = stars;\n    });\n    // 必须从第一个活动开始连续玩过，跳着玩的数据不采用\n    const clean = {};\n    for (let i = 0; i < ACTS.length && candidate[i]; i++) clean[ACTS[i].id] = candidate[i];\n    return clean;\n  }\n`,
  `  function normalizeKidsStars(value) {\n    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};\n    const clean = {};\n    ACTS.forEach((act) => {\n      const stars = Math.trunc(Number(value[act.id]));\n      if (Number.isInteger(stars) && stars >= 1 && stars <= 3) clean[act.id] = stars;\n    });\n    // 保留所有已知活动的合法星级；是否解锁仍由 actsUnlockedTo 的连续进度决定。\n    // 这样在中间插入新活动时，旧版后段进度不会被清空。\n    return clean;\n  }\n`,
);

// Unify interaction gating and keep share follow-up speech aligned with the actual question.
replaceOnce(
  'kids.js',
  `  function setNumberChoicesEnabled(enabled) {\n    $$('#kChoices .bubble').forEach((button) => {\n      button.disabled = !enabled;\n      button.setAttribute('aria-disabled', String(!enabled));\n    });\n  }\n\n  function buildNumberChoices(q) {\n`,
  `  function setNumberChoicesEnabled(enabled) {\n    $$('#kChoices .bubble').forEach((button) => {\n      button.disabled = !enabled;\n      button.setAttribute('aria-disabled', String(!enabled));\n    });\n  }\n\n  function needsInteraction(q) {\n    return q && (q.type === 'feed' || q.type === 'carry' || q.type === 'share');\n  }\n\n  function shareFollowUp(q) {\n    return q.ask === 'each' ? '分好啦！每人分到几个？' : '分好啦！还剩几个？';\n  }\n\n  function buildNumberChoices(q) {\n`,
);
replaceOnce(
  'kids.js',
  `    setNumberChoicesEnabled(q.type !== 'feed' || q.feedComplete);\n  }\n\n  function renderQuestion(afterIntro) {\n    const act = ACTS[state.act.idx];\n    const q = act.gen();\n    q.feedComplete = q.type !== 'feed';\n`,
  `    setNumberChoicesEnabled(!needsInteraction(q) || q.interactionComplete);\n  }\n\n  function renderQuestion(afterIntro) {\n    const act = ACTS[state.act.idx];\n    const q = act.gen();\n    q.interactionComplete = !needsInteraction(q);\n`,
);

// Feed: enable answers only after feeding is complete; queue the prompt instead of
// scheduling a stale timer that can interrupt the answer feedback.
replaceOnce(
  'kids.js',
  `        if (fed === q.toEat) {\n          q.feedComplete = true;\n          setNumberChoicesEnabled(true);\n          appetite.classList.add('done');   // 喂饱后停止脉动提醒\n          const seq = state.runSeq;\n          setTimeout(() => {\n            if (state.screen === 'game' && state.runSeq === seq) speak('还剩几个？');\n          }, 900);\n        }\n`,
  `        if (fed === q.toEat) {\n          q.interactionComplete = true;\n          setNumberChoicesEnabled(true);\n          appetite.classList.add('done');   // 喂饱后停止脉动提醒\n          speak('还剩几个？', true);\n        }\n`,
);

// Carry: reaching ten is the required interaction boundary.
replaceOnce(
  'kids.js',
  `          if (moved === 10 - q.base) {\n            const seq = state.runSeq;\n            setTimeout(() => {\n              if (state.screen === 'game' && state.runSeq === seq) {\n                speak('装满十个啦！外面还剩 ' + (q.loose - moved) + ' 个，一共几个？');\n              }\n            }, 900);\n          }\n`,
  `          if (moved === 10 - q.base) {\n            q.interactionComplete = true;\n            setNumberChoicesEnabled(true);\n            speak('装满十个啦！外面还剩 ' + (q.loose - moved) + ' 个，一共几个？', true);\n          }\n`,
);

// Share: an odd leftover must be explicitly identified before answers unlock. For
// even totals, finishing the last pair is sufficient. Follow-up speech mirrors q.ask.
replaceOnce(
  'kids.js',
  `          if (placed >= maxPlace) {\n            // 奇数个的最后一个：再分就不一样多了，剩下来\n            obj.classList.add('leftover');\n            if (!leftoverSaid) {\n              leftoverSaid = true;\n              speak('分不了啦，一人一个才公平，这个剩下了！');\n            }\n            return;\n          }\n`,
  `          if (placed >= maxPlace) {\n            // 奇数个的最后一个：再分就不一样多了，剩下来\n            obj.classList.add('leftover');\n            obj.disabled = true;\n            if (!leftoverSaid) {\n              leftoverSaid = true;\n              q.interactionComplete = true;\n              setNumberChoicesEnabled(true);\n              speak('分不了啦，一人一个才公平，这个剩下了！');\n              speak(shareFollowUp(q), true);\n            }\n            return;\n          }\n`,
);
replaceOnce(
  'kids.js',
  `          if (placed === maxPlace && q.total % 2 === 1) {\n            const seq = state.runSeq;\n            setTimeout(() => {\n              if (state.screen === 'game' && state.runSeq === seq) speak('剩下的分不了啦！还剩几个？');\n            }, 900);\n          }\n`,
  `          if (placed === maxPlace) {\n            if (q.total % 2 === 0) {\n              q.interactionComplete = true;\n              setNumberChoicesEnabled(true);\n              speak(shareFollowUp(q), true);\n            } else {\n              speak('还剩一个，点一下看看能不能公平分掉？', true);\n            }\n          }\n`,
);

// Defensive answer gate for every interaction-led activity.
replaceOnce(
  'kids.js',
  `  function chooseNumber(btn, value) {\n    if (state.locked) return;\n    if (state.question.type === 'feed' && !state.question.feedComplete) {\n      speak('先喂饱小吃货哦');\n      return;\n    }\n    if (value === state.question.answer) acceptAnswer(btn);\n`,
  `  function chooseNumber(btn, value) {\n    if (state.locked) return;\n    if (!state.question.interactionComplete) {\n      const hint = state.question.type === 'feed' ? '先喂饱小吃货哦'\n        : state.question.type === 'carry' ? '先把十格盘装满哦' : '先把果果分完哦';\n      speak(hint);\n      return;\n    }\n    if (value === state.question.answer) acceptAnswer(btn);\n`,
);

// Allow the queued parity conclusion to finish before the next question cancels speech.
replaceOnce(
  'kids.js',
  `    const seq = state.runSeq;\n    setTimeout(() => {\n      if (state.screen !== 'game' || state.runSeq !== seq) return;\n      state.act.qIndex += 1;\n      if (state.act.qIndex >= CONFIG.roundCount) showKidResult();\n      else renderQuestion();\n    }, CONFIG.advanceDelay);\n`,
  `    const seq = state.runSeq;\n    const delay = state.question.conclusion ? CONFIG.conclusionDelay : CONFIG.advanceDelay;\n    setTimeout(() => {\n      if (state.screen !== 'game' || state.runSeq !== seq) return;\n      state.act.qIndex += 1;\n      if (state.act.qIndex >= CONFIG.roundCount) showKidResult();\n      else renderQuestion();\n    }, delay);\n`,
);

// Bump the service-worker cache after changing kids.js.
for (const path of ['sw.js', 'tests/review-fixes.test.mjs', 'tests/scrolls.test.mjs', 'tests/kids.test.mjs', 'tests/review-regressions.test.mjs']) {
  replaceOnce(path, "const CACHE = 'sxd-v14'", "const CACHE = 'sxd-v15'");
}

// Existing generator/storage tests: expose the unlock helper and update migration expectations.
replaceOnce(
  'tests/kids.test.mjs',
  `\${extractFunction(kids, 'normalizeKidsStars')}\nglobalThis.API = { ACTS, normalizeKidsStars, numOptions, \${GEN_NAMES.join(', ')} };\n`,
  `\${extractFunction(kids, 'normalizeKidsStars')}\n\${extractFunction(kids, 'actsUnlockedTo')}\nglobalThis.API = { ACTS, normalizeKidsStars, actsUnlockedTo, numOptions, \${GEN_NAMES.join(', ')} };\n`,
);
replaceOnce(
  'tests/kids.test.mjs',
  `const { ACTS, normalizeKidsStars, numOptions } = ctx.API;\n`,
  `const { ACTS, normalizeKidsStars, actsUnlockedTo, numOptions } = ctx.API;\n`,
);
replaceOnce(
  'tests/kids.test.mjs',
  `// ---------- 存档校验（防篡改：必须从头连续玩过） ----------\neq(normalizeKidsStars(null), {});\neq(normalizeKidsStars('x'), {});\neq(normalizeKidsStars([]), {});\neq(normalizeKidsStars({ add5: 1 }), { add5: 1 });\neq(normalizeKidsStars({ add5: 3, sub5: 2 }), { add5: 3, sub5: 2 });\neq(normalizeKidsStars({ sub5: 2 }), {});                        // 跳过第一个活动\neq(normalizeKidsStars({ add5: 1, mix10: 3 }), { add5: 1 });      // 中间断档\neq(normalizeKidsStars({ unknown: 3, add5: 1 }), { add5: 1 });    // 未知 id 丢弃\neq(normalizeKidsStars({ count: 2, number: 3, add5: 1 }), { add5: 1 });   // 旧版存档：已移除的 id 被丢弃\neq(normalizeKidsStars({ count: 3, number: 3, more: 3, add5: 2, sub5: 1 }), { add5: 2, sub5: 1 });\neq(normalizeKidsStars({ add5: 0 }), {});\neq(normalizeKidsStars({ add5: 4 }), {});\neq(normalizeKidsStars({ add5: 2.6 }), { add5: 2 });\neq(normalizeKidsStars({ add5: '3', sub5: '1' }), { add5: 3, sub5: 1 });\n`,
  `// ---------- 存档校验（保留合法星级，解锁仍要求连续） ----------\neq(normalizeKidsStars(null), {});\neq(normalizeKidsStars('x'), {});\neq(normalizeKidsStars([]), {});\neq(normalizeKidsStars({ add5: 1 }), { add5: 1 });\neq(normalizeKidsStars({ add5: 3, sub5: 2 }), { add5: 3, sub5: 2 });\neq(normalizeKidsStars({ sub5: 2 }), { sub5: 2 });                // 合法星级保留，但活动仍处于锁定\neq(normalizeKidsStars({ add5: 1, mix10: 3 }), { add5: 1, mix10: 3 }); // 中间断档不再删除后段星级\neq(normalizeKidsStars({ unknown: 3, add5: 1 }), { add5: 1 });    // 未知 id 丢弃\neq(normalizeKidsStars({ count: 2, number: 3, add5: 1 }), { add5: 1 });   // 旧版已移除 id 丢弃\neq(normalizeKidsStars({ count: 3, number: 3, more: 3, add5: 2, sub5: 1 }), { add5: 2, sub5: 1 });\neq(normalizeKidsStars({ add5: 0 }), {});\neq(normalizeKidsStars({ add5: 4 }), {});\neq(normalizeKidsStars({ add5: 2.6 }), { add5: 2 });\neq(normalizeKidsStars({ add5: '3', sub5: '1' }), { add5: 3, sub5: 1 });\n\nconst legacyFive = { add5: 3, sub5: 2, mix10: 3, make10: 2, carry: 1 };\neq(normalizeKidsStars(legacyFive), legacyFive, '插入 share 后必须保留旧版后段星级');\nassert.equal(actsUnlockedTo(normalizeKidsStars(legacyFive)), 3, '缺少 share 时仍停在 share');\nconst migrated = normalizeKidsStars({ ...legacyFive, share: 2 });\nassert.equal(actsUnlockedTo(migrated), ACTS.length, '补上 share 后旧 make10/carry 进度自动恢复');\n`,
);

// Expand the behavioral regression test to all interaction-led activities and
// verify that share follow-up speech matches the question being asked.
replaceOnce(
  'tests/review-regressions.test.mjs',
  `// ---------- Feed interaction cannot be bypassed ----------\n{\n  const source = \`\nconst state = globalThis.input.state;\nconst speak = (msg) => { globalThis.counts.spoken = msg; };\nconst acceptAnswer = () => { globalThis.counts.accept += 1; };\nconst rejectAnswer = () => { globalThis.counts.reject += 1; };\n\${extractFunction(kids, 'chooseNumber')}\nglobalThis.api = { chooseNumber };\n\`;\n  const ctx = {\n    input: { state: { locked: false, question: { type: 'feed', feedComplete: false, answer: 2 } } },\n    counts: { spoken: '', accept: 0, reject: 0 },\n  };\n  vm.runInNewContext(source, ctx);\n  ctx.api.chooseNumber({}, 2);\n  assert.equal(ctx.counts.accept, 0);\n  assert.equal(ctx.counts.reject, 0);\n  assert.match(ctx.counts.spoken, /先喂饱/);\n  ctx.input.state.question.feedComplete = true;\n  ctx.api.chooseNumber({}, 2);\n  assert.equal(ctx.counts.accept, 1);\n}\nassert.match(kids, /setNumberChoicesEnabled\\(q\\.type !== 'feed' \\|\\| q\\.feedComplete\\)/);\nassert.match(kids, /q\\.feedComplete = true;\\s*setNumberChoicesEnabled\\(true\\)/);\n`,
  `// ---------- Interaction-led activities cannot be bypassed ----------\n{\n  const source = \`\nconst state = globalThis.input.state;\nconst speak = (msg) => { globalThis.counts.spoken = msg; };\nconst acceptAnswer = () => { globalThis.counts.accept += 1; };\nconst rejectAnswer = () => { globalThis.counts.reject += 1; };\n\${extractFunction(kids, 'chooseNumber')}\nglobalThis.api = { chooseNumber };\n\`;\n  for (const type of ['feed', 'carry', 'share']) {\n    const ctx = {\n      input: { state: { locked: false, question: { type, interactionComplete: false, answer: 2 } } },\n      counts: { spoken: '', accept: 0, reject: 0 },\n    };\n    vm.runInNewContext(source, ctx);\n    ctx.api.chooseNumber({}, 2);\n    assert.equal(ctx.counts.accept, 0, type);\n    assert.equal(ctx.counts.reject, 0, type);\n    assert.match(ctx.counts.spoken, /先/, type);\n    ctx.input.state.question.interactionComplete = true;\n    ctx.api.chooseNumber({}, 2);\n    assert.equal(ctx.counts.accept, 1, type);\n  }\n}\nassert.match(kids, /q\\.interactionComplete = !needsInteraction\\(q\\)/);\nassert.match(kids, /q\\.interactionComplete = true;\\s*setNumberChoicesEnabled\\(true\\)/);\n\n// ---------- Share follow-up stays aligned with q.ask ----------\n{\n  const source = \`\n\${extractFunction(kids, 'shareFollowUp')}\nglobalThis.followUp = shareFollowUp;\n\`;\n  const ctx = {};\n  vm.runInNewContext(source, ctx);\n  assert.match(ctx.followUp({ ask: 'each' }), /每人分到几个/);\n  assert.doesNotMatch(ctx.followUp({ ask: 'each' }), /还剩几个/);\n  assert.match(ctx.followUp({ ask: 'left' }), /还剩几个/);\n}\nassert.doesNotMatch(kids, /}, 900\\);/);\nassert.match(kids, /state\\.question\\.conclusion \\? CONFIG\\.conclusionDelay : CONFIG\\.advanceDelay/);\n`,
);

console.log('apply-latest-kids-fixes.mjs: fixes applied');
