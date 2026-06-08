                                                                                                                              const STORAGE_KEY = {
  fav: "bm_favorites",
  wrong: "bm_wrongs",
  mode: "bm_mode",
                                                                                                                                examRecords: "bm_exam_records",
                                                                                                                                shuffleAll: "bm_shuffle_all",
                                                                                                                                shuffleStarred: "bm_shuffle_starred",
                                                                                                                                shuffleUnstarred: "bm_shuffle_unstarred"
};

const EXAM_QUESTION_COUNT = 10;

const state = {
  questions: [],
  mode: localStorage.getItem(STORAGE_KEY.mode) || "all",
  currentIndex: 0,
  showAnswer: false,
  shuffleAll: localStorage.getItem(STORAGE_KEY.shuffleAll) === "1",
  shuffleStarred: localStorage.getItem(STORAGE_KEY.shuffleStarred) === "1",
  shuffleUnstarred: localStorage.getItem(STORAGE_KEY.shuffleUnstarred) === "1",
  allShuffledIds: [],
  starredShuffledIds: [],
  unstarredShuffledIds: [],
  exam: null,
  examRecords: JSON.parse(localStorage.getItem(STORAGE_KEY.examRecords) || "[]"),
  favorites: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY.fav) || "[]")),
  wrongs: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY.wrong) || "[]"))
};

const el = {
  qText: document.getElementById("qText"),
  qTag: document.getElementById("qTag"),
  qNumber: document.getElementById("qNumber"),
  questionCard: document.getElementById("questionCard"),
  profilePanel: document.getElementById("profilePanel"),
  actionsBar: document.getElementById("actionsBar"),
  allTools: document.getElementById("allTools"),
  jumpNumberInput: document.getElementById("jumpNumberInput"),
  jumpNumberBtn: document.getElementById("jumpNumberBtn"),
  shuffleAllBtn: document.getElementById("shuffleAllBtn"),
  progressText: document.getElementById("progressText"),
  favCard: document.getElementById("favCard"),
  wrongCard: document.getElementById("wrongCard"),
  favCount: document.getElementById("favCount"),
  wrongCount: document.getElementById("wrongCount"),
  inputsWrap: document.getElementById("inputsWrap"),
  answerForm: document.getElementById("answerForm"),
  submitBtn: document.getElementById("submitBtn"),
  toggleAnswerBtn: document.getElementById("toggleAnswerBtn"),
  answerKey: document.getElementById("answerKey"),
  feedback: document.getElementById("feedback"),
  removeWrongBtn: document.getElementById("removeWrongBtn"),
  nextBtn: document.getElementById("nextBtn"),
  prevBtn: document.getElementById("prevBtn"),
  exitExamBtn: document.getElementById("exitExamBtn"),
  profileBtn: document.getElementById("profileBtn"),
  startExamBtn: document.getElementById("startExamBtn"),
  favBtn: document.getElementById("favBtn"),
  modeBtns: Array.from(document.querySelectorAll(".mode-btn[data-mode]"))
};

function normalize(s) {
  return (s || "")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，,]/g, "，")
    .replace(/[。\.]/g, "。");
}

