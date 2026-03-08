const canvas = document.getElementById("boardCanvas");
const ctx = canvas.getContext("2d");
const rollButton = document.getElementById("rollButton");
const restartButton = document.getElementById("restartButton");
const soundToggle = document.getElementById("soundToggle");
const messageBox = document.getElementById("messageBox");
const turnLabel = document.getElementById("turnLabel");
const turnDot = document.getElementById("turnDot");
const turnHint = document.getElementById("turnHint");
const diceFace = document.getElementById("diceFace");
const diceValueLabel = document.getElementById("diceValueLabel");
const playerStats = document.getElementById("playerStats");
const rankingList = document.getElementById("rankingList");
const historyList = document.getElementById("historyList");
const seatRed = document.getElementById("seatRed");
const seatGreen = document.getElementById("seatGreen");
const seatYellow = document.getElementById("seatYellow");
const seatBlue = document.getElementById("seatBlue");
const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");
const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
const winnerScreen = document.getElementById("winnerScreen");
const winnerTitle = document.getElementById("winnerTitle");
const winnerSubtitle = document.getElementById("winnerSubtitle");
const winnerRanking = document.getElementById("winnerRanking");
const playAgainButton = document.getElementById("playAgainButton");
const closeWinnerButton = document.getElementById("closeWinnerButton");
const confettiLayer = document.getElementById("confettiLayer");
const pips = Array.from(diceFace.querySelectorAll(".pip"));

const BOARD_SIZE = 780;
const GRID_SIZE = 15;
const CELL = BOARD_SIZE / GRID_SIZE;
const CENTER = { x: 7, y: 7 };
const SAFE_GLOBAL_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const MODES = {
  duel: ["red", "yellow"],
};
const TRACKING_NAMESPACE = "bashashoaib_ludo_game";
const TRACKING_TIMEZONE = "Asia/Kolkata";

const COLORS = {
  red: "#d84d4d",
  green: "#2fa36a",
  yellow: "#e0ae32",
  blue: "#3d6fdb",
};

const SOFT_COLORS = {
  red: "rgba(255, 106, 106, 0.32)",
  green: "rgba(70, 211, 132, 0.32)",
  yellow: "rgba(255, 213, 76, 0.34)",
  blue: "rgba(98, 145, 255, 0.3)",
};

const RING_PATH = [
  [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0], [8, 1],
  [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8], [13, 8],
  [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14], [6, 13],
  [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6], [1, 6],
];

const PLAYERS = [
  { id: "red", name: "Red", startIndex: 0, homeLane: laneFromLeft(), base: tokenBaseSlots("red"), isHuman: true },
  { id: "green", name: "Green", startIndex: 13, homeLane: laneFromTop(), base: tokenBaseSlots("green"), isHuman: false },
  { id: "yellow", name: "Yellow", startIndex: 26, homeLane: laneFromRight(), base: tokenBaseSlots("yellow"), isHuman: false },
  { id: "blue", name: "Blue", startIndex: 39, homeLane: laneFromBottom(), base: tokenBaseSlots("blue"), isHuman: false },
];

const state = {
  currentPlayerIndex: 0,
  diceValue: null,
  tokens: [],
  animating: false,
  gameOver: false,
  hoverTokenId: null,
  consecutiveSixes: 0,
  turnStartSnapshot: [],
  placements: [],
  history: [],
  mode: "duel",
  started: false,
  soundEnabled: true,
  audioContext: null,
  confettiTimer: null,
};

function laneFromLeft() { return [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]]; }
function laneFromTop() { return [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]]; }
function laneFromRight() { return [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]; }
function laneFromBottom() { return [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]]; }
function tokenBaseSlots(playerId) {
  const slots = {
    red: [[1, 1], [3, 1], [1, 3], [3, 3]],
    green: [[10, 1], [12, 1], [10, 3], [12, 3]],
    yellow: [[10, 10], [12, 10], [10, 12], [12, 12]],
    blue: [[1, 10], [3, 10], [1, 12], [3, 12]],
  };
  return slots[playerId];
}
function currentPlayer() { return PLAYERS[state.currentPlayerIndex]; }
function getPlayer(playerId) { return PLAYERS.find((player) => player.id === playerId); }
function getActivePlayerIds() { return MODES[state.mode] || MODES.duel; }
function getActivePlayers() { return PLAYERS.filter((player) => getActivePlayerIds().includes(player.id)); }
function getTokensForPlayer(playerId) { return state.tokens.filter((token) => token.playerId === playerId); }
function setMessage(text) { messageBox.textContent = text; }
function setTurnHint(text) { turnHint.textContent = text; }
function gridToPixel(x, y) { return { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL }; }
function snapshotTokens() {
  return state.tokens.map((token) => ({
    id: token.id,
    playerId: token.playerId,
    status: token.status,
    drawX: token.drawX,
    drawY: token.drawY,
  }));
}
function restoreSnapshot(snapshot) {
  state.tokens = snapshot.map((token) => ({ ...token }));
}
function playerHasPlaced(playerId) { return state.placements.some((entry) => entry.playerId === playerId); }
function beginTurnSnapshot() { state.turnStartSnapshot = snapshotTokens(); }
function pushHistory(text) {
  state.history.unshift(text);
  state.history = state.history.slice(0, 8);
  renderHistory();
}

