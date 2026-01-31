// DOM Elements
const views = {
    lobby: document.getElementById('lobby-view'),
    waiting: document.getElementById('waiting-room-view'),
    game: document.getElementById('game-view')
};

const screens = {
    joinSection: document.querySelector('.join-section'),
    settingsPanel: document.querySelector('.settings-panel')
};

const inputs = {
    playerName: document.getElementById('player-name'),
    joinCode: document.getElementById('join-code'),
    gridSize: document.getElementById('grid-size'),
    difficulty: document.getElementById('difficulty')
};

const elements = {
    grid: document.getElementById('game-grid'),
    targetNumber: document.getElementById('target-number'),
    playersList: document.getElementById('players-container'),
    lobbyCode: document.getElementById('lobby-code-display'),
    lobbySlots: document.getElementById('lobby-player-slots'),
    lobbyQR: document.getElementById('lobby-qr-container')
};

const buttons = {
    createGame: document.getElementById('btn-create'),
    // joinGame removed
    enterGame: document.getElementById('btn-enter'),
    startGame: document.getElementById('btn-start-game'),
    buzzer: document.getElementById('buzzer-btn'),
    // New Back Buttons
    lobbyBack: document.getElementById('btn-lobby-back'),
    gameBack: document.getElementById('btn-game-back')
};

// State
let appState = {
    currentView: 'lobby',
    playerName: '',
    playerId: null, // assigned by firebase
    gameId: null,
    isHost: false,
    gridData: [],
    gridSize: 7,
    difficulty: 'medium',
    target: 0,
    players: {},

    // Gameplay State
    buzzerOwner: null,
    buzzerTimer: null,
    selectedCells: [], // Array of indices
    vetoVotes: {},
    isLocked: false,
    lockedUntil: null
};

// --- View Management ---
function switchView(viewName) {
    appState.currentView = viewName;

    // Hide all views
    Object.values(views).forEach(el => {
        if (el) el.classList.remove('active');
    });

    // Show target view
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
    // Note: Back buttons are now embedded in views, no global toggle needed
}

// --- Persistence Helpers ---
function saveSession() {
    if (appState.gameId && appState.playerId) {
        const session = {
            gameId: appState.gameId,
            playerId: appState.playerId,
            isHost: appState.isHost,
            playerName: appState.playerName
        };
        localStorage.setItem('trio_session', JSON.stringify(session));
    }
}

function clearSession() {
    localStorage.removeItem('trio_session');
}

function checkSession() {
    const sessionStr = localStorage.getItem('trio_session');
    if (sessionStr) {
        try {
            const session = JSON.parse(sessionStr);
            if (session.gameId && session.playerId) {
                console.log("Found previous session:", session);
                // Restore State
                appState.gameId = session.gameId;
                appState.playerId = session.playerId;
                appState.isHost = session.isHost;
                appState.playerName = session.playerName;

                // Attempt Reconnect
                subscribeToGame(appState.gameId);
                // Check if we are playing or waiting?
                // subscribeToGame handles view switch based on 'state'
                // But we default to waiting room initially
                enterWaitingRoom();
                return true;
            }
        } catch (e) {
            console.error("Session parse error", e);
            clearSession();
        }
    }
    return false;
}

// --- Initialization ---
function init() {
    setupEventListeners();

    // Check for Join Code in URL
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');

    // Priority: 1. Join Code, 2. Restoration, 3. Default Lobby
    if (joinCode) {
        // Pre-fill
        inputs.joinCode.value = joinCode;
        // Optional: Focus name
        inputs.playerName.focus();
    } else {
        // Try Restore
        checkSession();
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Create Game
    buttons.createGame.addEventListener('click', () => {
        const name = inputs.playerName.value.trim();
        if (!name) { showMessage('Fehler', 'Bitte gib deinen Namen ein!'); return; }

        createGame(name);
    });

    // Enter Game (Join)
    buttons.enterGame.addEventListener('click', () => {
        const name = inputs.playerName.value.trim();
        const code = inputs.joinCode.value.trim();
        if (!name || !code) { showMessage('Fehler', 'Name und Game-Code sind erforderlich!'); return; }

        joinGame(code, name);
    });

    buttons.startGame.addEventListener('click', startGameAction);
    const refreshBtn = document.getElementById('btn-vote-refresh');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            showConfirm("Zielzahl ändern?", "Möchtest du eine Abstimmung starten?", () => {
                initiateVote();
            });
        };
    }

    buttons.buzzer.addEventListener('click', handleBuzzerClick);

    // Back Button Listeners
    // Re-select to ensure freshness
    const lobbyBack = document.getElementById('btn-lobby-back');
    if (lobbyBack) lobbyBack.addEventListener('click', handleGlobalBack);

    const gameBack = document.getElementById('btn-game-back');
    if (gameBack) gameBack.addEventListener('click', () => {
        showConfirm("Spiel verlassen?", "Möchtest du das Spiel wirklich verlassen?", () => {
            leaveGame();
        });
    });
}

