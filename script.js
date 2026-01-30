// DOM Elements
const views = {
    lobby: document.getElementById('lobby-view'),
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

const buttons = {
    createGame: document.getElementById('btn-create'),
    joinGame: document.getElementById('btn-join'),
    enterGame: document.getElementById('btn-enter'),
    buzzer: document.getElementById('buzzer-btn')
};

// State
let appState = {
    currentView: 'lobby',
    playerName: '',
    gameId: null,
    isHost: false
};

// Constants
const TARGET_GRID_SIZE = 7;

// --- Initialization ---
function init() {
    setupEventListeners();
    renderGrid(7); // Default mock grid
}

// --- Event Listeners ---
function setupEventListeners() {
    // Buttons
    buttons.createGame.addEventListener('click', () => {
        const name = inputs.playerName.value.trim();
        if (!name) {
            alert('Bitte gib deinen Namen ein!');
            return;
        }
        appState.playerName = name;
        appState.isHost = true;
        // Logic to setup game would go here

        // Settings are visible by default in HTML for simplicity per instructions "Wenn man erstellt, soll man Settings wählen können"
        // For now, we simulate "Creating" simply by toggling view
        switchView('game');
    });

    buttons.enterGame.addEventListener('click', () => {
        const name = inputs.playerName.value.trim();
        const code = inputs.joinCode.value.trim();
        if (!name || !code) {
            alert('Name und Game-Code sind erforderlich!');
            return;
        }
        appState.playerName = name;
        appState.isHost = false;
        // Join logic would go here
        switchView('game');
    });

    // Toggle Join Input visibility for better UI
    buttons.joinGame.addEventListener('click', () => {
        // Simple toggle or scroll to join section
        // For now, let's assume 'joinGame' in the prompt was the trigger to show the code input
        // But the prompts says: "Start screen has buttons 'Create' and 'Join'".
        // We will make sure the Join section is clear.
        document.getElementById('join-container').style.display = 'block';
        document.getElementById('create-container').style.display = 'none';
    });

    // Back to "Menu" logic if we need it (not requested but nice)
}

// --- View Switching ---
function switchView(viewName) {
    if (!views[viewName]) return;

    // Hide all
    Object.values(views).forEach(el => {
        el.classList.remove('active');
        // setTimeout to allow transition if we want to add display:none logic correctly handled by CSS
    });

    // Show target
    views[viewName].classList.add('active');
    appState.currentView = viewName;
}

// --- Game Logic Mockups ---
function renderGrid(size) {
    const gridEl = document.getElementById('game-grid');
    gridEl.innerHTML = '';

    // update CSS grid propery
    gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    const totalCells = size * size;
    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.innerText = Math.floor(Math.random() * 20) + 1; // Random numbers 1-20
        cell.dataset.index = i;
        cell.addEventListener('click', handleCellClick);
        gridEl.appendChild(cell);
    }
}

function handleCellClick(e) {
    const cell = e.target;
    // Toggle selection visual
    cell.classList.toggle('selected');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