function getTrackingStamp() {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TRACKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date()).reduce((accumulator, part) => {
    if (part.type !== "literal") accumulator[part.type] = part.value;
    return accumulator;
  }, {});
  const dayKey = `${parts.year}${parts.month}${parts.day}`;
  const hourKey = `${dayKey}${parts.hour}`;
  return {
    dayKey,
    hourKey,
    label: `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:00 ${TRACKING_TIMEZONE}`,
  };
}

function hitTrackingKey(key) {
  fetch(`https://countapi.mileshilliard.com/api/v1/hit/${TRACKING_NAMESPACE}_${key}`, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
  }).catch(() => {});
}

function trackBackgroundVisit() {
  const stamp = getTrackingStamp();
  try {
    const lastHour = localStorage.getItem("royalLudoTrackedHour");
    if (lastHour !== stamp.hourKey) {
      localStorage.setItem("royalLudoTrackedHour", stamp.hourKey);
      hitTrackingKey(`hour_${stamp.hourKey}`);
    }

    const lastDay = localStorage.getItem("royalLudoTrackedDay");
    if (lastDay !== stamp.dayKey) {
      localStorage.setItem("royalLudoTrackedDay", stamp.dayKey);
      hitTrackingKey(`day_${stamp.dayKey}`);
    }
  } catch (error) {
    // Ignore storage errors and still attempt total visit tracking.
  }

  hitTrackingKey("total");
}

function ensureAudio() {
  if (!state.soundEnabled) return null;
  if (!state.audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    state.audioContext = new AudioCtor();
  }
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }
  return state.audioContext;
}

function playTone(frequency, duration, type = "sine", gainValue = 0.035, delay = 0) {
  const audio = ensureAudio();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const startAt = audio.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function playSound(name) {
  if (!state.soundEnabled) return;
  if (name === "roll") {
    playTone(340, 0.08, "square", 0.03, 0);
    playTone(440, 0.08, "square", 0.03, 0.08);
    playTone(520, 0.08, "square", 0.03, 0.16);
    return;
  }
  if (name === "move") {
    playTone(420, 0.08, "triangle", 0.03, 0);
    playTone(520, 0.1, "triangle", 0.028, 0.08);
    return;
  }
  if (name === "capture") {
    playTone(220, 0.08, "sawtooth", 0.04, 0);
    playTone(165, 0.1, "sawtooth", 0.04, 0.08);
    playTone(310, 0.12, "square", 0.035, 0.18);
    return;
  }
  if (name === "win") {
    playTone(392, 0.12, "triangle", 0.04, 0);
    playTone(523, 0.12, "triangle", 0.04, 0.12);
    playTone(659, 0.18, "triangle", 0.045, 0.24);
  }
}

function getTokenCoords(token) {
  if (token.status === -1) {
    const player = getPlayer(token.playerId);
    const slotIndex = Number(token.id.split("-")[1]);
    const [x, y] = player.base[slotIndex];
    return gridToPixel(x, y);
  }
  if (token.status >= 0 && token.status <= 50) {
    const player = getPlayer(token.playerId);
    return gridToPixel(...RING_PATH[(player.startIndex + token.status) % RING_PATH.length]);
  }
  if (token.status >= 51 && token.status <= 56) {
    const player = getPlayer(token.playerId);
    return gridToPixel(...player.homeLane[token.status - 51]);
  }
  return gridToPixel(CENTER.x, CENTER.y);
}

function renderPlayerStats() {
  playerStats.innerHTML = "";
  getActivePlayers().forEach((player) => {
    const tokens = getTokensForPlayer(player.id);
    const homeCount = tokens.filter((token) => token.status === 56).length;
    const baseCount = tokens.filter((token) => token.status === -1).length;
    const placement = state.placements.find((entry) => entry.playerId === player.id);
    const isCurrent = currentPlayer().id === player.id;
    const statusText = placement
      ? `Finished #${placement.place}`
      : isCurrent
        ? "Playing now"
        : player.isHuman
          ? "Waiting"
          : "AI waiting";
    const row = document.createElement("div");
    row.className = `player-row${isCurrent ? " active" : ""}`;
    row.innerHTML = `
      <span class="player-avatar" style="background:${COLORS[player.id]}">${player.name.charAt(0)}</span>
      <div class="player-meta">
        <strong>${player.name}${player.isHuman ? " (Boss)" : " AI"}</strong>
        <span>Base: ${baseCount} | Track: ${4 - baseCount - homeCount}${placement ? ` | Place: ${placement.place}` : ""}</span>
        <span class="player-status">${statusText}</span>
      </div>
      <span class="player-home">Home: ${homeCount}/4</span>
    `;
    playerStats.appendChild(row);
  });
}

function renderRanking() {
  rankingList.innerHTML = "";

  if (state.placements.length === 0) {
    rankingList.innerHTML = '<p class="empty-note">No player has finished yet.</p>';
    return;
  }

  state.placements.forEach((entry) => {
    const player = getPlayer(entry.playerId);
    const row = document.createElement("div");
    row.className = "ranking-row";
    row.innerHTML = `<strong>${entry.place}. ${player.name}${player.isHuman ? " (Boss)" : ""}</strong><span>Finished all 4 tokens</span>`;
    rankingList.appendChild(row);
  });
}

function renderHistory() {
  historyList.innerHTML = "";

  if (state.history.length === 0) {
    historyList.innerHTML = '<p class="empty-note">Turn events will appear here.</p>';
    return;
  }

  state.history.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "history-row";
    row.innerHTML = `<strong>Event ${state.history.length - index}</strong><span>${entry}</span>`;
    historyList.appendChild(row);
  });
}