function handleGlobalBack() {
    // If in Game or Waiting -> Leave Game logic
    if (appState.currentView === 'game' || appState.currentView === 'waiting') {
        showConfirm("Spiel verlassen?", "Möchtest du das Spiel wirklich verlassen?", () => {
            leaveGame();
        });
    } else {
        // Default fallback (though usually hidden in lobby)
        location.reload();
    }
}

// --- Custom Modal Helpers ---
function showMessage(title, message) {
    showModal(title, message, null, true);
}

function showConfirm(title, message, onConfirm) {
    showModal(title, message, onConfirm, false);
}

function showModal(title, message, onConfirm, isAlert = false, confirmText = 'OK', cancelText = 'Abbrechen', onCancel = null) {
    const modal = document.getElementById('app-modal');
    const titleEl = document.getElementById('app-modal-title');
    const msgEl = document.getElementById('app-modal-message');
    const confirmBtn = document.getElementById('app-modal-confirm');
    const cancelBtn = document.getElementById('app-modal-cancel');

    titleEl.innerText = title;
    msgEl.innerText = message;

    // Clear old listeners
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    if (isAlert) {
        newCancel.style.display = 'none';
        newConfirm.innerText = confirmText;
        newConfirm.style.width = '100%';
    } else {
        newCancel.style.display = 'block';
        newConfirm.innerText = confirmText;
        newCancel.innerText = cancelText;
        newConfirm.style.width = 'auto';
    }

    newConfirm.onclick = () => {
        modal.classList.remove('active');
        if (onConfirm) onConfirm();
    };

    newCancel.onclick = () => {
        modal.classList.remove('active');
        if (onCancel) onCancel();
    };

    modal.classList.add('active');
}


// --- Firebase Logic ---

