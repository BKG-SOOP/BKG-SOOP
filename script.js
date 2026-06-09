import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBH3ccNKz5P7shmcgtHTTCK-Yg_LtoW4-4",
  authDomain: "bkg-soop.firebaseapp.com",
  databaseURL: "https://bkg-soop-default-rtdb.firebaseio.com",
  projectId: "bkg-soop",
  storageBucket: "bkg-soop.firebasestorage.app",
  messagingSenderId: "569354931997",
  appId: "1:569354931997:web:e5acdc63a6aa8a53871bf4",
  measurementId: "G-SRFPHLCMDL"
};

const ADMIN_UID = "7rYEhRouIuZdEK3bRoQtYUz7arW2";
const ADMIN_EMAIL_DOMAIN = "bkg-soop.com";
const ROOT_PATH = "bkgSoopRecordBoard";

const TIER_GROUPS = [
  { name: "0티어", subs: ["GOD", "상", "중", "하"] },
  { name: "1티어", subs: ["최상", "상", "중", "하"] },
  { name: "2티어", subs: ["최상", "상", "중", "하"] },
  { name: "3티어", subs: ["최상", "상", "중", "하"] }
];

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const rootRef = ref(db, ROOT_PATH);

let currentUser = null;
let isAdmin = false;
let searchQuery = "";

let state = {
  players: [],
  updatedAt: ""
};

const tiersContainer = document.getElementById("tiersContainer");
const tierNav = document.getElementById("tierNav");
const totalPlayersEl = document.getElementById("totalPlayers");
const totalGamesEl = document.getElementById("totalGames");
const updatedAtEl = document.getElementById("updatedAt");
const connectStatusEl = document.getElementById("connectStatus");

const loginBtn = document.getElementById("loginBtn");
const addRecordBtn = document.getElementById("addRecordBtn");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

setupExtraUi();
render();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isAdmin = Boolean(user && user.uid === ADMIN_UID);
  render();

  if (user && !isAdmin) {
    alert("관리자 권한이 없는 계정입니다.");
    signOut(auth);
  }
});

onValue(
  rootRef,
  (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      state = {
        players: [],
        updatedAt: ""
      };
    } else {
      state = convertFirebaseData(data);
    }

    connectStatusEl.textContent = "Firebase 연결 완료";
    render();
  },
  (error) => {
    connectStatusEl.textContent = "Firebase 연결 실패";
    alert(`Firebase 데이터를 불러오지 못했습니다.\n${error.message}`);
  }
);

loginBtn.addEventListener("click", async () => {
  if (isAdmin) {
    await signOut(auth);
    return;
  }

  openLoginModal();
});

addRecordBtn.addEventListener("click", () => {
  if (!requireAdmin()) return;
  openAddRecordModal();
});

addPlayerBtn.addEventListener("click", () => {
  if (!requireAdmin()) return;
  openAddPlayerModal();
});

resetAllBtn.addEventListener("click", async () => {
  if (!requireAdmin()) return;

  if (!confirm("전체 데이터를 초기화할까요?\n\n멤버와 전적이 모두 삭제됩니다.")) return;

  try {
    await set(rootRef, {
      players: {},
      meta: createMeta()
    });
  } catch (error) {
    alertWriteError(error);
  }
});

modalClose.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

function setupExtraUi() {
  createSearchPanel();
}

function createSearchPanel() {
  if (document.getElementById("playerSearchInput")) return;

  const main = document.querySelector(".main");
  const board = document.querySelector(".board");

  if (!main || !board) return;

  const searchPanel = document.createElement("div");
  searchPanel.className = "search-panel";
  searchPanel.innerHTML = `
    <div class="search-row">
      <div class="search-input-wrap">
        <input
          id="playerSearchInput"
          class="search-input"
          type="text"
          placeholder="두글자 닉네임 또는 풀네임 검색"
          autocomplete="off"
        />
        <button id="playerSearchClear" class="search-clear-btn hidden" type="button">×</button>
      </div>
      <div id="searchResultBadge" class="search-result-badge">전체</div>
    </div>
  `;

  main.insertBefore(searchPanel, board);

  const input = document.getElementById("playerSearchInput");
  const clearBtn = document.getElementById("playerSearchClear");

  input.addEventListener("input", () => {
    searchQuery = input.value.trim();
    render();
  });

  clearBtn.addEventListener("click", () => {
    searchQuery = "";
    input.value = "";
    render();
    input.focus();
  });
}