function updateTurnText() {
  const player = currentPlayer();
  turnLabel.textContent = player.isHuman ? "Boss" : `${player.name} AI`;
  turnLabel.style.color = "#ffffff";
  turnDot.style.background = COLORS[player.id];
  turnDot.style.boxShadow = `0 0 0 5px ${hexToRgba(COLORS[player.id], 0.18)}`;
  renderPlayerStats();
}

function updateButtons() {
  rollButton.disabled = !(state.started && currentPlayer().isHuman && !state.animating && !state.gameOver && state.diceValue === null);
}

function syncSeats() {
  const activeIds = getActivePlayerIds();
  const seatMap = {
    red: seatRed,
    green: seatGreen,
    yellow: seatYellow,
    blue: seatBlue,
  };
  Object.entries(seatMap).forEach(([playerId, element]) => {
    if (!element) return;
    if (playerId === "red") {
      element.textContent = "Boss";
      element.classList.remove("seat-idle");
      return;
    }
    const player = getPlayer(playerId);
    if (activeIds.includes(playerId)) {
      element.textContent = `${player.name} AI`;
      element.classList.remove("seat-idle");
    } else {
      element.textContent = "Idle";
      element.classList.add("seat-idle");
    }
  });
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.mode === state.mode);
  });
  startButton.disabled = false;
}

function setDiceDisplay(value) {
  const layouts = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  diceValueLabel.textContent = String(value);
  pips.forEach((pip, index) => pip.classList.toggle("active", layouts[value].includes(index)));
}

function resetGame() {
  state.currentPlayerIndex = 0;
  state.diceValue = null;
  state.animating = false;
  state.gameOver = false;
  state.hoverTokenId = null;
  state.consecutiveSixes = 0;
  state.placements = [];
  state.history = [];
  state.tokens = getActivePlayers().flatMap((player) => player.base.map((slot, index) => ({
    id: `${player.id}-${index}`,
    playerId: player.id,
    status: -1,
    drawX: slot[0],
    drawY: slot[1],
  })));
  setMessage(state.started ? "Boss, press Roll Dice to start your Red vs Yellow match." : "Boss, press Play to start your Red vs Yellow match.");
  setTurnHint(state.started ? "You are Red. Yellow is the AI." : "The game will start after you press Play.");
  setDiceDisplay(0);
  beginTurnSnapshot();
  syncSeats();
  updateTurnText();
  updateButtons();
  renderRanking();
  renderHistory();
  draw();
}