function createGame(playerName) {
    const shortId = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit code
    const gameRef = db.ref(`games/${shortId}`);

    gameRef.once('value').then(snapshot => {
        if (snapshot.exists()) {
            // Collision? Retry recursively
            createGame(playerName);
            return;
        }

        appState.playerName = playerName;
        appState.isHost = true;
        appState.difficulty = inputs.difficulty.value;
        appState.gridSize = parseInt(inputs.gridSize.value);
        appState.gameId = shortId;

        // Host Player ID (still needs to be unique inside the game)
        // We can use a simple random string for player ID too since it's local scope
        // But push() is fine for players list.
        const playersRef = gameRef.child('players');
        const hostPlayerRef = playersRef.push();
        appState.playerId = hostPlayerRef.key;

        const gameData = {
            state: 'waiting',
            settings: {
                difficulty: appState.difficulty,
                gridSize: appState.gridSize
            },
            hostId: appState.playerId,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        gameRef.set(gameData).then(() => {
            hostPlayerRef.set({
                name: playerName,
                score: 0,
                status: 'waiting',
                isHost: true
            });

            subscribeToGame(appState.gameId);
            enterWaitingRoom();
            saveSession();

            gameRef.onDisconnect().remove();
        });
    });
}

function joinGame(gameId, playerName) {
    appState.playerName = playerName;
    appState.gameId = gameId;
    appState.isHost = false;

    const gameRef = db.ref(`games/${gameId}`);

    // Check if game exists first
    gameRef.once('value').then(snapshot => {
        if (!snapshot.exists()) {
            showMessage('Fehler', 'Spiel nicht gefunden!');
            return;
        }

        const playerRef = gameRef.child('players').push();
        appState.playerId = playerRef.key;

        playerRef.set({
            name: playerName,
            score: 0,
            status: 'waiting',
            isHost: false
        }).then(() => {
            subscribeToGame(gameId);
            enterWaitingRoom();

            saveSession(); // Save session

            // Auto-remove player if client disconnects
            playerRef.onDisconnect().remove();
        });
    });
}

function enterWaitingRoom() {
    switchView('waiting');

    // UI Updates
    elements.lobbyCode.innerText = appState.gameId;

    // QR Code with Direct Link
    // Construct URL: Current Base + ?join=GAMEID
    const protocol = window.location.protocol;
    const host = window.location.host;
    let path = window.location.pathname;

    // Remove 'index.html' for cleaner URL if present
    if (path.endsWith('index.html')) {
        path = path.substring(0, path.length - 'index.html'.length);
    }
    // Ensure trailing slash
    if (!path.endsWith('/')) {
        path += '/';
    }

    const joinUrl = `${protocol}//${host}${path}?join=${appState.gameId}`;

    console.log("Generating QR for:", joinUrl); // Debug log

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;

    elements.lobbyQR.innerHTML = `
        <img src="${qrUrl}" alt="Game QR Code" style="max-width:200px; width:100%; border:4px solid white; border-radius:8px;" />
    `;

    // Warn if on localhost
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const warnDiv = document.createElement('div');
        warnDiv.style.backgroundColor = '#451a03';
        warnDiv.style.color = '#fbbf24';
        warnDiv.style.padding = '10px';
        warnDiv.style.borderRadius = '8px';
        warnDiv.style.marginTop = '15px';
        warnDiv.style.fontSize = '0.9rem';
        warnDiv.style.lineHeight = '1.4';
        warnDiv.innerHTML = `
            <strong>⚠️ ACHTUNG:</strong><br>
            Du bist auf <code>${hostname}</code>.<br>
            Andere Geräte können diesen QR-Code nicht scannen.<br>
            Bitte öffne die Seite über deine <strong>Netzwerk-IP</strong> (z.B. 192.168.X.X), damit der QR-Code funktioniert.
        `;
        elements.lobbyQR.appendChild(warnDiv);
    }

    if (appState.isHost) {
        buttons.startGame.style.display = 'block';
        document.getElementById('lobby-status-text').style.display = 'none';
    } else {
        buttons.startGame.style.display = 'none';
        document.getElementById('lobby-status-text').style.display = 'block';
        document.getElementById('lobby-status-text').innerText = "Warte auf Host...";
    }

    // Add Leave Button if not exists
    if (!document.getElementById('btn-leave-lobby')) {
        const leaveBtn = document.createElement('button');
        leaveBtn.id = 'btn-leave-lobby';
        leaveBtn.className = 'btn-leave';
        leaveBtn.innerText = 'Lobby verlassen';
        leaveBtn.onclick = () => {
            showConfirm("Lobby verlassen?", "Möchtest du die Lobby verlassen?", () => { leaveGame(); });
        };
        elements.lobbyQR.parentNode.appendChild(leaveBtn);
        // Or append elsewhere? lobby-container seems best.
        // Actually let's put it at the bottom of the container
        document.querySelector('#waiting-room-view .lobby-container').appendChild(leaveBtn);
    }
}

function leaveGame() {
    if (!appState.gameId || !appState.playerId) {
        location.reload();
        return;
    }

    const gameRef = db.ref(`games/${appState.gameId}`);

    if (appState.isHost) {
        // Host leaves -> Delete Game OR just remove host? 
        // User requested: "Logik, die die Spiele automatisch aus firebase löscht, wenn ein spiel verlassen wird"
        // Interpreted as: If everyone leaves OR host leaves (since host owns logic), delete it.
        // Simplest for now: Host leaves = Game Over.
        gameRef.remove();
    } else {
        // Client leaves
        gameRef.child(`players/${appState.playerId}`).remove();
    }

    // Reset local state
    clearSession();
    location.reload();
}

// ... existing code ...

