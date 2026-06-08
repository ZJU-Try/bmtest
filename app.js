const STORAGE_KEY = {
  fav: "bm_favorites",
  wrong: "bm_wrongs",
  mode: "bm_mode"
};

const state = {
  questions: [],
  mode: localStorage.getItem(STORAGE_KEY.mode) || "all",
  currentIndex: 0,
  showAnswer: false,
  favorites: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY.fav) || "[]")),
  wrongs: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY.wrong) || "[]"))
};

const el = {
  qText: document.getElementById("qText"),
  qTag: document.getElementById("qTag"),
  qNumber: document.getElementById("qNumber"),
  progressText: document.getElementById("progressText"),
  favCount: document.getElementById("favCount"),
  wrongCount: document.getElementById("wrongCount"),
  inputsWrap: document.getElementById("inputsWrap"),
  answerForm: document.getElementById("answerForm"),
  submitBtn: document.getElementById("submitBtn"),
  toggleAnswerBtn: document.getElementById("toggleAnswerBtn"),
  answerKey: document.getElementById("answerKey"),
  feedback: document.getElementById("feedback"),
  nextBtn: document.getElementById("nextBtn"),
  prevBtn: document.getElementById("prevBtn"),
  favBtn: document.getElementById("favBtn"),
  modeBtns: Array.from(document.querySelectorAll(".mode-btn"))
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
  if (state.mode === "wrong") {
    return state.questions.filter((q) => state.wrongs.has(q.id));
  }
  if (state.mode === "fav") {
    return state.questions.filter((q) => state.favorites.has(q.id));
  }
  if (state.mode === "starred") {
    return state.questions.filter((q) => q.star);
  }
  return state.questions;
}

function persistSets() {
  localStorage.setItem(STORAGE_KEY.fav, JSON.stringify([...state.favorites]));
  localStorage.setItem(STORAGE_KEY.wrong, JSON.stringify([...state.wrongs]));
}

function updateModeButtons() {
  el.modeBtns.forEach((b) => {
    b.classList.toggle("is-active", b.dataset.mode === state.mode);
  });
}

function updateStats(deck) {
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
  el.submitBtn.style.display = "inline-flex";
  el.toggleAnswerBtn.style.display = "inline-flex";

  if (state.showAnswer) {
    el.answerKey.style.display = "block";
    el.answerKey.textContent = `答案：${getAnswerText(question)}`;
    el.toggleAnswerBtn.textContent = "隐藏答案";
  } else {
    el.answerKey.style.display = "none";
    el.answerKey.textContent = "";
    el.toggleAnswerBtn.textContent = "显示答案";
  }

  if (!question.blanks.length) {
    const input = document.createElement("input");
    input.className = "answer-input";
    input.placeholder = "输入答案";
    input.type = "text";
    el.inputsWrap.appendChild(input);
    return;
  }

  question.blanks.forEach((_, idx) => {
    const input = document.createElement("input");
    input.className = "answer-input";
    input.placeholder = `填空 ${idx + 1}`;
    input.type = "text";
    el.inputsWrap.appendChild(input);
  });
}

function renderQuestion() {
  const deck = getDeck();
  if (state.currentIndex >= deck.length) {
    state.currentIndex = Math.max(0, deck.length - 1);
  }

  updateStats(deck);
  updateModeButtons();

  if (!deck.length) {
    el.qTag.textContent = "空题库";
    el.qNumber.textContent = "#-";
    el.qText.textContent = "当前筛选下暂无题目。";
    el.answerForm.style.display = "none";
    el.answerKey.style.display = "none";
    el.answerKey.textContent = "";
    el.feedback.textContent = "";
    el.favBtn.textContent = "☆ 收藏";
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

  renderAnswerInputs(q);
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
  const deck = getDeck();
  if (!deck.length) {
    return;
  }
  state.currentIndex = (state.currentIndex + step + deck.length) % deck.length;
  state.showAnswer = false;
  renderQuestion();
}

function switchMode(mode) {
  state.mode = mode;
  localStorage.setItem(STORAGE_KEY.mode, mode);
  state.currentIndex = 0;
  state.showAnswer = false;
  renderQuestion();
}

function toggleFavorite() {
  const deck = getDeck();
  if (!deck.length) {
    return;
  }

  const q = deck[state.currentIndex];
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
el.favBtn.addEventListener("click", toggleFavorite);
el.toggleAnswerBtn.addEventListener("click", toggleAnswer);
el.modeBtns.forEach((btn) => btn.addEventListener("click", () => switchMode(btn.dataset.mode)));

load();
