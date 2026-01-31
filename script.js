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
    difficulty: document.getElementById('difficulty'),
    winningScore: document.getElementById('winning-score'),
    customScore: document.getElementById('custom-score'),
    numberRange: document.getElementById('number-range')
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
    gridSize: 7,
    difficulty: 'medium',
    winningScore: 10,
    target: 0,
    players: {},

    // Gameplay State
    buzzerOwner: null,
    buzzerTimer: null,
    selectedCells: [], // Array of indices (Synced)
    vetoVotes: {},
    isLocked: false,
    lockedUntil: null,
    penaltyInterval: null
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

    // Auto-Save Session on view change if game is active
    if (appState.gameId && appState.playerId) {
        saveSession();
    }
}

// --- Persistence Helpers ---
function saveSession() {
    if (appState.gameId && appState.playerId) {
        const session = {
            gameId: appState.gameId,
            playerId: appState.playerId,
            isHost: appState.isHost,
            isHost: appState.isHost,
            playerName: appState.playerName,
            difficulty: appState.difficulty,
            currentView: appState.currentView
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
                appState.isHost = session.isHost;
                appState.playerName = session.playerName;
                if (session.difficulty) appState.difficulty = session.difficulty;

                console.log("Restoring session:", session);
                subscribeToGame(appState.gameId);

                // Optimistic View Restore
                if (session.currentView) {
                    console.log("Optimistic Switch to:", session.currentView);
                    if (session.currentView === 'game') switchView('game');
                    else if (session.currentView === 'waiting') enterWaitingRoom();
                }

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
    // PWA ENFORCEMENT CHECK
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator.standalone === true);

    // Check if on localhost (allow bypass for dev)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // REMOVE THIS LINE TO ENFORCE EVERYWHERE:
    // if (!isStandalone && !isLocalhost) {

    // User requested "im Internet" -> Enforce strict?
    // "Also im Browser gibt es das Modal... und in der Installierten App funktioniert es."
    // Let's enforce it strictly unless it is specifically prevented. 
    // BUT: I am running on localhost now. If I enforce strict, the user (and I) might get blocked if not "installed".
    // Installing localhost PWA is possible but annoying.
    // I will add a developer bypass check: ?dev=true logic OR just allow localhost.
    // The prompt says "wenn man die App im Internet öffnet". This implies remote access.
    // So excluding localhost is likely what they want implicitly to pass "App im Internet".
    // I'll stick to blocking non-standalone.

    if (!isStandalone) {
        // Show the Trigger Button in Lobby
        const installBtn = document.getElementById('btn-trigger-install');
        if (installBtn) {
            installBtn.style.display = 'block';

            installBtn.addEventListener('click', () => {
                document.getElementById('pwa-install-modal').classList.add('active');

                // Detect OS logic (moved here so it runs when opened)
                const ua = navigator.userAgent || navigator.vendor || window.opera;
                const isTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
                const isIOS = (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) || (ua.includes("Mac") && isTouch);
                const isAndroid = /android/i.test(ua);

                let targetId = 'install-desktop';
                if (isIOS) targetId = 'install-ios';
                else if (isAndroid) targetId = 'install-android';

                document.querySelectorAll('.platform-guide').forEach(el => el.style.display = 'none');
                const guide = document.getElementById(targetId);
                if (guide) guide.style.display = 'block';
            });
        }

        // Close Button Logic
        const closeBtn = document.getElementById('btn-close-install');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent bubbling
                document.getElementById('pwa-install-modal').classList.remove('active');
            });
        }

        // Auto-show removed per user request:
        // document.getElementById('pwa-install-modal').classList.add('active');
    }

    setupEventListeners();

    // Check for Join Code in URL
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');

    // 1. Restore Player Attributes (Name)
    const storedName = localStorage.getItem('trio_player_name');
    if (storedName) {
        inputs.playerName.value = storedName;
    }

    // 2. Restore Game Settings (if available)
    const storedSettings = localStorage.getItem('trio_game_settings');
    if (storedSettings) {
        try {
            const settings = JSON.parse(storedSettings);
            if (settings.difficulty) inputs.difficulty.value = settings.difficulty;
            if (settings.winningScore) inputs.winningScore.value = settings.winningScore;
            if (settings.customScore) inputs.customScore.value = settings.customScore;
            if (settings.numberRange) inputs.numberRange.value = settings.numberRange;

            // Trigger change event to update UI (e.g. custom score field visibility)
            if (settings.winningScore === 'custom') {
                inputs.customScore.style.display = 'block';
            }
        } catch (e) {
            console.error("Error restoring settings", e);
        }
    }

    // Priority: 1. Join Code, 2. Restoration, 3. Default Lobby
    if (joinCode) {
        // Pre-fill
        inputs.joinCode.value = joinCode;

        // Quick Join UI Mode
        const createContainer = document.getElementById('create-container');
        const joinDivider = document.querySelector('.join-section p'); // "ODER"
        const joinInput = document.getElementById('join-code');

        if (createContainer) createContainer.style.display = 'none';
        if (joinDivider) joinDivider.style.display = 'none';
        if (joinInput) joinInput.style.display = 'none';

        // Add specific layout class
        const lobbyContainer = document.querySelector('.lobby-container');
        if (lobbyContainer) lobbyContainer.classList.add('quick-join-mode');

        // Optional: Focus name if empty, else ready
        if (!inputs.playerName.value) {
            inputs.playerName.focus();
        }

        // CLEANUP: Remove query param so reload/back goes to Home
        window.history.replaceState({}, document.title, window.location.pathname);
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

        // Persist Name
        localStorage.setItem('trio_player_name', name);
        // Persist Settings
        const settings = {
            difficulty: inputs.difficulty.value,
            winningScore: inputs.winningScore.value,
            customScore: inputs.customScore.value,
            numberRange: inputs.numberRange ? inputs.numberRange.value : 'base'
        };
        localStorage.setItem('trio_game_settings', JSON.stringify(settings));

        createGame(name);
    });

    // Enter Game (Join)
    buttons.enterGame.addEventListener('click', () => {
        const name = inputs.playerName.value.trim();
        const code = inputs.joinCode.value.trim();
        if (!name || !code) { showMessage('Fehler', 'Name und Game-Code sind erforderlich!'); return; }

        // Persist Name
        localStorage.setItem('trio_player_name', name);

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

    // Winning Score Change Listener
    if (inputs.winningScore) {
        inputs.winningScore.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                inputs.customScore.style.display = 'block';
                inputs.customScore.focus();
            } else {
                inputs.customScore.style.display = 'none';
            }
        });
    }

    // Init QR Scanner
    setupQRScanner();
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
        appState.numberRange = inputs.numberRange ? inputs.numberRange.value : 'base';
        appState.gameId = shortId;

        let wScore = parseInt(inputs.winningScore.value);
        if (inputs.winningScore.value === 'custom') {
            wScore = parseInt(inputs.customScore.value);
        }
        if (!wScore || wScore < 1) wScore = 10; // Fallback
        appState.winningScore = wScore;

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
                gridSize: appState.gridSize,
                difficulty: appState.difficulty,
                gridSize: appState.gridSize,
                winningScore: appState.winningScore,
                numberRange: appState.numberRange || 'base'
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
            // Disabling auto-delete on disconnect to allow Reloads!
            // gameRef.onDisconnect().remove(); 
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
            // Disabling to allow reloads. 
            // playerRef.onDisconnect().remove();
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
    // Generate Grid
    const { grid, solutions } = generateGridData(appState.gridSize);

    if (solutions.length === 0) {
        console.warn("Retrying gen...");
        startGameAction();
        return;
    }

    const randomSol = solutions[Math.floor(Math.random() * solutions.length)];
    appState.target = randomSol.result;
    appState.currSolutions = solutions;

    const gameId = `games/${appState.gameId}`;
    db.ref(gameId).update({
        grid: grid,
        target: appState.target,
        state: 'playing',
        solutions: null,
        currentAttempt: null,
        buzzerOwner: null,
        buzzerTimestamp: null
    }).then(() => console.log("HOST: DB Update Success"))
        .catch(e => console.error("HOST: DB Update Failed", e));
}