function convertFirebaseData(data) {
  const rawPlayers = data.players || {};

  const players = Object.entries(rawPlayers).map(([id, player]) => {
    const tier = isValidTier(player.tier) ? player.tier : "0티어";
    const subTier = isValidSubTier(tier, player.subTier)
      ? player.subTier
      : getDefaultSubTier(tier);

    return {
      id,
      name: player.name || "이름없음",
      shortName: player.shortName || "",
      tier,
      subTier,
      records: Array.isArray(player.records) ? player.records.slice(-20) : [],
      createdAt: player.createdAt || 0
    };
  });

  players.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.name.localeCompare(b.name, "ko");
  });

  return {
    players,
    updatedAt: data.meta?.updatedAt || ""
  };
}

function render() {
  renderAdminState();
  renderStats();
  renderTierNav();
  renderTiers();
  renderSearchState();
}

function renderAdminState() {
  loginBtn.textContent = isAdmin ? "관리자 로그아웃" : "관리자 로그인";

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin);
  });
}

function renderStats() {
  const totalPlayers = state.players.length;
  const totalGames = state.players.reduce((sum, player) => {
    return sum + player.records.length;
  }, 0);

  totalPlayersEl.textContent = `${totalPlayers}명`;
  totalGamesEl.textContent = `${totalGames}게임`;
  updatedAtEl.textContent = state.updatedAt || "-";
}

function renderSearchState() {
  const badge = document.getElementById("searchResultBadge");
  const clearBtn = document.getElementById("playerSearchClear");

  if (!badge || !clearBtn) return;

  const filteredCount = getVisiblePlayers().length;

  if (searchQuery) {
    badge.textContent = `${filteredCount}명 검색`;
    clearBtn.classList.remove("hidden");
  } else {
    badge.textContent = "전체";
    clearBtn.classList.add("hidden");
  }
}

function renderTierNav() {
  tierNav.innerHTML = "";

  TIER_GROUPS.forEach((group, groupIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className = "tier-nav-group";

    const subLinks = group.subs
      .map((sub, subIndex) => {
        return `<a href="#${getSubTierId(groupIndex, subIndex)}">${sub}</a>`;
      })
      .join("");

    wrapper.innerHTML = `
      <a class="tier-nav-title" href="#tier-${groupIndex}">${group.name}</a>
      <div class="tier-nav-subs">
        ${subLinks}
      </div>
    `;

    tierNav.appendChild(wrapper);
  });
}

function getVisiblePlayers() {
  if (!searchQuery) return state.players;

  const query = normalizeName(searchQuery);

  return state.players.filter((player) => {
    const fullName = normalizeName(player.name);
    const shortName = normalizeName(player.shortName || "");
    const tier = normalizeName(player.tier);
    const subTier = normalizeName(player.subTier);

    return (
      fullName.includes(query) ||
      shortName.includes(query) ||
      tier.includes(query) ||
      subTier.includes(query)
    );
  });
}