function startGameAction() {
    if (!appState.isHost) return;

    // Generate Grid
    generateGrid(appState.gridSize);
    const solutions = findSolutions(appState.gridData, appState.gridSize, appState.difficulty);

    if (solutions.length === 0) {
        console.warn("Retrying gen...");
        startGameAction();
        return;
    }

    const randomSol = solutions[Math.floor(Math.random() * solutions.length)];
    appState.target = randomSol.result;
    appState.currSolutions = solutions;

    console.log("HOST: Starting action, setting target:", appState.target);

    // Update DB -> Triggers start for everyone
    db.ref(`games/${appState.gameId}`).update({
        grid: appState.gridData,
        target: appState.target,
        state: 'playing'
    }).then(() => console.log("HOST: DB Update Success"))
        .catch(e => console.error("HOST: DB Update Failed", e));
}

// --- Listeners ---

function subscribeToGame(gameId) {
    const gameRef = db.ref(`games/${gameId}`);

    // 1. Status Check (Waiting -> Playing)
    // 1. Status Check (Waiting -> Playing)
    gameRef.on('value', (snapshot) => {
        const data = snapshot.val();

        // Host Disconnected / Game Ended
        // Host Disconnected / Game Ended
        if (!data) {
            if (!appState.isHost) {
                showModal("Spiel beendet", "Der Host hat das Spiel verlassen.", () => {
                    clearSession(); // Prevents restoration loop
                    location.reload();
                }, true);
            }
            return;
        }

        // Settings Sync
        if (data.settings) {
            appState.gridSize = data.settings.gridSize;
            appState.difficulty = data.settings.difficulty;
        }

        let forceRender = false;

        // State Transition
        if (data.state === 'playing' && appState.currentView !== 'game') {
            switchView('game');
            forceRender = true; // Force render since view just appeared
        }

        // Data Sync
        if (data.grid) {
            const strGrid = JSON.stringify(data.grid);
            // If data changed AND/OR we forced a render (e.g. host just started)
            if (strGrid !== JSON.stringify(appState.gridData) || forceRender) {
                appState.gridData = data.grid;
                renderGrid();
            }
        }
        if (data.target) {
            console.log("SYNC: Target update received:", data.target);
            if (appState.target !== data.target || forceRender) {
                appState.target = data.target;
                elements.targetNumber.innerText = appState.target;
                if (appState.isHost) db.ref(`games/${gameId}/veto`).remove();
            }
        }

        // Vote Sync
        if (data.vote) {
            handleVoteUpdate(data.vote, data.players);
        } else {
            // No vote active -> clear UI
            const dv = document.getElementById('vote-dots');
            if (dv) dv.innerHTML = '';
            const vb = document.getElementById('vote-box');
            if (vb) vb.style.display = 'none';
        }

        // Players Sync
        if (data.players) {
            appState.players = data.players;

            renderLobbySlots(data.players);
            renderPlayersList(data.players);

            const myData = data.players[appState.playerId];
            if (myData && myData.lockedUntil) {
                if (myData.lockedUntil > Date.now()) appState.lockedUntil = myData.lockedUntil;
                else appState.lockedUntil = null;
            }
            if (data.veto) updateVetoUI(data.veto, Object.keys(data.players).length);
            if (appState.isHost && data.veto) checkVetoThreshold(data.veto, Object.keys(data.players).length);
        }

        if (appState.isHost && data.attempts) handleAttemptsHost(data.attempts);
    });

    // Buzzer unique listener
    gameRef.child('status').on('value', snap => {
        const status = snap.val();
        if (status && status.buzzerOwner) handleBuzzerOwnerChange(status.buzzerOwner, status.timestamp);
        else resetBuzzerState();
    });
}

// --- Gameplay Logic ---

function handleBuzzerClick() {
    if (!appState.gameId) return;

    // Check Lock
    const now = Date.now();
    if (appState.lockedUntil && now < appState.lockedUntil) {
        const wait = Math.ceil((appState.lockedUntil - now) / 1000);
        showMessage('Gesperrt', `Du bist noch ${wait}s gesperrt!`);
        return;
    }
    if (appState.isLocked && appState.buzzerOwner !== appState.playerId) return;

    // Firebase Transaction to claim buzzer
    const gameRef = db.ref(`games/${appState.gameId}`);

    gameRef.child('status').transaction((currentStatus) => {
        if (!currentStatus || !currentStatus.buzzerOwner) {
            return { buttonOwner: appState.playerId, timestamp: firebase.database.ServerValue.TIMESTAMP, buzzerOwner: appState.playerId };
        }
        return undefined;
    }, (error, committed) => {
        if (committed) console.log('Buzzer claimed!');
    });
}