// --- Listeners ---

function subscribeToGame(gameId) {
    console.log("Subscribing to game:", gameId);
    const gameRef = db.ref(`games/${gameId}`);

    // 1. Status Check (Waiting -> Playing)
    // 1. Status Check (Waiting -> Playing)
    gameRef.on('value', (snapshot) => {
        const data = snapshot.val();
        console.log("Game Data received:", data);

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
            if (data.settings.winningScore) appState.winningScore = data.settings.winningScore;

            // Update difficulty badge
            const diffEl = document.getElementById('difficulty-display');
            if (diffEl) {
                const map = { normal: 'Normal', advanced: 'Fortgeschritten', pro: 'Profi' };
                diffEl.innerText = map[appState.difficulty] || appState.difficulty;
            }

            // Refresh modal if active (e.g. strict mode buttons)
            // If difficulty changed (or loaded late), we need to update visibility of buttons
            const modal = document.getElementById('calc-modal');
            if (modal && modal.classList.contains('active')) {
                populateModalButtons(true);
            }
        }

        let forceRender = false;

        // State Transition
        if (data.state === 'playing' && appState.currentView !== 'game') {
            switchView('game');
            forceRender = true; // Force render since view just appeared
        } else if (data.state === 'waiting' && appState.currentView !== 'waiting') {
            enterWaitingRoom();
        }

        // Data Sync
        if (data.grid) {
            const strGrid = JSON.stringify(data.grid);
            // If data changed AND/OR we forced a render (e.g. host just started)
            if (strGrid !== JSON.stringify(appState.gridData) || forceRender) {
                appState.gridData = data.grid;
                renderGrid();

                // If Modal is open, we might need to repopulate buttons now that grid is here!
                if (document.getElementById('calc-modal').classList.contains('active')) {
                    populateModalButtons(true);
                }
            }
        }
        if (data.target) {
            console.log("SYNC: Target update received:", data.target);
            if (appState.target !== data.target || forceRender) {
                appState.target = data.target;
                elements.targetNumber.innerText = appState.target;

                // Update Modal Target if open
                const modalTarget = document.getElementById('modal-target-display');
                if (modalTarget) modalTarget.innerText = `Ziel: ${appState.target}`;

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
                if (myData.lockedUntil > Date.now()) {
                    appState.lockedUntil = myData.lockedUntil;
                    startPenaltyCountdown();
                }
                else appState.lockedUntil = null;
            }
            if (data.veto) updateVetoUI(data.veto, Object.keys(data.players).length);
            if (appState.isHost && data.veto) checkVetoThreshold(data.veto, Object.keys(data.players).length);
        }

        if (appState.isHost) {
            attachHostLogic(gameId);
        }

        if (data.winner) {
            handleGameWin(data.winner, data.players);
        }
    });

    // Real-Time Selection Sync
    gameRef.child('status/selection').on('value', snap => {
        const sel = snap.val() || [];
        // Only update if DIFFERENT to avoid jitter if loopback
        if (JSON.stringify(sel) !== JSON.stringify(appState.selectedCells)) {
            appState.selectedCells = sel;
            updateGridSelection();

            // If modal is open but buttons missing (Reload case), repopulate
            const modal = document.getElementById('calc-modal');
            if (modal.classList.contains('active') && sel.length > 0) {
                populateModalButtons(true); // Preserve formula
            }
        }
    });

    // Real-Time Modal Sync
    gameRef.child('status/modal').on('value', snap => {
        const modalState = snap.val();
        if (modalState) {
            // Ensure grid selected cells are ready?
            // If not, we wait for selection sync to trigger repopulate.
            handleModalSync(modalState);
        } else {
            closeCalculationModal(false); // Ensure close if null
        }
    });

    // Result Sync (Popup)
    gameRef.child('status/result').on('value', snap => {
        const res = snap.val();
        if (res && res.timestamp > (Date.now() - 5000)) { // Only recent
            handleResultSync(res);
            // Verify modal closes for everyone?
            // Host logic sets status/modal to false implicitly by clearing status?
            // No, status/modal is separate.
            // We should ensure modal closes.
            closeCalculationModal(false);
        }
    });
    // Buzzer unique listener
    gameRef.child('status').on('value', snap => {
        const status = snap.val();
        if (status && status.buzzerOwner) {
            if (appState.buzzerOwner !== status.buzzerOwner) {
                handleBuzzerOwnerChange(status.buzzerOwner, status.timestamp);
            }
        } else {
            if (appState.buzzerOwner !== null) {
                resetBuzzerState();
            }
        }
    });

    // Real-Time Selection Sync
    gameRef.child('status/selection').on('value', snap => {
        const sel = snap.val() || [];
        // Only update if DIFFERENT to avoid jitter if loopback
        if (JSON.stringify(sel) !== JSON.stringify(appState.selectedCells)) {
            appState.selectedCells = sel;
            updateGridSelection();

            // If modal is open but buttons missing (Reload case), repopulate
            const modal = document.getElementById('calc-modal');
            if (modal.classList.contains('active') && sel.length > 0) {
                populateModalButtons(true); // Preserve formula
            }
        }
    });

}