function renderTiers() {
  tiersContainer.innerHTML = "";

  const visiblePlayers = getVisiblePlayers();

  TIER_GROUPS.forEach((group, groupIndex) => {
    const groupPlayers = visiblePlayers.filter((player) => player.tier === group.name);

    if (searchQuery && groupPlayers.length === 0) return;

    const section = document.createElement("section");
    section.className = "tier-section";
    section.id = `tier-${groupIndex}`;

    section.innerHTML = `
      <div class="tier-header">
        <div class="tier-title">${group.name}</div>
        <div class="tier-count">${groupPlayers.length}명</div>
      </div>
      <div class="sub-tier-list"></div>
    `;

    const subTierList = section.querySelector(".sub-tier-list");

    group.subs.forEach((sub, subIndex) => {
      const subPlayers = visiblePlayers.filter((player) => {
        return player.tier === group.name && player.subTier === sub;
      });

      if (searchQuery && subPlayers.length === 0) return;

      const block = document.createElement("div");
      block.className = "sub-tier-block";
      block.id = getSubTierId(groupIndex, subIndex);

      block.innerHTML = `
        <div class="sub-tier-head">
          <div class="sub-tier-title">${sub}</div>
          <div class="sub-tier-count">${subPlayers.length}명</div>
        </div>
        <div class="sub-player-list"></div>
      `;

      const list = block.querySelector(".sub-player-list");

      if (subPlayers.length === 0) {
        list.innerHTML = `<div class="sub-tier-empty">등록된 인원이 없습니다.</div>`;
      } else {
        subPlayers.forEach((player) => {
          list.appendChild(createPlayerRow(player));
        });
      }

      subTierList.appendChild(block);
    });

    tiersContainer.appendChild(section);
  });

  if (searchQuery && tiersContainer.innerHTML.trim() === "") {
    tiersContainer.innerHTML = `
      <section class="tier-section">
        <div class="tier-header">
          <div class="tier-title">검색 결과 없음</div>
          <div class="tier-count">0명</div>
        </div>
        <div class="sub-tier-empty">검색어와 일치하는 인원이 없습니다.</div>
      </section>
    `;
  }
}

function createPlayerRow(player) {
  const wins = player.records.filter((record) => record === "W").length;
  const losses = player.records.filter((record) => record === "L").length;
  const total = player.records.length;
  const winRate = total === 0 ? "0%" : `${((wins / total) * 100).toFixed(1)}%`;

  const row = document.createElement("div");
  row.className = "player-row";

  const recordHtml = player.records
    .slice(-20)
    .map((record) => {
      const className = record === "W" ? "win" : "loss";
      const label = record === "W" ? "승" : "패";
      return `<span class="record-dot ${className}">${label}</span>`;
    })
    .join("");

  const shortNameHtml = player.shortName
    ? `<span class="player-short">${escapeHtml(player.shortName)}</span>`
    : `<span class="player-short empty-short">--</span>`;

  row.innerHTML = `
    <div class="player-name">
      <div class="player-identity">
        ${shortNameHtml}
        <span class="player-full">${escapeHtml(player.name)}</span>
      </div>
    </div>

    <div class="record-dots">
      ${recordHtml || `<span style="color:#667085;">기록 없음</span>`}
    </div>

    <div class="stat">${wins}승</div>
    <div class="stat">${losses}패</div>
    <div class="stat">${winRate}</div>

    <div class="player-actions admin-only ${isAdmin ? "" : "hidden"}">
      <button class="mini-btn" data-action="win">승</button>
      <button class="mini-btn" data-action="loss">패</button>
      <button class="mini-btn" data-action="undo">취소</button>
      <button class="mini-btn warning" data-action="reset">초기화</button>
      <button class="mini-btn" data-action="edit">수정</button>
      <button class="mini-btn" data-action="move">이동</button>
      <button class="mini-btn danger" data-action="delete">삭제</button>
    </div>
  `;

  row.querySelector('[data-action="win"]')?.addEventListener("click", () => {
    addRecord(player.id, "W");
  });

  row.querySelector('[data-action="loss"]')?.addEventListener("click", () => {
    addRecord(player.id, "L");
  });

  row.querySelector('[data-action="undo"]')?.addEventListener("click", () => {
    undoRecord(player.id);
  });

  row.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
    resetPlayerRecords(player.id);
  });

  row.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
    openEditPlayerModal(player.id);
  });

  row.querySelector('[data-action="move"]')?.addEventListener("click", () => {
    openMoveTierModal(player.id);
  });

  row.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
    deletePlayer(player.id);
  });

  return row;
}

async function addRecord(playerId, result) {
  if (!requireAdmin()) return;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  const records = [...player.records, result].slice(-20);

  try {
    await update(ref(db, `${ROOT_PATH}/players/${playerId}`), { records });
    await updateMeta();
  } catch (error) {
    alertWriteError(error);
  }
}