function handleBuzzerOwnerChange(ownerId, timestamp) {
    appState.buzzerOwner = ownerId;
    const isMe = (ownerId === appState.playerId);

    if (isMe) {
        buttons.buzzer.innerText = "WÄHLE 3 ZAHLEN!";
        buttons.buzzer.classList.add('active-buzzer');
        buttons.buzzer.disabled = false;
        appState.isLocked = false;
    } else {
        const ownerName = appState.players[ownerId]?.name || 'Jemand';
        buttons.buzzer.innerText = `${ownerName} RECHNET...`;
        buttons.buzzer.classList.remove('active-buzzer');
        buttons.buzzer.disabled = true;
        appState.isLocked = true;
    }
}

function resetBuzzerState() {
    appState.buzzerOwner = null;
    appState.isLocked = false;
    appState.selectedCells = [];
    updateGridSelection();

    buttons.buzzer.innerText = "TRIO!";
    buttons.buzzer.classList.remove('active-buzzer');
    buttons.buzzer.disabled = false;

    // Check local lock
    if (appState.lockedUntil && appState.lockedUntil > Date.now()) {
        const wait = Math.ceil((appState.lockedUntil - Date.now()) / 1000);
        buttons.buzzer.innerText = `GESPERRT (${wait}s)`;
        buttons.buzzer.disabled = true;
    }
}

function handleCellClick(e) {
    if (appState.buzzerOwner !== appState.playerId) return;

    const cell = e.target;
    const index = parseInt(cell.dataset.index);
    const existingIdx = appState.selectedCells.indexOf(index);

    if (existingIdx !== -1) {
        appState.selectedCells = appState.selectedCells.filter(i => i !== index);
        updateGridSelection();
        return;
    }

    if (appState.selectedCells.length >= 3) return;

    if (appState.selectedCells.length === 0) {
        appState.selectedCells.push(index);
    } else {
        const lastIdx = appState.selectedCells[appState.selectedCells.length - 1];
        if (isNeighbor(lastIdx, index)) {
            if (appState.selectedCells.length === 2) {
                if (isLinear(appState.selectedCells[0], appState.selectedCells[1], index)) {
                    appState.selectedCells.push(index);
                }
            } else {
                appState.selectedCells.push(index);
            }
        }
    }

    updateGridSelection();

    if (appState.selectedCells.length === 3) {
        openCalculationModal();
    }
}

function isNeighbor(idx1, idx2) {
    const s = appState.gridSize;
    const r1 = Math.floor(idx1 / s), c1 = idx1 % s;
    const r2 = Math.floor(idx2 / s), c2 = idx2 % s;
    return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
}

function isLinear(idx1, idx2, idx3) {
    const s = appState.gridSize;
    const r1 = Math.floor(idx1 / s), c1 = idx1 % s;
    const r2 = Math.floor(idx2 / s), c2 = idx2 % s;
    const r3 = Math.floor(idx3 / s), c3 = idx3 % s;
    const allSameRow = (r1 === r2 && r2 === r3);
    const allSameCol = (c1 === c2 && c2 === c3);
    return allSameRow || allSameCol;
}

function updateGridSelection() {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(c => {
        const idx = parseInt(c.dataset.index);
        c.classList.remove('selected', 'dimmed', 'highlight-neighbor');
        c.style.opacity = '1';

        if (appState.selectedCells.includes(idx)) {
            c.classList.add('selected');
        } else if (appState.selectedCells.length > 0) {
            // Dim check
            const lastIdx = appState.selectedCells[appState.selectedCells.length - 1];
            let isValid = isNeighbor(lastIdx, idx);
            if (appState.selectedCells.length === 2 && isValid) {
                isValid = isLinear(appState.selectedCells[0], appState.selectedCells[1], idx);
            }

            if (isValid && appState.selectedCells.length < 3) {
                c.classList.add('highlight-neighbor');
            } else {
                c.classList.add('dimmed');
                c.style.opacity = '0.4';
            }
        }
    });
}

// --- Calculation Modal ---

let modalState = { formula: '', usedIndices: [] };