function setupQRScanner() {
    const scanBtn = document.getElementById('btn-scan-qr');
    const qrModal = document.getElementById('qr-modal');
    const closeQrBtn = document.getElementById('btn-close-qr');
    let html5QrcodeScanner = null;

    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            qrModal.classList.add('active');

            // Init Scanner
            if (!html5QrcodeScanner) {
                html5QrcodeScanner = new Html5Qrcode("reader");
            }

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            // Prefer back camera
            html5QrcodeScanner.start({ facingMode: "environment" }, config, (decodedText, decodedResult) => {
                // SUCCESS
                console.log("Scan success:", decodedText);

                // Handle URL or Code
                let code = decodedText;

                // If URL, extract 'join' param
                try {
                    const url = new URL(decodedText);
                    const joinParam = url.searchParams.get('join');
                    if (joinParam) code = joinParam;
                } catch (e) {
                    // Not a URL, use raw text
                }

                if (code && code.length >= 4) { // Basic validation
                    // Stop scanner
                    html5QrcodeScanner.stop().then(() => {
                        qrModal.classList.remove('active');

                        // Fill input
                        inputs.joinCode.value = code;

                        // Auto-Join if name exists
                        if (inputs.playerName.value.trim()) {
                            joinGame(code, inputs.playerName.value.trim());
                        } else {
                            // Focus name input
                            inputs.playerName.focus();
                        }
                    }).catch(err => console.error(err));
                }

            }, (errorMessage) => {
                // parse error, ignore
            }).catch(err => {
                console.error("Error starting scanner", err);
                alert("Kamera konnte nicht gestartet werden. Bitte Berechtigung prüfen.");
                qrModal.classList.remove('active');
            });
        });
    }

    // Close QR Modal
    if (closeQrBtn) {
        closeQrBtn.addEventListener('click', () => {
            if (html5QrcodeScanner) {
                html5QrcodeScanner.stop().then(() => {
                    qrModal.classList.remove('active');
                }).catch(err => {
                    console.error("Stop failed", err);
                    qrModal.classList.remove('active');
                });
            } else {
                qrModal.classList.remove('active');
            }
        });
    }
}

function handleResultSync(res) {
    const pName = appState.players[res.playerId]?.name || 'Spieler';
    const isMe = (res.playerId === appState.playerId);

    let title, msg;
    if (res.correct) {
        title = "RICHTIG! 🎉";
        msg = `+${res.score} Punkte für ${res.playerName}!`;
        playSound('success');
        startConfetti();
        if (isMe) {
            // My successful attempt
        }
    } else {
        title = "FALSCH! ❌";
        if (isMe) msg = res.reason || "Das war leider falsch! Du bist für 20s gesperrt.";
        else msg = `${res.playerName} hat falsch gerechnet (${res.formula}).`; // Inform others
        playSound('fail');

        // ...
    } // Auto-close after 3s
    showModal(title, msg, null, true, "OK");
    setTimeout(() => {
        const m = document.getElementById('app-modal');
        if (m.classList.contains('active')) m.classList.remove('active');
    }, 3000);
}

function handleGameWin(winnerId, players) {
    const winnerName = players[winnerId]?.name || "Unbekannt";
    const isMe = winnerId === appState.playerId;

    showModal(
        "SPIEL VORBEI! 🏆",
        isMe ? "Glückwunsch! Du hast gewonnen!" : `${winnerName} hat gewonnen!`,
        () => {
            // "OK" action -> Return to lobby? or just close?
            // If Host, maybe reset game?
            if (appState.isHost) {
                // Reset Game
                db.ref(`games/${appState.gameId}`).update({
                    state: 'waiting',
                    winner: null,
                    grid: null, // clear grid
                    target: 0,
                    vote: null
                });
                // Reset scores?
                const updates = {};
                Object.keys(players).forEach(pid => {
                    updates[`players/${pid}/score`] = 0;
                    updates[`players/${pid}/status`] = 'waiting';
                });
                db.ref(`games/${appState.gameId}`).update(updates);
            }
            switchView('lobby'); // Everyone goes back to lobby/waiting room?
            // Actually 'waiting' view is the room.
            enterWaitingRoom();
        },
        false,
        "Zurück zur Lobby",
        "Schließen", // Cancel text
        () => {
            // Just close modal, stay in game view (maybe to chat/see board)
        }
    );



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
        if (committed) {
            console.log('Buzzer claimed!');
            // Initialize Status
            gameRef.child('status').update({
                selection: [],
                modal: { isOpen: false, formula: '' }
            });
        }
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

        // Only start timer if modal is NOT open
        if (!document.getElementById('calc-modal').classList.contains('active')) {
            startSelectionTimer();
        }
    } else {
        const ownerName = appState.players[ownerId]?.name || 'Jemand';
        buttons.buzzer.innerText = `${ownerName} RECHNET...`;
        buttons.buzzer.classList.remove('active-buzzer');
        buttons.buzzer.disabled = true;
        appState.isLocked = true;


        // Clear any local selection timer if it was running (edge case)
        if (appState.selectionTimer) {
            clearInterval(appState.selectionTimer);
            appState.selectionTimer = null;
        }
    }
    updateGridSelection(); // Refresh dimming based on new owner

    // Update Modal Read-Only state if open
    const modal = document.getElementById('calc-modal');
    if (modal.classList.contains('active')) {
        if (isMe) modal.classList.remove('read-only');
        else modal.classList.add('read-only');
    }
}

function startSelectionTimer() {
    if (appState.selectionTimer) clearInterval(appState.selectionTimer);

    let timeLeft = 10;
    updateBuzzerTimerDisplay(timeLeft);

    appState.selectionTimer = setInterval(() => {
        timeLeft--;
        updateBuzzerTimerDisplay(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(appState.selectionTimer);
            handleSelectionTimeout();
        }
    }, 1000);
}

function updateBuzzerTimerDisplay(seconds) {
    if (appState.buzzerOwner === appState.playerId) {
        buttons.buzzer.innerText = `WÄHLE 3 ZAHLEN! (${seconds})`;
    }
}

function handleSelectionTimeout() {
    if (appState.buzzerOwner !== appState.playerId) return;
    showMessage("Zu langsam!", "Du hast nicht rechtzeitig ausgewählt. 20s Sperre!");

    // Apply Penalty Logic locally -> Trigger standard failure path
    // We can reuse the failure part of validateAttempt logic?
    // Or simpler: Push a fail state or just set lockedUntil directly.

    const gameRef = db.ref(`games/${appState.gameId}`);
    const lockTime = Date.now() + 20000;

    // Reset state & Lock
    const updates = {};
    updates[`players/${appState.playerId}/lockedUntil`] = lockTime;
    updates['status'] = null; // Clears buzzer owner
    gameRef.update(updates);
}

function resetBuzzerState() {
    appState.buzzerOwner = null;
    appState.isLocked = false;
    appState.selectedCells = [];
    if (appState.selectionTimer) {
        clearInterval(appState.selectionTimer);
        appState.selectionTimer = null;
    }
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
    // Handle clicking a dimmed cell -> Reset selection to just this cell if valid (removed per new logic)

    // pointer-events: none handles dimming logic usually, but we removed dimming for "others" only.
    // If I am owner, nothing is dimmed.

    const index = parseInt(cell.dataset.index);
    const existingIdx = appState.selectedCells.indexOf(index);
    let newSelection = [...appState.selectedCells];

    // Toggle logic
    if (existingIdx !== -1) {
        newSelection = newSelection.filter(i => i !== index);
    } else {
        if (newSelection.length >= 3) {
            flashInvalidCell(cell);
            return;
        }

        // Add tentatively and validate
        newSelection.push(index);

        if (validateSelection(newSelection)) {
            // Valid
        } else {
            flashInvalidCell(cell);
            return;
        }
    }

    updateSelection(newSelection);
}

