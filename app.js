const modeScreen = document.getElementById("mode-screen");
const gameCard = document.querySelector(".game-card:not(.mode-card)");
const modeBadge = document.getElementById("mode-badge");
const boardBadge = document.getElementById("board-badge");
const changeModeBtn = document.getElementById("change-mode-btn");
const restartBoardBtn = document.getElementById("restart-board-btn");
const drawerToggleBtn = document.getElementById("drawer-toggle-btn");
const drawerCloseBtn = document.getElementById("drawer-close-btn");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const soundToggleBtn = document.getElementById("sound-toggle-btn");
const startGameBtn = document.getElementById("start-game-btn");
const clearScoreboardBtn = document.getElementById("clear-scoreboard-btn");
const winnerBox = document.getElementById("winner-box");
const resetBtn = document.getElementById("reset-btn");
const boardRoot = document.getElementById("board");
const statsLeftLabel = document.getElementById("stats-left-label");
const statsRightLabel = document.getElementById("stats-right-label");
const statsLeftTotal = document.getElementById("stats-left-total");
const statsRightTotal = document.getElementById("stats-right-total");
const statsDraws = document.getElementById("stats-draws");
const historyList = document.getElementById("history-list");
const historyCount = document.getElementById("history-count");
const modeButtons = document.querySelectorAll("[data-mode]");
const sizeButtons = document.querySelectorAll("[data-board-size]");

const STORAGE_KEYS = {
  mode: "ticTacToeMode",
  boardSize: "ticTacToeBoardSize",
  theme: "ticTacToeTheme",
  sound: "ticTacToeSoundEnabled",
  persistence: "ticTacToeMatchData",
};

const DEFAULT_BOARD_SIZE = 3;
const SUPPORTED_BOARD_SIZES = [3, 4, 5];

const defaultStats = {
  pvp: {
    O: { wins: 0, losses: 0, draws: 0 },
    X: { wins: 0, losses: 0, draws: 0 },
  },
  pvc: {
    player: { wins: 0, losses: 0, draws: 0 },
    computer: { wins: 0, losses: 0, draws: 0 },
  },
};

let persistentState = loadPersistentState();
let matchStats = persistentState.stats;
let matchHistory = persistentState.history;
let selectedMode = localStorage.getItem(STORAGE_KEYS.mode) || "";
let selectedBoardSize = normalizeBoardSize(Number(localStorage.getItem(STORAGE_KEYS.boardSize)) || DEFAULT_BOARD_SIZE);
let themePreference = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
let soundEnabledRaw = localStorage.getItem(STORAGE_KEYS.sound);
let soundEnabled = soundEnabledRaw === null ? true : soundEnabledRaw === "true";
let boardState = [];
let boardPatterns = [];
let boardCells = [];
let currentTurn = "O";
let gameOver = false;
let computerTurnPending = false;
let computerMoveTimeoutId = null;
let audioContext = null;

function normalizeBoardSize(value) {
  return SUPPORTED_BOARD_SIZES.includes(value) ? value : DEFAULT_BOARD_SIZE;
}

function cloneDefaultStats() {
  return JSON.parse(JSON.stringify(defaultStats));
}

function loadPersistentState() {
  try {
    const storedState = JSON.parse(localStorage.getItem(STORAGE_KEYS.persistence));
    if (!storedState || typeof storedState !== "object") {
      return { stats: cloneDefaultStats(), history: [] };
    }

    const storedStats = storedState.stats || {};
    const mergedStats = cloneDefaultStats();

    mergedStats.pvp.O = { ...mergedStats.pvp.O, ...((storedStats.pvp || {}).O || {}) };
    mergedStats.pvp.X = { ...mergedStats.pvp.X, ...((storedStats.pvp || {}).X || {}) };
    mergedStats.pvc.player = { ...mergedStats.pvc.player, ...((storedStats.pvc || {}).player || {}) };
    mergedStats.pvc.computer = { ...mergedStats.pvc.computer, ...((storedStats.pvc || {}).computer || {}) };

    return {
      stats: mergedStats,
      history: Array.isArray(storedState.history) ? storedState.history.slice(0, 10) : [],
    };
  } catch (error) {
    return { stats: cloneDefaultStats(), history: [] };
  }
}

