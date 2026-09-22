const MOCK_USERS = [
    { username: 'teste', password: '1234', name: 'Usuário Teste' },
    { username: 'joao', password: '1234', name: 'João Silva' },
    { username: 'maria', password: '5678', name: 'Maria Santos' },
];

const TARIFF = 1.90;

const state = {
    currentUser: null,
    isAuthenticated: false,
    currentScreen: 'screen-charger',
    chargeType: null,
    chargeValue: null,
    chargePercent: null,
    batteryCurrent: 30,
    seconds: 0,
    percent: 0,
    chargingInterval: null,
};

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
    state.currentScreen = id;
    if (id === 'screen-charger' && typeof map !== 'undefined' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

function showAuthScreen() {
    document.getElementById('auth-form').style.display = 'block';
    document.getElementById('auth-register-form').style.display = 'none';
    document.getElementById('auth-error').classList.remove('active');
    document.getElementById('auth-loading').classList.remove('active');
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    showScreen('screen-auth');
}

function showRegisterScreen() {
    document.getElementById('auth-form').style.display = 'none';
    document.getElementById('auth-register-form').style.display = 'block';
    document.getElementById('register-error').classList.remove('active');
    document.getElementById('register-loading').classList.remove('active');
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-name').value = '';
    showScreen('screen-auth');
}

function showReadyScreen() {
    updateRouteSummary();
    updateBatteryDisplay();
    showScreen('screen-ready');
}

function showChargeTypeScreen() {
    state.chargeType = null;
    document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('type-detail').classList.remove('active');
    document.getElementById('btn-confirm-type').style.display = 'none';
    showScreen('screen-type');
}

async function mockValidateUser(username, password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const user = MOCK_USERS.find(u => u.username === username && u.password === password);
            if (user) resolve(user);
            else reject('Usuário ou senha inválidos');
        }, 800);
    });
}

async function mockRegisterUser(name, username, password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (MOCK_USERS.find(u => u.username === username)) {
                reject('Usuário já cadastrado');
            } else {
                const newUser = { name, username, password };
                MOCK_USERS.push(newUser);
                resolve(newUser);
            }
        }, 800);
    });
}

async function handleLogin() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || !password) {
        document.getElementById('auth-error').textContent = 'Preencha todos os campos';
        document.getElementById('auth-error').classList.add('active');
        return;
    }

    document.getElementById('auth-error').classList.remove('active');
    document.getElementById('auth-loading').classList.add('active');

    try {
        const user = await mockValidateUser(username, password);
        state.currentUser = user;
        state.isAuthenticated = true;
        document.getElementById('auth-loading').classList.remove('active');
        showReadyScreen();
    } catch (err) {
        document.getElementById('auth-loading').classList.remove('active');
        document.getElementById('auth-error').textContent = err;
        document.getElementById('auth-error').classList.add('active');
    }
}

async function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    if (!name || !username || !password) {
        document.getElementById('register-error').textContent = 'Preencha todos os campos';
        document.getElementById('register-error').classList.add('active');
        return;
    }

    document.getElementById('register-error').classList.remove('active');
    document.getElementById('register-loading').classList.add('active');

    try {
        await mockRegisterUser(name, username, password);
        document.getElementById('register-loading').classList.remove('active');
        document.getElementById('reg-success').style.display = 'block';
        setTimeout(() => {
            showAuthScreen();
        }, 1500);
    } catch (err) {
        document.getElementById('register-loading').classList.remove('active');
        document.getElementById('register-error').textContent = err;
        document.getElementById('register-error').classList.add('active');
    }
}

function updateRouteSummary() {
    const chargerName = state.selectedCharger ? state.selectedCharger.name : 'Carregador';
    const distance = state.selectedCharger ? state.selectedCharger.distance : 0;
    const timeEst = Math.ceil(distance * 3);
    document.getElementById('route-charger-name').textContent = chargerName;
    document.getElementById('route-distance').textContent = distance < 1
        ? (distance * 1000).toFixed(0) + ' m'
        : distance.toFixed(1) + ' km';
    document.getElementById('route-time').textContent = '~' + timeEst + ' min';
    document.getElementById('route-tariff').textContent = 'R$ ' + TARIFF.toFixed(2) + '/kWh';
}

function updateBatteryDisplay() {
    const current = state.batteryCurrent;
    document.getElementById('battery-fill').style.width = current + '%';
    document.getElementById('battery-text').textContent = current + '%';
}

function resetChargeState() {
    state.chargeType = null;
    state.chargeValue = null;
    state.chargePercent = null;
    state.seconds = 0;
    state.percent = 0;
    if (state.chargingInterval) clearInterval(state.chargingInterval);
    state.chargingInterval = null;
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initMap === 'function') initMap();
    if (typeof initNFCListener === 'function') initNFCListener();
});

window.showScreen = showScreen;
window.showAuthScreen = showAuthScreen;
window.showRegisterScreen = showRegisterScreen;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.state = state;
window.TARIFF = TARIFF;
