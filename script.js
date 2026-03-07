const canvas = document.getElementById("boardCanvas");
const ctx = canvas.getContext("2d");

const rollButton = document.getElementById("rollButton");
const restartButton = document.getElementById("restartButton");
const messageBox = document.getElementById("messageBox");
const turnLabel = document.getElementById("turnLabel");
const diceFace = document.getElementById("diceFace");

const BOARD_SIZE = 720;
const GRID_SIZE = 15;
const CELL = BOARD_SIZE / GRID_SIZE;
const CENTER = { x: 7, y: 7 };

const COLORS = {
  red: "#d84f4f",
  green: "#36a86e",
  yellow: "#e8b63a",
  blue: "#4f7ad8",
};

const PLAYERS = [
  { id: "red", name: "Red", startIndex: 0, homeLane: laneFromLeft(), base: tokenBaseSlots(1.7, 1.7), isHuman: true },
  { id: "green", name: "Green", startIndex: 13, homeLane: laneFromTop(), base: tokenBaseSlots(9.7, 1.7), isHuman: false },
  { id: "yellow", name: "Yellow", startIndex: 26, homeLane: laneFromRight(), base: tokenBaseSlots(9.7, 9.7), isHuman: false },
  { id: "blue", name: "Blue", startIndex: 39, homeLane: laneFromBottom(), base: tokenBaseSlots(1.7, 9.7), isHuman: false },
];

const SAFE_GLOBAL_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const RING_PATH = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

const state = {
  currentPlayerIndex: 0,
  diceValue: null,
  tokens: [],
  animating: false,
  gameOver: false,
};

function laneFromLeft() {
  return [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]];
}

function laneFromTop() {
  return [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]];
}

function laneFromRight() {
  return [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]];
}

function laneFromBottom() {
  return [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]];
}

function tokenBaseSlots(startX, startY) {
  return [
    [startX, startY],
    [startX + 2.1, startY],
    [startX, startY + 2.1],
    [startX + 2.1, startY + 2.1],
  ];
}

function resetGame() {
  state.currentPlayerIndex = 0;
  state.diceValue = null;
  state.animating = false;
  state.gameOver = false;
  state.tokens = PLAYERS.flatMap((player) =>
    player.base.map((slot, index) => ({
      id: `${player.id}-${index}`,
      playerId: player.id,
      status: -1,
      drawX: slot[0],
      drawY: slot[1],
    }))
  );

  setMessage("Press Roll Dice to start.");
  diceFace.textContent = "-";
  updateTurnText();
  updateButtons();
  draw();

  if (!currentPlayer().isHuman) {
    window.setTimeout(playAiTurn, 500);
  }
}

function currentPlayer() {
  return PLAYERS[state.currentPlayerIndex];
}

function setMessage(text) {
  messageBox.textContent = text;
}

function updateTurnText() {
  const player = currentPlayer();
  turnLabel.textContent = player.name;
  turnLabel.style.color = COLORS[player.id];
}

function updateButtons() {
  const player = currentPlayer();
  const canRoll = !state.animating && !state.gameOver && state.diceValue === null && player.isHuman;
  rollButton.disabled = !canRoll;
}

function gridToPixel(x, y) {
  return {
    x: (x + 0.5) * CELL,
    y: (y + 0.5) * CELL,
  };
}

function getTokenCoords(token) {
  if (token.status === -1) {
    const player = PLAYERS.find((item) => item.id === token.playerId);
    const slotIndex = Number(token.id.split("-")[1]);
    const [x, y] = player.base[slotIndex];
    return gridToPixel(x, y);
  }

  if (token.status >= 0 && token.status <= 50) {
    const player = PLAYERS.find((item) => item.id === token.playerId);
    const globalIndex = (player.startIndex + token.status) % RING_PATH.length;
    return gridToPixel(...RING_PATH[globalIndex]);
  }

  if (token.status >= 51 && token.status <= 56) {
    const player = PLAYERS.find((item) => item.id === token.playerId);
    return gridToPixel(...player.homeLane[token.status - 51]);
  }

  return gridToPixel(CENTER.x, CENTER.y);
}