async function undoRecord(playerId) {
  if (!requireAdmin()) return;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  if (player.records.length === 0) {
    alert("취소할 전적이 없습니다.");
    return;
  }

  const records = player.records.slice(0, -1);

  try {
    await update(ref(db, `${ROOT_PATH}/players/${playerId}`), { records });
    await updateMeta();
  } catch (error) {
    alertWriteError(error);
  }
}

async function resetPlayerRecords(playerId) {
  if (!requireAdmin()) return;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  if (player.records.length === 0) {
    alert(`${player.name} 님은 초기화할 전적이 없습니다.`);
    return;
  }

  if (
    !confirm(
      `${player.shortName ? player.shortName + " / " : ""}${player.name} 님의 최근 전적을 초기화할까요?\n\n멤버는 유지되고 이 사람의 승/패 기록만 삭제됩니다.`
    )
  ) {
    return;
  }

  try {
    await update(ref(db, `${ROOT_PATH}/players/${playerId}`), {
      records: []
    });

    await updateMeta();
  } catch (error) {
    alertWriteError(error);
  }
}

async function deletePlayer(playerId) {
  if (!requireAdmin()) return;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  if (!confirm(`${player.name} 님을 삭제할까요?`)) return;

  try {
    await remove(ref(db, `${ROOT_PATH}/players/${playerId}`));
    await updateMeta();
  } catch (error) {
    alertWriteError(error);
  }
}

function openLoginModal() {
  openModal(
    "관리자 로그인",
    `
      <form class="form" id="loginForm">
        <label>
          아이디
          <input type="text" id="loginIdInput" placeholder="예: admin" autocomplete="username" />
        </label>

        <label>
          비밀번호
          <input type="password" id="passwordInput" placeholder="비밀번호 입력" autocomplete="current-password" />
        </label>

        <div class="form-actions">
          <button type="submit" class="submit-btn">로그인</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>

      <div class="notice">
        이메일 전체가 아니라 <b>@${ADMIN_EMAIL_DOMAIN}</b> 앞부분만 입력하면 됩니다.<br>
        예: admin@${ADMIN_EMAIL_DOMAIN} → admin
      </div>

      <div id="loginError" class="error-text hidden"></div>
    `
  );

  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const idValue = document.getElementById("loginIdInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    const errorEl = document.getElementById("loginError");

    if (!idValue || !password) {
      errorEl.textContent = "아이디와 비밀번호를 모두 입력해 주세요.";
      errorEl.classList.remove("hidden");
      return;
    }

    const email = idValue.includes("@")
      ? idValue
      : `${idValue}@${ADMIN_EMAIL_DOMAIN}`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      closeModal();
    } catch (error) {
      errorEl.textContent = getLoginErrorMessage(error);
      errorEl.classList.remove("hidden");
    }
  });

  bindCloseButtons();
}

function openAddRecordModal() {
  if (state.players.length === 0) {
    alert("먼저 닉네임을 추가해 주세요.");
    return;
  }

  openModal(
    "전적 일괄 추가",
    `
      <form class="form" id="addRecordForm">
        <div class="bulk-record-box">
          <div class="bulk-area-wrap">
            <div class="bulk-area-title">
              <span>승리 인원</span>
              <span class="hint">탭 / 줄바꿈 / 쉼표로 구분</span>
            </div>
            <textarea
              id="winnerText"
              class="bulk-textarea bulk-win"
              placeholder="예: 해원	수힛	수피	부기"
              autocomplete="off"
            ></textarea>
          </div>

          <div class="bulk-area-wrap">
            <div class="bulk-area-title">
              <span>패배 인원</span>
              <span class="hint">탭 / 줄바꿈 / 쉼표로 구분</span>
            </div>
            <textarea
              id="loserText"
              class="bulk-textarea bulk-loss"
              placeholder="예: 아칸	흑구	프로	성장"
              autocomplete="off"
            ></textarea>
          </div>
        </div>

        <div class="bulk-help">
          두글자 닉네임 또는 풀네임으로 입력할 수 있어요.<br>
          예: <b>해원</b> 또는 <b>hyewon_n</b>
        </div>

        <div class="form-actions">
          <button type="submit" class="submit-btn">전적 추가</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>
    `,
    "wide-modal"
  );

  document.getElementById("addRecordForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const winnerNames = parseBulkNames(document.getElementById("winnerText").value);
    const loserNames = parseBulkNames(document.getElementById("loserText").value);

    await addBulkRecords(winnerNames, loserNames);
  });

  bindCloseButtons();
}