function validateSelection(indices) {
    if (indices.length <= 1) return true;

    const s = appState.gridSize;
    // 1. Sort geographically (Row then Col) to ensure vectors are consistent
    const coords = indices.map(idx => {
        return { r: Math.floor(idx / s), c: idx % s };
    }).sort((a, b) => (a.r - b.r) || (a.c - b.c));

    // 2. Check Vector Consistency
    // Get Vector P1 -> P2
    const dr1 = coords[1].r - coords[0].r;
    const dc1 = coords[1].c - coords[0].c;

    // Valid Directions:
    // (0, 1), (1, 0), (1, 1), (1, -1)  <- Standard Neighbors (Dist 1)
    // (0, 2), (2, 0), (2, 2), (2, -2)  <- Skip 1 (Dist 2)
    // Basic check: |dr| == |dc| OR dr==0 OR dc==0

    if (Math.abs(dr1) !== Math.abs(dc1) && dr1 !== 0 && dc1 !== 0) return false; // Not linear/diagonal
    if (Math.max(Math.abs(dr1), Math.abs(dc1)) > 2) return false; // Gap too big (> 1 skipped)

    if (indices.length === 3) {
        // Get Vector P2 -> P3
        const dr2 = coords[2].r - coords[1].r;
        const dc2 = coords[2].c - coords[1].c;

        // Vectors MUST be identical for equidistance and collinearity
        if (dr1 !== dr2 || dc1 !== dc2) return false;
    }

    return true;
}

function flashInvalidCell(cell) {
    cell.classList.add('invalid-flash');
    setTimeout(() => cell.classList.remove('invalid-flash'), 400);
}




function updateSelection(newSel) {
    db.ref(`games/${appState.gameId}/status/selection`).set(newSel);

    if (newSel.length === 3) {
        // Auto-open modal if we are the owner
        openCalculationModal();
    }
}



function updateGridSelection() {
    const cells = document.querySelectorAll('.grid-cell');
    const hasOwner = appState.buzzerOwner !== null;
    const isOwner = (appState.buzzerOwner === appState.playerId);

    cells.forEach(c => {
        const idx = parseInt(c.dataset.index);
        c.classList.remove('selected', 'selected-border', 'dimmed', 'highlight-possible');
        c.style.filter = '';

        if (hasOwner) {
            if (appState.selectedCells.includes(idx)) {
                c.classList.add('selected-border');
            } else {
                if (!isOwner) {
                    c.classList.add('dimmed');
                }
            }
        }
    });
}    // --- Calculation Modal ---

let modalState = { formula: '', usedIndices: [] };

function handleModalSync(remoteState) {
    const modal = document.getElementById('calc-modal');
    const wasActive = modal.classList.contains('active');

    // 1. Open/Close State
    if (remoteState.isOpen) {
        modal.classList.add('active');
        modal.style.display = 'flex';

        // Show Target
        const targetEl = document.getElementById('modal-target-display');
        if (targetEl) targetEl.innerText = `Ziel: ${appState.target}`;

        // Check local owner vs observer
        // Check local owner vs observer
        // Use appState.buzzerOwner directly. Note: on reload it might be null initially.
        // If null, we default to read-only.
        const headerOwner = appState.buzzerOwner;
        const isOwner = (headerOwner === appState.playerId);

        if (isOwner) {
            modal.classList.remove('read-only');
        } else {
            modal.classList.add('read-only');
            // Only populate if just opened to avoid wiping formula or rebuilding DOM constantly
            if (!wasActive) {
                // Initial open or reload
                populateModalButtons(true);
            } else {
                // If it was active, maybe just update?
                // But if we reload, wasActive is false.
            }
        }

        // 2. Formula Sync
        if (remoteState.formula !== undefined) {
            modalState.formula = remoteState.formula;
            updateFormulaDisplay();
        }

        // 3. Used Indices Sync
        if (remoteState.usedIndices) {
            modalState.usedIndices = remoteState.usedIndices || [];
            // Update Visuals
            const numPad = document.getElementById('modal-numpad');
            if (numPad) {
                Array.from(numPad.children).forEach(btn => {
                    const idx = parseInt(btn.dataset.index);
                    if (modalState.usedIndices.includes(idx)) btn.classList.add('used');
                    else btn.classList.remove('used');
                });
            }
        }

    } else {
        closeCalculationModal(false); // Local close without push
    }
}

function openCalculationModal() {
    // Only owner calls this via updateSelection(3)
    if (appState.buzzerOwner !== appState.playerId) return;

    // Clear Selection Timer
    if (appState.selectionTimer) {
        clearInterval(appState.selectionTimer);
        appState.selectionTimer = null;
    }

    db.ref(`games/${appState.gameId}/status/modal`).set({
        isOpen: true,
        formula: '',
        usedIndices: []
    });

    populateModalButtons(); // Owner resets formula initially
}

function populateModalButtons(preserveFormula = false) {
    // Safety Check: Grid must be loaded
    if (!appState.gridData || appState.gridData.length === 0) {
        console.warn("populateModalButtons: Grid not ready, skipping.");
        return;
    }

    const numPad = document.getElementById('modal-numpad');
    numPad.innerHTML = '';

    if (!preserveFormula) {
        modalState.formula = '';
        modalState.usedIndices = [];
        modalState.usedIndices = [];
        modalState.history = []; // Clear history
    } else {
        // Attempt to reconstruct history from formula string for validation context
        // This is a naive reconstruction: If last char is digit, assume last was 'num'.
        // If last char is op, assume last was 'op'.
        // This is enough for "No Double Operator" and "No Double Number" checks.
        if (!modalState.history) modalState.history = [];
        if (modalState.formula.length > 0) {
            const lastChar = modalState.formula.slice(-1);
            const isDigit = /[0-9]/.test(lastChar);
            // Push a dummy history item to set context
            // We don't need full idx since we can't easily map back, but 'type' is what matters.
            modalState.history.push({
                type: isDigit ? 'num' : 'op',
                idx: -1,
                dummy: true
            });
        }
    }
    // If preserving, we keep formula but we might need to recalc usedIndices?
    // Actually formula string doesn't tell us used indicies easily unless we parse.
    // But for Reload, we get formula from Remote, but usedIndices??
    // We can't easily reconstruct usedIndices from formula string alone (e.g. if two 3s exist).
    // STRICT MODE: We probably need to sync usedIndices to firebase too if we want perfect resume.
    // For now: If preserving (Reload), we assume usedIndices is empty or best effort.
    // BUT: If usedIndices is empty, buttons won't be grayed out!
    // The user said "numbers disappear".
    // Let's at least show the numbers.
    updateFormulaDisplay();

    appState.selectedCells.forEach(idx => {
        const num = appState.gridData[idx];
        const btn = document.createElement('button');
        btn.className = 'btn-calc num-btn';
        btn.innerText = num;
        btn.dataset.index = idx;

        // Restore used class for persistence
        if (modalState.usedIndices.includes(idx)) {
            btn.classList.add('used');
        }

        btn.onclick = () => handleNumClick(num, idx, btn);
        numPad.appendChild(btn);
    });

    // Attach listeners only once or re-attach safely?
    // They are global IDs. Re-attaching is fine.
    document.getElementById('btn-solve').onclick = submitSolution;
    document.querySelectorAll('.btn-calc.op').forEach(b => {
        b.onclick = () => handleOpClick(b.dataset.op, b);

        // Difficulty Check for Visibility
        // Fallback: If appState.difficulty is null (reload race condition), check DOM or default to normal?
        let currentDiff = appState.difficulty;
        if (!currentDiff && inputs.difficulty) {
            currentDiff = inputs.difficulty.value || 'normal';
        }

        if (currentDiff === 'normal') {
            if (b.dataset.op === '/' || b.dataset.op === '(' || b.dataset.op === ')') {
                b.style.display = 'none';
            } else {
                b.style.display = '';
            }
        } else if (currentDiff === 'advanced') {
            if (b.dataset.op === '*' || b.dataset.op === '(' || b.dataset.op === ')') {
                b.style.display = 'none';
            } else {
                b.style.display = '';
            }
        } else {
            b.style.display = '';
        }

        // Restore used class for operators
        if (['+', '-', '*', '/'].includes(b.dataset.op) && modalState.formula.includes(b.dataset.op)) {
            b.classList.add('used');
        } else {
            b.classList.remove('used');
        }
    });
    document.getElementById('btn-clear').onclick = handleClear;
}