function tokenGlobalIndex(token) {
  if (token.status < 0 || token.status > 50) return null;
  return (getPlayer(token.playerId).startIndex + token.status) % RING_PATH.length;
}
function isSafeSquare(token) { return token.status < 0 || token.status > 50 || SAFE_GLOBAL_INDEXES.has(tokenGlobalIndex(token)); }
function getTokensOnSameTrackSquare(token) {
  const globalIndex = tokenGlobalIndex(token);
  if (globalIndex === null) return [];
  return state.tokens.filter((otherToken) => otherToken.id !== token.id && tokenGlobalIndex(otherToken) === globalIndex);
}
function wouldLandOnBlockedSquare(token, diceValue) {
  if (token.status === 56) return false;
  if (token.status !== -1 && token.status + diceValue > 56) return false;

  const newStatus = token.status === -1 ? 0 : token.status + diceValue;
  const trialToken = { ...token, status: newStatus };
  const landingTokens = getTokensOnSameTrackSquare(trialToken);

  if (landingTokens.length === 0) {
    return false;
  }

  if (isSafeSquare(trialToken)) {
    return false;
  }

  return landingTokens.some((otherToken) => otherToken.playerId === token.playerId) ||
    landingTokens.some((otherToken) => isSafeSquare(otherToken));
}
function isMoveLegal(token, diceValue) {
  if (token.status === 56) return false;
  if (token.status === -1) return diceValue === 6;
  return token.status + diceValue <= 56 && !wouldLandOnBlockedSquare(token, diceValue);
}
function legalMovesForPlayer(playerId, diceValue) {
  return getTokensForPlayer(playerId).filter((token) => isMoveLegal(token, diceValue) && !wouldLandOnBlockedSquare(token, diceValue));
}
function findOpponentsOnSameSquare(movedToken) {
  const globalIndex = tokenGlobalIndex(movedToken);
  if (globalIndex === null) return [];
  return state.tokens.filter((token) => token.playerId !== movedToken.playerId && tokenGlobalIndex(token) === globalIndex);
}
function animateDice(finalValue, onDone) {
  playSound("roll");
  diceFace.classList.add("rolling");
  let ticks = 0;
  const interval = window.setInterval(() => {
    ticks += 1;
    setDiceDisplay(Math.floor(Math.random() * 6) + 1);
    if (ticks >= 10) {
      window.clearInterval(interval);
      diceFace.classList.remove("rolling");
      setDiceDisplay(finalValue);
      onDone();
    }
  }, 90);
}

function rollDice() {
  if (!state.started || state.animating || state.diceValue !== null || state.gameOver) return;
  const value = Math.floor(Math.random() * 6) + 1;
  state.diceValue = value;
  setMessage(`${currentPlayer().name} is rolling the dice.`);
  setTurnHint(`Rolled ${value}.`);
  updateButtons();
  animateDice(value, () => {
    if (value === 6) {
      state.consecutiveSixes += 1;
      if (state.consecutiveSixes === 3) {
        restoreSnapshot(state.turnStartSnapshot);
        renderPlayerStats();
        pushHistory(`${currentPlayer().name} rolled three 6s and lost the whole turn.`);
        draw();
        setDiceDisplay(0);
        state.diceValue = null;
        setMessage(`${currentPlayer().name} rolled three consecutive 6s. The turn is forfeited and moves are canceled.`);
        setTurnHint("Turn passes to next player.");
        state.consecutiveSixes = 0;
        finishTurn(false, 1200);
        return;
      }
    } else {
      state.consecutiveSixes = 0;
    }

    const player = currentPlayer();
    const moves = legalMovesForPlayer(player.id, value);
    if (moves.length === 0) {
      setMessage(`${player.name} rolled ${value}, but no token can move.`);
      setTurnHint(value === 6 ? "Extra turn because of 6." : "Turn passes to next player.");
      pushHistory(`${player.name} rolled ${value} with no valid move.`);
      finishTurn(value === 6, 900);
      return;
    }
    if (player.isHuman) {
      if (moves.length === 1) {
        setMessage(`Boss, you rolled ${value}. Your only valid token will move automatically.`);
        setTurnHint("Automatic move.");
        pushHistory(`Boss rolled ${value} and the only valid move was auto-played.`);
        draw();
        window.setTimeout(() => moveToken(moves[0]), 500);
        return;
      }
      setMessage(`Boss, you rolled ${value}. Click a glowing Red token.`);
      setTurnHint(`${moves.length} move${moves.length > 1 ? "s are" : " is"} available.`);
      pushHistory(`Boss rolled ${value}.`);
      draw();
      return;
    }
    setMessage(`${player.name} rolled ${value} and is choosing a move.`);
    setTurnHint("AI is thinking.");
    pushHistory(`${player.name} rolled ${value}.`);
    draw();
    window.setTimeout(playAiTurn, 400);
  });
}