function openCalculationModal() {
    const modal = document.getElementById('calc-modal');
    modal.classList.add('active');

    // Ensure styles are visible
    modal.style.display = 'flex'; // Force flex in case class toggle fails with specificity

    const numPad = document.getElementById('modal-numpad');
    numPad.innerHTML = '';
    modalState.formula = '';
    modalState.usedIndices = [];
    updateFormulaDisplay();

    appState.selectedCells.forEach(idx => {
        const num = appState.gridData[idx];
        const btn = document.createElement('button');
        btn.className = 'btn-calc num-btn';
        btn.innerText = num;
        btn.dataset.index = idx;
        btn.onclick = () => handleNumClick(num, idx, btn);
        numPad.appendChild(btn);
    });

    document.getElementById('btn-solve').onclick = submitSolution;
    document.querySelectorAll('.btn-calc.op').forEach(b => {
        b.onclick = () => handleOpClick(b.dataset.op);
    });
    document.getElementById('btn-backspace').onclick = handleBackspace;
    document.getElementById('btn-clear').onclick = () => {
        modalState.formula = ''; modalState.usedIndices = []; updateFormulaDisplay();
        document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('used'));
    };
}

function closeCalculationModal() {
    document.getElementById('calc-modal').classList.remove('active');
    document.getElementById('calc-modal').style.display = '';
    appState.selectedCells = [];
    updateGridSelection();

    // Explicit release if we cancel?
    // User might just close tab. We need penalty on timeout or explict cancel button?
    // For now simple close logic.
}

function handleNumClick(num, idx, btn) {
    if (modalState.usedIndices.includes(idx)) return;
    modalState.formula += num;
    modalState.usedIndices.push(idx);
    btn.classList.add('used');
    updateFormulaDisplay();
}

function handleOpClick(op) { modalState.formula += op; updateFormulaDisplay(); }
function handleBackspace() { modalState.formula = modalState.formula.slice(0, -1); updateFormulaDisplay(); }
function updateFormulaDisplay() { document.getElementById('formula-display').innerText = modalState.formula; }

function submitSolution() {
    if (!modalState.formula) return;
    try { calculateFormula(modalState.formula); } catch (e) { showMessage('Fehler', "Ungültige Formel"); return; }

    const attempt = {
        playerId: appState.playerId,
        indices: appState.selectedCells,
        formula: modalState.formula,
        target: appState.target
    };

    db.ref(`games/${appState.gameId}/attempts`).push(attempt);
    closeCalculationModal();
}

function calculateFormula(str) {
    if (/[^0-9+\-*/().\s]/.test(str)) throw new Error("Invalid chars");
    return Function(`'use strict'; return (${str})`)();
}

function handleAttemptsHost(attemptsDict) {
    // Usually child_added listener handles this. 
    // We attach it once.
}

let attemptsListenerAttached = false;
function attachHostLogic(gameId) {
    if (attemptsListenerAttached) return;
    attemptsListenerAttached = true;
    db.ref(`games/${gameId}/attempts`).on('child_added', snapshot => {
        validateAttempt(snapshot.val(), snapshot.key);
    });
}
// Attach on create
// Modified: We call this if appState.isHost inside subscribe or create
// Let's call it in subscribe loop if isHost and not attached

function validateAttempt(attempt, attemptKey) {
    const gameRef = db.ref(`games/${appState.gameId}`);
    let valid = false;
    try {
        const result = calculateFormula(attempt.formula);
        if (Math.abs(result - attempt.target) < 0.001) valid = true;
    } catch (e) { }

    if (valid) {
        gameRef.child(`players/${attempt.playerId}/score`).transaction(score => (score || 0) + 1);
        gameRef.child('status').set(null);
        // New Target
        startGameAction(); // Re-use generator (generates new target/grid? No just target usually?)
        // Instructions said "Neue Zielzahl". startGameAction regenerates Grid too?
        // Let's split it.
        // Actually for Trio, Grid stays same usually? Prompt didn't specify. 
        // "Wenn >50% Veto... Host Algorithmus neue Zielzahl".
        // Let's imply Grid stays, Target changes.
        generateNewTarget();
    } else {
        const lockTime = Date.now() + 5000;
        gameRef.child(`players/${attempt.playerId}/lockedUntil`).set(lockTime);
        gameRef.child('status').set(null);
    }
    db.ref(`games/${appState.gameId}/attempts/${attemptKey}`).remove();
}