function persistState() {
  persistentState.stats = matchStats;
  persistentState.history = matchHistory;
  localStorage.setItem(STORAGE_KEYS.persistence, JSON.stringify(persistentState));
}

function getModeLabel(mode) {
  if (mode === "pvc") {
    return "Player vs Computer";
  }

  if (mode === "pvp") {
    return "Player vs Player";
  }

  return "Not selected";
}

function getBoardLabel(size = selectedBoardSize) {
  return `${size} × ${size}`;
}

function updateModeBadge() {
  modeBadge.innerText = `Mode: ${getModeLabel(selectedMode)}`;
}

function updateBoardBadge() {
  boardBadge.innerText = `Board: ${getBoardLabel()}`;
}

function applyTheme(theme) {
  themePreference = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = themePreference;
  localStorage.setItem(STORAGE_KEYS.theme, themePreference);
  themeToggleBtn.innerText = themePreference === "dark" ? "Light mode" : "Dark mode";
}

function updateSoundToggle() {
  soundToggleBtn.innerText = soundEnabled ? "Sound: On" : "Sound: Off";
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem(STORAGE_KEYS.sound, String(soundEnabled));
  updateSoundToggle();
}

function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function playTone(frequency, duration, type = "sine", gainValue = 0.03) {
  if (!soundEnabled) {
    return;
  }

  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = gainValue;
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function playClickSound() {
  playTone(520, 0.05, "square", 0.018);
}

function playWinSound() {
  playTone(784, 0.1, "triangle", 0.04);
  setTimeout(() => playTone(988, 0.12, "triangle", 0.035), 90);
}

function playDrawSound() {
  playTone(220, 0.16, "sine", 0.03);
}

function showSetupScreen() {
  modeScreen.style.display = "block";
  gameCard.style.display = "none";
}

function showGameScreen() {
  modeScreen.style.display = "none";
  gameCard.style.display = "block";
}

function updateSetupSelections() {
  startGameBtn.disabled = !selectedMode;

  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === selectedMode);
  }

  for (const button of sizeButtons) {
    button.classList.toggle("active", Number(button.dataset.boardSize) === selectedBoardSize);
  }
}

function setMode(mode) {
  selectedMode = mode;
  localStorage.setItem(STORAGE_KEYS.mode, mode);
  updateModeBadge();
  updateSetupSelections();
}

function setBoardSize(size) {
  selectedBoardSize = normalizeBoardSize(size);
  localStorage.setItem(STORAGE_KEYS.boardSize, String(selectedBoardSize));
  updateBoardBadge();
  updateSetupSelections();
}

function buildBoardPatterns(size) {
  const patterns = [];

  for (let row = 0; row < size; row += 1) {
    const rowPattern = [];
    for (let col = 0; col < size; col += 1) {
      rowPattern.push(row * size + col);
    }
    patterns.push(rowPattern);
  }

  for (let col = 0; col < size; col += 1) {
    const columnPattern = [];
    for (let row = 0; row < size; row += 1) {
      columnPattern.push(row * size + col);
    }
    patterns.push(columnPattern);
  }

  const mainDiagonal = [];
  const antiDiagonal = [];
  for (let index = 0; index < size; index += 1) {
    mainDiagonal.push(index * size + index);
    antiDiagonal.push(index * size + (size - 1 - index));
  }

  patterns.push(mainDiagonal, antiDiagonal);
  return patterns;
}

function getCellFontSize(size) {
  if (size >= 5) {
    return "1.55rem";
  }

  if (size === 4) {
    return "2rem";
  }

  return "2.8rem";
}

function renderBoard(size = selectedBoardSize) {
  boardRoot.innerHTML = "";
  boardRoot.style.setProperty("--board-size", String(size));
  boardRoot.style.setProperty("--cell-font-size", getCellFontSize(size));
  boardPatterns = buildBoardPatterns(size);
  boardState = Array(size * size).fill("");
  boardCells = [];

  for (let index = 0; index < boardState.length; index += 1) {
    const cellButton = document.createElement("button");
    cellButton.type = "button";
    cellButton.className = "box";
    const row = Math.floor(index / size) + 1;
    const col = (index % size) + 1;
    cellButton.setAttribute("aria-label", `Row ${row}, Column ${col}`);
    cellButton.addEventListener("click", () => handleCellClick(index));
    boardRoot.appendChild(cellButton);
    boardCells.push(cellButton);
  }
}