function nextPlayer() {
  let nextIndex = state.currentPlayerIndex;
  let attempts = 0;
  do {
    nextIndex = (nextIndex + 1) % PLAYERS.length;
    attempts += 1;
  } while (attempts <= PLAYERS.length && (!getActivePlayerIds().includes(PLAYERS[nextIndex].id) || playerHasPlaced(PLAYERS[nextIndex].id)));

  state.currentPlayerIndex = nextIndex;
  state.diceValue = null;
  state.consecutiveSixes = 0;
  beginTurnSnapshot();
  updateTurnText();
  updateButtons();
  draw();
  if (currentPlayer().isHuman) {
    setMessage("Boss, your turn. Roll the dice.");
    setTurnHint("Click Roll Dice.");
  } else {
    setMessage(`${currentPlayer().name}'s turn.`);
    setTurnHint("AI will roll automatically.");
    window.setTimeout(playAiTurn, 350);
  }
}

function finishTurn(extraTurn, delay = 700) {
  window.setTimeout(() => {
    state.diceValue = null;
    updateButtons();
    draw();
    if (state.gameOver) return;
    if (extraTurn) {
      setMessage(`${currentPlayer().name} gets another turn.`);
      setTurnHint(currentPlayer().isHuman ? "Roll again." : "AI rolls again.");
      if (!currentPlayer().isHuman) window.setTimeout(playAiTurn, 350);
      return;
    }
    nextPlayer();
  }, delay);
}

function sendTokenToBase(token) {
  token.status = -1;
  const coords = getTokenCoords(token);
  token.drawX = coords.x / CELL - 0.5;
  token.drawY = coords.y / CELL - 0.5;
}

function checkWinner(playerId) { return getTokensForPlayer(playerId).every((token) => token.status === 56); }

function smoothMove(token, target, done) {
  const start = { x: (token.drawX + 0.5) * CELL, y: (token.drawY + 0.5) * CELL };
  const startTime = performance.now();
  const duration = 120;
  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    token.drawX = (start.x + (target.x - start.x) * eased) / CELL - 0.5;
    token.drawY = (start.y + (target.y - start.y) * eased) / CELL - 0.5;
    draw();
    if (progress < 1) requestAnimationFrame(frame); else done();
  }
  requestAnimationFrame(frame);
}

function animateTokenMovement(token, newStatus, onDone) {
  state.animating = true;
  const steps = [];
  if (token.status === -1) {
    steps.push(0);
    for (let step = 1; step <= newStatus; step += 1) steps.push(step);
  } else {
    for (let step = token.status + 1; step <= newStatus; step += 1) steps.push(step);
  }
  let index = 0;
  function moveNext() {
    if (index >= steps.length) {
      token.status = newStatus;
      const coords = getTokenCoords(token);
      token.drawX = coords.x / CELL - 0.5;
      token.drawY = coords.y / CELL - 0.5;
      state.animating = false;
      onDone();
      return;
    }
    token.status = steps[index];
    smoothMove(token, getTokenCoords(token), () => {
      index += 1;
      moveNext();
    });
  }
  moveNext();
}

function moveToken(token) {
  if (state.animating || state.diceValue === null || !isMoveLegal(token, state.diceValue)) return;
  const diceValue = state.diceValue;
  const newStatus = token.status === -1 ? 0 : token.status + diceValue;
  const player = currentPlayer();
  setMessage(`${player.name} moves a token by ${diceValue}.`);
  setTurnHint("Animating move.");
  updateButtons();
  animateTokenMovement(token, newStatus, () => {
    playSound("move");
    let extraTurn = diceValue === 6;
    const captured = !isSafeSquare(token) ? findOpponentsOnSameSquare(token) : [];
    if (captured.length > 0) {
      captured.forEach(sendTokenToBase);
      extraTurn = true;
      playSound("capture");
      setMessage(`${player.name} captured ${captured.length} token${captured.length > 1 ? "s" : ""}.`);
      setTurnHint("Capture gives an extra turn.");
      pushHistory(`${player.name} captured ${captured.length} token${captured.length > 1 ? "s" : ""}.`);
    } else if (newStatus === 56) {
      extraTurn = true;
      setMessage(`${player.name} moved a token into home.`);
      setTurnHint("Home entry gives an extra turn.");
      pushHistory(`${player.name} moved a token into home.`);
    } else if (diceValue === 6) {
      setTurnHint("6 gives an extra turn.");
      pushHistory(`${player.name} used a 6 for movement.`);
    } else {
      setTurnHint("Move complete.");
      pushHistory(`${player.name} completed a move of ${diceValue}.`);
    }
    renderPlayerStats();
    draw();
    if (checkWinner(player.id)) {
      if (!playerHasPlaced(player.id)) {
        state.placements.push({ playerId: player.id, place: state.placements.length + 1 });
      }
      renderRanking();
      const activeRemaining = getActivePlayers().filter((entry) => !playerHasPlaced(entry.id));
      state.diceValue = null;
      renderPlayerStats();
      updateButtons();

      if (activeRemaining.length <= 1) {
        if (activeRemaining.length === 1 && !playerHasPlaced(activeRemaining[0].id)) {
          state.placements.push({ playerId: activeRemaining[0].id, place: state.placements.length + 1 });
        }
        state.gameOver = true;
        renderRanking();
        renderPlayerStats();
        pushHistory(`${player.name} completed the match ranking.`);
        setMessage(`${player.name} secured place ${state.placements.length === 1 ? "1" : state.placements.find((entry) => entry.playerId === player.id).place}. Match ranking is complete.`);
        setTurnHint(player.isHuman ? "Boss finished in the rankings." : "All placements are decided.");
        showWinnerOverlay();
        return;
      }

      pushHistory(`${player.name} finished in place ${state.placements.find((entry) => entry.playerId === player.id).place}.`);
      setMessage(`${player.name} finished in place ${state.placements.find((entry) => entry.playerId === player.id).place}. The match continues for ranking.`);
      setTurnHint("Next active player will continue the match.");
      finishTurn(false, 1200);
      return;
    }
    finishTurn(extraTurn);
  });
}

