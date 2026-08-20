/* ============================================================
 * 数数小达人 —— 中班数学启蒙（4~5 岁）
 * 纯静态实现：kids.html + kids.css + kids.js，零依赖
 *
 * 设计要点（与「速算小达人」大孩子版的区别）：
 *   - 不依赖识字：题目用实物图案展示，语音读题（speechSynthesis）
 *   - 不用键盘输入：答案为 3 个大泡泡点选，或直接点选图案
 *   - 零压力：没有怪兽、没有倒计时，答错轻轻提示后无限重试
 *   - 六个活动按序解锁：数一数 → 认数字 → 比多少 → 小加法 → 小减法 → 大冒险
 * ============================================================ */
(function () {
  'use strict';

  const CONFIG = {
    roundCount: 5,       // 每轮题数
    advanceDelay: 1400,  // 答对后停留（毫秒）
  };

  /* ---------------- 小工具 ---------------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function loadBest(key) {
    const raw = storageGet(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function saveBest(key, val) {
    storageSet(key, JSON.stringify(val));
  }

  const EMOJIS = ['🍎', '🍓', '🐥', '🦋', '⭐', '🌸', '🐞', '🐟', '🍇', '🎈'];
  const PRAISE = ['真棒！', '太厉害啦！', '答对咯！', '好样的！', '哇，你好聪明！'];
  const PRAISE_SPEECH = ['真棒！', '太厉害啦', '答对咯', '好样的'];

  /* ---------------- 小星公主（雪儿公主的妹妹，原创形象） ---------------- */
  const KID_SVG =
    '<svg viewBox="0 0 60 72" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="11" cy="24" r="5" fill="#8a5a3b"/><circle cx="49" cy="24" r="5" fill="#8a5a3b"/>' +
    '<path d="M18 36 Q30 29 42 36 L47 58 Q30 64 13 58 Z" fill="#ff9ecb"/>' +
    '<path d="M18 36 Q30 29 42 36 L44 46 Q30 51 16 46 Z" fill="#ffc3de"/>' +
    '<g class="arm-l"><rect x="14" y="32" width="4.5" height="11" rx="2.2" fill="#ffc3de"/></g>' +
    '<g class="arm-r"><rect x="41.5" y="32" width="4.5" height="11" rx="2.2" fill="#ffc3de"/></g>' +
    '<circle cx="30" cy="20" r="12" fill="#f9d7b5"/>' +
    '<path d="M19 16 Q24 8 30 12 Q36 8 41 16 Q36 12 30 13 Q24 12 19 16 Z" fill="#8a5a3b"/>' +
    '<path d="M25 8 L27 2.5 L30 6.5 L33 2.5 L35 8 Z" fill="#ffd94a" stroke="#e8b53f" stroke-width="0.8"/>' +
    '<circle cx="26" cy="20" r="1.5" fill="#3a3a3a"/><circle cx="34" cy="20" r="1.5" fill="#3a3a3a"/>' +
    '<circle cx="22.5" cy="24" r="2" fill="#ffb3ba" opacity="0.8"/><circle cx="37.5" cy="24" r="2" fill="#ffb3ba" opacity="0.8"/>' +
    '<path d="M26 26 Q30 29.5 34 26" stroke="#3a3a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  /* ---------------- 音效（Web Audio 合成，柔和不刺耳） ---------------- */
  let actx = null;
  const state = {
    screen: 'home',
    act: null,            // 本轮 { idx, qIndex, retries, firstTry }
    question: null,
    locked: false,
    runSeq: 0,            // 轮次守卫：切屏/开新轮后旧回调不再生效
    soundOn: storageGet('sxd_sound') !== '0',   // 与大孩子版共享音效偏好
  };

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
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.2, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch (e) { /* 忽略 */ }
  }
  const playClick = () => { ensureAudio(); tone(880, 0, 0.05, 'sine', 0.06); };
  // 答对：明亮的上行三连音
  const playCorrect = () => {
    ensureAudio();
    tone(659, 0, 0.12, 'sine', 0.22);
    tone(784, 0.1, 0.12, 'sine', 0.22);
    tone(1047, 0.2, 0.22, 'sine', 0.22);
  };
  // 答错：温柔的低音，不是刺耳的「错误」声
  const playOops = () => { ensureAudio(); tone(330, 0, 0.2, 'sine', 0.12); };
  const playStars = (n) => {
    ensureAudio();
    for (let i = 0; i < Math.max(1, n); i += 1) tone(523 + i * 131, i * 0.18, 0.25, 'sine', 0.22);
  };

  /* ---------------- 语音读题（不支持时自动静默） ---------------- */
  function speak(text) {
    if (!state.soundOn || typeof window.speechSynthesis === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.9;
      u.pitch = 1.15;
      window.speechSynthesis.speak(u);
    } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 出题器 ---------------- */
  // 生成含正确答案在内的 3 个数字选项（干扰项靠近答案、不重复、不越界）
  function numOptions(answer, lo, hi) {
    const set = [answer];
    const candidates = shuffle([answer - 1, answer + 1, answer + 2, answer - 2, answer + 3, answer + 4]);
    for (const v of candidates) {
      if (set.length >= 3) break;
      if (v >= lo && v <= hi && !set.includes(v)) set.push(v);
    }
    for (let v = lo; v <= hi && set.length < 3; v += 1) {
      if (!set.includes(v)) set.push(v);
    }
    return shuffle(set);
  }

  function genCount() {
    const n = randInt(3, 10);
    return {
      type: 'objects',
      prompt: '数一数，一共有几个？',
      speech: '数一数，一共有几个',
      emoji: pick(EMOJIS),
      groups: [{ count: n, eaten: 0 }],
      plus: false,
      tapCount: true,
      answer: n,
      options: numOptions(n, 0, 12),
    };
  }

  function genNumber() {
    if (Math.random() < 0.5) {
      // 看实物 → 选数字
      const n = randInt(1, 10);
      return {
        type: 'objects',
        prompt: '有几个？点出数字',
        speech: '有几个？点出数字',
        emoji: pick(EMOJIS),
        groups: [{ count: n, eaten: 0 }],
        tapCount: false,
        answer: n,
        options: numOptions(n, 0, 12),
      };
    }
    // 看数字 → 找出一样多的一堆
    const n = randInt(1, 9);
    const others = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((v) => v !== n)).slice(0, 2);
    const counts = shuffle([n, others[0], others[1]]);
    return {
      type: 'groupPick',
      prompt: '和数字一样多的是哪一堆？',
      speech: '和它一样多的是哪一堆',
      emoji: pick(EMOJIS),
      digit: n,
      groups: counts.map((c) => ({ count: c })),
      answer: counts.indexOf(n),
    };
  }

  function genMore() {
    const left = randInt(1, 9);
    let right = randInt(1, 9);
    while (right === left) right = randInt(1, 9);
    return {
      type: 'compare',
      prompt: '哪一边的多？',
      speech: '哪一边的多',
      emoji: pick(EMOJIS),
      groups: [{ count: left }, { count: right }],
      answer: left > right ? 0 : 1,
    };
  }

  function genAdd5() {
    const a = randInt(1, 4);
    const b = randInt(1, 5 - a);
    return {
      type: 'objects',
      prompt: '合起来一共有几个？',
      speech: '合起来，一共有几个',
      emoji: pick(EMOJIS),
      groups: [{ count: a, eaten: 0 }, { count: b, eaten: 0 }],
      plus: true,
      tapCount: false,
      answer: a + b,
      options: numOptions(a + b, 0, 8),
    };
  }

  function genSub5() {
    const total = randInt(2, 5);
    const eaten = randInt(1, total);
    return {
      type: 'objects',
      prompt: '吃掉了一些，还剩几个？',
      speech: '吃掉了一些，还剩几个',
      emoji: pick(EMOJIS),
      groups: [{ count: total, eaten }],
      tapCount: false,
      answer: total - eaten,
      options: numOptions(total - eaten, 0, 8),
    };
  }

  function genMix10() {
    if (Math.random() < 0.5) {
      const a = randInt(2, 9);
      const b = randInt(1, 10 - a);
      return {
        type: 'objects',
        prompt: '合起来一共有几个？',
        speech: '合起来，一共有几个',
        emoji: pick(EMOJIS),
        groups: [{ count: a, eaten: 0 }, { count: b, eaten: 0 }],
        plus: true,
        tapCount: false,
        answer: a + b,
        options: numOptions(a + b, 0, 12),
      };
    }
    const total = randInt(5, 10);
    const eaten = randInt(1, total - 1);
    return {
      type: 'objects',
      prompt: '吃掉了一些，还剩几个？',
      speech: '吃掉了一些，还剩几个',
      emoji: pick(EMOJIS),
      groups: [{ count: total, eaten }],
      tapCount: false,
      answer: total - eaten,
      options: numOptions(total - eaten, 0, 12),
    };
  }

  /* ---------------- 活动清单（按顺序解锁） ---------------- */
  const ACTS = [
    { id: 'count', name: '数一数', emoji: '🍎', tip: '点一个，数一个', gen: genCount },
    { id: 'number', name: '认数字', emoji: '🔢', tip: '找出一样多的', gen: genNumber },
    { id: 'more', name: '比多少', emoji: '⚖️', tip: '哪一边的多', gen: genMore },
    { id: 'add5', name: '小加法', emoji: '➕', tip: '合起来有几个', gen: genAdd5 },
    { id: 'sub5', name: '小减法', emoji: '➖', tip: '吃掉还剩几个', gen: genSub5 },
    { id: 'mix10', name: '大冒险', emoji: '🌟', tip: '10 以内加减', gen: genMix10 },
  ];

  /* ---------------- 进度存档 ---------------- */
  function normalizeKidsStars(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const candidate = {};
    ACTS.forEach((act, idx) => {
      const stars = Math.trunc(Number(value[act.id]));
      if (Number.isInteger(stars) && stars >= 1 && stars <= 3) candidate[idx] = stars;
    });
    // 必须从第一个活动开始连续玩过，跳着玩的数据不采用
    const clean = {};
    for (let i = 0; i < ACTS.length && candidate[i]; i++) clean[ACTS[i].id] = candidate[i];
    return clean;
  }

  function loadKidsStars() { return normalizeKidsStars(loadBest('sxd_kids_stars')); }
  function saveKidsStars(map) { saveBest('sxd_kids_stars', normalizeKidsStars(map)); }
  function actsUnlockedTo(stars) {
    let i = 0;
    while (i < ACTS.length && stars[ACTS[i].id]) i += 1;
    return i;
  }

  /* ---------------- 首页 ---------------- */
  let tipTimer = null;
  function showTip(msg) {
    const tip = $('#kTip');
    tip.textContent = msg;
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { tip.textContent = ''; }, 2200);
  }

  function renderHome() {
    const stars = loadKidsStars();
    const unlockedTo = actsUnlockedTo(stars);
    const grid = $('#actGrid');
    grid.textContent = '';
    ACTS.forEach((act, i) => {
      const got = stars[act.id] || 0;
      const unlocked = i <= unlockedTo;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'act-card' + (unlocked ? '' : ' locked')
        + (i === unlockedTo && unlockedTo < ACTS.length ? ' current' : '');
      const emoji = document.createElement('span');
      emoji.className = 'act-emoji';
      emoji.textContent = unlocked ? act.emoji : '🔒';
      const name = document.createElement('span');
      name.className = 'act-name';
      name.textContent = act.name;
      const tip = document.createElement('span');
      tip.className = 'act-tip';
      tip.textContent = unlocked ? act.tip : '先玩好前面的哦';
      const st = document.createElement('span');
      st.className = 'act-stars';
      st.textContent = unlocked ? [1, 2, 3].map((n) => (n <= got ? '★' : '☆')).join('') : '';
      card.append(emoji, name, tip, st);
      card.addEventListener('click', () => {
        if (!unlocked) {
          showTip('🔒 先玩好「' + ACTS[i - 1].name + '」就能解锁啦');
          return;
        }
        playClick();
        startRound(i);
      });
      grid.appendChild(card);
    });
  }

  /* ---------------- 游戏流程 ---------------- */
  function showScreen(name) {
    state.screen = name;
    $$('.k-screen').forEach((s) => {
      const active = s.id === 'k-' + name;
      s.classList.toggle('active', active);
      s.setAttribute('aria-hidden', String(!active));
    });
  }

  function startRound(idx) {
    state.runSeq += 1;
    state.act = { idx, qIndex: 0, retries: 0, firstTry: 0 };
    showScreen('game');
    renderQuestion();
  }

  function renderProgress() {
    const row = $('#kProgress');
    row.textContent = '';
    for (let i = 0; i < CONFIG.roundCount; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'k-dot' + (i < state.act.qIndex ? ' done' : '');
      row.appendChild(dot);
    }
  }

  // 一堆实物图案（可点选数数 / 标记被吃掉的）
  function buildGroup(group, q) {
    const wrap = document.createElement('div');
    wrap.className = 'obj-group';
    let counted = 0;
    for (let i = 0; i < group.count; i += 1) {
      const isEaten = q.groups[0] === group && group.eaten > 0 && i < group.eaten;
      const obj = document.createElement('button');
      obj.type = 'button';
      obj.className = 'obj' + (isEaten ? ' eaten' : '');
      obj.setAttribute('aria-label', isEaten ? '被吃掉的' : '点一点，数一数');
      const pic = document.createElement('span');
      pic.className = 'obj-pic';
      pic.textContent = q.emoji;
      obj.appendChild(pic);
      if (isEaten) {
        const mark = document.createElement('span');
        mark.className = 'obj-mark';
        mark.textContent = '😋';
        obj.appendChild(mark);
        obj.disabled = true;
      } else if (q.tapCount) {
        const badge = document.createElement('span');
        badge.className = 'obj-badge';
        obj.appendChild(badge);
        obj.addEventListener('click', () => {
          if (obj.classList.contains('counted')) return;
          counted += 1;
          obj.classList.add('counted');
          badge.textContent = String(counted);
          playClick();
          speak(String(counted));
        });
      }
      wrap.appendChild(obj);
    }
    return wrap;
  }

  function buildGroupCard(count, emoji, small) {
    const card = document.createElement('div');
    card.className = 'group-card' + (small ? ' small' : '');
    for (let i = 0; i < count; i += 1) {
      const s = document.createElement('span');
      s.textContent = emoji;
      card.appendChild(s);
    }
    return card;
  }

  function renderQuestion() {
    const act = ACTS[state.act.idx];
    const q = act.gen();
    state.question = q;
    state.locked = false;
    state.act.retries = 0;

    $('#kPrompt').textContent = q.prompt;
    const stage = $('#kStage');
    stage.textContent = '';
    const choices = $('#kChoices');
    choices.textContent = '';

    if (q.type === 'objects') {
      const row = document.createElement('div');
      row.className = 'obj-row';
      row.appendChild(buildGroup(q.groups[0], q));
      if (q.plus) {
        const plus = document.createElement('span');
        plus.className = 'k-plus';
        plus.textContent = '+';
        row.appendChild(plus);
        row.appendChild(buildGroup(q.groups[1], q));
      }
      stage.appendChild(row);
      q.options.forEach((v) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bubble';
        b.textContent = String(v);
        b.addEventListener('click', () => chooseNumber(b, v));
        choices.appendChild(b);
      });
    } else if (q.type === 'groupPick') {
      const digitCard = document.createElement('div');
      digitCard.className = 'digit-card';
      digitCard.textContent = String(q.digit);
      stage.appendChild(digitCard);
      q.groups.forEach((g, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'group-choice';
        const inner = buildGroupCard(g.count, q.emoji, true);
        b.appendChild(inner);
        b.addEventListener('click', () => chooseElement(b, idx));
        choices.appendChild(b);
      });
    } else if (q.type === 'compare') {
      q.groups.forEach((g, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'group-choice big';
        b.appendChild(buildGroupCard(g.count, q.emoji, false));
        b.addEventListener('click', () => chooseElement(b, idx));
        stage.appendChild(b);
      });
    }

    renderProgress();
    speak(q.speech);
  }

  /* ---------------- 作答 ---------------- */
  function chooseNumber(btn, value) {
    if (state.locked) return;
    if (value === state.question.answer) acceptAnswer(btn);
    else rejectAnswer(btn);
  }

  function chooseElement(btn, idx) {
    if (state.locked) return;
    if (idx === state.question.answer) acceptAnswer(btn);
    else rejectAnswer(btn);
  }

  function acceptAnswer(btn) {
    state.locked = true;
    btn.classList.add('correct');
    playCorrect();
    speak(pick(PRAISE_SPEECH));
    confettiAt(btn);
    if (state.act.retries === 0) state.act.firstTry += 1;
    const seq = state.runSeq;
    setTimeout(() => {
      if (state.screen !== 'game' || state.runSeq !== seq) return;
      state.act.qIndex += 1;
      if (state.act.qIndex >= CONFIG.roundCount) showKidResult();
      else renderQuestion();
    }, CONFIG.advanceDelay);
  }

  function rejectAnswer(btn) {
    state.act.retries += 1;
    playOops();
    speak('没关系，再试一次');
    btn.classList.add('shake');
    btn.disabled = true;                       // 排除一个错误选项，引导继续尝试
    setTimeout(() => btn.classList.remove('shake'), 500);
  }

  /* ---------------- 结果 ---------------- */
  function showKidResult() {
    const act = ACTS[state.act.idx];
    const firstTry = state.act.firstTry;
    const stars = firstTry >= CONFIG.roundCount ? 3 : firstTry >= CONFIG.roundCount - 1 ? 2 : 1;
    const map = loadKidsStars();
    const prev = map[act.id] || 0;
    if (stars > prev) {
      map[act.id] = stars;
      saveKidsStars(map);
    }
    $('#kResultTitle').textContent = stars === 3
      ? '🌟 全都对，太厉害啦！'
      : stars === 2 ? '🎉 完成本轮，真棒！' : '💪 完成本轮，继续加油！';
    $('#kResultStats').textContent =
      act.emoji + ' ' + act.name + ' · 一次答对 ' + firstTry + ' / ' + CONFIG.roundCount + ' 题';

    [1, 2, 3].forEach((n) => {
      const el = $('#kStar' + n);
      el.className = 'k-star' + (n <= stars ? '' : ' off');
      void el.offsetWidth;
      el.classList.add('on');
    });
    playStars(stars);
    speak(stars === 3 ? '太棒了！你得到了三颗星！' : '你得到了' + (stars === 2 ? '两' : '一') + '颗星，真棒！');
    if (stars === 3) setTimeout(iceConfetti, 500);
    showScreen('result');
  }

  /* ---------------- 特效（彩带，与大孩子版同款手感） ---------------- */
  const CONFETTI_COLORS = ['#ff9ecb', '#ffd94a', '#a8dcfb', '#b6f5a8', '#ffab91', '#ce93d8'];
  function spawnParticles(x, y, n) {
    const layer = $('#fxLayer');
    for (let i = 0; i < n; i += 1) {
      const el = document.createElement('span');
      el.className = 'particle';
      const ang = Math.random() * Math.PI * 2;
      const dist = 36 + Math.random() * 96;
      el.style.width = (7 + Math.random() * 5) + 'px';
      el.style.height = (10 + Math.random() * 5) + 'px';
      el.style.borderRadius = '2px';
      el.style.background = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0];
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      el.style.setProperty('--dy', (Math.sin(ang) * dist * 0.75 - 26).toFixed(0) + 'px');
      el.style.setProperty('--rot', ((Math.random() * 720 - 360) | 0) + 'deg');
      el.style.setProperty('--t', (0.65 + Math.random() * 0.4).toFixed(2) + 's');
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1150);
    }
  }
  function confettiAt(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    spawnParticles(r.left + r.width / 2, r.top + r.height / 2, 22);
  }
  function iceConfetti() {
    const pts = [
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.36 },
      { x: window.innerWidth * (0.28 + Math.random() * 0.2), y: window.innerHeight * 0.5 },
      { x: window.innerWidth * (0.58 + Math.random() * 0.2), y: window.innerHeight * 0.55 },
    ];
    pts.forEach((p, i) => setTimeout(() => spawnParticles(p.x, p.y, 26), i * 150));
  }

  /* ---------------- 事件绑定 ---------------- */
  function updateSoundButton() {
    const btn = $('#soundBtn');
    btn.textContent = state.soundOn ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', String(state.soundOn));
    btn.setAttribute('aria-label', state.soundOn ? '关闭音效' : '开启音效');
  }
  $('#soundBtn').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    storageSet('sxd_sound', state.soundOn ? '1' : '0');
    if (!state.soundOn && typeof window.speechSynthesis !== 'undefined') {
      try { window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
    }
    updateSoundButton();
  });

  $('#homeBtn').addEventListener('click', () => {
    state.runSeq += 1;                     // 让未生效的自动推进回调失效
    speak('');
    renderHome();
    showScreen('home');
  });
  $('#speakBtn').addEventListener('click', () => {
    if (state.question) speak(state.question.speech);
  });
  $('#kPrompt').addEventListener('click', () => {
    if (state.question) speak(state.question.speech);
  });
  $('#againBtn').addEventListener('click', () => {
    if (state.act) startRound(state.act.idx);
  });
  $('#backHomeBtn').addEventListener('click', () => {
    renderHome();
    showScreen('home');
  });

  /* ---------------- 初始化 ---------------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  $('#heroChar').innerHTML = KID_SVG;
  updateSoundButton();
  renderHome();
  showScreen('home');
})();