function closeCalculationModal(push = true) {
    document.getElementById('calc-modal').classList.remove('active');
    document.getElementById('calc-modal').style.display = '';

    if (push && appState.gameId && appState.buzzerOwner === appState.playerId) {
        db.ref(`games/${appState.gameId}/status/modal`).set({ isOpen: false });
        // Reset selection too
        updateSelection([]);
        // Reset buzzer? No, buzzer reset happens on correct/penalty.
        // If they just close check penalty logic?? 
        // For now assumes submit is the way out.
    }
}

function updateRemoteFormula() {
    if (appState.buzzerOwner === appState.playerId) {
        db.ref(`games/${appState.gameId}/status/modal`).update({
            formula: modalState.formula,
            usedIndices: modalState.usedIndices
        });
    }
}





function handleNumClick(num, idx, btn) {
    if (appState.buzzerOwner !== appState.playerId) return;
    if (modalState.usedIndices.includes(idx)) return;

    const prev = modalState.formula;

    // Check consecutive numbers restriction
    // If last char is a digit or ends with number, prevent.
    // Actually we deal with multichar numbers? No, digits are single.
    // BUT user said "2 numbers consecutive". 19 is consecutive. 1 9.
    // Do we allow 19? The request says "never 2 numbers consecutive without operator".
    // This implies we cannot form multi-digit numbers?
    // "1-9" is single digit. "1-20" is double digit.
    // But these are TILES. The tiles are treated as atomic numbers.
    // So "19" is one tile. "5" is one tile.
    // The issue is clicking "5" then "3" -> "53".
    // We want to force "5 + 3".
    // So if the last inputs was a 'num' type in history, prevent.
    if (modalState.history && modalState.history.length > 0) {
        const last = modalState.history[modalState.history.length - 1];
        if (last.type === 'num') {
            if (btn) flashInvalidElement(btn);
            return; // Block consecutive numbers
        }
    }

    if (!modalState.history) modalState.history = [];
    modalState.history.push({ type: 'num', idx: idx, prevFormula: prev });

    modalState.formula += num;
    modalState.usedIndices.push(idx);
    btn.classList.add('used');

    updateRemoteFormula();
    updateFormulaDisplay();
}

function handleOpClick(op, btn) {
    if (appState.buzzerOwner !== appState.playerId) return;

    const prev = modalState.formula;

    // RULE: Start with Number validations (handled by history check)
    // If first input, MUST be a number?
    if (!modalState.history || modalState.history.length === 0) {
        if (op !== '(') {
            if (btn) flashInvalidElement(btn);
            return;
        }
    }

    // --- VALIDATION & FEEDBACK LOGIC ---

    // Helper to flash existing operator in display
    const flashExistingOp = (opsToFind) => {
        const spans = document.getElementById('formula-display').querySelectorAll('.char-op');
        spans.forEach(span => {
            if (opsToFind.includes(span.dataset.char)) {
                flashInvalidElement(span);
            }
        });
    };

    const hasPlus = modalState.formula.includes('+');
    const hasMinus = modalState.formula.includes('-');
    const hasMult = modalState.formula.includes('*');
    const hasDiv = modalState.formula.includes('/');

    // 1. Line Operator Conflict (+/-)
    if (['+', '-'].includes(op)) {
        if (hasPlus || hasMinus) {
            if (btn) flashInvalidElement(btn);
            flashExistingOp(['+', '-']);
            return;
        }
    }

    // 2. Point Operator Conflict (* or /) - Validation depends on Difficulty
    if (['*', '/'].includes(op)) {
        // In Normal/Advanced, only ONE point op is allowed usually?
        // Normal: (A * B) +/- C.  One *.
        // Advanced: (A / B) +/- C. One /.
        // Profi: Mixed. One Point, One Line. So One Point max.
        // So in ALL modes, max 1 Point op is a safe rule based on game design?
        // Let's assume yes: "never 2 operationszeichen" implies structure limit?
        // Actually, the user prompts specifically asked for "Kombination von */: mit +/-".
        // This implicitly limits to one of each pair type for Profi too.

        if (hasMult || hasDiv) {
            if (btn) flashInvalidElement(btn);
            flashExistingOp(['*', '/']);
            return;
        }
    }

    // 3. Consecutive Operators (except parens)
    if (modalState.history && modalState.history.length > 0) {
        const last = modalState.history[modalState.history.length - 1];
        if (last.type === 'op' && ['+', '-', '*', '/'].includes(last.op) && ['+', '-', '*', '/'].includes(op)) {
            if (btn) flashInvalidElement(btn);
            return;
        }
    }

    // History Update
    if (!modalState.history) modalState.history = [];
    modalState.history.push({ type: 'op', prevFormula: prev, op: op });

    modalState.formula += op;

    // Visual Feedback (mark used if single-use logic applies, which it does for ops in this game)
    if (btn && ['+', '-', '*', '/'].includes(op)) {
        btn.classList.add('used');
    }

    updateRemoteFormula();
    updateFormulaDisplay();
}

function flashInvalidElement(el) {
    el.style.border = "2px solid red";
    el.style.animation = "shake 0.3s";
    setTimeout(() => {
        el.style.border = "";
        el.style.animation = "";
    }, 400);
}



function handleClear() {
    if (appState.buzzerOwner !== appState.playerId) return;
    modalState.formula = '';
    modalState.usedIndices = [];
    modalState.history = [];
    document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('used'));
    document.querySelectorAll('.btn-calc.op').forEach(b => b.classList.remove('used'));

    updateRemoteFormula();
    updateFormulaDisplay();
}