function chooseAiToken(moves) {
  const value = state.diceValue;
  const finishing = moves.find((token) => (token.status === -1 ? 0 : token.status + value) === 56);
  if (finishing) return finishing;
  const capturing = moves.find((token) => {
    const clone = { ...token, status: token.status === -1 ? 0 : token.status + value };
    return !isSafeSquare(clone) && findOpponentsOnSameSquare(clone).length > 0;
  });
  if (capturing) return capturing;
  const leavingBase = moves.find((token) => token.status === -1);
  if (leavingBase) return leavingBase;
  return moves.slice().sort((a, b) => b.status - a.status)[0];
}

function playAiTurn() {
  if (!state.started || state.gameOver || state.animating || currentPlayer().isHuman) return;
  if (state.diceValue === null) {
    rollDice();
    return;
  }
  const moves = legalMovesForPlayer(currentPlayer().id, state.diceValue);
  if (moves.length === 0) return;
  window.setTimeout(() => moveToken(chooseAiToken(moves)), 260);
}

function buildConfetti() {
  confettiLayer.innerHTML = "";
  const confettiColors = [COLORS.red, COLORS.green, COLORS.yellow, COLORS.blue, "#ffffff"];
  for (let index = 0; index < 24; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = confettiColors[index % confettiColors.length];
    piece.style.animationDuration = `${3 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    confettiLayer.appendChild(piece);
  }
  if (state.confettiTimer) window.clearTimeout(state.confettiTimer);
  state.confettiTimer = window.setTimeout(() => {
    confettiLayer.innerHTML = "";
  }, 5200);
}

function showWinnerOverlay() {
  const firstPlace = state.placements[0] ? getPlayer(state.placements[0].playerId) : getPlayer("red");
  winnerTitle.textContent = firstPlace.isHuman ? "Boss wins the match" : `${firstPlace.name} AI wins the match`;
  winnerSubtitle.textContent = "Final ranking for the 2-player match.";
  winnerRanking.innerHTML = "";
  state.placements.forEach((entry) => {
    const player = getPlayer(entry.playerId);
    const row = document.createElement("div");
    row.className = "winner-row";
    row.innerHTML = `<strong>${entry.place}. ${player.name}${player.isHuman ? " (Boss)" : " AI"}</strong><span>All four tokens reached home.</span>`;
    winnerRanking.appendChild(row);
  });
  winnerScreen.classList.remove("hidden");
  buildConfetti();
  playSound("win");
}

function hideWinnerOverlay() {
  winnerScreen.classList.add("hidden");
  winnerRanking.innerHTML = "";
  confettiLayer.innerHTML = "";
}
function draw() {
  drawBoard();
  drawMoveHints();
  drawTokens();
}

function drawBoard() {
  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 0, 0, BOARD_SIZE, BOARD_SIZE, 18, true, false);

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      drawGridCell(x, y, "#ffffff", "rgba(35, 44, 68, 0.12)");
    }
  }

  drawBaseZone(0, 0, COLORS.red, SOFT_COLORS.red);
  drawBaseZone(9, 0, COLORS.green, SOFT_COLORS.green);
  drawBaseZone(9, 9, COLORS.yellow, SOFT_COLORS.yellow);
  drawBaseZone(0, 9, COLORS.blue, SOFT_COLORS.blue);

  RING_PATH.forEach(([x, y], index) => {
    drawTrackCell(x, y, SAFE_GLOBAL_INDEXES.has(index) ? "#fffdf4" : "#ffffff", "rgba(35, 44, 68, 0.2)");
    if (SAFE_GLOBAL_INDEXES.has(index)) drawSafeMarker(x, y);
  });

  getActivePlayers().forEach((player) => {
    player.homeLane.forEach(([x, y], index) => {
      drawTrackCell(x, y, hexToRgba(COLORS[player.id], 0.55), "rgba(35, 44, 68, 0.12)");
      if (index === 5) drawArrowCell(x, y, player.id);
    });
  });

  drawCenterTriangles();
}

function drawGridCell(x, y, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
}

function drawTrackCell(x, y, fill, stroke) {
  const pad = CELL * 0.05;
  const px = x * CELL + pad;
  const py = y * CELL + pad;
  roundRect(ctx, px, py, CELL - pad * 2, CELL - pad * 2, 8, true, false, fill);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;
  roundRect(ctx, px, py, CELL - pad * 2, CELL - pad * 2, 8, false, true);
}

function drawBaseZone(startX, startY, color, softColor) {
  ctx.fillStyle = softColor;
  roundRect(ctx, startX * CELL, startY * CELL, CELL * 6, CELL * 6, 12, true, false);
  ctx.strokeStyle = hexToRgba(color, 0.45);
  ctx.lineWidth = 2.5;
  roundRect(ctx, startX * CELL, startY * CELL, CELL * 6, CELL * 6, 12, false, true);

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, (startX + 1) * CELL, (startY + 1) * CELL, CELL * 4, CELL * 4, 6, true, false);
  ctx.strokeStyle = hexToRgba(color, 0.22);
  roundRect(ctx, (startX + 1) * CELL, (startY + 1) * CELL, CELL * 4, CELL * 4, 6, false, true);

  for (let row = startY + 1; row <= startY + 4; row += 2) {
    for (let col = startX + 1; col <= startX + 4; col += 2) {
      const { x, y } = gridToPixel(col, row);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, 0.45);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
}

function drawSafeMarker(x, y) {
  const center = gridToPixel(x, y);
  ctx.strokeStyle = "rgba(85, 85, 85, 0.8)";
  ctx.lineWidth = 2;
  drawOutlinedStar(center.x, center.y, CELL * 0.12, CELL * 0.24, 5);
}

function drawArrowCell(x, y, playerId) {
  const center = gridToPixel(x, y);
  ctx.fillStyle = COLORS[playerId];
  ctx.beginPath();
  if (playerId === "red") {
    ctx.moveTo(center.x + CELL * 0.2, center.y - CELL * 0.18);
    ctx.lineTo(center.x - CELL * 0.18, center.y);
    ctx.lineTo(center.x + CELL * 0.2, center.y + CELL * 0.18);
  } else if (playerId === "green") {
    ctx.moveTo(center.x - CELL * 0.18, center.y + CELL * 0.2);
    ctx.lineTo(center.x, center.y - CELL * 0.18);
    ctx.lineTo(center.x + CELL * 0.18, center.y + CELL * 0.2);
  } else if (playerId === "yellow") {
    ctx.moveTo(center.x - CELL * 0.2, center.y - CELL * 0.18);
    ctx.lineTo(center.x + CELL * 0.18, center.y);
    ctx.lineTo(center.x - CELL * 0.2, center.y + CELL * 0.18);
  } else {
    ctx.moveTo(center.x - CELL * 0.18, center.y - CELL * 0.2);
    ctx.lineTo(center.x, center.y + CELL * 0.18);
    ctx.lineTo(center.x + CELL * 0.18, center.y - CELL * 0.2);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCenterTriangles() {
  const center = gridToPixel(CENTER.x, CENTER.y);
  const left = gridToPixel(6, 7);
  const top = gridToPixel(7, 6);
  const right = gridToPixel(8, 7);
  const bottom = gridToPixel(7, 8);

  fillTriangle([left, top, center], COLORS.red);
  fillTriangle([top, right, center], COLORS.green);
  fillTriangle([right, bottom, center], COLORS.yellow);
  fillTriangle([bottom, left, center], COLORS.blue);

  ctx.strokeStyle = "rgba(35, 44, 68, 0.16)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.closePath();
  ctx.stroke();
}

function drawMoveHints() {
  if (!state.started || !currentPlayer().isHuman || state.diceValue === null || state.animating) return;
  legalMovesForPlayer(currentPlayer().id, state.diceValue).forEach((token) => {
    const pixel = tokenPixel(token);
    ctx.strokeStyle = "rgba(31, 75, 58, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, CELL * 0.33, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawTokens() {
  const groups = new Map();
  state.tokens.forEach((token) => {
    const key = `${token.drawX.toFixed(2)}-${token.drawY.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(token);
  });
  groups.forEach((tokens) => {
    tokens.forEach((token, index) => {
      const pixel = tokenPixel(token);
      const spread = [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]][index] || [0, 0];
      drawToken(token, pixel.x + spread[0] * CELL, pixel.y + spread[1] * CELL);
    });
  });
}