function parseBulkNames(text) {
  return text
    .split(/[\t\n\r,，、/]+/g)
    .map((name) => name.trim())
    .filter(Boolean);
}

async function addBulkRecords(winnerNames, loserNames) {
  if (!requireAdmin()) return;

  if (winnerNames.length === 0 && loserNames.length === 0) {
    alert("승리 인원 또는 패배 인원을 입력해 주세요.");
    return;
  }

  const duplicatedInWinner = findDuplicatedNames(winnerNames);
  const duplicatedInLoser = findDuplicatedNames(loserNames);

  if (duplicatedInWinner.length > 0) {
    alert(`승리 인원에 중복 입력이 있습니다.\n\n${duplicatedInWinner.join(", ")}`);
    return;
  }

  if (duplicatedInLoser.length > 0) {
    alert(`패배 인원에 중복 입력이 있습니다.\n\n${duplicatedInLoser.join(", ")}`);
    return;
  }

  const overlap = winnerNames.filter((name) => {
    return loserNames.some((other) => normalizeName(other) === normalizeName(name));
  });

  if (overlap.length > 0) {
    alert(`승리/패배 양쪽에 모두 입력된 인원이 있습니다.\n\n${overlap.join(", ")}`);
    return;
  }

  const winnerPlayers = [];
  const loserPlayers = [];
  const notFound = [];

  winnerNames.forEach((name) => {
    const player = findPlayerByInputName(name);

    if (player) {
      winnerPlayers.push(player);
    } else {
      notFound.push(`[승리] ${name}`);
    }
  });

  loserNames.forEach((name) => {
    const player = findPlayerByInputName(name);

    if (player) {
      loserPlayers.push(player);
    } else {
      notFound.push(`[패배] ${name}`);
    }
  });

  if (notFound.length > 0) {
    alert(
      "등록된 인원 중 찾을 수 없는 이름이 있습니다.\n\n" +
      notFound.join("\n") +
      "\n\n두글자 닉네임 또는 풀네임이 정확한지 확인해 주세요."
    );
    return;
  }

  const allTargetPlayers = [...winnerPlayers, ...loserPlayers];

  if (allTargetPlayers.length === 0) {
    alert("전적을 추가할 인원이 없습니다.");
    return;
  }

  const updates = {};

  winnerPlayers.forEach((player) => {
    const records = [...player.records, "W"].slice(-20);
    updates[`${ROOT_PATH}/players/${player.id}/records`] = records;
  });

  loserPlayers.forEach((player) => {
    const records = [...player.records, "L"].slice(-20);
    updates[`${ROOT_PATH}/players/${player.id}/records`] = records;
  });

  updates[`${ROOT_PATH}/meta`] = createMeta();

  try {
    await update(ref(db), updates);
    closeModal();

    alert(
      `전적 추가 완료!\n\n승리: ${winnerPlayers.length}명\n패배: ${loserPlayers.length}명`
    );
  } catch (error) {
    alertWriteError(error);
  }
}

function findPlayerByInputName(inputName) {
  const target = normalizeName(inputName);

  return state.players.find((player) => {
    const fullName = normalizeName(player.name);
    const shortName = normalizeName(player.shortName || "");

    return fullName === target || shortName === target;
  });
}

