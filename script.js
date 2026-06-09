const TIER_GROUPS = [
  {
    name: "0티어",
    subs: ["GOD", "상", "중", "하"]
  },
  {
    name: "1티어",
    subs: ["최상", "상", "중", "하"]
  },
  {
    name: "2티어",
    subs: ["최상", "상", "중", "하"]
  },
  {
    name: "3티어",
    subs: ["최상", "상", "중", "하"]
  }
];

// 첫 번째 테스트용 관리자 비밀번호.
// Firebase 연결 전까지만 쓰는 임시 방식.
// 실제 공개 사이트에서는 이 방식은 보안용으로 쓰면 안 돼.
const ADMIN_PASSWORD = "1234";

const STORAGE_KEY = "bkg-soop-records-v2";

let isAdmin = false;

let state = {
  players: [
    {
      id: createId(),
      name: "해원",
      tier: "0티어",
      subTier: "GOD",
      records: ["W", "W", "L", "W"]
    },
    {
      id: createId(),
      name: "아칸",
      tier: "1티어",
      subTier: "최상",
      records: ["L", "W", "W"]
    },
    {
      id: createId(),
      name: "흑구",
      tier: "2티어",
      subTier: "상",
      records: []
    }
  ],
  updatedAt: ""
};

const tiersContainer = document.getElementById("tiersContainer");
const tierNav = document.getElementById("tierNav");
const totalPlayersEl = document.getElementById("totalPlayers");
const totalGamesEl = document.getElementById("totalGames");
const updatedAtEl = document.getElementById("updatedAt");

const loginBtn = document.getElementById("loginBtn");
const addRecordBtn = document.getElementById("addRecordBtn");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

load();
render();

loginBtn.addEventListener("click", () => {
  if (isAdmin) {
    isAdmin = false;
    render();
    return;
  }

  openLoginModal();
});

addRecordBtn.addEventListener("click", () => {
  if (!isAdmin) {
    openLoginModal();
    return;
  }

  openAddRecordModal();
});

addPlayerBtn.addEventListener("click", () => {
  openAddPlayerModal();
});

resetAllBtn.addEventListener("click", () => {
  if (!confirm("전체 데이터를 초기화할까요?")) return;

  state.players = [];
  touch();
  save();
  render();
});

modalClose.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

function load() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    touch();
    save();
    return;
  }

  try {
    state = JSON.parse(saved);
    normalizeState();
  } catch {
    touch();
    save();
  }
}