function tokenPixel(token) { return { x: (token.drawX + 0.5) * CELL, y: (token.drawY + 0.5) * CELL }; }
function drawToken(token, x, y) {
  const color = COLORS[token.playerId];
  const isHover = state.hoverTokenId === token.id;
  const isClickable = currentPlayer().isHuman && state.diceValue !== null && !state.animating && legalMovesForPlayer(currentPlayer().id, state.diceValue).some((move) => move.id === token.id);
  if (isClickable) {
    ctx.fillStyle = hexToRgba(color, isHover ? 0.28 : 0.18);
    ctx.beginPath();
    ctx.arc(x, y, CELL * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y + CELL * 0.06, CELL * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(color, 0.5);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y - CELL * 0.05, CELL * 0.16, Math.PI, 0);
  ctx.lineTo(x, y + CELL * 0.13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 60, 60, 0.55)";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - CELL * 0.08, CELL * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(color, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
function hitTestToken(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  return legalMovesForPlayer(currentPlayer().id, state.diceValue).find((token) => {
    const pixel = tokenPixel(token);
    return Math.hypot(pixel.x - x, pixel.y - y) <= CELL * 0.34;
  }) || null;
}

function onCanvasClick(event) {
  if (!state.started || !currentPlayer().isHuman || state.animating || state.diceValue === null) return;
  const token = hitTestToken(event);
  if (token) moveToken(token);
}

function onCanvasMove(event) {
  if (!state.started || !currentPlayer().isHuman || state.animating || state.diceValue === null) {
    state.hoverTokenId = null;
    canvas.style.cursor = "default";
    draw();
    return;
  }
  const token = hitTestToken(event);
  const nextHover = token ? token.id : null;
  if (state.hoverTokenId !== nextHover) {
    state.hoverTokenId = nextHover;
    canvas.style.cursor = token ? "pointer" : "default";
    draw();
  }
}

function roundRect(context, x, y, width, height, radius, fill, stroke, fillStyle) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  if (fill) {
    if (fillStyle) context.fillStyle = fillStyle;
    context.fill();
  }
  if (stroke) context.stroke();
}

function fillTriangle(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.closePath();
  ctx.fill();
}

function drawStar(cx, cy, innerRadius, outerRadius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawOutlinedStar(cx, cy, innerRadius, outerRadius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenColor(hex, amount) {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  const adjust = (channel) => Math.min(255, Math.round(channel + (255 - channel) * amount));
  return `rgb(${adjust((num >> 16) & 255)}, ${adjust((num >> 8) & 255)}, ${adjust(num & 255)})`;
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = "duel";
    updateModeButtons();
    state.started = false;
    resetGame();
    setMessage("Boss, Red vs Yellow AI is selected.");
    setTurnHint("Press Play Now to start the game.");
  });
});

startButton.addEventListener("click", () => {
  state.started = true;
  startScreen.classList.add("hidden");
  hideWinnerOverlay();
  ensureAudio();
  resetGame();
});

playAgainButton.addEventListener("click", () => {
  hideWinnerOverlay();
  state.started = true;
  resetGame();
});

closeWinnerButton.addEventListener("click", () => {
  hideWinnerOverlay();
  state.started = false;
  startScreen.classList.remove("hidden");
  updateButtons();
});

soundToggle.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  soundToggle.textContent = state.soundEnabled ? "Sound On" : "Sound Off";
  if (state.soundEnabled) ensureAudio();
});

rollButton.addEventListener("click", rollDice);
restartButton.addEventListener("click", () => {
  hideWinnerOverlay();
  state.started = false;
  startScreen.classList.remove("hidden");
  resetGame();
});
canvas.addEventListener("click", onCanvasClick);
canvas.addEventListener("mousemove", onCanvasMove);
canvas.addEventListener("mouseleave", () => {
  state.hoverTokenId = null;
  canvas.style.cursor = "default";
  draw();
});

updateModeButtons();
resetGame();
startScreen.classList.remove("hidden");
trackBackgroundVisit();