function updateFormulaDisplay() {
    const container = document.getElementById('formula-display');
    container.innerHTML = ''; // Clear current

    // Parse formula into tokens for granular display
    // Tokens: Numbers (sequences of digits), Operators, Parens
    // Regex: Split by boundaries but keep delimiters. 
    // Actually, we can just iterate chars if we want char-level control, 
    // OR we can tokenize properly. 
    // For "12 + 5", we want "12", " ", "+", " ", "5".
    // But since we built it char by char, maybe we treat each char as a span?
    // "12" is visually one block usually. But flashing "1" and "2" separately is fine.
    // However, for operators like "+", it is a single char.
    // Let's do CHAR based for simplicity and max control.

    const chars = modalState.formula.split('');
    chars.forEach((char, index) => {
        const span = document.createElement('span');

        let displayChar = char;
        if (char === '*') displayChar = '·';
        if (char === '/') displayChar = ':';

        span.innerText = displayChar;
        span.dataset.char = char; // Store real value
        span.dataset.index = index;

        // Styling classes
        if (['+', '-', '*', '/'].includes(char)) span.className = 'char-op';
        else if (['(', ')'].includes(char)) span.className = 'char-paren';
        else if (/[0-9]/.test(char)) span.className = 'char-num';
        else span.className = 'char-other';

        container.appendChild(span);
    });
}