function clearWinningHighlights() {
  for (const cell of boardCells) {
    cell.classList.remove("winning");
  }
}

function clearBoardVisuals() {
  boardState = Array(boardState.length).fill("");

  for (const cell of boardCells) {
    cell.textContent = "";
    cell.disabled = false;
    cell.classList.remove("winning");
    cell.style.color = "#0f172a";
  }
}

function resetGameState() {
  gameOver = false;
  computerTurnPending = false;

  if (computerMoveTimeoutId !== null) {
    clearTimeout(computerMoveTimeoutId);
    computerMoveTimeoutId = null;
  }

  currentTurn = selectedMode === "pvc" ? "player" : "O";
  winnerBox.innerText = "Not Ended";
  winnerBox.classList.remove("draw-state");
  clearBoardVisuals();
  closeDrawer();
}

function startGame() {
  if (!selectedMode) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.mode, selectedMode);
  localStorage.setItem(STORAGE_KEYS.boardSize, String(selectedBoardSize));
  updateModeBadge();
  updateBoardBadge();
  renderBoard(selectedBoardSize);
  resetGameState();
  showGameScreen();
}

function restartBoard() {
  selectedBoardSize = DEFAULT_BOARD_SIZE;
  localStorage.setItem(STORAGE_KEYS.boardSize, String(selectedBoardSize));
  updateBoardBadge();
  updateSetupSelections();
  resetGameState();
  showSetupScreen();
}

function closeDrawer() {
  gameCard.classList.remove("drawer-open");
}

function toggleDrawer() {
  gameCard.classList.toggle("drawer-open");
}

function highlightWinningPattern(pattern) {
  clearWinningHighlights();
  for (const index of pattern) {
    boardCells[index].classList.add("winning");
  }
}

function isBoardFull() {
  return boardState.every((cell) => cell !== "");
}

function evaluateWinner() {
  for (const pattern of boardPatterns) {
    const firstSymbol = boardState[pattern[0]];
    if (!firstSymbol) {
      continue;
    }

    if (pattern.every((index) => boardState[index] === firstSymbol)) {
      return { symbol: firstSymbol, pattern };
    }
  }

  return null;
}

function getAvailableMoves() {
  const availableMoves = [];
  for (let index = 0; index < boardState.length; index += 1) {
    if (boardState[index] === "") {
      availableMoves.push(index);
    }
  }

  return availableMoves;
}

function canStillWin(symbol) {
  return boardPatterns.some((pattern) => {
    return pattern.every((index) => boardState[index] === "" || boardState[index] === symbol);
  });
}

function shouldEndEarlyAsDraw() {
  return !canStillWin("O") && !canStillWin("X");
}

function findWinningMove(symbol) {
  for (const pattern of boardPatterns) {
    let symbolCount = 0;
    let emptyIndex = null;

    for (const index of pattern) {
      if (boardState[index] === symbol) {
        symbolCount += 1;
      } else if (boardState[index] === "") {
        emptyIndex = index;
      }
    }

    if (symbolCount === selectedBoardSize - 1 && emptyIndex !== null) {
      return emptyIndex;
    }
  }

  return null;
}

function getCenterMoves() {
  if (selectedBoardSize % 2 === 1) {
    const center = Math.floor(selectedBoardSize / 2);
    return [center * selectedBoardSize + center];
  }

  const upper = selectedBoardSize / 2 - 1;
  const lower = selectedBoardSize / 2;
  return [
    upper * selectedBoardSize + upper,
    upper * selectedBoardSize + lower,
    lower * selectedBoardSize + upper,
    lower * selectedBoardSize + lower,
  ];
}

function getCornerMoves() {
  const lastIndex = selectedBoardSize - 1;
  return [0, lastIndex, selectedBoardSize * lastIndex, selectedBoardSize * selectedBoardSize - 1];
}