function getTokensForPlayer(playerId) {
  return state.tokens.filter((token) => token.playerId === playerId);
}

function isMoveLegal(token, diceValue) {
  if (token.status === 56) {
    return false;
  }

  if (token.status === -1) {
    return diceValue === 6;
  }

  return token.status + diceValue <= 56;
}

function legalMovesForPlayer(playerId, diceValue) {
  return getTokensForPlayer(playerId).filter((token) => isMoveLegal(token, diceValue));
}

function isSafeSquare(token) {
  if (token.status < 0 || token.status > 50) {
    return true;
  }

  const player = PLAYERS.find((item) => item.id === token.playerId);
  const globalIndex = (player.startIndex + token.status) % RING_PATH.length;
  return SAFE_GLOBAL_INDEXES.has(globalIndex);
}

function findOpponentsOnSameSquare(movedToken) {
  if (movedToken.status < 0 || movedToken.status > 50) {
    return [];
  }

  const movedPlayer = PLAYERS.find((item) => item.id === movedToken.playerId);
  const movedGlobalIndex = (movedPlayer.startIndex + movedToken.status) % RING_PATH.length;

  return state.tokens.filter((token) => {
    if (token.playerId === movedToken.playerId || token.status < 0 || token.status > 50) {
      return false;
    }

    const player = PLAYERS.find((item) => item.id === token.playerId);
    const globalIndex = (player.startIndex + token.status) % RING_PATH.length;
    return movedGlobalIndex === globalIndex;
  });
}

function rollDice() {
  if (state.animating || state.diceValue !== null || state.gameOver) {
    return;
  }

  const value = Math.floor(Math.random() * 6) + 1;
  state.diceValue = value;
  diceFace.textContent = String(value);

  const player = currentPlayer();
  const moves = legalMovesForPlayer(player.id, value);

  if (moves.length === 0) {
    setMessage(`${player.name} rolled ${value}. No move is possible.`);
    const keepTurn = value === 6;
    finishTurn(keepTurn, 850);
    return;
  }

  if (player.isHuman) {
    setMessage(`Boss, you rolled ${value}. Click one of your Red tokens.`);
  } else {
    setMessage(`${player.name} rolled ${value}. Thinking...`);
    window.setTimeout(playAiTurn, 650);
  }

  updateButtons();
  draw();
}

function nextPlayer() {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % PLAYERS.length;
  state.diceValue = null;
  updateTurnText();
  updateButtons();
  draw();

  if (!state.gameOver && !currentPlayer().isHuman) {
    window.setTimeout(playAiTurn, 700);
  }
}

function finishTurn(getsExtraTurn, delay = 650) {
  window.setTimeout(() => {
    if (state.gameOver) {
      return;
    }

    state.diceValue = null;

    if (getsExtraTurn) {
      setMessage(`${currentPlayer().name} gets another turn.`);
      updateButtons();
      draw();

      if (!currentPlayer().isHuman) {
        window.setTimeout(playAiTurn, 700);
      }
      return;
    }

    nextPlayer();
    if (currentPlayer().isHuman) {
      setMessage("Boss, press Roll Dice.");
    }
  }, delay);
}

function checkWinner(playerId) {
  return getTokensForPlayer(playerId).every((token) => token.status === 56);
}

function sendTokenToBase(token) {
  token.status = -1;
  const coords = getTokenCoords(token);
  token.drawX = coords.x / CELL - 0.5;
  token.drawY = coords.y / CELL - 0.5;
}

function animateTokenMovement(token, newStatus, onDone) {
  state.animating = true;

  const stepStatuses = [];

  if (token.status === -1) {
    stepStatuses.push(0);
    for (let i = 1; i <= newStatus; i += 1) {
      stepStatuses.push(i);
    }
  } else {
    for (let i = token.status + 1; i <= newStatus; i += 1) {
      stepStatuses.push(i);
    }
  }

  let index = 0;

  function moveNext() {
    if (index >= stepStatuses.length) {
      token.status = newStatus;
      const finalCoords = getTokenCoords(token);
      token.drawX = finalCoords.x / CELL - 0.5;
      token.drawY = finalCoords.y / CELL - 0.5;
      state.animating = false;
      onDone();
      return;
    }

    token.status = stepStatuses[index];
    const coords = getTokenCoords(token);
    smoothMove(token, coords, () => {
      index += 1;
      moveNext();
    });
  }

  moveNext();
}