function submitSolution() {
    if (!modalState.formula) return;

    // Profi Mode Validation: STRICT Parentheses Check
    if (appState.difficulty === 'pro') {
        const formula = modalState.formula;
        const hasOpen = formula.includes('(');
        const hasClose = formula.includes(')');

        if (!hasOpen || !hasClose) {
            // Flash Solve Button
            const solveBtn = document.getElementById('btn-solve');
            flashInvalidElement(solveBtn);

            // Flash Parentheses Buttons
            const openBtn = document.querySelector('.btn-calc.op[data-op="("]');
            const closeBtn = document.querySelector('.btn-calc.op[data-op=")"]');
            if (openBtn) flashInvalidElement(openBtn);
            if (closeBtn) flashInvalidElement(closeBtn);

            return;
        }

        // Rule: Line operation (+/-) must be INSIDE parentheses.
        // Inverse: Point operation (* or /) inside parentheses is invalid.
        // We need to extract the content inside outermost parens (assuming simple nesting for now, logic supports single level anyway)
        // Find indices of parens. 
        // Note: Currently generated logic is simple structure, so first ( and last ) or first ( and matching ).
        // A regexp like /\(([^)]+)\)/ can extract inner content.

        const match = formula.match(/\(([^)]+)\)/);
        if (match) {
            const innerContent = match[1];
            // Check if inner content contains * or /
            if (innerContent.includes('*') || innerContent.includes('/')) {
                // FAIL
                const solveBtn = document.getElementById('btn-solve');
                flashInvalidElement(solveBtn);

                const openBtn = document.querySelector('.btn-calc.op[data-op="("]');
                const closeBtn = document.querySelector('.btn-calc.op[data-op=")"]');
                if (openBtn) flashInvalidElement(openBtn);
                if (closeBtn) flashInvalidElement(closeBtn);

                // Flash the Point Operator in Display
                const spans = document.getElementById('formula-display').querySelectorAll('.char-op');
                spans.forEach(span => {
                    // Check if this span is inside parens? 
                    // Simple check: Check if its char is * or / AND it's "inside".
                    // Since we know the rule failed, any * or / inside IS the problem.
                    // We can check span.dataset.index vs paren indices.
                    // Let's rely on dataset.char for now, but to be precise we need indices.
                    const idx = parseInt(span.dataset.index);
                    const openIdx = formula.indexOf('(');
                    const closeIdx = formula.indexOf(')'); // First matching close for simple logic

                    if (idx > openIdx && idx < closeIdx) {
                        if (['*', '/'].includes(span.dataset.char)) {
                            flashInvalidElement(span);
                        }
                    }
                });
                return;
            }
        }
    }

    try { calculateFormula(modalState.formula); } catch (e) { showMessage('Fehler', "Ungültige Formel"); return; }

    const attempt = {
        playerId: appState.playerId,
        playerName: appState.selfName || 'Spieler',
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

function calculateScore(attempt) {
    // Basic score is 1 point per solution
    return 1;
}

function validateAttempt(attempt, attemptKey) {
    const gameRef = db.ref(`games/${appState.gameId}`);
    let valid = false;
    let structureValid = true;
    let failReason = null;
    let result = null;

    try {
        result = calculateFormula(attempt.formula);

        // Special Validation for Normal Mode
        console.log("Validating Attempt. Difficulty:", appState.difficulty);
        if (appState.difficulty === 'normal') {
            // Check for valid structure: Exact one * and one +/-
            const f = attempt.formula;
            const countMult = (f.match(/\*/g) || []).length;
            const countPlus = (f.match(/\+/g) || []).length;
            const countMinus = (f.match(/-/g) || []).length;

            if (countMult !== 1) {
                structureValid = false;
                failReason = "Es muss genau eine Mal-Rechnung enthalten sein!";
            }
            if (countPlus + countMinus !== 1) {
                structureValid = false;
                if (!failReason) failReason = "Es muss genau eine Plus- oder Minus-Rechnung enthalten sein!";
            }

            // Structure Check: A*B+C, A*B-C, C+A*B
            // The prompt says "Structure is given: (A*B) +/- C". 
            // In linear input without parens (since parens hidden):
            // We allow: A*B+C, A*B-C, C+A*B.
            // We disallow: -C+A*B (leading sign), A+B+C (already filtered by op counts), etc.

            // Regex to match "Start with Mult" OR "End with Mult"
            // Simple Pattern: term * term +/- term   OR   term +/- term * term
            // Terms are numbers.
            // Since we know we have exactly one * and one +/-:
            // Valid forms:
            // N * N + N
            // N * N - N
            // N + N * N
            // N - N * N (allowed? "C - A * B" -> 10 - 2*3 = 4.  (A*B)+/-C allows subtraction FROM C? "Zwei davon multiplizieren und die dritte addieren oder subtrahieren" -> (A*B) - C or (A*B) + C. 
            // The prompt says: "(Zahl A · Zahl B) ± Zahl C". This usually implies the term (A*B) is the primary unit.
            // (A*B) - C is clear. 4*5 - 2 = 18.
            // (A*B) + C is clear. 4*5 + 2 = 22.
            // What about C - (A*B)? "20 - 4*2".  (A*B) is being subtracted.
            // Prompt says: "Zwischenergebnis und dritte Zahl verrechnen".
            // "Zwei davon multiplizieren und die dritte addieren oder subtrahieren."
            // This phrasing "multiply two, and ADD OR SUBTRACT the third". 
            // Grammatically: Result = (A*B) +/- C. 
            // Does not explicitly allow C - (A*B). 
            // Let's STICK to the requested formula: (A*B) +/- C.
            // So allowed: A*B+C, C+A*B, A*B-C.

            // Checking logic:
            // 1. Is there a leading minus? (Disallow)
            if (f.trim().startsWith('-')) structureValid = false;

            // 2. Locate the minus.
            // If minus exists:
            // Valid: "N*N - N".  Invalid: "N - N*N".
            // "4*5-2". Minus index > Multiply index? Yes.
            // "2-4*5". Minus index < Multiply index.
            if (countMinus === 1) {
                const idxMinus = f.indexOf('-');
                const idxMult = f.indexOf('*');
                if (idxMinus < idxMult) {
                    // This is C - A*B (minus comes before mult). Reject.
                    // Exception: A * B - C -> mult before minus. OK.
                    structureValid = false;
                    failReason = "Ungültige Struktur! Multiplikation muss vor Subtraktion erfolgen (oder A*B - C).";
                }
            }
        } else if (appState.difficulty === 'advanced') {
            // Check for valid structure: Exact one / and one +/-
            const f = attempt.formula;
            const countDiv = (f.match(/\//g) || []).length;
            const countPlus = (f.match(/\+/g) || []).length;
            const countMinus = (f.match(/-/g) || []).length;

            if (countDiv !== 1) {
                structureValid = false;
                failReason = "Es muss genau eine Geteilt-Rechnung enthalten sein!";
            }
            if (countPlus + countMinus !== 1) {
                structureValid = false;
                if (!failReason) failReason = "Es muss genau eine Plus- oder Minus-Rechnung enthalten sein!";
            }

            // Structure Check: A/B+C, A/B-C, C+A/B
            if (f.trim().startsWith('-')) structureValid = false;

            if (countMinus === 1) {
                const idxMinus = f.indexOf('-');
                const idxDiv = f.indexOf('/');
                if (idxMinus < idxDiv) {
                    structureValid = false;
                    failReason = "Ungültige Struktur! Division muss vor Subtraktion erfolgen (oder (A/B) - C).";
                }
            }
        } else if (appState.difficulty === 'pro') {
            // Profi: Must have ( AND ) AND (* OR /) AND (+ OR -)
            const f = attempt.formula;
            if (!f.includes('(') || !f.includes(')')) {
                structureValid = false;
                failReason = "Es müssen Klammern verwendet werden!";
            } else {
                const hasMultDiv = f.includes('*') || f.includes('/');
                const hasPlusMinus = f.includes('+') || f.includes('-');
                if (!hasMultDiv || !hasPlusMinus) {
                    structureValid = false;
                    failReason = "Es müssen Strich- UND Punktrechnung (mit Klammern) enthalten sein!";
                }
            }
        }

        if (Math.abs(result - attempt.target) < 0.001 && structureValid) valid = true;
    } catch (e) { }

    if (!structureValid && !failReason) {
        if (appState.difficulty === 'normal') {
            if ((attempt.formula.match(/\*/g) || []).length !== 1) failReason = "Es muss genau eine Mal-Rechnung enthalten sein!";
            else failReason = "Es muss genau eine Plus- oder Minus-Rechnung enthalten sein!";
        } else if (appState.difficulty === 'advanced') {
            if ((attempt.formula.match(/\//g) || []).length !== 1) failReason = "Es muss genau eine Geteilt-Rechnung enthalten sein!";
            else failReason = "Es muss genau eine Plus- oder Minus-Rechnung enthalten sein!";
        } else if (appState.difficulty === 'pro') {
            failReason = "Ungültige Struktur für Profi-Modus.";
        }
    }

    const resultData = {
        correct: valid,
        score: valid ? calculateScore(attempt) : 0,
        playerId: attempt.playerId,
        playerName: attempt.playerName || 'Unbekannt',
        target: attempt.target,
        formula: attempt.formula,
        result: result,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        reason: valid ? null : (failReason || "Das Ergebnis ist leider falsch.")
    };

    // ... rest of function ...

    if (valid) {
        gameRef.child(`players/${attempt.playerId}/score`).transaction(score => {
            return (score || 0) + 1;
        }, (error, committed, snapshot) => {
            if (committed) {
                const newScore = snapshot.val();
                if (appState.winningScore && newScore >= appState.winningScore) {
                    gameRef.update({
                        state: 'finished',
                        winner: attempt.playerId
                    });
                }
            }
        });

        gameRef.child('status').set(null);
        // New Target
        startGameAction();
        generateNewTarget();
    } else {
        const lockTime = Date.now() + 20000; // 20s Penalty
        gameRef.child(`players/${attempt.playerId}/lockedUntil`).set(lockTime);
        gameRef.child('status').set(null);
    }

    // Result Feedback
    // Result Feedback
    // resultData is already defined above with 'reason'.
    // We just need to ensure properties match or update the reference.
    // The previous definition:
    /*
    const resultData = {
        correct: valid,
        score: valid ? calculateScore(attempt) : 0,
        playerId: attempt.playerId,
        playerName: attempt.playerName,
        target: attempt.target,
        formula: attempt.formula,
        reason: valid ? null : (failReason || "Das Ergebnis ist leider falsch.")
    };
    */
    // The duplicate below (lines 1495-1501) adds "result: result" and "timestamp".
    // We should merge them or just use the first one and add missing props.
    // Let's modify the first one to include result/timestamp and remove this block.

    gameRef.child('status/result').set(resultData);

    db.ref(`games/${appState.gameId}/attempts/${attemptKey}`).remove();
}

function startPenaltyCountdown() {
    if (appState.penaltyInterval) clearInterval(appState.penaltyInterval);
    if (!appState.lockedUntil || appState.lockedUntil <= Date.now()) {
        appState.lockedUntil = null;
        // Reset button text if not buzzer owner
        if (appState.buzzerOwner === null) {
            buttons.buzzer.innerText = "TRIO!";
            buttons.buzzer.disabled = false;
        }
        return;
    }

    buttons.buzzer.disabled = true;
    appState.penaltyInterval = setInterval(() => {
        const remaining = Math.ceil((appState.lockedUntil - Date.now()) / 1000);
        if (remaining <= 0) {
            clearInterval(appState.penaltyInterval);
            appState.lockedUntil = null;
            if (appState.buzzerOwner === null) {
                buttons.buzzer.innerText = "TRIO!";
                buttons.buzzer.disabled = false;
            } else {
                // If someone else is owner, let the owner listener handle text
            }
        } else {
            buttons.buzzer.innerText = `GESPERRT (${remaining}s)`;
        }
    }, 1000);

    // Initial immediate update
    const remaining = Math.ceil((appState.lockedUntil - Date.now()) / 1000);
    buttons.buzzer.innerText = `GESPERRT (${remaining}s)`;
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

function generateGridData(size) {
    const totalCells = size * size;
    let max = 9;
    let min = 1;
    let maxTarget = 50;

    // Range Logic
    // Default to base if unspeicified or 'base'
    if (appState.numberRange === 'extended') {
        max = 19; // "1-19"
        maxTarget = 100; // "Zielzahl 100"
    } else {
        // base
        max = 9; // "1-9"
        maxTarget = 50; // "Zielzahl bis 50"
    }

    const newGrid = [];
    for (let i = 0; i < size * size; i++) {
        let num = Math.floor(Math.random() * (max - min + 1)) + min;
        newGrid.push(num);
    }

    const solutions = findSolutions(newGrid, size, appState.difficulty, maxTarget);

    // --- Validation Analysis ---
    const possibleSet = new Set(solutions.map(s => s.result));
    const impossible = [];
    for (let i = 1; i <= maxTarget; i++) {
        if (!possibleSet.has(i)) impossible.push(i);
    }
    console.group(`🎲 Analyse für Modus: ${appState.difficulty.toUpperCase()}`);
    console.log(`Zahlenraum: 1 bis ${maxTarget}`);
    console.log(`Anzahl Lösungen: ${solutions.length}`);
    if (impossible.length > 0) {
        console.log(`🚫 Unmögliche Zielzahlen (${impossible.length}):`, impossible.join(', '));
    } else {
        console.log("✅ Alle Zahlen im Bereich sind möglich!");
    }
    console.groupEnd();
    // ---------------------------

    return { grid: newGrid, solutions };
}

function getNumberColor(num) {
    // Use Golden Angle (approx 137.5 degrees) to maximize contrast between sequential numbers
    // Base Hue shift helps avoid too many reds/pinks if starting at 0
    const hue = (num * 137.508) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

function findSolutions(grid, size, difficulty, maxTarget = 50) {
    const solutions = [];
    const addSol = (nums, result) => { if (Number.isInteger(result) && result > 0 && result <= maxTarget) solutions.push({ result, nums }); };

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

    // Diagonal TL-BR
    for (let row = 0; row < size - 2; row++) {
        for (let col = 0; col < size - 2; col++) {
            const idx = row * size + col;
            // idx, idx+(s+1), idx+2*(s+1)
            tryAdd([grid[idx], grid[idx + size + 1], grid[idx + 2 * (size + 1)]], difficulty, addSol);
        }
    }

    // Diagonal TR-BL
    for (let row = 0; row < size - 2; row++) {
        for (let col = 2; col < size; col++) {
            const idx = row * size + col;
            // idx, idx+(s-1), idx+2*(s-1)
            tryAdd([grid[idx], grid[idx + size - 1], grid[idx + 2 * (size - 1)]], difficulty, addSol);
        }
    }
    return solutions;
}

function tryAdd(triplet, diff, addSol) {
    const [a, b, c] = triplet;
    if (diff === 'normal') {
        // Normal: (A * B) +/- C (Target structure, but we try permutations because user picks 3 numbers)
        // User selects 3 numbers. We need to see if ANY combination of them fits (A*B)+/-C
        // Permutations: [a,b,c], [a,c,b], [b,a,c], ...
        const perms = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];

        perms.forEach(p => {
            // (p0 * p1) + p2
            addSol(triplet, (p[0] * p[1]) + p[2]);
            // (p0 * p1) - p2
            addSol(triplet, (p[0] * p[1]) - p[2]);
        });
    } else if (diff === 'advanced') {
        // Advanced: (A / B) +/- C
        const perms = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];

        perms.forEach(p => {
            // (p0 / p1) + p2
            addSol(triplet, (p[0] / p[1]) + p[2]);
            // (p0 / p1) - p2
            addSol(triplet, (p[0] / p[1]) - p[2]);
        });
    } else {
        // Profi: Full Permutations
        // STRICT RULE: Line Operation (+/-) MUST be in parentheses. Point Operation (*//) MUST be outside.
        // Allowed: (A +/- B) * C   or   (A +/- B) / C
        // Allowed: A * (B +/- C)   or   A / (B +/- C)
        // Disallowed: (A * B) + C  (Point in parens)

        const ops = ['+', '-', '*', '/'];
        const perms = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];

        perms.forEach(p => {
            ops.forEach(o1 => ops.forEach(o2 => {
                const isLine1 = ['+', '-'].includes(o1);
                const isPoint1 = ['*', '/'].includes(o1);
                const isLine2 = ['+', '-'].includes(o2);
                const isPoint2 = ['*', '/'].includes(o2);

                // Structure 1: (p0 o1 p1) o2 p2
                // We assume parentheses are around the FIRST operation (o1).
                // So o1 MUST be Line, o2 MUST be Point.
                if (isLine1 && isPoint2) {
                    try {
                        const res1 = eval(`(${p[0]}${o1}${p[1]})${o2}${p[2]}`);
                        addSol(triplet, res1);
                    } catch (e) { }
                }

                // Structure 2: p0 o1 (p1 o2 p2)
                // We assume parentheses are around the SECOND operation (o2).
                // So o2 MUST be Line, o1 MUST be Point.
                if (isPoint1 && isLine2) {
                    try {
                        const res2 = eval(`${p[0]}${o1}(${p[1]}${o2}${p[2]})`);
                        addSol(triplet, res2);
                    } catch (e) { }
                }
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

    // Calculate Ranks (Dense ranking)
    // 10, 8, 8, 5 -> Rank 1, 2, 2, 3
    let currentRank = 1;
    let lastScore = list.length > 0 ? (list[0].score || 0) : -1;

    list.forEach((p, index) => {
        const pScore = p.score || 0;
        if (pScore < lastScore) {
            currentRank++; // Move to next rank if score is lower
            lastScore = pScore;
        } else if (index > 0 && pScore === lastScore) {
            // Same rank as previous, do nothing to currentRank
        } else {
            // First item, rank is 1
        }

        /* 
           However, "Standard Competition Ranking" (1224) vs "Dense" (1223).
           User: "2. platzierten... 3. platzierten".
           Let's use Dense for visuals so both 2nd places get Silver.
        */

        let rankIcon = '';
        if (currentRank === 1) rankIcon = '👑';
        else if (currentRank === 2) rankIcon = '🥈';
        else if (currentRank === 3) rankIcon = '🥉';

        const item = document.createElement('div');
        item.className = 'player-item';

        // Host gets yellow border
        if (p.isHost) item.style.borderLeft = "3px solid var(--warning)";

        item.innerHTML = `
            <span>${p.name} ${rankIcon}</span>
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
        cell.style.backgroundColor = getNumberColor(num);
        cell.style.color = 'white';
        // Add text shadow for better readability
        cell.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
        grid.appendChild(cell);
    });
    updateGridSelection();
}

// Start App
// Sound Effect Stub
function playSound(type) {
    // console.log("Playing sound:", type);
    // Placeholder for actual sound logic
    // e.g. new Audio('assets/sounds/' + type + '.mp3').play();
}

function startConfetti() {
    // console.log("Confetti!");
    // Placeholder for confetti animation
}

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

    if (!voteData || (voteData.status !== 'active' && voteData.status !== 'rejected')) {
        if (voteBox) voteBox.style.display = 'none';
        if (dotsContainer) dotsContainer.innerHTML = '';
        return;
    }

    if (voteBox) voteBox.style.display = 'flex';
    if (dotsContainer) dotsContainer.innerHTML = '';

    // 1. Check if I need to vote
    const myVote = voteData.votes ? voteData.votes[appState.playerId] : null;
    const voteBtn = document.getElementById('btn-cast-vote');

    if (voteData.status === 'rejected') {
        if (voteBtn) voteBtn.style.display = 'none';
    } else if (!myVote) {
        // Show Button instead of auto-popup
        if (voteBtn) {
            voteBtn.style.display = 'block';
            voteBtn.onclick = () => {
                showModal("Abstimmung", `${voteData.initiator} möchte die Zielzahl mischen.`, () => {
                    castVote('accept');
                }, false, "Akzeptieren", "Ablehnen", () => {
                    castVote('reject');
                });
            };
        }
    } else {
        if (voteBtn) voteBtn.style.display = 'none';
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
            // Rejection: Set status to rejected (shows red dot) and wait
            if (voteData.status !== 'rejected') {
                db.ref(`games/${appState.gameId}/vote/status`).set('rejected');
                setTimeout(() => {
                    db.ref(`games/${appState.gameId}/vote`).remove();
                }, 2000);
            }
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