function findDuplicatedNames(names) {
  const seen = new Set();
  const duplicated = [];

  names.forEach((name) => {
    const key = normalizeName(name);

    if (seen.has(key)) {
      duplicated.push(name);
    } else {
      seen.add(key);
    }
  });

  return duplicated;
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function openAddPlayerModal() {
  const tierOptions = TIER_GROUPS.map((group) => {
    return `<option value="${group.name}">${group.name}</option>`;
  }).join("");

  openModal(
    "닉네임 추가",
    `
      <form class="form" id="addPlayerForm">
        <label>
          풀네임
          <input type="text" id="playerName" placeholder="풀네임 입력" autocomplete="off" />
        </label>

        <label>
          두글자 닉네임
          <input type="text" id="playerShortName" placeholder="예: 해원" maxlength="2" autocomplete="off" />
        </label>

        <label>
          상위 티어
          <select id="playerTier">
            ${tierOptions}
          </select>
        </label>

        <label>
          하위 티어
          <select id="playerSubTier"></select>
        </label>

        <div class="form-actions">
          <button type="submit" class="submit-btn">추가</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>
    `
  );

  const tierSelect = document.getElementById("playerTier");
  const subTierSelect = document.getElementById("playerSubTier");

  fillSubTierOptions(tierSelect.value, subTierSelect);

  tierSelect.addEventListener("change", () => {
    fillSubTierOptions(tierSelect.value, subTierSelect);
  });

  document.getElementById("addPlayerForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("playerName").value.trim();
    const shortName = document.getElementById("playerShortName").value.trim();
    const tier = tierSelect.value;
    const subTier = subTierSelect.value;

    if (!name) {
      alert("풀네임을 입력해 주세요.");
      return;
    }

    if (!shortName) {
      alert("두글자 닉네임을 입력해 주세요.");
      return;
    }

    if (shortName.length > 2) {
      alert("두글자 닉네임은 최대 2글자까지 입력할 수 있습니다.");
      return;
    }

    const duplicatedName = state.players.some((player) => player.name === name);
    const duplicatedShortName = state.players.some((player) => player.shortName === shortName);

    if (duplicatedName) {
      alert("이미 등록된 풀네임입니다.");
      return;
    }

    if (duplicatedShortName) {
      alert("이미 등록된 두글자 닉네임입니다.");
      return;
    }

    const id = createId();

    const newPlayer = {
      name,
      shortName,
      tier,
      subTier,
      records: [],
      createdAt: Date.now()
    };

    try {
      await set(ref(db, `${ROOT_PATH}/players/${id}`), newPlayer);
      await updateMeta();
      closeModal();
    } catch (error) {
      alertWriteError(error);
    }
  });

  bindCloseButtons();
}

function openEditPlayerModal(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  openModal(
    "닉네임 수정",
    `
      <form class="form" id="editPlayerForm">
        <label>
          풀네임
          <input type="text" id="editPlayerName" value="${escapeAttr(player.name)}" autocomplete="off" />
        </label>

        <label>
          두글자 닉네임
          <input type="text" id="editPlayerShortName" value="${escapeAttr(player.shortName || "")}" maxlength="2" autocomplete="off" />
        </label>

        <div class="form-actions">
          <button type="submit" class="submit-btn">저장</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>
    `
  );

  document.getElementById("editPlayerForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("editPlayerName").value.trim();
    const shortName = document.getElementById("editPlayerShortName").value.trim();

    if (!name) {
      alert("풀네임을 입력해 주세요.");
      return;
    }

    if (!shortName) {
      alert("두글자 닉네임을 입력해 주세요.");
      return;
    }

    if (shortName.length > 2) {
      alert("두글자 닉네임은 최대 2글자까지 입력할 수 있습니다.");
      return;
    }

    const duplicatedName = state.players.some((p) => {
      return p.id !== playerId && p.name === name;
    });

    const duplicatedShortName = state.players.some((p) => {
      return p.id !== playerId && p.shortName === shortName;
    });

    if (duplicatedName) {
      alert("이미 등록된 풀네임입니다.");
      return;
    }

    if (duplicatedShortName) {
      alert("이미 등록된 두글자 닉네임입니다.");
      return;
    }

    try {
      await update(ref(db, `${ROOT_PATH}/players/${playerId}`), {
        name,
        shortName
      });

      await updateMeta();
      closeModal();
    } catch (error) {
      alertWriteError(error);
    }
  });

  bindCloseButtons();
}