function normalizeState() {
  if (!state || !Array.isArray(state.players)) {
    state = {
      players: [],
      updatedAt: ""
    };
  }

  state.players = state.players.map((player) => {
    const tier = isValidTier(player.tier) ? player.tier : "0티어";
    const subTier = isValidSubTier(tier, player.subTier)
      ? player.subTier
      : getDefaultSubTier(tier);

    return {
      id: player.id || createId(),
      name: player.name || "이름없음",
      tier,
      subTier,
      records: Array.isArray(player.records) ? player.records.slice(-20) : []
    };
  });
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function touch() {
  const now = new Date();
  state.updatedAt = now.toLocaleString("ko-KR");
}

function render() {
  renderAdminState();
  renderStats();
  renderTierNav();
  renderTiers();
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

  totalPlayersEl.textContent = totalPlayers;
  totalGamesEl.textContent = totalGames;
  updatedAtEl.textContent = state.updatedAt || "-";
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

function renderTiers() {
  tiersContainer.innerHTML = "";

  TIER_GROUPS.forEach((group, groupIndex) => {
    const groupPlayers = state.players.filter((player) => player.tier === group.name);

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
      const subPlayers = state.players.filter((player) => {
        return player.tier === group.name && player.subTier === sub;
      });

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

  row.innerHTML = `
    <div class="player-name">${escapeHtml(player.name)}</div>
    <div class="record-dots">
      ${recordHtml || `<span style="color:#666;">기록 없음</span>`}
    </div>
    <div class="stat">${wins}승</div>
    <div class="stat">${losses}패</div>
    <div class="stat">${winRate}</div>
    <div class="player-actions admin-only ${isAdmin ? "" : "hidden"}">
      <button class="mini-btn" data-action="win">승</button>
      <button class="mini-btn" data-action="loss">패</button>
      <button class="mini-btn" data-action="undo">취소</button>
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

  row.querySelector('[data-action="move"]')?.addEventListener("click", () => {
    openMoveTierModal(player.id);
  });

  row.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
    deletePlayer(player.id);
  });

  return row;
}

function addRecord(playerId, result) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  player.records.push(result);

  if (player.records.length > 20) {
    player.records = player.records.slice(-20);
  }

  touch();
  save();
  render();
}

function undoRecord(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  if (player.records.length === 0) {
    alert("취소할 전적이 없습니다.");
    return;
  }

  player.records.pop();

  touch();
  save();
  render();
}

function deletePlayer(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  if (!confirm(`${player.name} 님을 삭제할까요?`)) return;

  state.players = state.players.filter((p) => p.id !== playerId);

  touch();
  save();
  render();
}

function openLoginModal() {
  openModal(
    "관리자 로그인",
    `
      <form class="form" id="loginForm">
        <label>
          관리자 비밀번호
          <input type="password" id="passwordInput" placeholder="비밀번호 입력" autocomplete="off" />
        </label>

        <div class="form-actions">
          <button type="submit" class="submit-btn">로그인</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>

      <div class="notice">
        첫 번째 테스트 버전 비밀번호는 <b>1234</b>입니다.<br>
        Firebase 연결 후에는 실제 관리자 로그인 방식으로 바꿀 예정입니다.
      </div>
    `
  );

  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const password = document.getElementById("passwordInput").value;

    if (password !== ADMIN_PASSWORD) {
      alert("비밀번호가 틀렸습니다.");
      return;
    }

    isAdmin = true;
    closeModal();
    render();
  });

  bindCloseButtons();
}

function openAddRecordModal() {
  if (state.players.length === 0) {
    alert("먼저 닉네임을 추가해 주세요.");
    return;
  }

  const playerOptions = state.players
    .map((player) => {
      return `
        <option value="${player.id}">
          ${escapeHtml(player.name)} / ${player.tier} / ${player.subTier}
        </option>
      `;
    })
    .join("");

  openModal(
    "전적 추가",
    `
      <form class="form" id="addRecordForm">
        <label>
          닉네임 선택
          <select id="recordPlayer">
            ${playerOptions}
          </select>
        </label>

        <label>
          결과 선택
          <select id="recordResult">
            <option value="W">승리</option>
            <option value="L">패배</option>
          </select>
        </label>

        <div class="form-actions">
          <button type="submit" class="submit-btn">저장</button>
          <button type="button" class="cancel-btn" data-close>취소</button>
        </div>
      </form>
    `
  );

  document.getElementById("addRecordForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const playerId = document.getElementById("recordPlayer").value;
    const result = document.getElementById("recordResult").value;

    addRecord(playerId, result);
    closeModal();
  });

  bindCloseButtons();
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
          닉네임
          <input type="text" id="playerName" placeholder="닉네임 입력" autocomplete="off" />
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

  document.getElementById("addPlayerForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = document.getElementById("playerName").value.trim();
    const tier = tierSelect.value;
    const subTier = subTierSelect.value;

    if (!name) {
      alert("닉네임을 입력해 주세요.");
      return;
    }

    const duplicated = state.players.some((player) => player.name === name);

    if (duplicated) {
      alert("이미 등록된 닉네임입니다.");
      return;
    }

    state.players.push({
      id: createId(),
      name,
      tier,
      subTier,
      records: []
    });

    touch();
    save();
    closeModal();
    render();
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

  openModal(
    "티어 이동",
    `
      <form class="form" id="moveTierForm">
        <label>
          닉네임
          <input type="text" value="${escapeHtml(player.name)}" disabled />
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

  document.getElementById("moveTierForm").addEventListener("submit", (event) => {
    event.preventDefault();

    player.tier = tierSelect.value;
    player.subTier = subTierSelect.value;

    touch();
    save();
    closeModal();
    render();
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

function openModal(title, bodyHtml) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  modalBody.innerHTML = "";
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

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
