import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue,
  get,
  set,
  update,
  remove,
  push,
  serverTimestamp
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
const ARCHIVE_MATCHES_PATH = `${ROOT_PATH}/archiveMatches`;
const MEMBER_ARCHIVE_PATH = `${ROOT_PATH}/memberArchive`;
const MONTHLY_MATCHES_PATH = `${ROOT_PATH}/monthlyMatches`;
const MONTHLY_STATS_PATH = `${ROOT_PATH}/monthlyStats`;
const MANUAL_ADJUSTMENTS_PATH = `${ROOT_PATH}/manualAdjustments`;
const INITIAL_IMPORT_PATH = `${ROOT_PATH}/archiveInitialImport`;

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
    await update(ref(db), {
      [`${ROOT_PATH}/players`]: {},
      [`${ROOT_PATH}/meta`]: createMeta()
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
  createTopWinRatePanel();
  createArchiveAdminTools();
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


function createTopWinRatePanel() {
  if (document.getElementById("topWinRatePanel")) return;

  const pageShell = document.querySelector(".page-shell") || document.body;

  const panel = document.createElement("aside");
  panel.id = "topWinRatePanel";
  panel.className = "top-rank-panel";
  panel.innerHTML = `
    <div class="top-rank-head">
      <div>
        <div class="top-rank-eyebrow">MEMBER RANKING</div>
        <h2>최고승률 TOP10</h2>
      </div>
      <span id="topRankCount" class="top-rank-count">0명</span>
    </div>

    <div class="top-rank-desc">
      전적이 1게임 이상 있는 등록 멤버 기준
    </div>

    <div id="topWinRateList" class="top-rank-list">
      <div class="top-rank-empty">아직 집계할 전적이 없습니다.</div>
    </div>
  `;

  pageShell.appendChild(panel);
}


function createArchiveAdminTools() {
  const sideActions = document.querySelector(".admin-only.side-actions");
  if (!sideActions || document.getElementById("archiveManageBtn")) return;

  const archiveManageBtn = document.createElement("button");
  archiveManageBtn.id = "archiveManageBtn";
  archiveManageBtn.className = "side-btn";
  archiveManageBtn.type = "button";
  archiveManageBtn.textContent = "BKG.GG 전적 관리";
  archiveManageBtn.addEventListener("click", () => {
    if (!requireAdmin()) return;
    openArchiveManagerModal();
  });

  const manualAdjustBtn = document.createElement("button");
  manualAdjustBtn.id = "manualAdjustmentBtn";
  manualAdjustBtn.className = "side-btn";
  manualAdjustBtn.type = "button";
  manualAdjustBtn.textContent = "BKG.GG 누적 보정";
  manualAdjustBtn.addEventListener("click", () => {
    if (!requireAdmin()) return;
    openManualAdjustmentModal();
  });

  const initialBtn = document.createElement("button");
  initialBtn.id = "initialArchiveSyncBtn";
  initialBtn.className = "side-btn";
  initialBtn.type = "button";
  initialBtn.textContent = "BKG.GG 초기 연동";
  initialBtn.addEventListener("click", () => {
    if (!requireAdmin()) return;
    openInitialArchiveSyncModal();
  });

  const cancelBulkBtn = document.createElement("button");
  cancelBulkBtn.id = "cancelLastBulkArchiveBtn";
  cancelBulkBtn.className = "side-btn danger";
  cancelBulkBtn.type = "button";
  cancelBulkBtn.textContent = "최근 일괄 전적 취소";
  cancelBulkBtn.addEventListener("click", async () => {
    if (!requireAdmin()) return;
    await cancelLatestBulkArchiveMatch();
  });

  sideActions.appendChild(archiveManageBtn);
  sideActions.appendChild(manualAdjustBtn);
  sideActions.appendChild(initialBtn);
  sideActions.appendChild(cancelBulkBtn);
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
      records: Array.isArray(player.records) ? player.records.slice(-30) : [],
      recordArchiveIds: normalizeRecordArchiveIds(
        Array.isArray(player.records) ? player.records.slice(-30) : [],
        Array.isArray(player.recordArchiveIds) ? player.recordArchiveIds : []
      ),
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
  renderTopWinRate();
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


function renderTopWinRate() {
  const listEl = document.getElementById("topWinRateList");
  const countEl = document.getElementById("topRankCount");

  if (!listEl || !countEl) return;

  const rankedPlayers = state.players
    .map((player) => {
      const wins = player.records.filter((record) => record === "W").length;
      const losses = player.records.filter((record) => record === "L").length;
      const total = wins + losses;
      const winRateValue = total === 0 ? 0 : wins / total;

      return {
        ...player,
        wins,
        losses,
        total,
        winRateValue
      };
    })
    .filter((player) => player.total > 0)
    .sort((a, b) => {
      if (b.winRateValue !== a.winRateValue) return b.winRateValue - a.winRateValue;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name, "ko");
    })
    .slice(0, 10);

  countEl.textContent = `${rankedPlayers.length}명`;

  if (rankedPlayers.length === 0) {
    listEl.innerHTML = `<div class="top-rank-empty">아직 집계할 전적이 없습니다.</div>`;
    return;
  }

  listEl.innerHTML = rankedPlayers
    .map((player, index) => {
      const rank = index + 1;
      const displayName = player.name;
      const subName = player.shortName || "";
      const rate = `${(player.winRateValue * 100).toFixed(1)}%`;

      return `
        <div class="top-rank-item">
          <div class="top-rank-left">
            <div class="top-rank-no">${rank}</div>
            <div class="top-rank-name-wrap">
              <div class="top-rank-name">${escapeHtml(displayName)}</div>
              ${
                subName
                  ? `<div class="top-rank-full">${escapeHtml(subName)}</div>`
                  : ""
              }
            </div>
          </div>

          <div class="top-rank-right">
            <div class="top-rank-rate">${rate}</div>
            <div class="top-rank-record">${player.wins}승 ${player.losses}패</div>
          </div>
        </div>
      `;
    })
    .join("");
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
    const subName = normalizeName(player.name);
    const shortName = normalizeName(player.shortName || "");
    const tier = normalizeName(player.tier);
    const subTier = normalizeName(player.subTier);

    return (
      subName.includes(query) ||
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
    .slice(-30)
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

  const recent = appendRecentRecord(player, result, "");

  try {
    await update(ref(db, `${ROOT_PATH}/players/${playerId}`), {
      records: recent.records,
      recordArchiveIds: recent.recordArchiveIds
    });
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

  const lastResult = player.records[player.records.length - 1];
  const currentArchiveIds = normalizeRecordArchiveIds(player.records, player.recordArchiveIds);
  const linkedMatchId = currentArchiveIds[currentArchiveIds.length - 1] || "";
  const records = player.records.slice(0, -1);
  const recordArchiveIds = currentArchiveIds.slice(0, -1);
  const updates = {
    [`${ROOT_PATH}/players/${playerId}/records`]: records,
    [`${ROOT_PATH}/players/${playerId}/recordArchiveIds`]: recordArchiveIds,
    [`${ROOT_PATH}/meta`]: createMeta()
  };

  try {
    if (linkedMatchId) {
      await addArchiveRemovalUpdates(updates, player, linkedMatchId, lastResult);
    }

    await update(ref(db), updates);
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
      records: [],
      recordArchiveIds: []
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
              placeholder="예: 해원 혜원 연진 나닝"
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
              placeholder="예: 해원 혜원 연진 나닝"
              autocomplete="off"
            ></textarea>
          </div>
        </div>

        <div class="bulk-help">
          두글자 닉네임 또는 풀네임으로 입력할 수 있어요.<br>
          예: <b>해원</b> 또는 <b>박해원</b>
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


function getLocalDateInfo(date = new Date()) {
  const year = date.getFullYear();
  const monthNumber = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = `${year}-${monthNumber}`;
  const dateText = `${month}-${day}`;

  return { date: dateText, month };
}

function buildArchiveUpdates(matchId, winnerPlayers, loserPlayers) {
  const nowMs = Date.now();
  const { date, month } = getLocalDateInfo(new Date(nowMs));
  const winnerIds = winnerPlayers.map((player) => player.id);
  const loserIds = loserPlayers.map((player) => player.id);
  const updates = {};

  updates[`${ARCHIVE_MATCHES_PATH}/${matchId}`] = {
    date,
    month,
    winnerIds,
    loserIds,
    winnerNames: winnerPlayers.map((player) => player.name),
    loserNames: loserPlayers.map((player) => player.name),
    createdAt: nowMs,
    serverCreatedAt: serverTimestamp(),
    createdBy: currentUser ? currentUser.uid : "",
    createdByEmail: currentUser ? currentUser.email || "" : "",
    source: "bulkRecord"
  };

  winnerPlayers.forEach((player) => {
    updates[`${MEMBER_ARCHIVE_PATH}/${player.id}/${matchId}`] = {
      date,
      month,
      result: "W",
      createdAt: nowMs,
      matchId,
      source: "bulkRecord"
    };
  });

  loserPlayers.forEach((player) => {
    updates[`${MEMBER_ARCHIVE_PATH}/${player.id}/${matchId}`] = {
      date,
      month,
      result: "L",
      createdAt: nowMs,
      matchId,
      source: "bulkRecord"
    };
  });

  updates[`${MONTHLY_MATCHES_PATH}/${month}/${matchId}`] = true;

  return updates;
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

  const matchRef = push(ref(db, ARCHIVE_MATCHES_PATH));
  const matchId = matchRef.key;
  const updates = buildArchiveUpdates(matchId, winnerPlayers, loserPlayers);

  winnerPlayers.forEach((player) => {
    const recent = appendRecentRecord(player, "W", matchId);
    updates[`${ROOT_PATH}/players/${player.id}/records`] = recent.records;
    updates[`${ROOT_PATH}/players/${player.id}/recordArchiveIds`] = recent.recordArchiveIds;
  });

  loserPlayers.forEach((player) => {
    const recent = appendRecentRecord(player, "L", matchId);
    updates[`${ROOT_PATH}/players/${player.id}/records`] = recent.records;
    updates[`${ROOT_PATH}/players/${player.id}/recordArchiveIds`] = recent.recordArchiveIds;
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

function normalizeRecordArchiveIds(records, recordArchiveIds = []) {
  const safeRecords = Array.isArray(records) ? records.slice(-30) : [];
  const safeIds = Array.isArray(recordArchiveIds) ? recordArchiveIds.slice(-30) : [];
  const missingCount = Math.max(0, safeRecords.length - safeIds.length);
  return [...Array(missingCount).fill(""), ...safeIds].slice(-30);
}

function appendRecentRecord(player, result, archiveMatchId = "") {
  const records = Array.isArray(player.records) ? player.records.slice(-30) : [];
  const archiveIds = normalizeRecordArchiveIds(records, player.recordArchiveIds);

  return {
    records: [...records, result].slice(-30),
    recordArchiveIds: [...archiveIds, archiveMatchId || ""].slice(-30)
  };
}

function removeMatchFromPlayerRecent(player, matchId, expectedResult) {
  const records = Array.isArray(player.records) ? [...player.records] : [];
  const archiveIds = normalizeRecordArchiveIds(records, player.recordArchiveIds);
  let index = archiveIds.lastIndexOf(matchId);

  if (index < 0 && records[records.length - 1] === expectedResult && !archiveIds[archiveIds.length - 1]) {
    index = records.length - 1;
  }

  if (index < 0) return null;

  records.splice(index, 1);
  archiveIds.splice(index, 1);

  return {
    records: records.slice(-30),
    recordArchiveIds: archiveIds.slice(-30)
  };
}

async function addArchiveRemovalUpdates(updates, player, matchId, expectedResult) {
  updates[`${MEMBER_ARCHIVE_PATH}/${player.id}/${matchId}`] = null;

  if (String(matchId).startsWith("initial_")) return;

  const matchSnapshot = await get(ref(db, `${ARCHIVE_MATCHES_PATH}/${matchId}`));
  const match = matchSnapshot.val();
  if (!match) return;

  const originalWinnerIds = Array.isArray(match.winnerIds) ? match.winnerIds : [];
  const originalLoserIds = Array.isArray(match.loserIds) ? match.loserIds : [];
  const originalWinnerNames = Array.isArray(match.winnerNames) ? match.winnerNames : [];
  const originalLoserNames = Array.isArray(match.loserNames) ? match.loserNames : [];

  const winnerIds = originalWinnerIds.filter((id) => id !== player.id);
  const loserIds = originalLoserIds.filter((id) => id !== player.id);
  const winnerNames = originalWinnerNames.filter((_, index) => originalWinnerIds[index] !== player.id);
  const loserNames = originalLoserNames.filter((_, index) => originalLoserIds[index] !== player.id);

  if (winnerIds.length === 0 && loserIds.length === 0) {
    updates[`${ARCHIVE_MATCHES_PATH}/${matchId}`] = null;
    if (match.month) {
      updates[`${MONTHLY_MATCHES_PATH}/${match.month}/${matchId}`] = null;
    }
    return;
  }

  updates[`${ARCHIVE_MATCHES_PATH}/${matchId}/winnerIds`] = winnerIds;
  updates[`${ARCHIVE_MATCHES_PATH}/${matchId}/loserIds`] = loserIds;
  updates[`${ARCHIVE_MATCHES_PATH}/${matchId}/winnerNames`] = winnerNames;
  updates[`${ARCHIVE_MATCHES_PATH}/${matchId}/loserNames`] = loserNames;
}


async function openArchiveManagerModal() {
  if (!requireAdmin()) return;

  openModal(
    "BKG.GG 전적 관리",
    `
      <div class="notice">
        테스트용 일괄 전적이나 잘못 입력된 archive 전적을 삭제할 수 있습니다.<br>
        삭제 시 archiveMatches, memberArchive, monthlyMatches와 연결된 최근 30전 기록을 함께 정리합니다.
      </div>
      <div id="archiveManagerList" class="archive-manager-list">
        archive 전적을 불러오는 중입니다...
      </div>
    `,
    "wide-modal"
  );

  try {
    const snapshot = await get(ref(db, ARCHIVE_MATCHES_PATH));
    const rawMatches = snapshot.val() || {};
    const matches = Object.entries(rawMatches)
      .map(([matchId, match]) => ({ matchId, ...match }))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, 50);

    const listEl = document.getElementById("archiveManagerList");
    if (!listEl) return;

    if (matches.length === 0) {
      listEl.innerHTML = `<div class="archive-empty">삭제할 archive 전적이 없습니다.</div>`;
      return;
    }

    listEl.innerHTML = matches.map((match) => {
      const winnerNames = Array.isArray(match.winnerNames) ? match.winnerNames : [];
      const loserNames = Array.isArray(match.loserNames) ? match.loserNames : [];
      const winnerCount = Array.isArray(match.winnerIds) ? match.winnerIds.length : winnerNames.length;
      const loserCount = Array.isArray(match.loserIds) ? match.loserIds.length : loserNames.length;
      const sourceLabel = match.source === "bulkRecord" ? "일괄 추가" : escapeHtml(match.source || "archive");

      return `
        <div class="archive-item">
          <div class="archive-info">
            <div class="archive-title">${escapeHtml(match.date || "날짜 없음")} · ${sourceLabel}</div>
            <div class="archive-teams">
              <b>승리</b> ${escapeHtml(winnerNames.join(", ") || `${winnerCount}명`)}<br>
              <b>패배</b> ${escapeHtml(loserNames.join(", ") || `${loserCount}명`)}
            </div>
            <div class="archive-match-id">${escapeHtml(match.matchId)}</div>
          </div>
          <button class="mini-btn danger archive-delete-btn" type="button" data-delete-archive="${escapeAttr(match.matchId)}">삭제</button>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("[data-delete-archive]").forEach((button) => {
      button.addEventListener("click", async () => {
        await deleteArchiveMatch(button.dataset.deleteArchive);
      });
    });
  } catch (error) {
    alertWriteError(error);
  }
}

async function deleteArchiveMatch(matchId) {
  if (!requireAdmin()) return;
  if (!matchId) return;

  const snapshot = await get(ref(db, `${ARCHIVE_MATCHES_PATH}/${matchId}`));
  const match = snapshot.val();

  if (!match) {
    alert("이미 삭제되었거나 존재하지 않는 archive 전적입니다.");
    return;
  }

  const winnerIds = Array.isArray(match.winnerIds) ? match.winnerIds : [];
  const loserIds = Array.isArray(match.loserIds) ? match.loserIds : [];
  const winnerNames = Array.isArray(match.winnerNames) ? match.winnerNames : [];
  const loserNames = Array.isArray(match.loserNames) ? match.loserNames : [];

  if (!confirm(`이 archive 전적을 삭제할까요?\n\n날짜: ${match.date || "-"}\n승리: ${winnerNames.join(", ") || winnerIds.length + "명"}\n패배: ${loserNames.join(", ") || loserIds.length + "명"}\n\nBKG.GG 누적/월별/참여율에서 제외되고, 연결된 최근 30전 기록도 함께 정리됩니다.`)) {
    return;
  }

  const updates = {};

  winnerIds.forEach((playerId) => {
    updates[`${MEMBER_ARCHIVE_PATH}/${playerId}/${matchId}`] = null;

    const player = state.players.find((item) => item.id === playerId);
    if (!player) return;

    const recent = removeMatchFromPlayerRecent(player, matchId, "W");
    if (!recent) return;

    updates[`${ROOT_PATH}/players/${playerId}/records`] = recent.records;
    updates[`${ROOT_PATH}/players/${playerId}/recordArchiveIds`] = recent.recordArchiveIds;
  });

  loserIds.forEach((playerId) => {
    updates[`${MEMBER_ARCHIVE_PATH}/${playerId}/${matchId}`] = null;

    const player = state.players.find((item) => item.id === playerId);
    if (!player) return;

    const recent = removeMatchFromPlayerRecent(player, matchId, "L");
    if (!recent) return;

    updates[`${ROOT_PATH}/players/${playerId}/records`] = recent.records;
    updates[`${ROOT_PATH}/players/${playerId}/recordArchiveIds`] = recent.recordArchiveIds;
  });

  updates[`${ARCHIVE_MATCHES_PATH}/${matchId}`] = null;
  if (match.month) {
    updates[`${MONTHLY_MATCHES_PATH}/${match.month}/${matchId}`] = null;
  }
  updates[`${ROOT_PATH}/meta`] = createMeta();

  try {
    await update(ref(db), updates);
    alert("archive 전적 삭제 완료!\nBKG.GG 집계에서도 제외되었습니다.");
    closeModal();
    await openArchiveManagerModal();
  } catch (error) {
    alertWriteError(error);
  }
}

function openManualAdjustmentModal() {
  if (!requireAdmin()) return;

  const { month } = getLocalDateInfo();
  const playerOptions = state.players
    .map((player) => {
      const label = `${player.name}${player.shortName ? " / " + player.shortName : ""} · ${player.tier} ${player.subTier}`;
      return `<option value="${escapeAttr(player.id)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  openModal(
    "BKG.GG 누적 보정",
    `
      <form class="form" id="manualAdjustmentForm">
        <label>
          멤버 선택
          <select id="manualPlayerId">${playerOptions}</select>
        </label>

        <label>
          보정 월
          <input type="month" id="manualMonth" value="${escapeAttr(month)}" />
        </label>

        <label>
          추가 승리 수
          <input type="number" id="manualWins" min="0" step="1" value="0" />
        </label>

        <label>
          추가 패배 수
          <input type="number" id="manualLosses" min="0" step="1" value="0" />
        </label>

        <label>
          메모
          <input type="text" id="manualNote" placeholder="예: 초기화 전 기록 수동 보정" autocomplete="off" />
        </label>

        <div class="notice">
          초기화되었거나 누락된 과거 전적을 BKG.GG 누적/월별 전적에 더하는 기능입니다.<br>
          보정값은 최근 5전에는 포함하지 않습니다. 최근 5전은 실제 archive 경기 기록만 기준으로 표시됩니다.
        </div>

        <div class="form-actions">
          <button type="submit" class="submit-btn">보정 추가</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>
    `
  );

  document.getElementById("manualAdjustmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const playerId = document.getElementById("manualPlayerId").value;
    const targetMonth = document.getElementById("manualMonth").value;
    const wins = Math.floor(Number(document.getElementById("manualWins").value || 0));
    const losses = Math.floor(Number(document.getElementById("manualLosses").value || 0));
    const note = document.getElementById("manualNote").value.trim();

    if (!playerId) {
      alert("멤버를 선택해 주세요.");
      return;
    }

    if (!targetMonth) {
      alert("보정 월을 선택해 주세요.");
      return;
    }

    if (!Number.isFinite(wins) || !Number.isFinite(losses) || wins < 0 || losses < 0) {
      alert("승리/패배 수를 올바르게 입력해 주세요.");
      return;
    }

    if (wins + losses <= 0) {
      alert("추가할 승리 또는 패배 수가 1개 이상이어야 합니다.");
      return;
    }

    await addManualAdjustment({ playerId, month: targetMonth, wins, losses, note });
  });

  bindCloseButtons();
}

async function addManualAdjustment({ playerId, month, wins, losses, note }) {
  if (!requireAdmin()) return;

  const player = state.players.find((item) => item.id === playerId);
  if (!player) return;

  const matches = wins + losses;

  if (!confirm(`${player.name} 님에게 BKG.GG 누적 보정을 추가할까요?\n\n월: ${month}\n보정: ${matches}전 ${wins}승 ${losses}패\n\n이 값은 누적 전적과 월별 전적에는 포함되지만 최근 5전에는 포함되지 않습니다.`)) {
    return;
  }

  const nowMs = Date.now();
  const adjustmentRef = push(ref(db, `${MANUAL_ADJUSTMENTS_PATH}/${playerId}`));
  const adjustmentId = adjustmentRef.key;

  const updates = {};
  updates[`${MANUAL_ADJUSTMENTS_PATH}/${playerId}/${adjustmentId}`] = {
    month,
    matches,
    wins,
    losses,
    note,
    playerName: player.name,
    playerShortName: player.shortName || "",
    createdAt: nowMs,
    serverCreatedAt: serverTimestamp(),
    createdBy: currentUser ? currentUser.uid : "",
    createdByEmail: currentUser ? currentUser.email || "" : "",
    source: "manualAdjustment"
  };
  updates[`${ROOT_PATH}/meta`] = createMeta();

  try {
    await update(ref(db), updates);
    closeModal();
    alert(`BKG.GG 누적 보정 완료!\n\n${player.name}: ${matches}전 ${wins}승 ${losses}패 추가`);
  } catch (error) {
    alertWriteError(error);
  }
}

function openInitialArchiveSyncModal() {
  const { month } = getLocalDateInfo();
  const maxRecords = Math.max(0, ...state.players.map((player) => player.records.length));

  openModal(
    "BKG.GG 초기 연동",
    `
      <form class="form" id="initialArchiveSyncForm">
        <label>
          연동 월
          <input type="month" id="initialArchiveMonth" value="${escapeAttr(month)}" />
        </label>

        <label>
          해당 월 전체 진행 판 수
          <input type="number" id="initialArchiveTotalMatches" min="0" step="1" value="${maxRecords}" />
        </label>

        <div class="notice">
          현재 전적표에 남아 있는 최근 전적을 BKG.GG 누적 데이터로 1회 복사합니다.<br>
          기존 전적에는 경기별 묶음/날짜 정보가 없어서, 개인별 승패 기록은 그대로 복사하고 참여율의 분모는 위에 입력한 전체 진행 판 수를 사용합니다.<br>
          중복 방지를 위해 같은 월은 한 번만 초기 연동할 수 있습니다.
        </div>

        <div class="form-actions">
          <button type="submit" class="submit-btn">초기 연동 실행</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>
    `
  );

  document.getElementById("initialArchiveSyncForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const targetMonth = document.getElementById("initialArchiveMonth").value;
    const totalMatches = Number(document.getElementById("initialArchiveTotalMatches").value || 0);

    if (!targetMonth) {
      alert("연동 월을 선택해 주세요.");
      return;
    }

    if (!Number.isFinite(totalMatches) || totalMatches < 0) {
      alert("전체 진행 판 수를 올바르게 입력해 주세요.");
      return;
    }

    await importCurrentRecordsToArchive(targetMonth, Math.floor(totalMatches));
  });

  bindCloseButtons();
}

async function importCurrentRecordsToArchive(targetMonth, totalMatches) {
  if (!requireAdmin()) return;

  const importSnapshot = await get(ref(db, `${INITIAL_IMPORT_PATH}/${targetMonth}`));
  if (importSnapshot.exists()) {
    alert(`${targetMonth} 월은 이미 초기 연동된 기록이 있습니다.\n중복 연동을 막기 위해 작업을 중단합니다.`);
    return;
  }

  const recordCount = state.players.reduce((sum, player) => sum + player.records.length, 0);

  if (recordCount === 0) {
    alert("초기 연동할 전적이 없습니다.");
    return;
  }

  if (!confirm(`현재 전적표에 남아 있는 승패 ${recordCount}개를 BKG.GG archive로 복사할까요?\n\n연동 월: ${targetMonth}\n전체 진행 판 수: ${totalMatches}판`)) {
    return;
  }

  const nowMs = Date.now();
  const updates = {};
  let importedRecords = 0;

  state.players.forEach((player) => {
    const records = Array.isArray(player.records) ? player.records.slice(-30) : [];
    const currentArchiveIds = normalizeRecordArchiveIds(records, player.recordArchiveIds);
    const nextArchiveIds = [...currentArchiveIds];

    records.forEach((result, index) => {
      if (currentArchiveIds[index]) return;

      const matchId = `initial_${targetMonth.replace("-", "")}_${player.id}_${String(index + 1).padStart(2, "0")}`;
      const createdAt = nowMs - (records.length - index) * 1000;

      updates[`${MEMBER_ARCHIVE_PATH}/${player.id}/${matchId}`] = {
        date: `${targetMonth}-01`,
        month: targetMonth,
        result,
        createdAt,
        matchId,
        source: "initialImport"
      };

      nextArchiveIds[index] = matchId;
      importedRecords += 1;
    });

    updates[`${ROOT_PATH}/players/${player.id}/recordArchiveIds`] = nextArchiveIds.slice(-30);
  });

  updates[`${INITIAL_IMPORT_PATH}/${targetMonth}`] = {
    completed: true,
    importedAt: nowMs,
    serverImportedAt: serverTimestamp(),
    importedBy: currentUser ? currentUser.uid : "",
    importedByEmail: currentUser ? currentUser.email || "" : "",
    totalMatches,
    recordCount,
    importedRecords
  };

  updates[`${MONTHLY_STATS_PATH}/${targetMonth}/initialTotalMatches`] = totalMatches;
  updates[`${MONTHLY_STATS_PATH}/${targetMonth}/initialRecordCount`] = recordCount;
  updates[`${MONTHLY_STATS_PATH}/${targetMonth}/updatedAt`] = nowMs;
  updates[`${ROOT_PATH}/meta`] = createMeta();

  try {
    await update(ref(db), updates);
    closeModal();
    alert(`BKG.GG 초기 연동 완료!\n\n복사된 개인 승패: ${importedRecords}개\n참여율 기준 전체 판 수: ${totalMatches}판`);
  } catch (error) {
    alertWriteError(error);
  }
}

async function cancelLatestBulkArchiveMatch() {
  if (!requireAdmin()) return;

  const snapshot = await get(ref(db, ARCHIVE_MATCHES_PATH));
  const rawMatches = snapshot.val() || {};
  const matches = Object.entries(rawMatches)
    .map(([matchId, match]) => ({ matchId, ...match }))
    .filter((match) => match.source === "bulkRecord")
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  if (matches.length === 0) {
    alert("취소할 일괄 archive 전적이 없습니다.");
    return;
  }

  const target = matches[0];
  const winnerIds = Array.isArray(target.winnerIds) ? target.winnerIds : [];
  const loserIds = Array.isArray(target.loserIds) ? target.loserIds : [];
  const winnerNames = Array.isArray(target.winnerNames) ? target.winnerNames : [];
  const loserNames = Array.isArray(target.loserNames) ? target.loserNames : [];

  if (!confirm(`가장 최근 일괄 전적을 취소할까요?\n\n날짜: ${target.date || "-"}\n승리: ${winnerNames.join(", ") || winnerIds.length + "명"}\n패배: ${loserNames.join(", ") || loserIds.length + "명"}\n\nBKG.GG archive와 연결된 최근 30전 기록을 함께 정리합니다.`)) {
    return;
  }

  const updates = {};

  winnerIds.forEach((playerId) => {
    updates[`${MEMBER_ARCHIVE_PATH}/${playerId}/${target.matchId}`] = null;

    const player = state.players.find((item) => item.id === playerId);
    if (!player) return;

    const recent = removeMatchFromPlayerRecent(player, target.matchId, "W");
    if (!recent) return;

    updates[`${ROOT_PATH}/players/${playerId}/records`] = recent.records;
    updates[`${ROOT_PATH}/players/${playerId}/recordArchiveIds`] = recent.recordArchiveIds;
  });

  loserIds.forEach((playerId) => {
    updates[`${MEMBER_ARCHIVE_PATH}/${playerId}/${target.matchId}`] = null;

    const player = state.players.find((item) => item.id === playerId);
    if (!player) return;

    const recent = removeMatchFromPlayerRecent(player, target.matchId, "L");
    if (!recent) return;

    updates[`${ROOT_PATH}/players/${playerId}/records`] = recent.records;
    updates[`${ROOT_PATH}/players/${playerId}/recordArchiveIds`] = recent.recordArchiveIds;
  });

  updates[`${ARCHIVE_MATCHES_PATH}/${target.matchId}`] = null;
  if (target.month) {
    updates[`${MONTHLY_MATCHES_PATH}/${target.month}/${target.matchId}`] = null;
  }
  updates[`${ROOT_PATH}/meta`] = createMeta();

  try {
    await update(ref(db), updates);
    alert("최근 일괄 전적 취소 완료!\nBKG.GG archive에서도 함께 제거되었습니다.");
  } catch (error) {
    alertWriteError(error);
  }
}


function findPlayerByInputName(inputName) {
  const target = normalizeName(inputName);

  return state.players.find((player) => {
    const subName = normalizeName(player.name);
    const shortName = normalizeName(player.shortName || "");

    return subName === target || shortName === target;
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