function smoothMove(token, target, done) {
  const start = {
    x: (token.drawX + 0.5) * CELL,
    y: (token.drawY + 0.5) * CELL,
  };

  const startTime = performance.now();
  const duration = 130;

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    const x = start.x + (target.x - start.x) * eased;
    const y = start.y + (target.y - start.y) * eased;
    token.drawX = x / CELL - 0.5;
    token.drawY = y / CELL - 0.5;
    draw();

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      done();
    }
  }

  requestAnimationFrame(frame);
}

function moveToken(token) {
  if (state.animating || state.diceValue === null || !isMoveLegal(token, state.diceValue)) {
    return;
  }

  const diceValue = state.diceValue;
  const oldStatus = token.status;
  const newStatus = oldStatus === -1 ? 0 : oldStatus + diceValue;
  const player = currentPlayer();

  setMessage(`${player.name} moves a token by ${diceValue}.`);
  updateButtons();

  animateTokenMovement(token, newStatus, () => {
    let earnedExtraTurn = diceValue === 6;

    const captured = findOpponentsOnSameSquare(token);
    if (!isSafeSquare(token) && captured.length > 0) {
      captured.forEach(sendTokenToBase);
      earnedExtraTurn = true;
      setMessage(`${player.name} captured ${captured.length} token${captured.length > 1 ? "s" : ""}.`);
    }

    if (newStatus === 56) {
      earnedExtraTurn = true;
      setMessage(`${player.name} placed a token in the center.`);
    }

    draw();

    if (checkWinner(player.id)) {
      state.gameOver = true;
      state.diceValue = null;
      updateButtons();
      setMessage(`${player.name} wins the game.`);
      return;
    }

    finishTurn(earnedExtraTurn);
  });
}

function chooseAiToken(moves) {
  const capturing = moves.find((token) => {
    const simulated = token.status === -1 ? 0 : token.status + state.diceValue;
    const clone = { ...token, status: simulated };
    return findOpponentsOnSameSquare(clone).length > 0 && !isSafeSquare(clone);
  });

  if (capturing) {
    return capturing;
  }

  const finishing = moves.find((token) => {
    const simulated = token.status === -1 ? 0 : token.status + state.diceValue;
    return simulated === 56;
  });

  if (finishing) {
    return finishing;
  }

  const leavingBase = moves.find((token) => token.status === -1);
  if (leavingBase) {
    return leavingBase;
  }

  return moves.sort((a, b) => b.status - a.status)[0];
}

function playAiTurn() {
  if (state.gameOver || state.animating || currentPlayer().isHuman) {
    return;
  }

  if (state.diceValue === null) {
    rollDice();
    return;
  }

  const moves = legalMovesForPlayer(currentPlayer().id, state.diceValue);
  if (moves.length === 0) {
    return;
  }

  const token = chooseAiToken(moves);
  window.setTimeout(() => moveToken(token), 500);
}

function drawRectCell(x, y, fill, stroke = "#ffffff", lineWidth = 1.5) {
  ctx.fillStyle = fill;
  ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
}

