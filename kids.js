/* ============================================================
 * 数数小达人 —— 中班数学启蒙（4~5 岁）
 * 纯静态实现：kids.html + kids.css + kids.js，零依赖
 *
 * 设计要点（与「速算小达人」大孩子版的区别）：
 *   - 不依赖识字：题目用实物图案展示，语音读题（speechSynthesis）
 *   - 不用键盘输入：答案为 3 个大泡泡点选，或直接点选图案
 *   - 零压力：没有怪兽、没有倒计时，答错轻轻提示后无限重试
 *   - 减法做成「喂小吃货」：亲手点掉要吃的实物（留下虚线幽灵位），
 *     剩下的就是答案——减法 = 拿走，看得见摸得着
 *   - 六个活动按序解锁：小加法 → 小减法 → 大冒险 → 分果果 → 凑十 → 满十加
 * ============================================================ */
(function () {
  'use strict';

  const CONFIG = {
    roundCount: 5,         // 每轮题数
    advanceDelay: 1400,    // 普通题答对后停留（毫秒）
    conclusionDelay: 3200, // 含单双数语音总结时，留足播放时间
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
  const PRAISE_SPEECH = ['真棒！', '太厉害啦', '答对咯', '好样的'];

  /* ---------------- 角色 SVG ---------------- */
  // 小星公主（雪儿公主的妹妹，原创形象）
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

  // 小吃货：张着大嘴的圆滚滚小怪物，喂它就咬一口
  const MONSTER_SVG =
    '<svg viewBox="0 0 56 50" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M16 12 L12 3 L21 7 Z" fill="#e87f95"/>' +
    '<path d="M40 12 L44 3 L35 7 Z" fill="#e87f95"/>' +
    '<ellipse cx="28" cy="29" rx="20" ry="19" fill="#ffb3ba"/>' +
    '<circle cx="20" cy="18" r="5" fill="#fff"/><circle cx="36" cy="18" r="5" fill="#fff"/>' +
    '<circle cx="21" cy="19" r="2.2" fill="#3a3a3a"/><circle cx="35" cy="19" r="2.2" fill="#3a3a3a"/>' +
    '<ellipse cx="28" cy="33" rx="10" ry="7.5" fill="#7a2e3e"/>' +
    '<path d="M21 30.5 Q28 27 35 30.5 L35 32.5 Q28 29.5 21 32.5 Z" fill="#fff"/>' +
    '<ellipse cx="28" cy="37" rx="5" ry="2.6" fill="#ff7d8e"/>' +
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
  // 喂一口：「啊呜」两声短音
  const playNom = () => { ensureAudio(); tone(392, 0, 0.07, 'triangle', 0.2); tone(262, 0.07, 0.12, 'triangle', 0.2); };
  // 搬进盘子：轻快上行两音
  const playMove = () => { ensureAudio(); tone(440, 0, 0.06, 'sine', 0.15); tone(587, 0.06, 0.1, 'sine', 0.15); };
  const playStars = (n) => {
    ensureAudio();
    for (let i = 0; i < Math.max(1, n); i += 1) tone(523 + i * 131, i * 0.18, 0.25, 'sine', 0.22);
  };

  /* ---------------- 语音读题（不支持时自动静默） ---------------- */
  // queue 为真时不打断正在播的语音，排在其后（用于「活动介绍 → 首题读题」）
  function speak(text, queue) {
    if (!state.soundOn || typeof window.speechSynthesis === 'undefined') return;
    try {
      if (!queue) window.speechSynthesis.cancel();
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

  function genAdd5() {
    const a = randInt(1, 4);
    const b = randInt(1, 5 - a);
    return {
      type: 'objects',
      prompt: '合起来一共有几个？',
      speech: '合起来，一共有几个',
      emoji: pick(EMOJIS),
      groups: [{ count: a }, { count: b }],
      plus: true,
      answer: a + b,
      options: numOptions(a + b, 0, 8),
    };
  }

  // 小减法：先亲手喂掉 toEat 个（留下幽灵空位），剩下的就是答案
  function genSub5() {
    const total = randInt(3, 5);
    const toEat = randInt(1, total);
    return {
      type: 'feed',
      prompt: '喂小吃货吃掉 ' + toEat + ' 个，还剩几个？',
      speech: '先点 ' + toEat + ' 个喂给小吃货，再看看还剩几个',
      emoji: pick(EMOJIS),
      total, toEat,
      answer: total - toEat,
      options: numOptions(total - toEat, 0, 8),
    };
  }

  // 凑十：十格盘（幼儿园标准教具，2×5 格子）让「合起来是 10」看得见
  function genMake10() {
    const a = randInt(1, 9);
    if (Math.random() < 0.45) {
      // 装满盘：a 个 + b 个 正好 10（3+7、2+8 这种好朋友加法）
      const emojis = shuffle(EMOJIS).slice(0, 2);
      return {
        type: 'tenframe',
        prompt: '盘子里一共有几个？',
        speech: '两种好吃的合起来，一共有几个',
        fill: [{ count: a, emoji: emojis[0] }, { count: 10 - a, emoji: emojis[1] }],
        answer: 10,
        options: numOptions(10, 0, 12),
      };
    }
    // 还差几个能装满：补数训练（3 的好朋友是 7），空格就在盘子里，数得着
    return {
      type: 'tenframe',
      prompt: '还差几个能装满盘子？',
      speech: '还差几个，能装满这个十格盘',
      fill: [{ count: a, emoji: pick(EMOJIS) }],
      answer: 10 - a,
      options: numOptions(10 - a, 0, 12),
    };
  }

  // 满十加：个位加法过十（5+7=12），凑十法的应用——
  // 大数进十格盘做底，孩子把外面的小数逐个搬进空格，
  // 盘子装满（10）+ 外面剩下的 = 答案
  function genCarry() {
    const sum = randInt(11, 18);
    const base = randInt(Math.ceil(sum / 2), 9);   // 大数进盘做底
    return {
      type: 'carry',
      prompt: '把外面的搬进盘子，一共有几个？',
      speech: '把外面的搬进十格盘，装满十个，再加上剩下的，一共有几个',
      emoji: pick(EMOJIS),
      base, loose: sum - base,
      answer: sum,
      options: numOptions(sum, 0, 20),
    };
  }

  // 分果果：把 N 个果果平均分给两个人（你一个我一个），
  // 奇数个时最后剩一个分不下去——单双数的直观体验
  function genShare() {
    const total = randInt(2, 10);
    const odd = total % 2 === 1;
    const askEach = Math.random() < 0.5;
    return {
      type: 'share',
      prompt: askEach ? '平均分给两个人，每人分到几个？' : '平均分给两个人，还剩几个？',
      speech: askEach ? '你一个，我一个，平均分一分，每人分到几个？' : '你一个，我一个，平均分一分，还剩几个？',
      emoji: pick(EMOJIS),
      total,
      ask: askEach ? 'each' : 'left',
      answer: askEach ? (total - (total % 2)) / 2 : total % 2,
      options: askEach ? numOptions((total - (total % 2)) / 2, 0, 12) : numOptions(total % 2, 0, 2),
      conclusion: odd ? '剩下一个，' + total + ' 是单数！' : '正好分完，' + total + ' 是双数！',
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
        groups: [{ count: a }, { count: b }],
        plus: true,
        answer: a + b,
        options: numOptions(a + b, 0, 12),
      };
    }
    const total = randInt(5, 10);
    const toEat = randInt(1, total - 1);
    return {
      type: 'feed',
      prompt: '喂小吃货吃掉 ' + toEat + ' 个，还剩几个？',
      speech: '先点 ' + toEat + ' 个喂给小吃货，再看看还剩几个',
      emoji: pick(EMOJIS),
      total, toEat,
      answer: total - toEat,
      options: numOptions(total - toEat, 0, 12),
    };
  }

  /* ---------------- 活动清单（按顺序解锁） ---------------- */
  const ACTS = [
    {
      id: 'add5', name: '小加法', emoji: '➕', tip: '合起来有几个', gen: genAdd5,
      speech: '小加法！把两堆好吃的合起来，一共有几个？',
    },
    {
      id: 'sub5', name: '小减法', emoji: '😋', tip: '喂饱小吃货', gen: genSub5,
      speech: '小减法！喂小吃货吃掉一些，还剩几个？',
    },
    {
      id: 'mix10', name: '大冒险', emoji: '🌟', tip: '10 以内加减', gen: genMix10,
      speech: '大冒险！十以内的加法和减法，加油！',
    },
    {
      id: 'share', name: '分果果', emoji: '🍒', tip: '你一个我一个', gen: genShare,
      speech: '分果果！你一个，我一个，平均分给小星和小吃货！',
    },
    {
      id: 'make10', name: '凑十', emoji: '🔟', tip: '装满十格盘', gen: genMake10,
      speech: '凑十！把十格盘装满，看看还差几个？',
    },
    {
      id: 'carry', name: '满十加', emoji: '🧺', tip: '装满十个再加', gen: genCarry,
      speech: '满十加！把外面的搬进十格盘，装满十个，再加上剩下的，一共有几个？',
    },
  ];

  /* ---------------- 进度存档 ---------------- */
  function normalizeKidsStars(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const clean = {};
    ACTS.forEach((act) => {
      const stars = Math.trunc(Number(value[act.id]));
      if (Number.isInteger(stars) && stars >= 1 && stars <= 3) clean[act.id] = stars;
    });
    // 保留所有已知活动的合法星级；是否解锁仍由 actsUnlockedTo 的连续进度决定。
    // 这样在中间插入新活动时，旧版后段进度不会被清空。
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
    speak(ACTS[idx].speech);        // 点卡片后先播报活动介绍（孩子不识字，靠听）
    showScreen('game');
    renderQuestion(true);           // 首题读题不打断介绍，排在后面
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

  // 一堆实物图案；interactive 时可点击（喂小吃货），onTap 收到被点的元素
  function buildObjects(count, emoji, interactive, onTap) {
    const wrap = document.createElement('div');
    wrap.className = 'obj-group';
    for (let i = 0; i < count; i += 1) {
      const obj = interactive ? document.createElement('button') : document.createElement('span');
      if (interactive) {
        obj.type = 'button';
        obj.setAttribute('aria-label', '点一点，喂给小吃货');
      }
      obj.className = 'obj';
      const pic = document.createElement('span');
      pic.className = 'obj-pic';
      pic.textContent = emoji;
      obj.appendChild(pic);
      if (interactive) obj.addEventListener('click', () => onTap(obj));
      wrap.appendChild(obj);
    }
    return wrap;
  }

  // 十格盘：2×5 共 10 格，装了的显示实物，没装的显示虚线空格
  function buildTenFrame(q) {
    const frame = document.createElement('div');
    frame.className = 'ten-frame';
    frame.setAttribute('aria-label', '十格盘');
    const items = [];
    q.fill.forEach((g) => {
      for (let i = 0; i < g.count; i += 1) items.push(g.emoji);
    });
    for (let i = 0; i < 10; i += 1) {
      const cell = document.createElement('span');
      cell.className = 'ten-cell' + (i < items.length ? '' : ' empty');
      cell.textContent = items[i] || '';
      cell.style.animationDelay = (i * 0.05) + 's';
      frame.appendChild(cell);
    }
    return frame;
  }

  function setNumberChoicesEnabled(enabled) {
    $$('#kChoices .bubble').forEach((button) => {
      button.disabled = !enabled;
      button.setAttribute('aria-disabled', String(!enabled));
    });
  }

  function needsInteraction(q) {
    return q && (q.type === 'feed' || q.type === 'carry' || q.type === 'share');
  }

  function shareFollowUp(q) {
    return q.ask === 'each' ? '分好啦！每人分到几个？' : '分好啦！还剩几个？';
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
    setNumberChoicesEnabled(!needsInteraction(q) || q.interactionComplete);
  }

  function renderQuestion(afterIntro) {
    const act = ACTS[state.act.idx];
    const q = act.gen();
    q.interactionComplete = !needsInteraction(q);
    state.question = q;
    state.locked = false;
    state.act.retries = 0;

    $('#kPrompt').textContent = q.prompt;
    const stage = $('#kStage');
    stage.textContent = '';
    $('#kChoices').textContent = '';

    if (q.type === 'objects') {
      // 加法：两堆实物中间一个大加号
      const row = document.createElement('div');
      row.className = 'obj-row';
      row.appendChild(buildObjects(q.groups[0].count, q.emoji, false));
      const plus = document.createElement('span');
      plus.className = 'k-plus';
      plus.textContent = '+';
      row.appendChild(plus);
      row.appendChild(buildObjects(q.groups[1].count, q.emoji, false));
      stage.appendChild(row);
    } else if (q.type === 'feed') {
      // 减法：点 toEat 个喂给小吃货（留下虚线幽灵位），剩下几个就是答案
      const row = document.createElement('div');
      row.className = 'obj-row';
      const panel = document.createElement('div');
      panel.className = 'feed-panel';
      const monster = document.createElement('div');
      monster.className = 'feed-monster';
      monster.innerHTML = MONSTER_SVG;
      const appetite = document.createElement('div');
      appetite.className = 'appetite';
      appetite.setAttribute('aria-label', '小吃货还想吃几个');
      for (let i = 0; i < q.toEat; i += 1) {
        const slot = document.createElement('span');
        slot.className = 'appetite-slot';
        slot.textContent = q.emoji;        // 气泡里画着它想吃的同款实物
        appetite.appendChild(slot);
      }
      panel.append(monster, appetite);

      let fed = 0;
      row.appendChild(buildObjects(q.total, q.emoji, true, (obj) => {
        if (obj.classList.contains('eaten')) return;
        if (fed >= q.toEat) {
          speak('小吃货吃饱啦，看看还剩几个？');
          return;
        }
        fed += 1;
        obj.classList.add('eaten');
        obj.disabled = true;
        appetite.children[fed - 1].classList.add('filled');
        monster.classList.remove('chomp');
        void monster.offsetWidth;
        monster.classList.add('chomp');
        playNom();
        speak(String(fed));
        if (fed === q.toEat) {
          q.interactionComplete = true;
          setNumberChoicesEnabled(true);
          appetite.classList.add('done');   // 喂饱后停止脉动提醒
          speak('还剩几个？', true);
        }
      }));
      row.appendChild(panel);
      stage.appendChild(row);
    } else if (q.type === 'tenframe') {
      // 凑十：十格盘（装满盘 / 还差几个）
      stage.appendChild(buildTenFrame(q));
    } else if (q.type === 'carry') {
      // 满十加：大数已在盘里，把外面的搬进空格装满十个，再加剩下的
      const wrap = document.createElement('div');
      wrap.className = 'carry-wrap';
      const frame = document.createElement('div');
      frame.className = 'ten-frame';
      frame.setAttribute('aria-label', '十格盘');
      const cells = [];
      for (let i = 0; i < 10; i += 1) {
        const cell = document.createElement('span');
        cell.className = 'ten-cell' + (i < q.base ? '' : ' empty');
        cell.textContent = i < q.base ? q.emoji : '';
        cell.style.animationDelay = (i * 0.04) + 's';
        frame.appendChild(cell);
        cells.push(cell);
      }
      const pile = document.createElement('div');
      pile.className = 'obj-group carry-pile';
      let moved = 0;
      for (let i = 0; i < q.loose; i += 1) {
        const obj = document.createElement('button');
        obj.type = 'button';
        obj.className = 'obj';
        obj.setAttribute('aria-label', '点一点，搬进盘子里');
        const pic = document.createElement('span');
        pic.className = 'obj-pic';
        pic.textContent = q.emoji;
        obj.appendChild(pic);
        obj.addEventListener('click', () => {
          if (obj.classList.contains('moved')) return;
          if (moved >= 10 - q.base) {
            speak('盘子装满啦！加上外面剩下的，一共几个？');
            return;
          }
          moved += 1;
          obj.classList.add('moved');
          obj.disabled = true;
          const cell = cells[q.base + moved - 1];
          cell.classList.remove('empty');
          cell.textContent = q.emoji;
          cell.classList.add('fill-in');
          playMove();
          speak(String(q.base + moved));
          if (moved === 10 - q.base) {
            q.interactionComplete = true;
            setNumberChoicesEnabled(true);
            speak('装满十个啦！外面还剩 ' + (q.loose - moved) + ' 个，一共几个？', true);
          }
        });
        pile.appendChild(obj);
      }
      wrap.append(frame, pile);
      stage.appendChild(wrap);
    } else if (q.type === 'share') {
      // 分果果：小星和小吃货各一个盘子，点篮子里的果果轮流分（你一个我一个）
      const wrap = document.createElement('div');
      wrap.className = 'share-wrap';
      const plates = document.createElement('div');
      plates.className = 'share-plates';
      const makeSide = (svg, label) => {
        const side = document.createElement('div');
        side.className = 'share-side';
        const ch = document.createElement('div');
        ch.className = 'share-char';
        ch.innerHTML = svg;
        const plate = document.createElement('div');
        plate.className = 'share-plate';
        plate.setAttribute('aria-label', label + '的盘子');
        side.append(ch, plate);
        return { side, plate };
      };
      const left = makeSide(KID_SVG, '小星');
      const right = makeSide(MONSTER_SVG, '小吃货');
      plates.append(left.side, right.side);

      const basket = document.createElement('div');
      basket.className = 'obj-group share-basket';
      let placed = 0;
      const maxPlace = q.total - (q.total % 2);
      let leftoverSaid = false;
      for (let i = 0; i < q.total; i += 1) {
        const obj = document.createElement('button');
        obj.type = 'button';
        obj.className = 'obj';
        obj.setAttribute('aria-label', '点一点，分果果');
        const pic = document.createElement('span');
        pic.className = 'obj-pic';
        pic.textContent = q.emoji;
        obj.appendChild(pic);
        obj.addEventListener('click', () => {
          if (obj.classList.contains('moved') || obj.classList.contains('leftover')) return;
          if (placed >= maxPlace) {
            // 奇数个的最后一个：再分就不一样多了，剩下来
            obj.classList.add('leftover');
            obj.disabled = true;
            if (!leftoverSaid) {
              leftoverSaid = true;
              q.interactionComplete = true;
              setNumberChoicesEnabled(true);
              speak('分不了啦，一人一个才公平，这个剩下了！');
              speak(shareFollowUp(q), true);
            }
            return;
          }
          placed += 1;
          obj.classList.add('moved');
          obj.disabled = true;
          const toLeft = placed % 2 === 1;
          const mini = document.createElement('span');
          mini.className = 'share-fruit';
          mini.textContent = q.emoji;
          (toLeft ? left.plate : right.plate).appendChild(mini);
          playMove();
          speak(toLeft ? '给小星' : '给小吃货');
          if (placed === maxPlace) {
            if (q.total % 2 === 0) {
              q.interactionComplete = true;
              setNumberChoicesEnabled(true);
              speak(shareFollowUp(q), true);
            } else {
              speak('还剩一个，点一下看看能不能公平分掉？', true);
            }
          }
        });
        basket.appendChild(obj);
      }
      wrap.append(plates, basket);
      stage.appendChild(wrap);
    }

    buildNumberChoices(q);
    renderProgress();
    speak(q.speech, !!afterIntro);
  }

  /* ---------------- 作答 ---------------- */
  function chooseNumber(btn, value) {
    if (state.locked) return;
    if (!state.question.interactionComplete) {
      const hint = state.question.type === 'feed' ? '先喂饱小吃货哦'
        : state.question.type === 'carry' ? '先把十格盘装满哦' : '先把果果分完哦';
      speak(hint);
      return;
    }
    if (value === state.question.answer) acceptAnswer(btn);
    else rejectAnswer(btn);
  }

  function acceptAnswer(btn) {
    state.locked = true;
    btn.classList.add('correct');
    playCorrect();
    speak(pick(PRAISE_SPEECH));
    // 分果果：答对后顺势总结单双数（排队跟在表扬后面）
    if (state.question.conclusion) speak(state.question.conclusion, true);
    confettiAt(btn);
    if (state.act.retries === 0) state.act.firstTry += 1;
    const seq = state.runSeq;
    const delay = state.question.conclusion ? CONFIG.conclusionDelay : CONFIG.advanceDelay;
    setTimeout(() => {
      if (state.screen !== 'game' || state.runSeq !== seq) return;
      state.act.qIndex += 1;
      if (state.act.qIndex >= CONFIG.roundCount) showKidResult();
      else renderQuestion();
    }, delay);
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
