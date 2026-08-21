/* ============================================================
 * 速算小达人 —— 三年级速算练习小游戏
 * 纯静态实现：index.html + style.css + game.js，零依赖
 * 打开方式：浏览器直接打开 index.html
 *
 * 出题规则：
 *   加法：基础 100 以内 / 进阶 1000 以内
 *   减法：基础 100 以内 / 进阶 1000 以内
 *   乘法：基础表内乘法(2~9×2~9) / 进阶含整十数×一位数、两位数×一位数
 *   除法：除数恒为一位数(2~9)，整除为主，少量带余数
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 配置（想调整难度/时长改这里） ---------------- */
  const CONFIG = {
    challengeSeconds: 60,   // 挑战模式时长（秒）
    divExactRatio: 0.85,    // 除法中整除的比例（其余为带余数）
    basePoints: 10,         // 挑战模式答对基础分
    streakBonusStep: 2,     // 连击加分：每多连击 1 次多 2 分
    correctDelay: 800,      // 答对后自动进入下一题（毫秒）
    wrongDelay: 1600,       // 答错后停留（毫秒）
    scrollDrillCount: 5,    // 秘籍演练题数
    scrollTestCount: 8,     // 秘籍掌握考验题数
    scrollTestPass: 7,      // 通过考验所需答对数
    scrollTestSecs: 15,     // 考验每题限时（秒）
    scrollHintDelay: 4500,  // 秘籍答错后展示分步提示的停留（毫秒）
    scrollEndDelay: 900,    // 最后一题答完到结算的间隔（毫秒）
    chase: {
      lag: 0.30,            // 怪兽初始落后公主的距离（0-1）
      wrongStep: 0.045,     // 每答错一题怪兽额外前进
      margin: 0.03,         // 贴身判定余量（怪兽贴到这个距离内算追上）
      dangerDist: 0.15,     // 紧张阈值：距离小于此值触发红光/心跳（须小于初始安全距离 lag）
      extraQ: 2,            // 怪兽速度标定：按（题数+2）的答题总耗时走完全程
      secPerQ: 10,          // 普通关每题期望耗时（秒）
      bossSecPerQ: 9,       // Boss 关每题期望耗时（秒），更快
      tickMs: 500,          // 怪兽推进的定时器间隔
    },
  };

  /* ---------------- 小工具 ---------------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  const TYPE_NAMES = { add: '加法', sub: '减法', mul: '乘法', div: '除法' };
  const DIFF_NAMES = { basic: '基础', advanced: '进阶' };
  const DIFF_DESC = {
    basic: '100 以内的加减、表内乘法、除数是一位数的除法（以整除为主）',
    advanced: '1000 以内的加减、两位数乘法、两位数除以一位数（含少量带余数）',
  };
  const PRAISE = ['太棒了！🎉', '真厉害！💪', '答对了！✨', '好快呀！⚡', '超级棒！🌟', '继续加油！🚀'];
  const ENCOURAGE = ['差一点点，再试一次！', '别灰心，公主还等着你！', '下次一定行！💪', '深呼吸，再来！'];

  /* ---------------- 原创角色 SVG（公主 / 怪兽 / 终点水晶） ---------------- */
  const SVGS = {
    // 雪儿公主：金色辫子、蓝裙、小皇冠（原创形象）
    princess:
      '<svg viewBox="0 0 60 75" xmlns="http://www.w3.org/2000/svg">' +
      '<g class="leg"><rect x="24" y="52" width="5" height="14" rx="2.5" fill="#f4c99b"/></g>' +
      '<g class="leg back"><rect x="31" y="52" width="5" height="14" rx="2.5" fill="#e8b586"/></g>' +
      '<path d="M20 34 Q30 28 40 34 L46 56 Q30 62 14 56 Z" fill="#7cc4f5"/>' +
      '<path d="M20 34 Q30 28 40 34 L42 45 Q30 50 18 45 Z" fill="#a8dcfb"/>' +
      '<rect x="25" y="30" width="10" height="8" rx="3" fill="#5da9e8"/>' +
      '<g class="arm"><rect x="24" y="29" width="4.5" height="12" rx="2.2" fill="#5da9e8"/></g>' +
      '<g class="arm back"><rect x="33" y="29" width="4.5" height="13" rx="2.2" fill="#5da9e8"/></g>' +
      '<circle cx="37" cy="26" r="2.6" fill="#9fe8ff"/>' +
      '<path d="M21 18 Q19 32 24 40 L26 20 Z" fill="#f2c14e"/>' +
      '<path d="M39 18 Q41 32 36 40 L34 20 Z" fill="#e8b53f"/>' +
      '<circle cx="21.5" cy="41" r="3" fill="#f2c14e"/><circle cx="38.5" cy="41" r="3" fill="#e8b53f"/>' +
      '<circle cx="30" cy="20" r="9" fill="#f9d7b5"/>' +
      '<path d="M22 17 Q26 10 30 13 Q34 10 38 17 Q34 14 30 15 Q26 14 22 17 Z" fill="#f2c14e"/>' +
      '<path d="M25 10 L27 4.5 L30 8.5 L33 4.5 L35 10 Z" fill="#ffd94a" stroke="#e8b53f" stroke-width="0.8"/>' +
      '<circle cx="27" cy="20" r="1.1" fill="#3a3a3a"/><circle cx="33" cy="20" r="1.1" fill="#3a3a3a"/>' +
      '<circle cx="25.5" cy="23" r="1.4" fill="#ffb3ba" opacity="0.8"/><circle cx="34.5" cy="23" r="1.4" fill="#ffb3ba" opacity="0.8"/>' +
      '</svg>',
    // 魔法花园：花藤怪
    vine:
      '<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 42 Q2 36 6 26" stroke="#4caf50" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M44 42 Q54 36 50 26" stroke="#4caf50" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<circle cx="28" cy="36" r="15" fill="#66c26a"/>' +
      '<circle cx="14" cy="14" r="4" fill="#ff9ecb"/><circle cx="42" cy="14" r="4" fill="#ff9ecb"/>' +
      '<circle cx="20" cy="8" r="4" fill="#ffd1e6"/><circle cx="36" cy="8" r="4" fill="#ffd1e6"/>' +
      '<circle cx="28" cy="6" r="4.5" fill="#ff9ecb"/>' +
      '<circle cx="28" cy="14" r="12" fill="#7ed67e"/>' +
      '<circle cx="24" cy="12" r="3.2" fill="#fff"/><circle cx="32" cy="12" r="3.2" fill="#fff"/>' +
      '<circle cx="24.7" cy="12.6" r="1.6" fill="#222"/><circle cx="32.7" cy="12.6" r="1.6" fill="#222"/>' +
      '<path d="M24 19 Q28 22 32 19" stroke="#2e7d32" stroke-width="2" fill="none"/>' +
      '<path d="M25.6 19.2 l1.2 2 1.2-2 Z" fill="#fff"/><path d="M29 19.2 l1.2 2 1.2-2 Z" fill="#fff"/>' +
      '</svg>',
    // 冰晶雪山：冰霜巨人
    giant:
      '<svg viewBox="0 0 56 60" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M18 8 L13.5 0 L22 5 Z" fill="#e8f9ff"/>' +
      '<path d="M38 8 L42.5 0 L34 5 Z" fill="#e8f9ff"/>' +
      '<circle cx="28" cy="14" r="11" fill="#9fd8f5"/>' +
      '<rect x="12" y="20" width="32" height="34" rx="12" fill="#9fd8f5"/>' +
      '<rect x="17" y="27" width="22" height="20" rx="9" fill="#cdeffb"/>' +
      '<path d="M12 28 Q4 32 6 40" stroke="#9fd8f5" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<path d="M44 28 Q52 32 50 40" stroke="#9fd8f5" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<circle cx="24" cy="13" r="2.8" fill="#fff"/><circle cx="32" cy="13" r="2.8" fill="#fff"/>' +
      '<circle cx="24.6" cy="13.5" r="1.4" fill="#1c4a66"/><circle cx="32.6" cy="13.5" r="1.4" fill="#1c4a66"/>' +
      '<path d="M24 19 Q28 21 32 19" stroke="#1c4a66" stroke-width="2" fill="none"/>' +
      '<path d="M26 45 l2 3 2-3 Z" fill="#e8f9ff"/><path d="M32 46 l1.6 2.4 1.6-2.4 Z" fill="#e8f9ff"/>' +
      '</svg>',
    // 梦幻城堡：暗影巨龙
    dragon:
      '<svg viewBox="0 0 58 56" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M14 26 Q0 8 4 2 Q16 8 20 18 Z" fill="#6a5aa8"/>' +
      '<path d="M44 26 Q58 8 54 2 Q42 8 38 18 Z" fill="#6a5aa8"/>' +
      '<ellipse cx="29" cy="38" rx="16" ry="14" fill="#8471c9"/>' +
      '<ellipse cx="29" cy="42" rx="9" ry="8" fill="#b0a3e3"/>' +
      '<path d="M45 44 Q54 46 52 54" stroke="#8471c9" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<circle cx="29" cy="18" r="11" fill="#8471c9"/>' +
      '<path d="M22 10 L19 3 L26 7 Z" fill="#f5b301"/>' +
      '<path d="M36 10 L39 3 L32 7 Z" fill="#f5b301"/>' +
      '<path d="M20.5 14 l6.5 2.2" stroke="#2a1e4a" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M37.5 14 l-6.5 2.2" stroke="#2a1e4a" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="25" cy="17.5" r="1.6" fill="#ff5252"/><circle cx="33" cy="17.5" r="1.6" fill="#ff5252"/>' +
      '<path d="M24 23 Q29 26.5 34 23 L32.6 25.5 Q29 27.5 25.4 25.5 Z" fill="#fff"/>' +
      '</svg>',
    // 终点：魔法水晶
    crystal:
      '<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#bdefff"/><stop offset="1" stop-color="#5db8f5"/>' +
      '</linearGradient></defs>' +
      '<path d="M25 2 L42 20 L34 56 L16 56 L8 20 Z" fill="url(#cg)" stroke="#8ad4ff" stroke-width="2"/>' +
      '<path d="M25 2 L34 56" stroke="#ffffff" opacity="0.5" stroke-width="2"/>' +
      '<circle cx="18" cy="22" r="3" fill="#fff" opacity="0.8"/>' +
      '<text x="36" y="14" font-size="10">✨</text>' +
      '</svg>',
  };

  /* ---------------- 闯关世界 / 关卡 ---------------- */
  const WORLDS = [
    {
      name: '魔法花园', emoji: '🌸', theme: 'w-garden', monster: 'vine', sub: '花仙子的家园',
      levels: [
        { name: '花间小路', types: ['add'], diff: 'basic', count: 8, need: 6 },
        { name: '蝴蝶谷', types: ['sub'], diff: 'basic', count: 8, need: 6 },
        { name: '玫瑰迷宫', types: ['add', 'sub'], diff: 'basic', count: 8, need: 6 },
        { name: '花藤封印', types: ['add', 'sub'], diff: 'basic', count: 10, need: 7, boss: true },
      ],
    },
    {
      name: '冰晶雪山', emoji: '❄️', theme: 'w-snow', monster: 'giant', sub: '冰雪魔法觉醒',
      levels: [
        { name: '雪松林', types: ['mul'], diff: 'basic', count: 10, need: 7 },
        { name: '冰桥险境', types: ['div'], diff: 'basic', count: 10, need: 7 },
        { name: '风雪坡道', types: ['mul', 'div'], diff: 'basic', count: 10, need: 7 },
        { name: '冰霜巨人', types: ['add', 'sub', 'mul', 'div'], diff: 'basic', count: 12, need: 9, boss: true },
      ],
    },
    {
      name: '梦幻城堡', emoji: '🏰', theme: 'w-castle', monster: 'dragon', sub: '最终决战',
      levels: [
        { name: '星辰回廊', types: ['add', 'sub'], diff: 'advanced', count: 12, need: 9 },
        { name: '符文高塔', types: ['mul'], diff: 'advanced', count: 12, need: 9 },
        { name: '月光大厅', types: ['add', 'sub', 'mul', 'div'], diff: 'advanced', count: 12, need: 9 },
        { name: '暗影巨龙', types: ['add', 'sub', 'mul', 'div'], diff: 'advanced', count: 14, need: 11, boss: true },
      ],
    },
  ];
  const LEVELS = WORLDS.flatMap((world, wid) =>
    world.levels.map((level, lid) => ({ wid, lid, level }))
  );
  const TOTAL_LEVELS = LEVELS.length;

  function levelId(wid, lid) {
    return LEVELS.findIndex((item) => item.wid === wid && item.lid === lid);
  }

  function levelAt(id) {
    return LEVELS[id] || null;
  }

  /* ---------------- 冒险存档 ---------------- */
  function normalizeAdvStars(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const candidate = {};
    Object.keys(value).forEach((key) => {
      const id = Number(key);
      const stars = Number(value[key]);
      if (Number.isInteger(id) && id >= 0 && id < TOTAL_LEVELS
        && Number.isInteger(stars) && stars >= 1 && stars <= 3) {
        candidate[id] = stars;
      }
    });

    // 进度必须从第 0 关开始连续，损坏或被篡改的跳关数据不予采用。
    const clean = {};
    for (let id = 0; id < TOTAL_LEVELS && candidate[id]; id++) clean[id] = candidate[id];
    return clean;
  }

  function loadAdvStars() {
    return normalizeAdvStars(loadBest('sxd_adventure'));
  }
  function saveAdvStars(map) {
    saveBest('sxd_adventure', normalizeAdvStars(map));
  }
  function advUnlockedTo(stars) {
    let id = 0;
    while (id < TOTAL_LEVELS && stars[id]) id += 1;
    return id;   // 下一关索引；0 表示第 0 关可玩
  }

  /* ---------------- 游戏状态 ---------------- */
  const state = {
    screen: 'home',          // home | map | setup | game | result
    difficulty: 'basic',     // basic | advanced
    mode: null,              // practice | challenge | adventure
    selectedTypes: ['add', 'sub', 'mul', 'div'],
    question: null,
    activeBox: 1,
    locked: false,           // 反馈期间锁定输入
    nextTimer: null,
    pCorrect: 0, pWrong: 0,  // 练习统计
    timeLeft: CONFIG.challengeSeconds,
    deadline: 0,             // 挑战截止时刻（时间戳），interval 只负责刷新显示
    timerId: null,
    score: 0, streak: 0, maxStreak: 0,
    cCorrect: 0, cWrong: 0,  // 挑战统计
    adv: null,               // 闯关状态 { wid, lid, qIndex, correct, wrong, princess, monster, speed, timer, ending }
    adventureRunSeq: 0,
    scroll: null,            // 秘籍运行状态 { index, kind, runId, qIndex, correct, wrong, timerId, ... }
    scrollRunSeq: 0,
    scrollLearn: null,       // 学习屏状态 { index, revealed, total }
    soundOn: storageGet('sxd_sound') !== '0',
  };

  /* ============================================================
   * 出题器
   * ============================================================ */

  function genAdd(diff) {
    if (diff === 'basic') {
      // 两位数 + 一位数/两位数，和 ≤ 100
      const a = randInt(10, 89);
      const b = randInt(1, 100 - a);
      return { text: a + ' + ' + b, answer: a + b };
    }
    // 三位数以内加法，和 ≤ 1000
    const a = randInt(11, 550);
    const b = randInt(11, 1000 - a);
    return { text: a + ' + ' + b, answer: a + b };
  }

  function genSub(diff) {
    if (diff === 'basic') {
      // 两位数减法，差 ≥ 0（多为两位数减两位数）
      const a = randInt(11, 99);
      const maxB = a - 1;
      const b = Math.random() < 0.6
        ? randInt(Math.min(10, maxB), maxB)
        : randInt(1, Math.min(9, maxB));
      return { text: a + ' − ' + b, answer: a - b };
    }
    // 三位数减法，差 ≥ 10
    const a = randInt(101, 999);
    const b = randInt(10, a - 10);
    return { text: a + ' − ' + b, answer: a - b };
  }

  function genMul(diff) {
    if (diff === 'basic') {
      // 表内乘法
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      return { text: a + ' × ' + b, answer: a * b };
    }
    // 四成整十数×一位数，六成两位数×一位数
    if (Math.random() < 0.4) {
      const a = pick([20, 30, 40, 50, 60, 70, 80, 90]);
      const b = randInt(2, 9);
      return { text: a + ' × ' + b, answer: a * b };
    }
    const a = randInt(11, 99);
    const b = randInt(2, 9);
    return { text: a + ' × ' + b, answer: a * b };
  }

  function genDiv(diff) {
    // 除数恒为一位数（1 的除法太简单，从 2 开始）
    const d = randInt(2, 9);

    // 商的范围：基础偏表内（2~9），进阶可到两位数
    const qMax = diff === 'basic' ? 9 : Math.floor(99 / d);

    if (Math.random() < CONFIG.divExactRatio) {
      // —— 整除为主 ——
      let q = randInt(2, qMax);
      let dividend = d * q;
      let guard = 0;
      // 保证被除数是两位数
      while (dividend < 10 && guard++ < 20) {
        q = randInt(2, qMax);
        dividend = d * q;
      }
      return { text: dividend + ' ÷ ' + d, answer: q, quotient: q, remainder: 0, isDiv: true };
    }

    // —— 少量带余数 ——
    const maxQ = Math.floor((99 - (d - 1)) / d);
    let q = randInt(2, Math.min(qMax, maxQ));
    let r = randInt(1, d - 1);
    let dividend = d * q + r;
    let guard = 0;
    while (dividend < 10 && guard++ < 20) {
      q = randInt(2, Math.min(qMax, maxQ));
      r = randInt(1, d - 1);
      dividend = d * q + r;
    }
    return { text: dividend + ' ÷ ' + d, answer: q, quotient: q, remainder: r, isDiv: true };
  }

  function genQuestion() {
    let type, diff;
    if (state.mode === 'scroll') {
      // 秘籍模式：定向出题，保证题目必然符合当前技巧的特征
      return Object.assign({ type: 'scroll' }, SCROLLS[state.scroll.index].gen());
    }
    if (state.mode === 'adventure') {
      const lv = WORLDS[state.adv.wid].levels[state.adv.lid];
      type = pick(lv.types);
      diff = lv.diff;
    } else if (state.mode === 'challenge') {
      type = pick(['add', 'sub', 'mul', 'div']);   // 挑战模式四种题型混合
      diff = state.difficulty;
    } else {
      type = pick(state.selectedTypes);            // 练习模式按所选题型
      diff = state.difficulty;
    }
    const q = type === 'add' ? genAdd(diff)
      : type === 'sub' ? genSub(diff)
      : type === 'mul' ? genMul(diff)
      : genDiv(diff);
    return Object.assign({ type }, q);
  }

  /* ============================================================
   * 界面切换
   * ============================================================ */

  function showScreen(name) {
    state.screen = name;
    $$('.screen').forEach((s) => {
      const active = s.id === 'screen-' + name;
      s.classList.toggle('active', active);
      s.setAttribute('aria-hidden', String(!active));
    });
    // 游戏中锁定难度切换
    $$('#difficultySeg .seg-btn').forEach((b) => { b.disabled = name === 'game'; });

    // 非游戏页切换后把焦点移入当前页面；游戏页由答案框接管焦点。
    if (name !== 'game') {
      window.requestAnimationFrame(() => {
        const screen = $('#screen-' + name);
        const target = screen && screen.querySelector('h2, [data-back], button:not([disabled])');
        if (!target) return;
        const temporaryTabIndex = target.tagName === 'H2';
        if (temporaryTabIndex) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        if (temporaryTabIndex) {
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
        }
      });
    }
  }

  function showFeedback(msg, cls) {
    const el = $('#feedback');
    el.textContent = msg;
    el.className = 'feedback' + (cls ? ' ' + cls : '');
  }

  /* ============================================================
   * 音效（Web Audio，无外部资源）
   * ============================================================ */

  let actx = null;

  function ensureAudio() {
    if (!state.soundOn) return;
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 忽略 */ }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }

  function tone(freq, delay, dur, type, vol) {
    if (!actx || !state.soundOn) return;
    try {
      const t0 = actx.currentTime + delay;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.25, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch (e) { /* 忽略 */ }
  }

  // 答对音效：音调随连击数沿半音阶上行，连击越高越明亮
  const playCorrect = () => {
    ensureAudio();
    const base = 587 * Math.pow(2, Math.min(state.streak, 10) / 12);
    tone(base, 0, 0.12);
    tone(base * 1.335, 0.1, 0.18);
  };
  const playWrong = () => { ensureAudio(); tone(196, 0, 0.28, 'square', 0.15); };
  const playClick = () => { ensureAudio(); tone(880, 0, 0.05, 'sine', 0.06); };
  const playHeartbeat = () => {
    ensureAudio();
    tone(75, 0, 0.1, 'sine', 0.4);
    tone(64, 0.13, 0.12, 'sine', 0.32);
  };
  const playLevelWin = () => {
    ensureAudio();
    tone(523, 0, 0.15); tone(659, 0.13, 0.15);
    tone(784, 0.26, 0.15); tone(1047, 0.42, 0.4);
  };
  const playAdvLose = () => {
    ensureAudio();
    tone(280, 0, 0.2, 'triangle', 0.22);
    tone(180, 0.18, 0.38, 'triangle', 0.22);
  };

  /* ============================================================
   * 游戏主流程
   * ============================================================ */

  function renderQuestion() {
    const q = state.question;
    const box1 = $('#box1');
    const box2 = $('#box2');
    const remSlot = $('#remSlot');
    const remKey = $('#remKey');

    $('#questionText').textContent = q.text;
    // 秘籍题面（连加 / 区间求和）较长时缩小字号，避免溢出
    $('#questionText').classList.toggle('small', q.text.length > 11);
    const hasRem = q.isDiv && q.remainder > 0;   // 只有真正带余数的除法才有第二个框
    remSlot.hidden = !hasRem;
    remKey.hidden = !hasRem;
    box1.value = '';
    box2.value = '';
    box1.placeholder = q.isDiv ? '商' : '';
    box2.placeholder = '余';
    box1.setAttribute('aria-label', q.isDiv ? '商' : '答案');
    box2.setAttribute('aria-label', '余数');
    focusBox(1);
  }

  function clearNextTimer() {
    if (state.nextTimer) clearTimeout(state.nextTimer);
    state.nextTimer = null;
  }

  function nextQuestion() {
    state.nextTimer = null;
    state.locked = false;
    if (state.scroll) state.scroll.awaitSkip = false;
    $('#questionCard').classList.remove('correct', 'wrong');
    state.question = genQuestion();
    renderQuestion();
    if (state.mode === 'scroll' && state.scroll && state.scroll.kind === 'test'
      && !state.scroll.ended && !state.scroll.cancelled) {
      startScrollQTimer();
    }
  }

  function scheduleNextQuestion(delay) {
    clearNextTimer();
    if (state.mode === 'adventure') {
      const runId = state.adv && state.adv.runId;
      const timerId = setTimeout(() => {
        if (state.nextTimer === timerId) state.nextTimer = null;
        if (state.mode !== 'adventure' || state.screen !== 'game' || !state.adv
          || state.adv.runId !== runId || state.adv.cancelled || state.adv.ending) return;
        if (state.adv.qIndex >= advLevel().count) {
          loseAdventure('exhausted');
          return;
        }
        nextQuestion();
      }, delay);
      state.nextTimer = timerId;
      return;
    }

    const mode = state.mode;
    const timerId = setTimeout(() => {
      if (state.nextTimer === timerId) state.nextTimer = null;
      if (state.mode !== mode || state.screen !== 'game') return;
      nextQuestion();
    }, delay);
    state.nextTimer = timerId;
  }

  function startQuestionFlow() {
    clearNextTimer();
    showFeedback('', '');
    nextQuestion();
  }

  function focusBox(n) {
    state.activeBox = n;
    const b1 = $('#box1');
    const b2 = $('#box2');
    b1.classList.toggle('active', n === 1);
    b2.classList.toggle('active', n === 2);
    (n === 1 ? b1 : b2).focus();
    const remKey = $('#remKey');
    if (!remKey.hidden) remKey.textContent = n === 1 ? '填写余数 →' : '← 修改商';
  }

  function appendDigit(d) {
    if (state.locked) return;
    const box = state.activeBox === 1 ? $('#box1') : $('#box2');
    // 除法的商和余数最多两位数；其他题型按答案实际位数（进阶加减乘可达三到四位数）
    const maxLen = state.question.isDiv ? 2 : String(state.question.answer).length;
    if (box.value.length >= maxLen) return;
    box.value += d;
    playClick();
    // 商输入两位后自动跳到余数框
    if (state.activeBox === 1 && !$('#remSlot').hidden && box.value.length >= 2) {
      focusBox(2);
    }
  }

  function removeDigit() {
    if (state.locked) return;
    const box = state.activeBox === 1 ? $('#box1') : $('#box2');
    box.value = box.value.slice(0, -1);
    playClick();
  }

  function submitAnswer() {
    if (state.locked) {
      // 秘籍答错后的分步提示较长，允许点 ✓ / 回车提前继续
      if (state.mode === 'scroll' && state.scroll && state.scroll.awaitSkip) {
        state.scroll.awaitSkip = false;
        clearNextTimer();
        if (state.scroll.qIndex >= scrollRunTotal()) endScrollRun();
        else nextQuestion();
      }
      return;
    }
    if (state.mode === 'challenge' && Date.now() >= state.deadline) {
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
    const box1 = $('#box1');
    const box2 = $('#box2');
    const remVisible = !$('#remSlot').hidden;

    if (!box1.value) {
      showFeedback('先写答案再确定哦～', 'hint');
      return;
    }
    // 带余数的除法必须填余数
    if (remVisible && !box2.value) {
      focusBox(2);
      showFeedback('还差余数哦，接着填～', 'hint');
      return;
    }

    if (state.mode === 'scroll') stopScrollQTimer();
    const v1 = parseInt(box1.value, 10);
    let ok;
    if (q.isDiv) {
      ok = v1 === q.quotient && (!remVisible || parseInt(box2.value, 10) === q.remainder);
    } else {
      ok = v1 === q.answer;
    }

    state.locked = true;
    if (state.mode === 'adventure') state.adv.qIndex += 1;
    if (state.mode === 'scroll') state.scroll.qIndex += 1;
    if (ok) onCorrect();
    else onWrong();
  }

  function onCorrect() {
    playCorrect();
    state.streak += 1;
    state.maxStreak = Math.max(state.maxStreak, state.streak);
    $('#questionCard').classList.add('correct');
    // 秘籍模式：答对时顺带复述口诀，加深记忆
    showFeedback(state.mode === 'scroll'
      ? pick(PRAISE) + ' 口诀：' + SCROLLS[state.scroll.index].mantra
      : pick(PRAISE), 'ok');
    confettiAt($('#questionCard'));
    if (state.streak >= 6) iceFirework();
    bumpTotalCorrect();
    let going = true;
    if (state.mode === 'challenge') {
      state.cCorrect += 1;
      state.score += CONFIG.basePoints + Math.max(0, state.streak - 1) * CONFIG.streakBonusStep;
    } else if (state.mode === 'adventure') {
      state.adv.correct += 1;
      going = advancePrincess();          // 公主前进一步；到达终点则进入胜利流程
    } else if (state.mode === 'scroll') {
      state.scroll.correct += 1;
      if (state.scroll.qIndex >= scrollRunTotal()) {
        going = false;
        scheduleScrollEnd();
      }
    } else {
      state.pCorrect += 1;
    }
    updateGameBar();
    if (going) scheduleNextQuestion(CONFIG.correctDelay);
  }

  function onWrong() {
    playWrong();
    state.streak = 0;
    $('#questionCard').classList.add('wrong');
    const q = state.question;
    const ansText = q.isDiv && q.remainder > 0 ? q.quotient + ' 余 ' + q.remainder : String(q.answer);
    if (state.mode === 'scroll') {
      // 秘籍模式的核心学习环节：答错时展示这道题自己的分步提示
      state.scroll.awaitSkip = true;
      showFeedback('正确答案是 ' + ansText + '\n' + q.hint.join('\n') + '\n（点 ✓ 或回车继续）', 'bad');
    } else {
      showFeedback('正确答案是 ' + ansText + '，加油！', 'bad');
    }
    let going = true;
    if (state.mode === 'challenge') state.cWrong += 1;
    else if (state.mode === 'adventure') {
      state.adv.wrong += 1;
      going = advanceMonster(true);       // 怪兽逼近一步；追上则进入失败流程
    } else if (state.mode === 'scroll') {
      state.scroll.wrong += 1;
      if (state.scroll.qIndex >= scrollRunTotal()) {
        going = false;
        scheduleScrollEnd();
      }
    } else {
      state.pWrong += 1;
    }
    updateGameBar();
    if (going) {
      const delay = state.mode === 'adventure' ? CONFIG.wrongDelay + 300
        : state.mode === 'scroll' ? CONFIG.scrollHintDelay : CONFIG.wrongDelay;
      scheduleNextQuestion(delay);
    }
  }

  function updateGameBar() {
    const diffName = DIFF_NAMES[state.difficulty];
    if (state.mode === 'adventure') {
      const w = WORLDS[state.adv.wid];
      const lv = w.levels[state.adv.lid];
      $('#gameModeLabel').textContent = w.emoji + ' ' + w.name + ' · ' + lv.name;
      $('#gameStats').textContent = '第 ' + Math.min(state.adv.qIndex, lv.count) + '/' + lv.count + ' 题'
        + (state.streak >= 2 ? '  ✨×' + state.streak : '');
    } else if (state.mode === 'challenge') {
      $('#gameModeLabel').textContent = '挑战模式 · ' + diffName;
      $('#gameStats').textContent = '得分 ' + state.score + (state.streak >= 2 ? '  🔥×' + state.streak : '');
    } else if (state.mode === 'scroll') {
      const sc = SCROLLS[state.scroll.index];
      const total = scrollRunTotal();
      $('#gameModeLabel').textContent = '📖 ' + sc.name + (state.scroll.kind === 'test' ? ' · 掌握考验' : ' · 演练');
      $('#gameStats').textContent = '第 ' + Math.min(state.scroll.qIndex + 1, total) + '/' + total
        + ' 题 · ✓' + state.scroll.correct;
    } else {
      const total = state.pCorrect + state.pWrong;
      const rate = total > 0 ? Math.round((100 * state.pCorrect) / total) : 0;
      $('#gameModeLabel').textContent = '练习模式 · ' + diffName;
      $('#gameStats').textContent = '答对 ' + state.pCorrect + ' · 答错 ' + state.pWrong + ' · ' + rate + '%';
    }
  }

  /* ---------------- 挑战模式计时 ---------------- */

  function startTimer() {
    state.deadline = Date.now() + CONFIG.challengeSeconds * 1000;
    $('#timerRow').hidden = false;
    tickTimer();
    state.timerId = setInterval(tickTimer, 100);
  }

  // 用截止时间戳计算剩余时间：不受浮点累加误差和浏览器后台节流影响
  function tickTimer() {
    state.timeLeft = Math.max(0, (state.deadline - Date.now()) / 1000);
    updateTimer();
    if (state.timeLeft <= 0) {
      stopTimer();
      endChallenge();
    }
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  function updateTimer() {
    const secs = Math.max(0, Math.ceil(state.timeLeft));
    $('#timerText').textContent = secs + ' 秒';
    const bar = $('#timerBar');
    const pct = Math.max(0, Math.min(100, (state.timeLeft / CONFIG.challengeSeconds) * 100));
    bar.style.width = pct + '%';
    bar.classList.toggle('warn', pct <= 50 && pct > 25);
    bar.classList.toggle('danger', pct <= 25);
  }

  /* ---------------- 模式启动 / 结束 ---------------- */

  function startPractice() {
    cancelAdventureRun();
    stopTimer();
    clearNextTimer();
    state.mode = 'practice';
    state.streak = 0;
    state.maxStreak = 0;
    state.pCorrect = 0;
    state.pWrong = 0;
    $('#timerRow').hidden = true;
    showScreen('game');
    updateGameBar();
    startQuestionFlow();
  }

  function startChallenge() {
    cancelAdventureRun();
    stopTimer();
    clearNextTimer();
    state.mode = 'challenge';
    state.score = 0;
    state.streak = 0;
    state.maxStreak = 0;
    state.cCorrect = 0;
    state.cWrong = 0;
    $('#timerRow').hidden = false;
    showScreen('game');
    updateGameBar();
    startQuestionFlow();
    startTimer();
  }

  function endPractice() {
    clearNextTimer();
    const total = state.pCorrect + state.pWrong;
    const rate = total > 0 ? Math.round((100 * state.pCorrect) / total) : 0;
    showResult({
      title: '📝 本轮练习结束',
      lines: [
        ['答对', state.pCorrect + ' 题'],
        ['答错', state.pWrong + ' 题'],
        ['总题数', total + ' 题'],
        ['正确率', rate + '%'],
      ],
      best: null,
      isRecord: false,
    });
  }

  function endChallenge() {
    if (state.mode !== 'challenge' || state.screen !== 'game') return;
    stopTimer();
    clearNextTimer();
    state.locked = true;
    const total = state.cCorrect + state.cWrong;
    const rate = total > 0 ? Math.round((100 * state.cCorrect) / total) : 0;
    const bestKey = 'sxd_best_' + state.difficulty;
    const prev = loadChallengeBest(bestKey);
    const isRecord = state.score > 0 && (prev === null || state.score > prev.score);
    if (isRecord) {
      saveBest(bestKey, {
        score: state.score,
        correct: state.cCorrect,
        maxStreak: state.maxStreak,
        date: new Date().toLocaleDateString(),
      });
    }
    showResult({
      title: '⏱️ 时间到！',
      lines: [
        ['得分', state.score + ' 分'],
        ['答对', state.cCorrect + ' 题'],
        ['答错', state.cWrong + ' 题'],
        ['正确率', rate + '%'],
        ['最高连击', '×' + state.maxStreak],
      ],
      best: loadChallengeBest(bestKey),
      isRecord: isRecord,
    });
  }

  function renderStatRows(container, rows) {
    container.textContent = '';
    rows.forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const label = document.createElement('span');
      label.className = 'stat-label';
      label.textContent = String(key);
      const result = document.createElement('span');
      result.className = 'stat-value';
      result.textContent = String(value);
      row.append(label, result);
      container.appendChild(row);
    });
  }

  function showResult(opts) {
    $('#resultTitle').textContent = opts.title;
    $('#starsRow').hidden = true;
    $('#advBtns').hidden = true;
    $('#scrollBtns').hidden = true;
    $('#normalBtns').hidden = false;
    renderStatRows($('#resultStats'), opts.lines);

    const bestBox = $('#bestBox');
    bestBox.textContent = '';
    if (opts.best) {
      const b = opts.best;
      const summary = document.createElement('div');
      summary.textContent = '🏆 历史最佳：' + b.score + ' 分（答对 ' + b.correct
        + ' 题 · 连击 ×' + b.maxStreak + '，' + b.date + '）';
      bestBox.appendChild(summary);
      if (opts.isRecord) {
        const record = document.createElement('div');
        record.className = 'record-tip';
        record.textContent = '🎉 新纪录！太厉害了！';
        bestBox.appendChild(record);
      }
      bestBox.hidden = false;
    } else {
      bestBox.hidden = true;
    }
    showScreen('result');
  }

  /* ---------------- 纪录存取 ---------------- */

  function loadBest(key) {
    const raw = storageGet(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function normalizeChallengeBest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const score = Math.trunc(Number(value.score));
    const correct = Math.trunc(Number(value.correct));
    const maxStreak = Math.trunc(Number(value.maxStreak));
    if (![score, correct, maxStreak].every(Number.isFinite)
      || score < 0 || correct < 0 || maxStreak < 0) return null;
    return {
      score,
      correct,
      maxStreak,
      date: String(value.date || '').slice(0, 32),
    };
  }

  function loadChallengeBest(key) {
    return normalizeChallengeBest(loadBest(key));
  }

  function saveBest(key, val) {
    storageSet(key, JSON.stringify(val));
  }

  function renderHomeBest() {
    const fmt = (x) => (x ? x.score + ' 分' : '暂无');
    const b = loadChallengeBest('sxd_best_basic');
    const a = loadChallengeBest('sxd_best_advanced');
    $('#homeBest').textContent =
      '🏆 挑战纪录　基础：' + fmt(b) + '　·　进阶：' + fmt(a);
  }

  /* ============================================================
   * 特效：彩带 / 雪花 / 冰晶绽放（DOM 粒子，transform+opacity，播完即删）
   * ============================================================ */
  const CONFETTI_COLORS = ['#ff9ecb', '#ffd94a', '#7cc4f5', '#9fe8ff', '#b6f5a8', '#f5b301'];
  const SNOW_CHARS = ['❄', '✨', '❅', '❆', '✦'];

  function fxLayerEl() { return $('#fxLayer'); }

  function spawnParticles(x, y, n, opts) {
    const layer = fxLayerEl();
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'particle';
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 120;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist * 0.75 - 30;
      const isSnow = opts && opts.snow && Math.random() < 0.4;
      if (isSnow) {
        el.textContent = SNOW_CHARS[(Math.random() * SNOW_CHARS.length) | 0];
        el.style.fontSize = (12 + Math.random() * 10) + 'px';
        el.style.color = opts.colors[(Math.random() * opts.colors.length) | 0];
      } else {
        el.style.width = (6 + Math.random() * 5) + 'px';
        el.style.height = (9 + Math.random() * 5) + 'px';
        el.style.borderRadius = '2px';
        el.style.background = opts.colors[(Math.random() * opts.colors.length) | 0];
      }
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', dx.toFixed(0) + 'px');
      el.style.setProperty('--dy', dy.toFixed(0) + 'px');
      el.style.setProperty('--rot', ((Math.random() * 720 - 360) | 0) + 'deg');
      el.style.setProperty('--t', (0.65 + Math.random() * 0.45).toFixed(2) + 's');
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1150);
    }
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // 答对：从题目卡片喷彩带 + 雪花
  function confettiAt(el) {
    if (!el) return;
    const c = centerOf(el);
    spawnParticles(c.x, c.y - 20, 24, { colors: CONFETTI_COLORS, snow: true });
  }

  // 冰晶绽放：全屏 2-3 个炸点
  function iceFirework() {
    const pts = [
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.38 },
      { x: window.innerWidth * (0.25 + Math.random() * 0.2), y: window.innerHeight * 0.5 },
      { x: window.innerWidth * (0.6 + Math.random() * 0.2), y: window.innerHeight * 0.55 },
    ];
    pts.forEach((p, i) => {
      setTimeout(() => spawnParticles(p.x, p.y, 30, { colors: ['#9fe8ff', '#d6f4ff', '#7cc4f5', '#fff'], snow: true }), i * 160);
    });
  }

  // 累计答对里程碑：每 50 题全屏庆祝
  function bumpTotalCorrect() {
    let total = parseInt(storageGet('sxd_total'), 10) || 0;
    total += 1;
    storageSet('sxd_total', String(total));
    if (total % 50 === 0) {
      iceFirework();
      showFeedback('累计答对 ' + total + ' 题！🎉 冰晶绽放！', 'ok');
    }
  }

  /* ============================================================
   * 闯关冒险：追逐引擎
   * ============================================================ */
  function advLevel() { return WORLDS[state.adv.wid].levels[state.adv.lid]; }
  function advLevelId() { return levelId(state.adv.wid, state.adv.lid); }

  // 逻辑位置 0-1 映射到跑道像素：公主从 22% 跑到 82%（终点水晶旁），
  // 负位置（怪兽落后的 lag）向左展开到 4%，保证开局两者视觉间隔明显
  function placeRunner(el, pos) {
    const track = $('#chaseTrack');
    const w = track.clientWidth;
    const x = Math.max(2, (0.22 + Math.max(pos, -CONFIG.chase.lag) * 0.60) * w);
    el.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
  }

  function updateDanger() {
    const ch = CONFIG.chase;
    const dist = state.adv.princess - state.adv.monster;
    const track = $('#chaseTrack');
    const danger = dist < ch.dangerDist;
    track.classList.toggle('danger', danger);
    const tip = $('#chaseTip');
    if (danger) {
      tip.textContent = '怪兽逼近了，答对让公主跑快点！';
      playHeartbeat();
    } else {
      const lv = advLevel();
      tip.textContent = (lv.boss ? '⚔️ BOSS · ' : '🚩 ') + lv.name + (lv.boss ? ' · 怪兽加速了！' : '');
    }
  }

  function startChaseTimer() {
    stopChaseTimer();
    const runId = state.adv.runId;
    let lastTick = performance.now();
    state.adv.timer = setInterval(() => {
      if (!state.adv || state.adv.runId !== runId || state.adv.cancelled
        || state.screen !== 'game' || state.adv.ending) return;
      const ch = CONFIG.chase;
      // 用真实流逝时间推进（后台节流回来最多补 3 秒，避免怪兽瞬间贴脸）
      const now = performance.now();
      const dtMs = Math.min(now - lastTick, 3000);
      lastTick = now;
      state.adv.monster += state.adv.speed * (dtMs / 1000);
      placeRunner($('#chaseMonster'), state.adv.monster);
      updateDanger();
      if (state.adv.monster >= state.adv.princess - ch.margin) loseAdventure('caught');
    }, CONFIG.chase.tickMs);
  }

  function stopChaseTimer() {
    if (state.adv && state.adv.timer) clearInterval(state.adv.timer);
    if (state.adv) state.adv.timer = null;
  }

  // 答对：公主前进一步；到达终点则胜利。返回 false 表示本局已结束
  // 位置由整数 correct 重算（而非累加），避免 1/6×6=0.9999… 的浮点误差
  function advancePrincess() {
    const lv = advLevel();
    state.adv.princess = Math.min(1, state.adv.correct / lv.need);
    placeRunner($('#chasePrincess'), state.adv.princess);
    if (state.adv.correct >= lv.need) {
      winAdventure();
      return false;
    }
    return true;
  }

  // 答错：怪兽额外逼近；追上则失败。返回 false 表示本局已结束
  function advanceMonster() {
    const ch = CONFIG.chase;
    state.adv.monster += ch.wrongStep;
    placeRunner($('#chaseMonster'), state.adv.monster);
    updateDanger();
    if (state.adv.monster >= state.adv.princess - ch.margin) {
      loseAdventure('caught');
      return false;
    }
    return true;
  }

  function setupChaseUI() {
    const w = WORLDS[state.adv.wid];
    const lv = advLevel();
    const track = $('#chaseTrack');
    track.className = 'chase-track ' + w.theme;
    $('#chaseMonster').innerHTML = SVGS[w.monster];
    $('#chasePrincess').innerHTML = SVGS.princess;
    $('#chaseGoal').innerHTML = SVGS.crystal;
    $('#chaseTip').textContent = (lv.boss ? '⚔️ BOSS · ' : '🚩 ') + lv.name + (lv.boss ? ' · 怪兽加速了！' : '');
    $('#chasePrincess').classList.remove('win');
    placeRunner($('#chasePrincess'), 0);
    placeRunner($('#chaseMonster'), state.adv.monster);
  }

  function startAdventure(wid, lid) {
    const entry = LEVELS.find((item) => item.wid === wid && item.lid === lid);
    if (!entry) return;
    cancelAdventureRun();
    stopTimer();
    const ch = CONFIG.chase;
    state.mode = 'adventure';
    state.streak = 0;
    state.maxStreak = 0;
    state.adv = {
      wid, lid,
      runId: ++state.adventureRunSeq,
      qIndex: 0, correct: 0, wrong: 0,
      princess: 0, monster: -ch.lag,
      speed: 0, timer: null, resultTimer: null,
      ending: false, cancelled: false,
    };
    const lv = entry.level;
    const secPerQ = lv.boss ? ch.bossSecPerQ : ch.secPerQ;
    state.adv.speed = (1 + ch.lag) / ((lv.count + ch.extraQ) * secPerQ);
    $('#timerRow').hidden = true;
    $('#chaseScene').hidden = false;
    showScreen('game');          // 先切换屏幕让跑道完成布局，再摆放角色
    setupChaseUI();              // 否则 clientWidth 为 0，开局位置全部塌缩到最左
    updateGameBar();
    startQuestionFlow();
    startChaseTimer();
  }

  function stopAdventure() {
    clearNextTimer();
    stopChaseTimer();
    if (state.adv && state.adv.resultTimer) clearTimeout(state.adv.resultTimer);
    if (state.adv) state.adv.resultTimer = null;
    $('#chaseScene').hidden = true;
    document.body.classList.remove('dim');
  }

  function cancelAdventureRun() {
    if (state.adv) {
      state.adv.cancelled = true;
      state.adv.ending = true;
    }
    stopAdventure();
  }

  function winAdventure() {
    if (!state.adv || state.adv.ending || state.adv.cancelled) return;
    state.adv.ending = true;
    clearNextTimer();
    stopChaseTimer();
    const runId = state.adv.runId;
    const lv = advLevel();
    // 星星按「实际作答」的正确率：零失误通关即 3 星（不除以总题数）
    const answered = state.adv.correct + state.adv.wrong;
    const rate = state.adv.correct / Math.max(1, answered);
    const stars = rate >= 0.999 ? 3 : rate >= 0.85 ? 2 : 1;
    // 存档（保留历史最高星）
    const map = loadAdvStars();
    map[advLevelId()] = Math.max(map[advLevelId()] || 0, stars);
    saveAdvStars(map);
    $('#chasePrincess').classList.add('win');
    playLevelWin();
    const c = centerOf($('#chasePrincess'));
    spawnParticles(c.x, c.y, 30, { colors: CONFETTI_COLORS, snow: true });
    state.adv.resultTimer = setTimeout(() => {
      if (!state.adv || state.adv.runId !== runId || state.adv.cancelled) return;
      state.adv.resultTimer = null;
      showAdvResult(true, stars);
    }, 1100);
  }

  function loseAdventure(reason) {
    if (!state.adv || state.adv.ending || state.adv.cancelled) return;
    state.adv.ending = true;
    clearNextTimer();
    stopChaseTimer();
    const runId = state.adv.runId;
    playAdvLose();
    document.body.classList.add('dim');
    // 怪兽扑向公主
    state.adv.monster = state.adv.princess - 0.015;
    placeRunner($('#chaseMonster'), state.adv.monster);
    state.adv.resultTimer = setTimeout(() => {
      if (!state.adv || state.adv.runId !== runId || state.adv.cancelled) return;
      state.adv.resultTimer = null;
      document.body.classList.remove('dim');
      showAdvResult(false, 0, reason);
    }, 1000);
  }

  function showAdvResult(won, stars, reason) {
    stopAdventure();
    const lv = advLevel();
    const w = WORLDS[state.adv.wid];
    const cleared = advUnlockedTo(loadAdvStars()) >= TOTAL_LEVELS;

    $('#resultTitle').textContent = won
      ? (advLevelId() === TOTAL_LEVELS - 1 ? '👑 恶龙被打败，王国获救啦！' : '🎉 公主到达终点！')
      : (reason === 'caught' ? '😱 怪兽追上公主了！' : '🏃 题目答完还没到达…');
    renderStatRows($('#resultStats'), [
      ['世界', w.emoji + ' ' + w.name + ' · ' + lv.name],
      ['答对', state.adv.correct + ' 题（需 ' + lv.need + '）'],
      ['水晶碎片', won ? '💎 已收集！' : '下次再来'],
      ['最高连击', '×' + state.maxStreak],
    ]);

    // 星星动画：先复位再逐颗弹出
    const starsRow = $('#starsRow');
    starsRow.hidden = false;
    [1, 2, 3].forEach((n) => {
      const el = $('#star' + n);
      el.className = 'big-star' + (won && n <= stars ? '' : ' off-star');
      void el.offsetWidth;                 // 强制 reflow 让动画重新触发
      el.classList.add('on');
    });
    $('#bestBox').hidden = true;
    $('#normalBtns').hidden = true;
    $('#scrollBtns').hidden = true;
    $('#advBtns').hidden = false;
    const hasNext = advLevelId() + 1 < TOTAL_LEVELS;
    $('#nextLevelBtn').hidden = !(won && hasNext);
    $('#retryBtn').hidden = false;
    $('#retryBtn').textContent = won ? (hasNext ? '再玩一次本关' : '重温本关') : '再试一次';
    if (!won) showFeedback(pick(ENCOURAGE), 'hint');

    if (won && stars === 3) setTimeout(iceFirework, 600);
    if (won && !hasNext) setTimeout(iceFirework, 900);
    if (won && cleared && advLevelId() === TOTAL_LEVELS - 1) setTimeout(iceFirework, 1200);
    showScreen('result');
  }

  /* ---------------- 关卡地图 ---------------- */
  function renderMap() {
    const stars = loadAdvStars();
    const unlockedTo = advUnlockedTo(stars);
    const crystals = Object.keys(stars).length;
    $('#mapCrystal').textContent = '💎 ' + crystals + ' / ' + TOTAL_LEVELS;
    $('#finaleBanner').hidden = crystals < TOTAL_LEVELS;

    const wrap = $('#mapWorlds');
    wrap.innerHTML = '';
    WORLDS.forEach((w, wi) => {
      const block = document.createElement('div');
      block.className = 'map-world ' + w.theme;
      const title = document.createElement('div');
      title.className = 'map-world-title';
      title.innerHTML = w.emoji + ' ' + w.name + ' <span class="w-sub">' + w.sub + '</span>';
      block.appendChild(title);
      const row = document.createElement('div');
      row.className = 'map-levels';
      w.levels.forEach((lv, li) => {
        const id = levelId(wi, li);
        const unlocked = id <= unlockedTo;
        const got = stars[id] || 0;
        const node = document.createElement('button');
        node.className = 'map-node' + (lv.boss ? ' boss' : '') + (unlocked ? '' : ' locked') + (id === unlockedTo && unlockedTo < TOTAL_LEVELS ? ' current' : '');
        node.innerHTML =
          (id === unlockedTo && unlockedTo < TOTAL_LEVELS ? '<span class="node-princess">' + SVGS.princess + '</span>' : '') +
          '<span class="node-num">' + (unlocked ? (lv.boss ? '👑' : id + 1) : '🔒') + '</span>' +
          '<span class="node-name">' + lv.name + '</span>' +
          '<span class="node-stars">' + (unlocked ? [1, 2, 3].map(n => n <= got ? '★' : '<span class="off">★</span>').join('') : '') + '</span>';
        if (unlocked) {
          node.addEventListener('click', () => { playClick(); startAdventure(wi, li); });
        }
        row.appendChild(node);
      });
      block.appendChild(row);
      wrap.appendChild(block);
    });
  }

  function renderHomeAdv() {
    const stars = loadAdvStars();
    const crystals = Object.keys(stars).length;
    const starSum = Object.keys(stars).reduce((s, k) => s + stars[k], 0);
    $('#homeAdv').textContent = '💎 水晶 ' + crystals + '/' + TOTAL_LEVELS + ' · ⭐ ' + starSum + '/' + TOTAL_LEVELS * 3;
  }

  /* ============================================================
   * 速算秘籍（上卷 · 速算技巧）：学 → 演练 → 掌握考验
   * 每张秘籍 = 口诀 + 分步演示 + 定向出题器；答错时展示该题的分步提示
   * ============================================================ */

  // —— 定向出题器：生成的题目必须真正符合对应技巧的特征 ——

  function genScrollTen() {
    if (Math.random() < 0.5) {
      // 凑十法：两个一位数相加，一定进位
      const a = randInt(5, 9);
      const b = randInt(6, 9);
      const rest = a + b - 10;
      return {
        text: a + ' + ' + b, answer: a + b,
        hint: ['见 ' + b + ' 想 ' + (10 - b), '拆一拆：' + a + ' = ' + (10 - b) + ' + ' + rest,
          '先凑十：' + (10 - b) + ' + ' + b + ' = 10', '再加剩：10 + ' + rest + ' = ' + (a + b)],
      };
    }
    // 连加凑整：首尾两个数凑成 100
    const a = randInt(11, 89);
    const b = randInt(11, 89);
    const c = 100 - a;
    return {
      text: a + ' + ' + b + ' + ' + c, answer: 100 + b,
      hint: ['找好朋友凑整：' + a + ' + ' + c + ' = 100', '再算：100 + ' + b + ' = ' + (100 + b)],
    };
  }

  function genScrollSubProp() {
    const a = randInt(150, 699);
    const b = randInt(21, 79);
    const c = 100 - b;
    return {
      text: a + ' − ' + b + ' − ' + c, answer: a - 100,
      hint: ['连减 = 减去它们的和：' + b + ' + ' + c + ' = 100', '一次减掉：' + a + ' − 100 = ' + (a - 100)],
    };
  }

  function genScrollNear100() {
    if (Math.random() < 0.5) {
      // 加法：第一个数接近整百
      const base = pick([100, 200, 300, 400, 500]);
      const d = randInt(1, 3);
      const low = Math.random() < 0.5;
      const a = base + (low ? -d : d);
      const b = randInt(21, 499);
      const mid = b + base;
      return {
        text: a + ' + ' + b, answer: a + b,
        hint: ['把 ' + a + ' 看成 ' + base, base + ' + ' + b + ' = ' + mid,
          (low ? '多算了 ' : '少算了 ') + d + '，' + (low ? '减去' : '补上')
            + '：' + mid + (low ? ' − ' : ' + ') + d + ' = ' + (a + b)],
      };
    }
    // 减法：减数接近整百
    const base = pick([100, 200, 300, 400]);
    const d = randInt(1, 3);
    const low = Math.random() < 0.5;
    const b = base + (low ? -d : d);
    const a = b + randInt(15, 400);
    const mid = a - base;
    return {
      text: a + ' − ' + b, answer: a - b,
      hint: ['把 ' + b + ' 看成 ' + base, a + ' − ' + base + ' = ' + mid,
        (low ? '多减了 ' : '少减了 ') + d + '，' + (low ? '加回' : '再减')
          + '：' + mid + (low ? ' + ' : ' − ') + d + ' = ' + (a - b)],
    };
  }

  function genScrollFold() {
    if (Math.random() < 0.5) {
      const a = 2 * randInt(6, 49);           // 12~98 的偶数
      const half = a / 2;
      return {
        text: a + ' × 5', answer: a * 5,
        hint: ['×5 = 先 ÷2 再 ×10', a + ' ÷ 2 = ' + half, half + ' × 10 = ' + a * 5],
      };
    }
    const a = 4 * randInt(3, 24);             // 12~96（4 的倍数）
    const quarter = a / 4;
    return {
      text: a + ' × 25', answer: a * 25,
      hint: ['×25 = 先 ÷4 再 ×100', a + ' ÷ 4 = ' + quarter, quarter + ' × 100 = ' + a * 25],
    };
  }

  function genScrollDistr() {
    const a = randInt(13, 89);
    if (Math.random() < 0.5) {
      return {
        text: a + ' × 99', answer: a * 99,
        hint: ['99 = 100 − 1', a + ' × 100 = ' + a * 100, a * 100 + ' − ' + a + ' = ' + a * 99],
      };
    }
    return {
      text: a + ' × 101', answer: a * 101,
      hint: ['101 = 100 + 1', a + ' × 100 = ' + a * 100, a * 100 + ' + ' + a + ' = ' + a * 101],
    };
  }

  function genScrollEleven() {
    const carry = Math.random() < 0.5;
    let t, u;
    if (carry) {
      t = randInt(2, 9);
      u = randInt(10 - t, 9);                 // 十位+个位 ≥ 10，需要进位
    } else {
      t = randInt(1, 9);
      u = randInt(0, 9 - t);                  // 不进位
    }
    const a = t * 10 + u;
    const s = t + u;
    if (!carry) {
      return {
        text: a + ' × 11', answer: a * 11,
        hint: ['两边一拉：' + t + ' ▢ ' + u, '中间相加：' + t + ' + ' + u + ' = ' + s,
          '拼起来：' + t + s + u],
      };
    }
    return {
      text: a + ' × 11', answer: a * 11,
      hint: ['两边一拉：' + t + ' ▢ ' + u, '中间相加：' + t + ' + ' + u + ' = ' + s + '（满十）',
        '写 ' + (s % 10) + ' 进 1，答案是 ' + (t + 1) + (s % 10) + u],
    };
  }

  function genScrollHeadTen() {
    const x = randInt(2, 9);                  // 十位（头）相同
    const y = randInt(1, 9);                  // 个位（尾）
    const a = x * 10 + y;
    const b = x * 10 + (10 - y);              // 个位合十
    const head = x * (x + 1);
    const tail = y * (10 - y);
    return {
      text: a + ' × ' + b, answer: a * b,
      hint: ['条件：十位都是 ' + x + '，个位 ' + y + ' + ' + (10 - y) + ' = 10',
        '头：' + x + ' × ' + (x + 1) + ' = ' + head,
        '尾：' + y + ' × ' + (10 - y) + ' = ' + tail + (tail < 10 ? '（不够两位补 0 → ' + ('0' + tail) + '）' : ''),
        '拼起来：' + head + ('0' + tail).slice(-2)],
    };
  }

  function genScrollGauss() {
    if (Math.random() < 0.5) {
      const n = randInt(8, 20);
      return {
        text: '1 + 2 + 3 + … + ' + n, answer: n * (n + 1) / 2,
        hint: ['首尾配对：1 + ' + n + ' = ' + (n + 1), '一共 ' + n + ' 个数：' + (n + 1) + ' × ' + n + ' = ' + n * (n + 1),
          '每对算了两遍，÷2：' + n * (n + 1) / 2],
      };
    }
    const a = randInt(12, 60);
    const n = randInt(5, 12);
    const b = a + n - 1;
    return {
      text: a + ' + ' + (a + 1) + ' + ' + (a + 2) + ' + … + ' + b, answer: (a + b) * n / 2,
      hint: ['首尾配对：' + a + ' + ' + b + ' = ' + (a + b), '一共 ' + n + ' 个数：' + (a + b) + ' × ' + n + ' = ' + (a + b) * n,
        '再 ÷2：' + (a + b) * n / 2],
    };
  }

  // —— 秘籍清单（上卷 · 速算技巧，按顺序解锁）——
  const SCROLLS = [
    {
      id: 'ten', emoji: '🤝', tier: '入门', name: '凑十与凑整',
      mantra: '见 9 想 1，见 8 想 2，先凑整',
      demos: [
        { q: '7 + 8', steps: [['见 8 想 2', '8 和 2 是好朋友'], ['拆一拆', '7 = 2 + 5'], ['先凑十', '2 + 8 = 10'], ['再加剩下', '10 + 5 = 15']] },
        { q: '25 + 38 + 75', steps: [['找好朋友', '25 + 75 = 100'], ['再加剩下的', '100 + 38 = 138']] },
      ],
      gen: genScrollTen,
    },
    {
      id: 'subprop', emoji: '🪄', tier: '入门', name: '减法性质',
      mantra: '连减两个数，等于减去它们的和',
      demos: [
        { q: '250 − 37 − 63', steps: [['后两数先牵手', '37 + 63 = 100'], ['一次减掉', '250 − 100 = 150']] },
        { q: '347 − 58 − 42', steps: [['后两数先牵手', '58 + 42 = 100'], ['一次减掉', '347 − 100 = 247']] },
      ],
      gen: genScrollSubProp,
    },
    {
      id: 'near100', emoji: '🎯', tier: '入门', name: '接近整百',
      mantra: '先看成整百算，多退少补',
      demos: [
        { q: '298 + 456', steps: [['把 298 看成 300', '456 + 300 = 756'], ['多加了 2，减回去', '756 − 2 = 754']] },
        { q: '502 − 197', steps: [['把 197 看成 200', '502 − 200 = 302'], ['多减了 3，补回来', '302 + 3 = 305']] },
      ],
      gen: genScrollNear100,
    },
    {
      id: 'fold', emoji: '⚡', tier: '进阶', name: '×5 与 ×25',
      mantra: '×5 折半乘十，×25 除四乘百',
      demos: [
        { q: '36 × 5', steps: [['先折半', '36 ÷ 2 = 18'], ['再乘 10', '18 × 10 = 180']] },
        { q: '48 × 25', steps: [['先除以 4', '48 ÷ 4 = 12'], ['再乘 100', '12 × 100 = 1200']] },
      ],
      gen: genScrollFold,
    },
    {
      id: 'distr', emoji: '✨', tier: '进阶', name: '×99 与 ×101',
      mantra: '×99 少一个，×101 多一个',
      demos: [
        { q: '34 × 99', steps: [['99 = 100 − 1', '34 × 100 − 34'], ['算出来', '3400 − 34 = 3366']] },
        { q: '45 × 101', steps: [['101 = 100 + 1', '45 × 100 + 45'], ['算出来', '4500 + 45 = 4545']] },
      ],
      gen: genScrollDistr,
    },
    {
      id: 'eleven', emoji: '🔮', tier: '进阶', name: '×11 秘技',
      mantra: '两边一拉，中间相加，满十进一',
      demos: [
        { q: '34 × 11', steps: [['两边一拉', '3 ▢ 4'], ['中间相加', '3 + 4 = 7 → 374']] },
        { q: '67 × 11', steps: [['中间相加满十', '6 + 7 = 13'], ['写 3 进 1', '(6+1) 3 7 → 737']] },
      ],
      gen: genScrollEleven,
    },
    {
      id: 'headten', emoji: '💞', tier: '高手', name: '头同尾合十',
      mantra: '头×(头+1)，拼上尾×尾',
      demos: [
        { q: '23 × 27', steps: [['看条件', '十位都是 2，个位 3+7=10'], ['算头', '2 × 3 = 6'], ['算尾', '3 × 7 = 21'], ['拼一起', '6 | 21 → 621']] },
      ],
      gen: genScrollHeadTen,
    },
    {
      id: 'gauss', emoji: '📿', tier: '高手', name: '高斯求和',
      mantra: '(首 + 尾) × 项数 ÷ 2',
      demos: [
        { q: '1 + 2 + 3 + … + 10', steps: [['首尾配对', '1 + 10 = 11'], ['一共 10 个数', '11 × 10 = 110'], ['每对算了两遍', '110 ÷ 2 = 55']] },
        { q: '21 + 22 + … + 30', steps: [['首尾配对', '21 + 30 = 51'], ['一共 10 个数', '51 × 10 = 510'], ['再除以 2', '510 ÷ 2 = 255']] },
      ],
      gen: genScrollGauss,
    },
  ];

  /* ---------------- 秘籍存档与进度 ---------------- */
  function normalizeScrollStars(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const candidate = {};
    SCROLLS.forEach((sc, idx) => {
      const stars = Math.trunc(Number(value[sc.id]));
      if (Number.isInteger(stars) && stars >= 1 && stars <= 3) candidate[idx] = stars;
    });
    // 与闯关存档同理：必须从头连续学会，跳学的数据不采用
    const clean = {};
    for (let i = 0; i < SCROLLS.length && candidate[i]; i++) clean[SCROLLS[i].id] = candidate[i];
    return clean;
  }

  function loadScrollStars() { return normalizeScrollStars(loadBest('sxd_scrolls')); }
  function saveScrollStars(map) { saveBest('sxd_scrolls', normalizeScrollStars(map)); }

  function scrollUnlockedTo(stars) {
    let i = 0;
    while (i < SCROLLS.length && stars[SCROLLS[i].id]) i += 1;
    return i;   // 第一张未学会的索引；等于总数表示全部解锁
  }

  function scrollsProgressText() {
    const stars = loadScrollStars();
    const learned = Object.keys(stars).length;
    const mastered = SCROLLS.filter((sc) => (stars[sc.id] || 0) >= 2).length;
    return '📖 学会 ' + learned + '/' + SCROLLS.length + ' · 🌟 掌握 ' + mastered + '/' + SCROLLS.length;
  }

  /* ---------------- 秘籍书架屏 ---------------- */
  let scrollTipTimer = null;
  function scrollShelfTip(msg) {
    const tip = $('#scrollTip');
    tip.textContent = msg;
    if (scrollTipTimer) clearTimeout(scrollTipTimer);
    scrollTipTimer = setTimeout(() => { tip.textContent = ''; }, 2200);
  }

  function renderScrollShelf() {
    const stars = loadScrollStars();
    const unlockedTo = scrollUnlockedTo(stars);
    const mastered = SCROLLS.filter((sc) => (stars[sc.id] || 0) >= 2).length;
    $('#scrollsProgress').textContent = '🌟 掌握 ' + mastered + ' / ' + SCROLLS.length;
    $('#scrollsMaster').hidden = mastered < SCROLLS.length;

    const shelf = $('#scrollShelf');
    shelf.textContent = '';
    SCROLLS.forEach((sc, i) => {
      const got = stars[sc.id] || 0;
      const unlocked = i <= unlockedTo;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'scroll-item' + (unlocked ? '' : ' locked')
        + (i === unlockedTo && unlockedTo < SCROLLS.length ? ' current' : '');
      const head = document.createElement('span');
      head.className = 'scroll-item-head';
      const num = document.createElement('span');
      num.className = 'scroll-num';
      num.textContent = unlocked ? (i + 1) : '🔒';
      const name = document.createElement('span');
      name.className = 'scroll-item-name';
      name.textContent = sc.emoji + ' ' + sc.name;
      head.append(num, name);
      const mantra = document.createElement('span');
      mantra.className = 'scroll-item-mantra';
      mantra.textContent = unlocked ? '「' + sc.mantra + '」' : '？？？';
      const status = document.createElement('span');
      status.className = 'scroll-item-stars';
      status.textContent = unlocked ? [1, 2, 3].map((n) => (n <= got ? '★' : '☆')).join('') : '';
      card.append(head, mantra, status);
      card.addEventListener('click', () => {
        if (!unlocked) {
          scrollShelfTip('🔒 先学会上一张「' + SCROLLS[i - 1].name + '」就能解锁啦');
          return;
        }
        playClick();
        openScrollLearn(i);
      });
      shelf.appendChild(card);
    });
  }

  /* ---------------- 秘籍学习屏 ---------------- */
  function openScrollLearn(index) {
    const sc = SCROLLS[index];
    state.scrollLearn = { index, revealed: 0, total: 0 };
    $('#scrollTitle').textContent = sc.emoji + ' ' + sc.name;
    $('#scrollMantra').textContent = '「 ' + sc.mantra + ' 」';
    const got = loadScrollStars()[sc.id] || 0;
    $('#scrollStars').textContent = got >= 2
      ? '🌟 已掌握 ' + [1, 2, 3].map((n) => (n <= got ? '★' : '☆')).join('')
      : got === 1 ? '✏️ 已学会，去掌握考验拿星吧' : '🌱 新秘籍';

    const wrap = $('#scrollDemo');
    wrap.textContent = '';
    sc.demos.forEach((demo, di) => {
      const block = document.createElement('div');
      block.className = 'demo-block';
      if (di > 0) {
        const tag = document.createElement('div');
        tag.className = 'demo-tag';
        tag.textContent = '再来看一道';
        block.appendChild(tag);
      }
      const qEl = document.createElement('div');
      qEl.className = 'demo-q';
      qEl.textContent = demo.q + ' = ?';
      block.appendChild(qEl);
      demo.steps.forEach(([label, expr]) => {
        state.scrollLearn.total += 1;
        const step = document.createElement('div');
        step.className = 'demo-step';
        const lb = document.createElement('span');
        lb.className = 'demo-step-label';
        lb.textContent = label;
        const ex = document.createElement('span');
        ex.className = 'demo-step-expr';
        ex.textContent = expr;
        step.append(lb, ex);
        block.appendChild(step);
      });
      wrap.appendChild(block);
    });
    applyDemoReveal();

    const testBtn = $('#scrollTestBtn');
    testBtn.disabled = got < 1;                 // 先完成演练才能考验
    testBtn.textContent = got >= 1 ? '掌握考验 🌟' : '考验需先完成演练';
    showScreen('scrollLearn');
  }

  function applyDemoReveal() {
    const learn = state.scrollLearn;
    if (!learn) return;
    $$('#scrollDemo .demo-step').forEach((el, i) => {
      el.classList.toggle('shown', i < learn.revealed);
    });
    const done = learn.revealed >= learn.total;
    $('#demoNextBtn').textContent = done ? '重新演示 ↺' : '下一步 ▸ ' + learn.revealed + '/' + learn.total;
  }

  /* ---------------- 演练 / 考验流程 ---------------- */
  function scrollRunTotal() {
    return state.scroll.kind === 'test' ? CONFIG.scrollTestCount : CONFIG.scrollDrillCount;
  }

  function stopScrollQTimer() {
    if (state.scroll && state.scroll.timerId) clearInterval(state.scroll.timerId);
    if (state.scroll) state.scroll.timerId = null;
  }

  function updateScrollTimerBar() {
    const left = Math.max(0, (state.scroll.qDeadline - Date.now()) / 1000);
    $('#timerText').textContent = Math.ceil(left) + ' 秒';
    const bar = $('#timerBar');
    const pct = Math.max(0, Math.min(100, (left / CONFIG.scrollTestSecs) * 100));
    bar.style.width = pct + '%';
    bar.classList.toggle('warn', pct <= 50 && pct > 25);
    bar.classList.toggle('danger', pct <= 25);
    return left;
  }

  // 掌握考验：每题轻限时，到时算答错并展示分步提示
  function startScrollQTimer() {
    stopScrollQTimer();
    const runId = state.scroll.runId;
    state.scroll.qDeadline = Date.now() + CONFIG.scrollTestSecs * 1000;
    $('#timerRow').hidden = false;
    updateScrollTimerBar();
    state.scroll.timerId = setInterval(() => {
      if (!state.scroll || state.scroll.runId !== runId || state.scroll.ended
        || state.scroll.cancelled || state.mode !== 'scroll' || state.screen !== 'game') return;
      if (updateScrollTimerBar() <= 0) {
        stopScrollQTimer();
        onScrollTimeout();
      }
    }, 100);
  }

  function onScrollTimeout() {
    if (!state.scroll || state.scroll.ended || state.scroll.cancelled || state.locked) return;
    state.locked = true;
    state.scroll.qIndex += 1;
    state.scroll.wrong += 1;
    state.streak = 0;
    playWrong();
    $('#questionCard').classList.add('wrong');
    state.scroll.awaitSkip = true;
    const q = state.question;
    showFeedback('⏰ 时间到！正确答案是 ' + q.answer + '\n' + q.hint.join('\n') + '\n（点 ✓ 或回车继续）', 'bad');
    updateGameBar();
    if (state.scroll.qIndex >= scrollRunTotal()) scheduleScrollEnd();
    else scheduleNextQuestion(CONFIG.scrollHintDelay);
  }

  function scheduleScrollEnd() {
    clearNextTimer();
    const runId = state.scroll.runId;
    const timerId = setTimeout(() => {
      if (state.nextTimer === timerId) state.nextTimer = null;
      if (state.mode !== 'scroll' || state.screen !== 'game' || !state.scroll
        || state.scroll.runId !== runId || state.scroll.cancelled || state.scroll.ended) return;
      endScrollRun();
    }, CONFIG.scrollEndDelay);
    state.nextTimer = timerId;
  }

  function startScrollRun(index, kind) {
    cancelAdventureRun();
    cancelScrollRun();
    stopTimer();
    state.mode = 'scroll';
    state.streak = 0;
    state.maxStreak = 0;
    state.scroll = {
      index, kind,
      runId: ++state.scrollRunSeq,
      qIndex: 0, correct: 0, wrong: 0,
      timerId: null, qDeadline: 0,
      ended: false, cancelled: false, awaitSkip: false,
    };
    $('#timerRow').hidden = true;
    $('#chaseScene').hidden = true;
    showScreen('game');
    updateGameBar();
    startQuestionFlow();
    if (kind === 'test') startScrollQTimer();
  }

  function cancelScrollRun() {
    if (state.scroll) {
      state.scroll.cancelled = true;
      state.scroll.ended = true;
    }
    stopScrollQTimer();
    clearNextTimer();
  }

  function endScrollRun() {
    if (!state.scroll || state.scroll.ended) return;
    state.scroll.ended = true;
    stopScrollQTimer();
    clearNextTimer();
    state.locked = true;
    const sc = SCROLLS[state.scroll.index];
    const isTest = state.scroll.kind === 'test';
    const correct = state.scroll.correct;
    const total = scrollRunTotal();
    // 星级：完成演练=1星；考验达标=2星；全对=3星（保留历史最高）
    const map = loadScrollStars();
    const prev = map[sc.id] || 0;
    let stars = prev;
    if (!isTest) stars = Math.max(stars, 1);
    else if (correct >= CONFIG.scrollTestCount) stars = Math.max(stars, 3);
    else if (correct >= CONFIG.scrollTestPass) stars = Math.max(stars, 2);
    const learnedNow = prev < 1 && stars >= 1;
    const masteredNow = prev < 2 && stars >= 2;
    if (stars !== prev) {
      map[sc.id] = stars;
      saveScrollStars(map);
    }
    showScrollResult(sc, isTest, correct, total, stars, learnedNow, masteredNow);
  }

  function showScrollResult(sc, isTest, correct, total, stars, learnedNow, masteredNow) {
    const passed = !isTest || correct >= CONFIG.scrollTestPass;
    const perfect = isTest && correct === CONFIG.scrollTestCount;
    $('#resultTitle').textContent = isTest
      ? (perfect ? '🌟 完美掌握！' : passed ? '🎉 考验通过，秘籍到手！' : '💪 差一点点，再考一次！')
      : (learnedNow ? '✏️ 演练完成，这张秘籍学会啦！' : '✏️ 演练完成！');
    renderStatRows($('#resultStats'), [
      ['秘籍', sc.emoji + ' ' + sc.name + ' · ' + sc.tier],
      ['答对', correct + ' / ' + total + ' 题' + (isTest ? '（通过需 ' + CONFIG.scrollTestPass + '）' : '')],
      ['最高连击', '×' + state.maxStreak],
      ['上卷进度', scrollsProgressText()],
    ]);

    const starsRow = $('#starsRow');
    if (isTest) {
      starsRow.hidden = false;
      [1, 2, 3].forEach((n) => {
        const el = $('#star' + n);
        el.className = 'big-star' + (n <= stars ? '' : ' off-star');
        void el.offsetWidth;                   // 强制 reflow 让星星动画重新触发
        el.classList.add('on');
      });
    } else {
      starsRow.hidden = true;
    }
    $('#bestBox').hidden = true;
    $('#normalBtns').hidden = true;
    $('#advBtns').hidden = true;
    $('#scrollBtns').hidden = false;
    const hasNext = state.scroll.index + 1 < SCROLLS.length;
    $('#scrollNextBtn').hidden = !(isTest && passed && hasNext);
    $('#scrollGoTestBtn').hidden = isTest;
    $('#scrollAgainBtn').textContent = isTest ? (passed ? '再考一次冲三星' : '再考一次') : '再演练一次';
    if (masteredNow || perfect) {
      playLevelWin();
      setTimeout(iceFirework, 500);
      const allMastered = SCROLLS.every((s) => (loadScrollStars()[s.id] || 0) >= 2);
      if (allMastered) setTimeout(iceFirework, 1100);
    }
    showScreen('result');
  }

  function renderHomeScrolls() {
    const stars = loadScrollStars();
    const learned = Object.keys(stars).length;
    const mastered = SCROLLS.filter((sc) => (stars[sc.id] || 0) >= 2).length;
    $('#homeScrolls').textContent = mastered === SCROLLS.length
      ? '👑 速算大师 · 上卷全部掌握！'
      : '📖 学会 ' + learned + '/' + SCROLLS.length + ' · 🌟 掌握 ' + mastered + '/' + SCROLLS.length;
  }

  /* ============================================================
   * 事件绑定
   * ============================================================ */

  // 首页：模式选择
  $$('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (card.dataset.mode === 'practice') showScreen('setup');
      else if (card.dataset.mode === 'adventure') { renderMap(); showScreen('map'); }
      else if (card.dataset.mode === 'scrolls') { renderScrollShelf(); showScreen('scrolls'); }
      else startChallenge();
    });
  });

  // 返回按钮
  $$('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => {
      stopTimer();
      cancelAdventureRun();
      cancelScrollRun();
      clearNextTimer();
      renderHomeBest();
      renderHomeAdv();
      renderHomeScrolls();
      showScreen('home');
    });
  });

  // 闯关结果按钮
  $('#nextLevelBtn').addEventListener('click', () => {
    const next = levelAt(advLevelId() + 1);
    if (next) startAdventure(next.wid, next.lid);
  });
  $('#retryBtn').addEventListener('click', () => {
    if (!state.adv) return;
    const { wid, lid } = state.adv;
    startAdventure(wid, lid);
  });
  $('#mapBtn').addEventListener('click', () => {
    cancelAdventureRun();
    renderMap();
    showScreen('map');
  });
  $('#finaleBanner').addEventListener('click', () => {
    playLevelWin();
    iceFirework();
    setTimeout(iceFirework, 700);
    setTimeout(iceFirework, 1400);
  });

  // 速算秘籍：学习屏与结算按钮
  $('#scrollBackBtn').addEventListener('click', () => {
    renderScrollShelf();
    showScreen('scrolls');
  });
  $('#demoNextBtn').addEventListener('click', () => {
    const learn = state.scrollLearn;
    if (!learn) return;
    playClick();
    learn.revealed = learn.revealed >= learn.total ? 0 : learn.revealed + 1;
    applyDemoReveal();
  });
  $('#scrollDrillBtn').addEventListener('click', () => {
    if (state.scrollLearn) startScrollRun(state.scrollLearn.index, 'drill');
  });
  $('#scrollTestBtn').addEventListener('click', () => {
    if (state.scrollLearn) startScrollRun(state.scrollLearn.index, 'test');
  });
  $('#scrollGoTestBtn').addEventListener('click', () => {
    if (state.scroll) startScrollRun(state.scroll.index, 'test');
  });
  $('#scrollAgainBtn').addEventListener('click', () => {
    if (state.scroll) startScrollRun(state.scroll.index, state.scroll.kind);
  });
  $('#scrollNextBtn').addEventListener('click', () => {
    if (!state.scroll) return;
    const next = state.scroll.index + 1;
    if (next < SCROLLS.length) openScrollLearn(next);
  });
  $('#scrollShelfBtn').addEventListener('click', () => {
    cancelScrollRun();
    renderScrollShelf();
    showScreen('scrolls');
  });

  // 难度切换
  $$('#difficultySeg .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.difficulty = btn.dataset.diff;
      $$('#difficultySeg .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
      updateSetupHint();
      renderHomeBest();
    });
  });

  // 音效开关
  function updateSoundButton() {
    const btn = $('#soundBtn');
    btn.textContent = state.soundOn ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', String(state.soundOn));
    btn.setAttribute('aria-label', state.soundOn ? '关闭音效' : '开启音效');
  }

  $('#soundBtn').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    storageSet('sxd_sound', state.soundOn ? '1' : '0');
    updateSoundButton();
  });

  // 练习设置
  function updateSetupHint() {
    $('#setupHint').textContent = '当前难度：' + DIFF_NAMES[state.difficulty] + ' · ' + DIFF_DESC[state.difficulty] + '。挑战模式为四种题型混合出题。';
  }

  function updateSetup() {
    const checked = $$('#typeGrid input:checked').length;
    $('#startPracticeBtn').disabled = checked === 0;
    // 兼容不支持 :has 的旧版 iPadOS：同步选中样式类
    $$('#typeGrid input').forEach((cb) => {
      cb.closest('.type-chip').classList.toggle('checked', cb.checked);
    });
  }

  $$('#typeGrid input').forEach((cb) => cb.addEventListener('change', updateSetup));

  $('#startPracticeBtn').addEventListener('click', () => {
    const types = $$('#typeGrid input:checked').map((cb) => cb.value);
    if (types.length === 0) {
      showFeedback('请至少选择一种题型～', 'hint');
      return;
    }
    state.selectedTypes = types;
    startPractice();
  });

  // 结束本轮
  $('#quitBtn').addEventListener('click', () => {
    if (state.mode === 'challenge') endChallenge();
    else if (state.mode === 'adventure') { cancelAdventureRun(); renderMap(); showScreen('map'); }
    else if (state.mode === 'scroll') { cancelScrollRun(); renderScrollShelf(); showScreen('scrolls'); }
    else endPractice();
  });

  // 再来一轮
  $('#againBtn').addEventListener('click', () => {
    if (state.mode === 'challenge') startChallenge();
    else startPractice();
  });

  // 数字键盘
  $('#keypad').addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    const k = btn.dataset.key;
    if (k >= '0' && k <= '9') appendDigit(k);
    else if (k === 'back') removeDigit();
    else if (k === 'ok') submitAnswer();
  });

  // 余数切换按钮
  $('#remKey').addEventListener('click', () => {
    if (state.locked) return;
    focusBox(state.activeBox === 1 ? 2 : 1);
  });

  // 点击输入框切换焦点
  $('#box1').addEventListener('click', () => focusBox(1));
  $('#box2').addEventListener('click', () => focusBox(2));

  // 物理键盘支持
  document.addEventListener('keydown', (e) => {
    if (state.screen !== 'game') return;
    if (state.locked) {
      // 秘籍答错提示期间允许回车跳过等待
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAnswer();
      }
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      appendDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      removeDigit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (!$('#remSlot').hidden) {
        e.preventDefault();
        focusBox(state.activeBox === 1 ? 2 : 1);
      }
    }
  });

  /* ---------------- 初始化 ---------------- */
  // 注册 Service Worker（PWA：添加到主屏幕、离线可玩；file:// 直接打开时自动跳过）
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  updateSoundButton();
  updateSetupHint();
  updateSetup();
  renderHomeBest();
  renderHomeAdv();
  renderHomeScrolls();
  showScreen('home');

  // 转屏 / 窗口变化时重放追逐跑道上的角色位置
  window.addEventListener('resize', () => {
    if (state.mode === 'adventure' && state.adv && state.screen === 'game') {
      placeRunner($('#chasePrincess'), state.adv.princess);
      placeRunner($('#chaseMonster'), state.adv.monster);
    }
  });
})();