function drawBoard() {
  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
  ctx.fillStyle = "#f6f1e7";
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      drawRectCell(x, y, "#fbf7ef", "#e5dac7", 1);
    }
  }

  fillHomeBase(0, 0, COLORS.red);
  fillHomeBase(9, 0, COLORS.green);
  fillHomeBase(9, 9, COLORS.yellow);
  fillHomeBase(0, 9, COLORS.blue);

  RING_PATH.forEach(([x, y], index) => {
    let fill = "#ffffff";
    if (SAFE_GLOBAL_INDEXES.has(index)) {
      fill = "#efe2ae";
    }
    drawRectCell(x, y, fill, "#c9bca8", 1.5);
  });

  PLAYERS.forEach((player) => {
    player.homeLane.forEach(([x, y]) => drawRectCell(x, y, hexToRgba(COLORS[player.id], 0.3), "#c9bca8", 1.5));
  });

  drawTriangle(COLORS.red, [[6, 6], [7, 7], [6, 8]]);
  drawTriangle(COLORS.green, [[6, 6], [7, 6], [7, 7]]);
  drawTriangle(COLORS.yellow, [[7, 7], [8, 6], [8, 8]]);
  drawTriangle(COLORS.blue, [[6, 8], [8, 8], [7, 7]]);

  ctx.fillStyle = "#fff";
  const center = gridToPixel(CENTER.x, CENTER.y);
  ctx.beginPath();
  ctx.arc(center.x, center.y, CELL * 0.24, 0, Math.PI * 2);
  ctx.fill();
}

function fillHomeBase(startX, startY, color) {
  ctx.fillStyle = hexToRgba(color, 0.18);
  ctx.fillRect(startX * CELL, startY * CELL, CELL * 6, CELL * 6);
  ctx.strokeStyle = "#c9bca8";
  ctx.lineWidth = 2;
  ctx.strokeRect(startX * CELL, startY * CELL, CELL * 6, CELL * 6);

  for (let y = startY + 1; y <= startY + 4; y += 2) {
    for (let x = startX + 1; x <= startX + 4; x += 2) {
      const pixel = gridToPixel(x, y);
      ctx.fillStyle = "#fffdf8";
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, CELL * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function drawTriangle(color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const first = gridToPixel(...points[0]);
  ctx.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => {
    const pixel = gridToPixel(...point);
    ctx.lineTo(pixel.x, pixel.y);
  });
  ctx.closePath();
  ctx.fill();
}

function drawTokens() {
  const grouped = new Map();

  state.tokens.forEach((token) => {
    const key = `${token.drawX.toFixed(2)}-${token.drawY.toFixed(2)}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(token);
  });

  grouped.forEach((tokens) => {
    tokens.forEach((token, index) => {
      const pixel = {
        x: (token.drawX + 0.5) * CELL,
        y: (token.drawY + 0.5) * CELL,
      };

      const spread = [
        [-0.16, -0.16],
        [0.16, -0.16],
        [-0.16, 0.16],
        [0.16, 0.16],
      ][index] || [0, 0];

      drawTokenCircle(pixel.x + spread[0] * CELL, pixel.y + spread[1] * CELL, COLORS[token.playerId]);
    });
  });
}

function drawTokenCircle(x, y, color) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y, CELL * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, CELL * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(34, 49, 39, 0.24)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawHighlightMoves() {
  if (state.diceValue === null || !currentPlayer().isHuman || state.animating) {
    return;
  }

  legalMovesForPlayer(currentPlayer().id, state.diceValue).forEach((token) => {
    const pixel = {
      x: (token.drawX + 0.5) * CELL,
      y: (token.drawY + 0.5) * CELL,
    };
    ctx.strokeStyle = "rgba(33, 76, 58, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, CELL * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function draw() {
  drawBoard();
  drawHighlightMoves();
  drawTokens();
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const chunk = value.length === 3
    ? value.split("").map((item) => item + item).join("")
    : value;
  const num = parseInt(chunk, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function onCanvasClick(event) {
  if (!currentPlayer().isHuman || state.animating || state.diceValue === null) {
    return;
  }

  const moves = legalMovesForPlayer(currentPlayer().id, state.diceValue);
  if (moves.length === 0) {
    return;
  }

  const point = canvasPoint(event);
  const clicked = moves.find((token) => {
    const pixel = {
      x: (token.drawX + 0.5) * CELL,
      y: (token.drawY + 0.5) * CELL,
    };
    return Math.hypot(pixel.x - point.x, pixel.y - point.y) <= CELL * 0.34;
  });

  if (clicked) {
    moveToken(clicked);
  }
}

rollButton.addEventListener("click", rollDice);
restartButton.addEventListener("click", resetGame);
canvas.addEventListener("click", onCanvasClick);

resetGame();
