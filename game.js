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
  const TOTAL_LEVELS = 12;

  /* ---------------- 冒险存档 ---------------- */
  function loadAdvStars() {
    const v = loadBest('sxd_adventure');
    return v && typeof v === 'object' ? v : {};
  }
  function saveAdvStars(map) {
    saveBest('sxd_adventure', map);
  }
  function advUnlockedTo(stars) {
    let max = -1;
    for (const k in stars) max = Math.max(max, parseInt(k, 10) || 0);
    return max + 1;   // 下一关索引；0 表示第 0 关可玩
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
    soundOn: localStorage.getItem('sxd_sound') !== '0',
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
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    // 游戏中锁定难度切换
    $$('#difficultySeg .seg-btn').forEach((b) => { b.disabled = name === 'game'; });
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
    const hasRem = q.isDiv && q.remainder > 0;   // 只有真正带余数的除法才有第二个框
    remSlot.hidden = !hasRem;
    remKey.hidden = !hasRem;
    box1.value = '';
    box2.value = '';
    box1.placeholder = q.isDiv ? '商' : '';
    box2.placeholder = '余';
    focusBox(1);
  }

  function nextQuestion() {
    state.locked = false;
    $('#questionCard').classList.remove('correct', 'wrong');
    state.question = genQuestion();
    renderQuestion();
  }

  function startQuestionFlow() {
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
    if (state.locked) return;
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

    const v1 = parseInt(box1.value, 10);
    let ok;
    if (q.isDiv) {
      ok = v1 === q.quotient && (!remVisible || parseInt(box2.value, 10) === q.remainder);
    } else {
      ok = v1 === q.answer;
    }

    state.locked = true;
    if (state.mode === 'adventure') state.adv.qIndex += 1;
    if (ok) onCorrect();
    else onWrong();
  }

  function onCorrect() {
    playCorrect();
    state.streak += 1;
    state.maxStreak = Math.max(state.maxStreak, state.streak);
    $('#questionCard').classList.add('correct');
    showFeedback(pick(PRAISE), 'ok');
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
    } else {
      state.pCorrect += 1;
    }
    updateGameBar();
    if (going) state.nextTimer = setTimeout(nextQuestion, CONFIG.correctDelay);
  }

  function onWrong() {
    playWrong();
    state.streak = 0;
    $('#questionCard').classList.add('wrong');
    const q = state.question;
    const ansText = q.isDiv && q.remainder > 0 ? q.quotient + ' 余 ' + q.remainder : String(q.answer);
    showFeedback('正确答案是 ' + ansText + '，加油！', 'bad');
    let going = true;
    if (state.mode === 'challenge') state.cWrong += 1;
    else if (state.mode === 'adventure') {
      state.adv.wrong += 1;
      going = advanceMonster(true);       // 怪兽逼近一步；追上则进入失败流程
    } else {
      state.pWrong += 1;
    }
    updateGameBar();
    if (going) {
      const delay = state.mode === 'adventure' ? CONFIG.wrongDelay + 300 : CONFIG.wrongDelay;
      state.nextTimer = setTimeout(() => {
        // 闯关：题目答完公主仍未到达 → 失败
        if (state.mode === 'adventure' && !state.adv.ending && state.adv.qIndex >= WORLDS[state.adv.wid].levels[state.adv.lid].count) {
          loseAdventure('exhausted');
        } else {
          nextQuestion();
        }
      }, delay);
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
    state.mode = 'practice';
    state.pCorrect = 0;
    state.pWrong = 0;
    $('#timerRow').hidden = true;
    showScreen('game');
    updateGameBar();
    startQuestionFlow();
  }

  function startChallenge() {
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
    clearTimeout(state.nextTimer);
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
    stopTimer();
    clearTimeout(state.nextTimer);
    state.locked = true;
    const total = state.cCorrect + state.cWrong;
    const rate = total > 0 ? Math.round((100 * state.cCorrect) / total) : 0;
    const bestKey = 'sxd_best_' + state.difficulty;
    const prev = loadBest(bestKey);
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
      best: loadBest(bestKey),
      isRecord: isRecord,
    });
  }

  function showResult(opts) {
    $('#resultTitle').textContent = opts.title;
    $('#starsRow').hidden = true;
    $('#advBtns').hidden = true;
    $('#normalBtns').hidden = false;
    $('#resultStats').innerHTML = opts.lines
      .map(([k, v]) => '<div class="stat-row"><span class="stat-label">' + k + '</span><span class="stat-value">' + v + '</span></div>')
      .join('');

    const bestBox = $('#bestBox');
    if (opts.best) {
      const b = opts.best;
      const rec = opts.isRecord ? '<div class="record-tip">🎉 新纪录！太厉害了！</div>' : '';
      bestBox.innerHTML =
        '<div>🏆 历史最佳：' + b.score + ' 分（答对 ' + b.correct + ' 题 · 连击 ×' + b.maxStreak + '，' + b.date + '）</div>' + rec;
      bestBox.hidden = false;
    } else {
      bestBox.hidden = true;
    }
    showScreen('result');
  }

  /* ---------------- 纪录存取 ---------------- */

  function loadBest(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function saveBest(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 忽略 */ }
  }

  function renderHomeBest() {
    const fmt = (x) => (x ? x.score + ' 分' : '暂无');
    const b = loadBest('sxd_best_basic');
    const a = loadBest('sxd_best_advanced');
    $('#homeBest').innerHTML =
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
    let total = 0;
    try { total = parseInt(localStorage.getItem('sxd_total'), 10) || 0; } catch (e) { /* 忽略 */ }
    total += 1;
    try { localStorage.setItem('sxd_total', String(total)); } catch (e) { /* 忽略 */ }
    if (total % 50 === 0) {
      iceFirework();
      showFeedback('累计答对 ' + total + ' 题！🎉 冰晶绽放！', 'ok');
    }
  }

  /* ============================================================
   * 闯关冒险：追逐引擎
   * ============================================================ */
  function advLevel() { return WORLDS[state.adv.wid].levels[state.adv.lid]; }
  function advLevelId() { return state.adv.wid * 4 + state.adv.lid; }

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
    let lastTick = performance.now();
    state.adv.timer = setInterval(() => {
      if (state.screen !== 'game' || state.adv.ending) return;
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
    const ch = CONFIG.chase;
    state.mode = 'adventure';
    state.streak = 0;
    state.maxStreak = 0;
    state.adv = {
      wid: wid, lid: lid,
      qIndex: 0, correct: 0, wrong: 0,
      princess: 0, monster: -ch.lag,
      speed: 0, timer: null, ending: false,
    };
    const lv = WORLDS[wid].levels[lid];
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
    stopChaseTimer();
    $('#chaseScene').hidden = true;
    document.body.classList.remove('dim');
  }

  function winAdventure() {
    if (state.adv.ending) return;
    state.adv.ending = true;
    stopChaseTimer();
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
    setTimeout(() => showAdvResult(true, stars), 1100);
  }

  function loseAdventure(reason) {
    if (state.adv.ending) return;
    state.adv.ending = true;
    stopChaseTimer();
    playAdvLose();
    document.body.classList.add('dim');
    // 怪兽扑向公主
    state.adv.monster = state.adv.princess - 0.015;
    placeRunner($('#chaseMonster'), state.adv.monster);
    setTimeout(() => {
      document.body.classList.remove('dim');
      showAdvResult(false, 0, reason);
    }, 1000);
  }

  function showAdvResult(won, stars, reason) {
    stopAdventure();
    const lv = advLevel();
    const w = WORLDS[state.adv.wid];
    const total = state.adv.correct + state.adv.wrong;
    const cleared = advUnlockedTo(loadAdvStars()) >= TOTAL_LEVELS;

    $('#resultTitle').textContent = won
      ? (advLevelId() === TOTAL_LEVELS - 1 ? '👑 恶龙被打败，王国获救啦！' : '🎉 公主到达终点！')
      : (reason === 'caught' ? '😱 怪兽追上公主了！' : '🏃 题目答完还没到达…');
    $('#resultStats').innerHTML = [
      ['世界', w.emoji + ' ' + w.name + ' · ' + lv.name],
      ['答对', state.adv.correct + ' 题（需 ' + lv.need + '）'],
      ['水晶碎片', won ? '💎 已收集！' : '下次再来'],
      ['最高连击', '×' + state.maxStreak],
    ].map(([k, v]) => '<div class="stat-row"><span class="stat-label">' + k + '</span><span class="stat-value">' + v + '</span></div>').join('');

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
        const id = wi * 4 + li;
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
   * 事件绑定
   * ============================================================ */

  // 首页：模式选择
  $$('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (card.dataset.mode === 'practice') showScreen('setup');
      else if (card.dataset.mode === 'adventure') { renderMap(); showScreen('map'); }
      else startChallenge();
    });
  });

  // 返回按钮
  $$('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => {
      stopTimer();
      stopAdventure();
      clearTimeout(state.nextTimer);
      renderHomeBest();
      renderHomeAdv();
      showScreen('home');
    });
  });

  // 闯关结果按钮
  $('#nextLevelBtn').addEventListener('click', () => {
    const id = advLevelId() + 1;
    startAdventure(Math.floor(id / 4), id % 4);
  });
  $('#retryBtn').addEventListener('click', () => {
    startAdventure(state.adv.wid, state.adv.lid);
  });
  $('#mapBtn').addEventListener('click', () => {
    renderMap();
    showScreen('map');
  });
  $('#finaleBanner').addEventListener('click', () => {
    playLevelWin();
    iceFirework();
    setTimeout(iceFirework, 700);
    setTimeout(iceFirework, 1400);
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
  $('#soundBtn').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    try { localStorage.setItem('sxd_sound', state.soundOn ? '1' : '0'); } catch (e) { /* 忽略 */ }
    $('#soundBtn').textContent = state.soundOn ? '🔊' : '🔇';
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
    else if (state.mode === 'adventure') { stopAdventure(); renderMap(); showScreen('map'); }
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
    if (state.screen !== 'game' || state.locked) return;
    if (/^[0-9]$/.test(e.key)) {
      appendDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      removeDigit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    } else if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
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
  $('#soundBtn').textContent = state.soundOn ? '🔊' : '🔇';
  updateSetupHint();
  updateSetup();
  renderHomeBest();
  renderHomeAdv();
  showScreen('home');

  // 转屏 / 窗口变化时重放追逐跑道上的角色位置
  window.addEventListener('resize', () => {
    if (state.mode === 'adventure' && state.adv && state.screen === 'game') {
      placeRunner($('#chasePrincess'), state.adv.princess);
      placeRunner($('#chaseMonster'), state.adv.monster);
    }
  });
})();