function generateNewTarget() {
    // Only target
    if (!appState.currSolutions || appState.currSolutions.length === 0) {
        // Find solutions if missing
        appState.currSolutions = findSolutions(appState.gridData, appState.gridSize, appState.difficulty);
    }
    const s = appState.currSolutions;
    if (s.length > 0) {
        const t = s[Math.floor(Math.random() * s.length)].result;
        db.ref(`games/${appState.gameId}`).update({ target: t, veto: null });
    } else {
        // No solutions? Regenerate Grid
        startGameAction();
    }
}

// --- Helpers + Renderers (Unified) ---

function updateVetoUI(vetoMap, totalPlayers) {
    let vetoEl = document.getElementById('veto-counter');
    if (!vetoEl) {
        vetoEl = document.createElement('div');
        vetoEl.id = 'veto-counter';
        // Styling...
        if (elements.targetNumber && elements.targetNumber.parentNode)
            elements.targetNumber.parentNode.appendChild(vetoEl);

        const btn = document.createElement('button');
        btn.innerText = "Zielzahl wechseln";
        btn.className = 'btn-secondary';
        btn.style.marginTop = '10px';
        btn.onclick = () => {
            db.ref(`games/${appState.gameId}/veto/${appState.playerId}`).set(true);
        };
        if (elements.targetNumber && elements.targetNumber.parentNode)
            elements.targetNumber.parentNode.appendChild(btn);
    }
    vetoEl.innerText = `${Object.keys(vetoMap).length}/${Math.ceil(totalPlayers / 2) + 1} Stimmen`;
}

function checkVetoThreshold(vetoMap, totalPlayers) {
    if (Object.keys(vetoMap).length > totalPlayers * 0.5) generateNewTarget();
}

function generateGrid(size) {
    const totalCells = size * size;
    appState.gridData = [];
    for (let i = 0; i < totalCells; i++) appState.gridData.push(Math.floor(Math.random() * 20) + 1);
}

function getNumberColor(num) {
    const hue = (num * (360 / 20)) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

function findSolutions(grid, size, difficulty) {
    const solutions = [];
    const addSol = (nums, result) => { if (Number.isInteger(result) && result > 0 && result < 200) solutions.push({ result, nums }); };

    // Simple Loop (Reuse earlier logic)
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size - 2; col++) {
            const idx = row * size + col;
            tryAdd([grid[idx], grid[idx + 1], grid[idx + 2]], difficulty, addSol);
        }
    }
    for (let col = 0; col < size; col++) {
        for (let row = 0; row < size - 2; row++) {
            const idx = row * size + col;
            tryAdd([grid[idx], grid[idx + size], grid[idx + size * 2]], difficulty, addSol);
        }
    }
    return solutions;
}

function tryAdd(triplet, diff, addSol) {
    const [a, b, c] = triplet;
    if (diff === 'easy') { addSol(triplet, a * b + c); addSol(triplet, a * b - c); }
    else {
        // simplified hard/med
        const ops = ['+', '-', '*', '/'];
        // Permutations 
        const perms = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];
        perms.forEach(p => {
            ops.forEach(o1 => ops.forEach(o2 => {
                try { addSol(triplet, eval(`${p[0]}${o1}${p[1]}${o2}${p[2]}`)); } catch (e) { }
            }));
        });
    }
}

function renderLobbySlots(players) {
    const container = document.getElementById('lobby-player-slots');
    if (!container) return; // Safety
    container.innerHTML = '';

    const list = players ? Object.values(players) : [];

    // Update Badge
    const badge = document.getElementById('player-count');
    if (badge) badge.innerText = list.length;

    // Render occupied slots
    list.forEach(p => {
        const slot = document.createElement('div');
        slot.className = 'lobby-slot occupied';
        slot.innerText = p.name;
        if (p.isHost) {
            slot.style.border = '2px solid var(--warning)';
            slot.innerHTML += ' 👑';
        }
        container.appendChild(slot);
    });
}

function renderPlayersList(players) {
    const container = document.getElementById('players-container');
    if (!container) return; // Safety
    container.innerHTML = '';

    const list = players ? Object.values(players) : [];
    list.sort((a, b) => (b.score || 0) - (a.score || 0));

    list.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item';
        if (p.isHost) item.style.borderLeft = "3px solid var(--warning)";

        item.innerHTML = `
            <span>${p.name} ${p.isHost ? '👑' : ''}</span>
            <span class="player-score">${p.score || 0}</span>
        `;
        container.appendChild(item);
    });
}

