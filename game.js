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

  /* ---------------- 游戏状态 ---------------- */
  const state = {
    screen: 'home',          // home | setup | game | result
    difficulty: 'basic',     // basic | advanced
    mode: null,              // practice | challenge
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
    const type = state.mode === 'challenge'
      ? pick(['add', 'sub', 'mul', 'div'])   // 挑战模式四种题型混合
      : pick(state.selectedTypes);            // 练习模式按所选题型
    const q = type === 'add' ? genAdd(state.difficulty)
      : type === 'sub' ? genSub(state.difficulty)
      : type === 'mul' ? genMul(state.difficulty)
      : genDiv(state.difficulty);
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

  const playCorrect = () => { ensureAudio(); tone(659, 0, 0.12); tone(880, 0.1, 0.18); };
  const playWrong = () => { ensureAudio(); tone(196, 0, 0.28, 'square', 0.15); };
  const playClick = () => { ensureAudio(); tone(880, 0, 0.05, 'sine', 0.06); };

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
    if (ok) onCorrect();
    else onWrong();
  }

  function onCorrect() {
    playCorrect();
    state.streak += 1;
    state.maxStreak = Math.max(state.maxStreak, state.streak);
    $('#questionCard').classList.add('correct');
    showFeedback(pick(PRAISE), 'ok');
    if (state.mode === 'challenge') {
      state.cCorrect += 1;
      state.score += CONFIG.basePoints + Math.max(0, state.streak - 1) * CONFIG.streakBonusStep;
    } else {
      state.pCorrect += 1;
    }
    updateGameBar();
    state.nextTimer = setTimeout(nextQuestion, CONFIG.correctDelay);
  }

  function onWrong() {
    playWrong();
    state.streak = 0;
    $('#questionCard').classList.add('wrong');
    const q = state.question;
    const ansText = q.isDiv && q.remainder > 0 ? q.quotient + ' 余 ' + q.remainder : String(q.answer);
    showFeedback('正确答案是 ' + ansText + '，加油！', 'bad');
    if (state.mode === 'challenge') state.cWrong += 1;
    else state.pWrong += 1;
    updateGameBar();
    state.nextTimer = setTimeout(nextQuestion, CONFIG.wrongDelay);
  }

  function updateGameBar() {
    const diffName = DIFF_NAMES[state.difficulty];
    if (state.mode === 'challenge') {
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
   * 事件绑定
   * ============================================================ */

  // 首页：模式选择
  $$('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (card.dataset.mode === 'practice') showScreen('setup');
      else startChallenge();
    });
  });

  // 返回按钮
  $$('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => {
      stopTimer();
      clearTimeout(state.nextTimer);
      renderHomeBest();
      showScreen('home');
    });
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
  showScreen('home');
})();