function openMoveTierModal(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  const tierOptions = TIER_GROUPS.map((group) => {
    const selected = player.tier === group.name ? "selected" : "";
    return `<option value="${group.name}" ${selected}>${group.name}</option>`;
  }).join("");

  const playerLabel = `${player.shortName || "--"} / ${player.name}`;

  openModal(
    "티어 이동",
    `
      <form class="form" id="moveTierForm">
        <label>
          닉네임
          <input type="text" value="${escapeAttr(playerLabel)}" disabled />
        </label>

        <label>
          상위 티어
          <select id="moveTier">
            ${tierOptions}
          </select>
        </label>

        <label>
          하위 티어
          <select id="moveSubTier"></select>
        </label>

        <div class="form-actions">
          <button type="submit" class="submit-btn">이동</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>
    `
  );

  const tierSelect = document.getElementById("moveTier");
  const subTierSelect = document.getElementById("moveSubTier");

  fillSubTierOptions(tierSelect.value, subTierSelect, player.subTier);

  tierSelect.addEventListener("change", () => {
    fillSubTierOptions(tierSelect.value, subTierSelect);
  });

  document.getElementById("moveTierForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await update(ref(db, `${ROOT_PATH}/players/${playerId}`), {
        tier: tierSelect.value,
        subTier: subTierSelect.value
      });

      await updateMeta();
      closeModal();
    } catch (error) {
      alertWriteError(error);
    }
  });

  bindCloseButtons();
}

function fillSubTierOptions(tierName, selectEl, selectedSubTier = "") {
  const group = getTierGroup(tierName);
  const subs = group ? group.subs : [];

  selectEl.innerHTML = subs
    .map((sub) => {
      const selected = selectedSubTier === sub ? "selected" : "";
      return `<option value="${sub}" ${selected}>${sub}</option>`;
    })
    .join("");
}

function requireAdmin() {
  if (isAdmin) return true;

  openLoginModal();
  return false;
}

async function updateMeta() {
  await update(ref(db, `${ROOT_PATH}/meta`), createMeta());
}

function createMeta() {
  return {
    updatedAt: new Date().toLocaleString("ko-KR"),
    updatedBy: currentUser ? currentUser.uid : ""
  };
}

function getTierGroup(tierName) {
  return TIER_GROUPS.find((group) => group.name === tierName);
}

function isValidTier(tierName) {
  return Boolean(getTierGroup(tierName));
}

function isValidSubTier(tierName, subTierName) {
  const group = getTierGroup(tierName);
  if (!group) return false;

  return group.subs.includes(subTierName);
}

function getDefaultSubTier(tierName) {
  const group = getTierGroup(tierName);
  return group ? group.subs[0] : "GOD";
}

function getSubTierId(groupIndex, subIndex) {
  return `tier-${groupIndex}-sub-${subIndex}`;
}

function openModal(title, bodyHtml, modalClass = "") {
  const modalBox = modal.querySelector(".modal-box");

  modalBox.className = modalClass
    ? `modal-box ${modalClass}`
    : "modal-box";

  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  modalBody.innerHTML = "";

  const modalBox = modal.querySelector(".modal-box");
  modalBox.className = "modal-box";
}

function bindCloseButtons() {
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(text) {
  return escapeHtml(text);
}

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function alertWriteError(error) {
  alert(
    "저장에 실패했습니다.\n\n" +
    "1. 관리자 계정으로 로그인했는지 확인해 주세요.\n" +
    "2. Realtime Database 규칙의 UID가 맞는지 확인해 주세요.\n\n" +
    error.message
  );
}

function getLoginErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "아이디 또는 비밀번호가 올바르지 않습니다.";

    case "auth/too-many-requests":
      return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.";

    case "auth/unauthorized-domain":
      return "현재 사이트 도메인이 Firebase Auth 허용 도메인에 등록되지 않았습니다.";

    default:
      return `로그인 실패: ${error.message}`;
  }
}