function renderGrid() {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';

    // Auto Grid Size styling
    grid.style.gridTemplateColumns = `repeat(${appState.gridSize}, 1fr)`;

    appState.gridData.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = index;
        cell.innerText = num;
        cell.onclick = (e) => handleCellClick(e);
        cell.style.color = getNumberColor(num);
        grid.appendChild(cell);
    });
    updateGridSelection();
}

// Start App
document.addEventListener('DOMContentLoaded', init);

// --- VOTING SYSTEM ---

function initiateVote() {
    if (!appState.gameId || !appState.playerId) return;
    const voteRef = db.ref(`games/${appState.gameId}/vote`);

    voteRef.set({
        initiator: appState.playerName,
        timestamp: Date.now(),
        status: 'active',
        votes: {
            [appState.playerId]: 'accept' // Auto-accept by initiator
        }
    });
}

function handleVoteUpdate(voteData, players) {
    const voteBox = document.getElementById('vote-box');
    const dotsContainer = document.getElementById('vote-dots');

    if (!voteData || voteData.status !== 'active') {
        if (voteBox) voteBox.style.display = 'none';
        if (dotsContainer) dotsContainer.innerHTML = '';
        return;
    }

    if (voteBox) voteBox.style.display = 'flex';
    if (dotsContainer) dotsContainer.innerHTML = '';

    // 1. Check if I need to vote
    const myVote = voteData.votes ? voteData.votes[appState.playerId] : null;

    if (!myVote) {
        showModal("Abstimmung", `${voteData.initiator} möchte die Zielzahl mischen.`, () => {
            castVote('accept');
        }, false, "Akzeptieren", "Ablehnen", () => {
            castVote('reject');
        });
    }

    // 2. Render Dots
    if (players && dotsContainer) {
        Object.keys(players).forEach(pid => {
            const dot = document.createElement('div');
            dot.className = 'vote-dot';

            const pVote = voteData.votes ? voteData.votes[pid] : null;
            if (pVote === 'accept') dot.classList.add('accept');
            else if (pVote === 'reject') dot.classList.add('reject');
            else dot.classList.add('pending'); // Add pending class explicitly if needed, or default grey

            dotsContainer.appendChild(dot);
        });
    }

    // 3. Host Logic
    if (appState.isHost) {
        const totalPlayers = Object.keys(players).length;
        const votes = voteData.votes || {};
        const accepts = Object.values(votes).filter(v => v === 'accept').length;
        const rejects = Object.values(votes).filter(v => v === 'reject').length;

        if (rejects > 0) {
            db.ref(`games/${appState.gameId}/vote`).remove();
            showModal("Abgelehnt", "Jemand hat dagegen gestimmt.", null, true);
        } else if (accepts === totalPlayers) {
            db.ref(`games/${appState.gameId}/vote`).remove();
            rerollTarget(); // Changed from startGameAction()
        }
    }
}

function castVote(decision) {
    if (!appState.gameId || !appState.playerId) return;
    db.ref(`games/${appState.gameId}/vote/votes/${appState.playerId}`).set(decision);
}
// --- REROLL LOGIC ---
function rerollTarget() {
    if (!appState.isHost) return;

    // Find solutions for EXISTING grid
    const solutions = findSolutions(appState.gridData, appState.gridSize, appState.difficulty);

    if (solutions.length === 0) {
        console.warn("No solutions for current grid, forced regen.");
        startGameAction();
        return;
    }

    const randomSol = solutions[Math.floor(Math.random() * solutions.length)];
    appState.target = randomSol.result;
    appState.currSolutions = solutions;

    // Force UI Update (Host Sync Fix)
    elements.targetNumber.innerText = appState.target;

    console.log("HOST: Rerolling Target to:", appState.target);

    // Update DB (Target ONLY)
    db.ref(`games/${appState.gameId}`).update({
        target: appState.target
    }).then(() => console.log("HOST: Target Reroll Update Success"))
        .catch(e => console.error("HOST: Target Reroll Update Failed", e));
}