function parseQuestions(mdText) {
  const cleaned = (mdText || "").replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/);
  const startRe = /^\s*\uFEFF?\s*(\*)?\s*(\d+)\s*[\.．，,、·]\s*(.*)$/;
  const result = [];

  let curr = null;
  for (const line of lines) {
    const m = line.match(startRe);
    if (m) {
      if (curr) {
        result.push(curr);
      }
      curr = {
        star: Boolean(m[1]),
        number: Number(m[2]),
        raw: (m[3] || "").trim()
      };
      continue;
    }

    if (!curr) {
      continue;
    }

    const t = line.trim();
    if (!t) {
      continue;
    }
    curr.raw += (curr.raw ? "\n" : "") + t;
  }

  if (curr) {
    result.push(curr);
  }

  return result.map((q, i) => {
    const blanks = [...q.raw.matchAll(/【([^【】]+)】/g)].map((x) => x[1]);
    return {
      id: `${q.number}-${i}`,
      index: i,
      number: q.number,
      star: q.star,
      raw: q.raw,
      blanks,
      prompt: q.star ? q.raw.replace(/【([^【】]+)】/g, "____") : q.raw
    };
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getQuestionAnswers(question) {
  return question.blanks.length ? question.blanks : [question.raw];
}

function getQuestionBlankCount(question) {
  return getQuestionAnswers(question).length;
}

function getAnswerText(question) {
  if (!question.star) {
    return "";
  }
  if (question.blanks.length) {
    return question.blanks.join("；");
  }
  return question.raw;
}

function getDeck() {
  if (state.mode === "profile") {
    return [];
  }
  if (state.mode === "wrong") {
    return state.questions.filter((q) => state.wrongs.has(q.id));
  }
  if (state.mode === "fav") {
    return state.questions.filter((q) => state.favorites.has(q.id));
  }

  const baseDeck = getBaseDeckForMode(state.mode);
  if (!isShuffleMode(state.mode) || !isShuffleEnabledForMode(state.mode)) {
    return baseDeck;
  }

  const ids = getShuffledIdsForMode(state.mode);
  if (ids.length !== baseDeck.length) {
    rebuildShuffleOrderForMode(state.mode);
  }
  const byId = new Map(baseDeck.map((q) => [q.id, q]));
  return getShuffledIdsForMode(state.mode).map((id) => byId.get(id)).filter(Boolean);
}

function getBaseDeckForMode(mode) {
  if (mode === "starred") {
    return state.questions.filter((q) => q.star);
  }
  if (mode === "unstarred") {
    return state.questions.filter((q) => !q.star);
  }
  return state.questions;
}

function isShuffleMode(mode) {
  return mode === "all" || mode === "starred" || mode === "unstarred";
}

function isShuffleEnabledForMode(mode) {
  if (mode === "all") {
    return state.shuffleAll;
  }
  if (mode === "starred") {
    return state.shuffleStarred;
  }
  if (mode === "unstarred") {
    return state.shuffleUnstarred;
  }
  return false;
}

function setShuffleEnabledForMode(mode, enabled) {
  if (mode === "all") {
    state.shuffleAll = enabled;
    localStorage.setItem(STORAGE_KEY.shuffleAll, enabled ? "1" : "0");
    return;
  }
  if (mode === "starred") {
    state.shuffleStarred = enabled;
    localStorage.setItem(STORAGE_KEY.shuffleStarred, enabled ? "1" : "0");
    return;
  }
  if (mode === "unstarred") {
    state.shuffleUnstarred = enabled;
    localStorage.setItem(STORAGE_KEY.shuffleUnstarred, enabled ? "1" : "0");
  }
}

function getShuffledIdsForMode(mode) {
  if (mode === "all") {
    return state.allShuffledIds;
  }
  if (mode === "starred") {
    return state.starredShuffledIds;
  }
  if (mode === "unstarred") {
    return state.unstarredShuffledIds;
  }
  return [];
}

function setShuffledIdsForMode(mode, ids) {
  if (mode === "all") {
    state.allShuffledIds = ids;
    return;
  }
  if (mode === "starred") {
    state.starredShuffledIds = ids;
    return;
  }
  if (mode === "unstarred") {
    state.unstarredShuffledIds = ids;
  }
}

function rebuildShuffleOrderForMode(mode) {
  const ids = getBaseDeckForMode(mode).map((q) => q.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  setShuffledIdsForMode(mode, ids);
}

function setAllToolsVisibility() {
  const visible = !state.exam && isShuffleMode(state.mode);
  el.allTools.style.display = visible ? "flex" : "none";
  if (!visible) {
    return;
  }
  const inAllMode = state.mode === "all";
  el.jumpNumberInput.style.display = inAllMode ? "block" : "none";
  el.jumpNumberBtn.style.display = inAllMode ? "inline-flex" : "none";
  const enabled = isShuffleEnabledForMode(state.mode);
  el.shuffleAllBtn.textContent = enabled ? "关闭乱序" : "开启乱序";
  el.shuffleAllBtn.classList.toggle("is-active", enabled);
}

function persistSets() {
  localStorage.setItem(STORAGE_KEY.fav, JSON.stringify([...state.favorites]));
  localStorage.setItem(STORAGE_KEY.wrong, JSON.stringify([...state.wrongs]));
}

function persistExamRecords() {
  localStorage.setItem(STORAGE_KEY.examRecords, JSON.stringify(state.examRecords));
}

function updateModeButtons() {
  const inExam = Boolean(state.exam && state.exam.active);
  const allModeButtons = Array.from(document.querySelectorAll(".mode-btn"));
  allModeButtons.forEach((b) => b.classList.remove("is-active"));
  el.favCard.classList.toggle("is-active", !inExam && state.mode === "fav");
  el.wrongCard.classList.toggle("is-active", !inExam && state.mode === "wrong");

  if (inExam) {
    el.startExamBtn.classList.add("is-active");
    return;
  }

  const active = el.modeBtns.find((b) => b.dataset.mode === state.mode);
  if (active) {
    active.classList.add("is-active");
  }
}

function updateStats(deck) {
  if (state.exam && state.exam.active) {
    el.progressText.textContent = `${state.exam.current + 1} / ${EXAM_QUESTION_COUNT}`;
    el.favCount.textContent = String(state.favorites.size);
    el.wrongCount.textContent = String(state.wrongs.size);
    return;
  }

  el.favCount.textContent = String(state.favorites.size);
  el.wrongCount.textContent = String(state.wrongs.size);
  el.progressText.textContent = deck.length ? `${state.currentIndex + 1} / ${deck.length}` : "0 / 0";
}

function renderAnswerInputs(question) {
  el.inputsWrap.innerHTML = "";

  if (!question.star) {
    el.submitBtn.style.display = "none";
    el.toggleAnswerBtn.style.display = "none";
    el.answerForm.style.display = "none";
    el.answerKey.style.display = "none";
    el.answerKey.textContent = "";
    return;
  }

  el.answerForm.style.display = "flex";
  const examMode = Boolean(state.exam && state.exam.active);
  el.submitBtn.style.display = "inline-flex";
  el.submitBtn.textContent = examMode ? "提交并下一题" : "提交答案";
  el.toggleAnswerBtn.style.display = examMode ? "none" : "inline-flex";

  if (!examMode && state.showAnswer) {
    el.answerKey.style.display = "block";
    el.answerKey.textContent = `答案：${getAnswerText(question)}`;
    el.toggleAnswerBtn.textContent = "隐藏答案";
  } else {
    el.answerKey.style.display = "none";
    el.answerKey.textContent = "";
    el.toggleAnswerBtn.textContent = "显示答案";
  }

  const answers = getQuestionAnswers(question);
  if (!question.blanks.length) {
    const input = document.createElement("input");
    input.className = "answer-input";
    input.placeholder = examMode ? "填入答案" : "输入答案";
    input.type = "text";
    if (examMode && state.exam.answers[question.id]) {
      input.value = state.exam.answers[question.id][0] || "";
    }
    el.inputsWrap.appendChild(input);
    return;
  }

  const savedAnswers = examMode ? (state.exam.answers[question.id] || []) : [];
  answers.forEach((_, idx) => {
    const input = document.createElement("input");
    input.className = "answer-input";
    input.placeholder = `填空 ${idx + 1}`;
    input.type = "text";
    if (examMode) {
      input.value = savedAnswers[idx] || "";
    }
    el.inputsWrap.appendChild(input);
  });
}

function setExamTheme(active) {
  document.body.classList.toggle("exam-mode", active);
}

function setLayout({ showQuestion, showProfile, showActions }) {
  el.questionCard.style.display = showQuestion ? "block" : "none";
  el.profilePanel.style.display = showProfile ? "block" : "none";
  el.actionsBar.style.display = showActions ? "grid" : "none";
}

function renderProfile() {
  setExamTheme(false);
  setLayout({ showQuestion: false, showProfile: true, showActions: false });

  const records = state.examRecords;
  const totalExams = records.length;
  const escaped = records.filter((r) => r.escaped).length;
  const sumScore = records.reduce((acc, r) => acc + r.score, 0);
  const totalBlanks = records.reduce((acc, r) => acc + r.totalBlanks, 0);
  const totalCorrect = records.reduce((acc, r) => acc + r.correctBlanks, 0);
  const accuracy = totalBlanks ? ((totalCorrect / totalBlanks) * 100).toFixed(2) : "0.00";
  const escapeRate = totalExams ? ((escaped / totalExams) * 100).toFixed(2) : "0.00";
  const avgScore = totalExams ? (sumScore / totalExams).toFixed(2) : "0.00";

  let html = `
    <div class="profile-metrics">
      <div class="profile-item"><span class="k">考试次数</span><span class="v">${totalExams}</span></div>
      <div class="profile-item"><span class="k">正确率</span><span class="v">${accuracy}%</span></div>
      <div class="profile-item"><span class="k">逃跑率</span><span class="v">${escapeRate}%</span></div>
      <div class="profile-item"><span class="k">平均分</span><span class="v">${avgScore}</span></div>
    </div>
  `;

  if (!records.length) {
    html += `<div class="record-list"><div class="record-card">暂无模拟考试记录。</div></div>`;
    el.profilePanel.innerHTML = html;
    return;
  }

  html += '<div class="record-list">';
  records.forEach((r, idx) => {
    const when = new Date(r.endedAt).toLocaleString();
    html += `
      <article class="record-card">
        <h3 class="record-title">第 ${records.length - idx} 次模拟考试</h3>
        <p class="record-meta">时间：${escapeHtml(when)} | 得分：${r.score.toFixed(2)} | 正确空数：${r.correctBlanks}/${r.totalBlanks} | ${r.escaped ? "提前退出" : "正常完成"}</p>
        <details class="record-paper">
          <summary>查看完整试卷与答卷</summary>
          ${r.paper.map((p) => `
            <div class="record-q">
              <div><strong>${p.number}.</strong> ${escapeHtml(p.prompt)}</div>
              <div>你的答案：${escapeHtml((p.userAnswers || []).join("；") || "（未作答）")}</div>
              <div>标准答案：${escapeHtml((p.correctAnswers || []).join("；"))}</div>
              <div>本题得分空数：${p.blankResults.filter(Boolean).length}/${p.blankResults.length}</div>
            </div>
          `).join("")}
        </details>
      </article>
    `;
  });
  html += "</div>";

  el.profilePanel.innerHTML = html;
}

function saveExamAnswerForCurrent() {
  if (!state.exam || !state.exam.active) {
    return;
  }
  const q = state.exam.questions[state.exam.current];
  if (!q) {
    return;
  }
  const inputs = Array.from(el.inputsWrap.querySelectorAll("input"));
  state.exam.answers[q.id] = inputs.map((i) => i.value.trim());
}

function evaluateExam(exam, escaped) {
  let correctBlanks = 0;
  let answeredBlanks = 0;

  const paper = exam.questions.map((q) => {
    const correctAnswers = getQuestionAnswers(q);
    const userAnswers = exam.answers[q.id] || [];
    const blankResults = correctAnswers.map((ans, idx) => {
      const user = (userAnswers[idx] || "").trim();
      if (user) {
        answeredBlanks += 1;
      }
      const ok = normalize(user) === normalize(ans);
      if (ok) {
        correctBlanks += 1;
      }
      return ok;
    });

    return {
      id: q.id,
      number: q.number,
      prompt: q.prompt,
      correctAnswers,
      userAnswers,
      blankResults
    };
  });

  const totalBlanks = exam.totalBlanks;
  const score = totalBlanks ? Number(((correctBlanks / totalBlanks) * 100).toFixed(2)) : 0;

  return {
    id: `exam_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    startedAt: exam.startedAt,
    endedAt: Date.now(),
    escaped,
    totalQuestions: exam.questions.length,
    totalBlanks,
    answeredBlanks,
    correctBlanks,
    score,
    paper
  };
}

function finalizeExam(escaped) {
  if (!state.exam || !state.exam.active) {
    return;
  }
  saveExamAnswerForCurrent();
  const record = evaluateExam(state.exam, escaped);
  state.examRecords.unshift(record);
  persistExamRecords();

  state.exam = null;
  state.showAnswer = false;
  state.mode = "profile";
  localStorage.setItem(STORAGE_KEY.mode, state.mode);
  renderQuestion();
}

function startExam() {
  if (state.exam && state.exam.active) {
    return;
  }

  const ok = confirm("是否确定开始模拟考试？");
  if (!ok) {
    return;
  }

  const pool = state.questions.filter((q) => q.star);
  if (pool.length < EXAM_QUESTION_COUNT) {
    el.feedback.textContent = `可作答题不足 ${EXAM_QUESTION_COUNT} 题，无法开始模拟考试。`;
    el.feedback.className = "feedback bad";
    return;
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, EXAM_QUESTION_COUNT);
  const totalBlanks = picked.reduce((acc, q) => acc + getQuestionBlankCount(q), 0);

  state.exam = {
    active: true,
    questions: picked,
    current: 0,
    answers: {},
    totalBlanks,
    startedAt: Date.now()
  };

  state.showAnswer = false;
  renderQuestion();
}

function renderExamQuestion() {
  setExamTheme(true);
  const q = state.exam.questions[state.exam.current];
  setLayout({ showQuestion: true, showProfile: false, showActions: true });

  el.qTag.textContent = "模拟考试";
  el.qNumber.textContent = `第 ${state.exam.current + 1} / ${EXAM_QUESTION_COUNT} 题`;
  el.qText.textContent = `${q.number}. ${q.prompt}`;
  el.feedback.textContent = "模拟考试模式不即时判对错。";
  el.feedback.className = "feedback";
  el.favBtn.textContent = state.favorites.has(q.id) ? "★ 已收藏" : "☆ 收藏";

  renderAnswerInputs(q);

  el.exitExamBtn.style.display = "inline-flex";
  el.prevBtn.disabled = state.exam.current === 0;
  el.nextBtn.textContent = state.exam.current === state.exam.questions.length - 1 ? "提交并结算" : "下一题";
}

function renderQuestion() {
  if (state.exam && state.exam.active) {
    updateStats([]);
    updateModeButtons();
    setAllToolsVisibility();
    el.removeWrongBtn.style.display = "none";
    renderExamQuestion();
    return;
  }

  if (state.mode === "profile") {
    updateStats([]);
    updateModeButtons();
    setAllToolsVisibility();
    el.removeWrongBtn.style.display = "none";
    renderProfile();
    return;
  }

  setExamTheme(false);
  setLayout({ showQuestion: true, showProfile: false, showActions: true });
  el.exitExamBtn.style.display = "none";
  el.prevBtn.disabled = false;
  el.nextBtn.textContent = "下一题";

  const deck = getDeck();
  if (state.currentIndex >= deck.length) {
    state.currentIndex = Math.max(0, deck.length - 1);
  }

  updateStats(deck);
  updateModeButtons();
  setAllToolsVisibility();

  if (!deck.length) {
    el.qTag.textContent = "空题库";
    el.qNumber.textContent = "#-";
    el.qText.textContent = "当前筛选下暂无题目。";
    el.answerForm.style.display = "none";
    el.answerKey.style.display = "none";
    el.answerKey.textContent = "";
    el.feedback.textContent = "";
    el.favBtn.textContent = "☆ 收藏";
    el.removeWrongBtn.style.display = "none";
    return;
  }

  const q = deck[state.currentIndex];
  el.qTag.textContent = q.star ? "可作答（填空）" : "阅读题";
  el.qNumber.textContent = `#${q.number}`;
  el.qText.textContent = `${q.number}. ${q.prompt}`;
  el.feedback.textContent = "";
  el.feedback.className = "feedback";

  const isFav = state.favorites.has(q.id);
  el.favBtn.textContent = isFav ? "★ 已收藏" : "☆ 收藏";
  el.removeWrongBtn.style.display = state.mode === "wrong" ? "inline-flex" : "none";

  renderAnswerInputs(q);
}

function removeCurrentWrong() {
  if (state.exam && state.exam.active) {
    return;
  }
  if (state.mode !== "wrong") {
    return;
  }

  const deck = getDeck();
  if (!deck.length) {
    return;
  }

  const q = deck[state.currentIndex];
  state.wrongs.delete(q.id);
  persistSets();
  renderQuestion();
}

function jumpToQuestionNumber() {
  if (state.exam || state.mode !== "all") {
    return;
  }

  const n = Number(el.jumpNumberInput.value);
  if (!Number.isInteger(n) || n <= 0) {
    el.feedback.textContent = "请输入有效题号。";
    el.feedback.className = "feedback bad";
    return;
  }

  const deck = getDeck();
  const idx = deck.findIndex((q) => q.number === n);
  if (idx < 0) {
    el.feedback.textContent = `未找到题号 ${n}。`;
    el.feedback.className = "feedback bad";
    return;
  }

  state.currentIndex = idx;
  state.showAnswer = false;
  renderQuestion();
}

function toggleAllShuffle() {
  if (state.exam || !isShuffleMode(state.mode)) {
    return;
  }

  const mode = state.mode;
  const currentDeck = getDeck();
  const current = currentDeck[state.currentIndex];

  const nextEnabled = !isShuffleEnabledForMode(mode);
  setShuffleEnabledForMode(mode, nextEnabled);
  if (nextEnabled) {
    rebuildShuffleOrderForMode(mode);
    state.currentIndex = 0;
  } else {
    setShuffledIdsForMode(mode, []);

    const nextDeck = getDeck();
    if (current) {
      const idx = nextDeck.findIndex((q) => q.id === current.id);
      state.currentIndex = idx >= 0 ? idx : 0;
    } else {
      state.currentIndex = 0;
    }
  }

  renderQuestion();
}

function toggleAnswer() {
  const deck = getDeck();
  if (!deck.length) {
    return;
  }
  const q = deck[state.currentIndex];
  if (!q.star) {
    return;
  }

  state.showAnswer = !state.showAnswer;
  renderAnswerInputs(q);
}

function answerCurrentQuestion() {
  if (state.exam && state.exam.active) {
    saveExamAnswerForCurrent();
    move(1);
    return;
  }

  const deck = getDeck();
  if (!deck.length) {
    return;
  }

  const q = deck[state.currentIndex];
  if (!q.star) {
    return;
  }

  const inputs = Array.from(el.inputsWrap.querySelectorAll("input"));
  const user = inputs.map((i) => i.value.trim());

  let answers = q.blanks;
  if (!answers.length) {
    answers = [q.raw];
  }

  const right = answers.every((ans, idx) => normalize(ans) === normalize(user[idx] || ""));

  if (right) {
    el.feedback.textContent = "回答正确";
    el.feedback.className = "feedback ok";
  } else {
    state.wrongs.add(q.id);
    persistSets();
    el.feedback.textContent = `回答错误。正确答案：${answers.join("；")}`;
    el.feedback.className = "feedback bad";
  }

  updateStats(deck);
}

function move(step) {
  if (state.exam && state.exam.active) {
    saveExamAnswerForCurrent();
    if (step > 0 && state.exam.current === state.exam.questions.length - 1) {
      finalizeExam(false);
      return;
    }
    const nextIndex = state.exam.current + step;
    state.exam.current = Math.max(0, Math.min(state.exam.questions.length - 1, nextIndex));
    renderQuestion();
    return;
  }

  const deck = getDeck();
  if (!deck.length) {
    return;
  }
  state.currentIndex = (state.currentIndex + step + deck.length) % deck.length;
  state.showAnswer = false;
  renderQuestion();
}

function switchMode(mode) {
  if (!mode) {
    return;
  }

  if (state.exam && state.exam.active) {
    const shouldExitExam = confirm("当前正在模拟考试，是否提前结束考试并结算？");
    if (!shouldExitExam) {
      return;
    }
    finalizeExam(true);
  }

  state.mode = mode;
  localStorage.setItem(STORAGE_KEY.mode, mode);
  state.currentIndex = 0;
  state.showAnswer = false;
  renderQuestion();
}

function toggleFavorite() {
  const deck = state.exam && state.exam.active ? state.exam.questions : getDeck();
  const index = state.exam && state.exam.active ? state.exam.current : state.currentIndex;
  if (!deck.length) {
    return;
  }

  const q = deck[index];
  if (state.favorites.has(q.id)) {
    state.favorites.delete(q.id);
  } else {
    state.favorites.add(q.id);
  }

  persistSets();
  renderQuestion();
}

async function load() {
  try {
    let md = "";
    try {
      const res = await fetch("./bm.md", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`读取 bm.md 失败：${res.status}`);
      }
      md = await res.text();
    } catch (_err) {
      if (typeof window.BM_MD === "string" && window.BM_MD.trim()) {
        md = window.BM_MD;
      } else {
        throw _err;
      }
    }

    state.questions = parseQuestions(md);
    if (!state.questions.length) {
      throw new Error("题库为空或解析失败");
    }
    renderQuestion();
  } catch (err) {
    el.qText.textContent = "题库加载失败。请检查 bm-data.js 是否存在，或使用本地静态服务器打开。";
    console.error(err);
  }
}

el.answerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  answerCurrentQuestion();
});

el.nextBtn.addEventListener("click", () => move(1));
el.prevBtn.addEventListener("click", () => move(-1));
el.exitExamBtn.addEventListener("click", () => finalizeExam(true));
el.startExamBtn.addEventListener("click", startExam);
el.favBtn.addEventListener("click", toggleFavorite);
el.removeWrongBtn.addEventListener("click", removeCurrentWrong);
el.toggleAnswerBtn.addEventListener("click", toggleAnswer);
el.jumpNumberBtn.addEventListener("click", jumpToQuestionNumber);
el.jumpNumberInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    jumpToQuestionNumber();
  }
});
el.shuffleAllBtn.addEventListener("click", toggleAllShuffle);
el.favCard.addEventListener("click", () => switchMode("fav"));
el.wrongCard.addEventListener("click", () => switchMode("wrong"));
el.modeBtns.forEach((btn) => btn.addEventListener("click", () => switchMode(btn.dataset.mode)));

window.addEventListener("beforeunload", (e) => {
  if (!(state.exam && state.exam.active)) {
    return;
  }
  e.preventDefault();
  e.returnValue = "";
});

load();