function getBestComputerMove() {
  const winningMove = findWinningMove("O");
  if (winningMove !== null) {
    return winningMove;
  }

  const blockingMove = findWinningMove("X");
  if (blockingMove !== null) {
    return blockingMove;
  }

  const centerMoves = getCenterMoves().filter((index) => boardState[index] === "");
  if (centerMoves.length) {
    return centerMoves[Math.floor(Math.random() * centerMoves.length)];
  }

  const cornerMoves = getCornerMoves().filter((index) => boardState[index] === "");
  if (cornerMoves.length) {
    return cornerMoves[Math.floor(Math.random() * cornerMoves.length)];
  }

  const availableMoves = getAvailableMoves();
  if (!availableMoves.length) {
    return null;
  }

  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

function applyMove(index, symbol) {
  if (boardState[index] !== "" || gameOver) {
    return false;
  }

  boardState[index] = symbol;
  boardCells[index].textContent = symbol;
  boardCells[index].style.color = symbol === "X" ? "blue" : "red";
  boardCells[index].disabled = true;
  playClickSound();
  return true;
}

function updateStatsDashboard() {
  const activeBucket = selectedMode === "pvc" ? matchStats.pvc : matchStats.pvp;

  if (selectedMode === "pvc") {
    statsLeftLabel.innerText = "Player";
    statsRightLabel.innerText = "Computer";
    statsLeftTotal.innerText = activeBucket.player.wins;
    statsRightTotal.innerText = activeBucket.computer.wins;
    statsDraws.innerText = activeBucket.player.draws;
  } else {
    statsLeftLabel.innerText = "Player O";
    statsRightLabel.innerText = "Player X";
    statsLeftTotal.innerText = activeBucket.O.wins;
    statsRightTotal.innerText = activeBucket.X.wins;
    statsDraws.innerText = activeBucket.O.draws;
  }

  historyCount.innerText = `${matchHistory.length} stored`;
  historyList.innerHTML = "";

  if (!matchHistory.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "history-item";
    emptyItem.innerHTML =
      '<div class="history-main"><span class="history-result">No matches yet</span><span class="history-meta">Play a round to start the history.</span></div>';
    historyList.appendChild(emptyItem);
    return;
  }

  for (const match of matchHistory) {
    const item = document.createElement("li");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-main">
        <span class="history-result">${match.result}</span>
        <span class="history-meta">${match.mode} · ${match.board}</span>
      </div>
      <span class="history-time">${match.time}</span>
    `;
    historyList.appendChild(item);
  }
}

function recordMatch(result, winnerSymbol) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const modeLabel = getModeLabel(selectedMode);
  const boardLabel = getBoardLabel();

  if (selectedMode === "pvc") {
    if (result === "draw") {
      matchStats.pvc.player.draws += 1;
      matchStats.pvc.computer.draws += 1;
    } else if (result === "player") {
      matchStats.pvc.player.wins += 1;
      matchStats.pvc.computer.losses += 1;
    } else if (result === "computer") {
      matchStats.pvc.computer.wins += 1;
      matchStats.pvc.player.losses += 1;
    }
  } else {
    if (result === "draw") {
      matchStats.pvp.O.draws += 1;
      matchStats.pvp.X.draws += 1;
    } else if (winnerSymbol === "O") {
      matchStats.pvp.O.wins += 1;
      matchStats.pvp.X.losses += 1;
    } else if (winnerSymbol === "X") {
      matchStats.pvp.X.wins += 1;
      matchStats.pvp.O.losses += 1;
    }
  }

  const resultLabel =
    result === "draw"
      ? "Draw"
      : selectedMode === "pvc"
        ? `${result === "player" ? "Player" : "Computer"} won`
        : `${winnerSymbol} won`;

  matchHistory.unshift({
    mode: modeLabel,
    board: boardLabel,
    result: resultLabel,
    time,
  });

  matchHistory = matchHistory.slice(0, 10);
  persistState();
  updateStatsDashboard();
}

function endGame(message, winnerSymbol, winningPattern) {
  gameOver = true;
  computerTurnPending = false;

  if (computerMoveTimeoutId !== null) {
    clearTimeout(computerMoveTimeoutId);
    computerMoveTimeoutId = null;
  }

  if (winningPattern) {
    highlightWinningPattern(winningPattern);
  }

  for (const cell of boardCells) {
    cell.disabled = true;
  }

  winnerBox.innerText = message;
  winnerBox.classList.toggle("draw-state", message === "Draw");

  if (message === "Draw") {
    playDrawSound();
    recordMatch("draw");
    return;
  }

  playWinSound();

  if (selectedMode === "pvc") {
    recordMatch(message.includes("Winner is X") ? "player" : "computer");
    return;
  }

  recordMatch("win", winnerSymbol || "");
}

function handlePvPMove(index) {
  if (boardState[index] !== "" || gameOver) {
    return;
  }

  if (!applyMove(index, currentTurn)) {
    return;
  }

  const winningResult = evaluateWinner();
  if (winningResult) {
    endGame(`Winner is ${winningResult.symbol}`, winningResult.symbol, winningResult.pattern);
    return;
  }

  if (shouldEndEarlyAsDraw() || isBoardFull()) {
    endGame("Draw");
    return;
  }

  currentTurn = currentTurn === "O" ? "X" : "O";
}

function makeComputerMove() {
  computerMoveTimeoutId = null;

  if (gameOver) {
    return;
  }

  const moveIndex = getBestComputerMove();
  if (moveIndex === null || boardState[moveIndex] !== "") {
    endGame("Draw");
    return;
  }

  if (!applyMove(moveIndex, "O")) {
    endGame("Draw");
    return;
  }

  const winningResult = evaluateWinner();
  if (winningResult) {
    endGame("Winner is O", "O", winningResult.pattern);
    return;
  }

  if (shouldEndEarlyAsDraw() || isBoardFull()) {
    endGame("Draw");
    return;
  }

  currentTurn = "player";
  computerTurnPending = false;
}

function handlePvCMove(index) {
  if (gameOver || computerTurnPending || currentTurn !== "player" || boardState[index] !== "") {
    return;
  }

  if (!applyMove(index, "X")) {
    return;
  }

  const winningResult = evaluateWinner();
  if (winningResult) {
    endGame("Winner is X", "X", winningResult.pattern);
    return;
  }

  if (shouldEndEarlyAsDraw() || isBoardFull()) {
    endGame("Draw");
    return;
  }

  currentTurn = "computer";
  computerTurnPending = true;
  computerMoveTimeoutId = setTimeout(makeComputerMove, 300);
}

function handleCellClick(index) {
  if (selectedMode === "pvc") {
    handlePvCMove(index);
    return;
  }

  handlePvPMove(index);
}

function openSetup() {
  showSetupScreen();
  updateSetupSelections();
}

function clearScoreboard() {
  matchStats = cloneDefaultStats();
  matchHistory = [];
  persistState();
  updateStatsDashboard();
}

function resetGame() {
  currentTurn = selectedMode === "pvc" ? "player" : "O";
  gameOver = false;
  computerTurnPending = false;

  if (computerMoveTimeoutId !== null) {
    clearTimeout(computerMoveTimeoutId);
    computerMoveTimeoutId = null;
  }

  winnerBox.innerText = "Not Ended";
  winnerBox.classList.remove("draw-state");
  boardState = Array(boardState.length).fill("");
  clearWinningHighlights();

  for (const cell of boardCells) {
    cell.textContent = "";
    cell.disabled = false;
    cell.style.color = "#0f172a";
  }

  closeDrawer();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

sizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setBoardSize(Number(button.dataset.boardSize));
  });
});

startGameBtn.addEventListener("click", startGame);
resetBtn.addEventListener("click", resetGame);
changeModeBtn.addEventListener("click", openSetup);
restartBoardBtn.addEventListener("click", restartBoard);
drawerToggleBtn.addEventListener("click", toggleDrawer);
drawerCloseBtn.addEventListener("click", closeDrawer);
themeToggleBtn.addEventListener("click", () => {
  applyTheme(themePreference === "dark" ? "light" : "dark");
});
soundToggleBtn.addEventListener("click", toggleSound);
clearScoreboardBtn.addEventListener("click", clearScoreboard);

applyTheme(themePreference);
updateSoundToggle();
updateModeBadge();
updateBoardBadge();
updateSetupSelections();
updateStatsDashboard();

if (selectedMode) {
  renderBoard(selectedBoardSize);
  resetGame();
  showGameScreen();
} else {
  showSetupScreen();
}
