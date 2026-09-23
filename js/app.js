const MOCK_USERS = [
    { username: 'teste', password: '1234', name: 'Usuário Teste' },
    { username: 'joao', password: '1234', name: 'João Silva' },
    { username: 'maria', password: '5678', name: 'Maria Santos' },
];

const TARIFF = 1.90;
const WALLET_BALANCE = 100.00;
const BATTERY_CAPACITY = 50;

const state = {
    currentUser: null,
    isAuthenticated: false,
    currentScreen: 'screen-charger',
    chargeType: null,
    chargeValue: null,
    chargePercent: null,
    chargeMode: null,
    estimatedCost: null,
    targetPercent: null,
    batteryCurrent: 30,
    walletBalance: WALLET_BALANCE,
    selectedCharger: null,
    seconds: 0,
    kwh: 0,
    percent: 0,
    chargingInterval: null,
    isFullChargeConfirmed: false,
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
    updateWalletDisplay();
    showScreen('screen-ready');
}

function showChargeTypeScreen() {
    state.chargeType = null;
    state.isFullChargeConfirmed = false;
    state.chargePercent = null;
    state.chargeValue = null;
    state.chargeMode = null;
    state.estimatedCost = null;
    state.targetPercent = null;
    document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('type-detail').classList.remove('active');
    document.getElementById('btn-confirm-type').style.display = 'none';
    showScreen('screen-type');
}

function updateWalletDisplay() {
    const walletEl = document.getElementById('wallet-balance');
    if (walletEl) {
        walletEl.textContent = 'R$ ' + state.walletBalance.toFixed(2).replace('.', ',');
    }
    const walletCard = document.getElementById('wallet-card');
    if (walletCard) {
        const canCharge = state.walletBalance > 0;
        walletCard.style.borderColor = canCharge ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
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
    const batteryFill = document.getElementById('battery-fill');
    const batteryText = document.getElementById('battery-text');
    if (batteryFill) batteryFill.style.width = current + '%';
    if (batteryText) batteryText.textContent = current + '%';
}

function resetChargeState() {
    state.chargeType = null;
    state.chargeValue = null;
    state.chargePercent = null;
    state.chargeMode = null;
    state.estimatedCost = null;
    state.targetPercent = null;
    state.seconds = 0;
    state.kwh = 0;
    state.percent = 0;
    if (state.chargingInterval) clearInterval(state.chargingInterval);
    state.chargingInterval = null;
    state.isFullChargeConfirmed = false;
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

function startCharging() {
    showChargeTypeScreen();
}

function simulateNFCTap() {
    showNFCTapOverlay();
    setTimeout(() => {
        hideNFCTapOverlay();
        state.batteryCurrent = Math.floor(Math.random() * 60) + 20;
        state.walletBalance = WALLET_BALANCE;
        showAuthScreen();
    }, 2000);
}

function initBgParallax() {
    const layer = document.getElementById('bg-parallax');
    if (!layer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let raf = null;

    function animate() {
        currentX += (targetX - currentX) * 0.06;
        currentY += (targetY - currentY) * 0.06;
        layer.style.transform = 'rotateY(' + currentX.toFixed(3) + 'deg) rotateX(' + currentY.toFixed(3) + 'deg)';
        if (Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01) {
            raf = requestAnimationFrame(animate);
        } else {
            raf = null;
        }
    }

    function onMove(e) {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        targetX = x * 6;
        targetY = -y * 4;
        if (!raf) raf = requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null || e.beta == null) return;
        targetX = Math.max(-8, Math.min(8, e.gamma * 0.3));
        targetY = Math.max(-6, Math.min(6, (e.beta - 45) * 0.2));
        if (!raf) raf = requestAnimationFrame(animate);
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initMap === 'function') initMap();
    if (typeof initNFCListener === 'function') initNFCListener();
    initBgParallax();
    updateWalletDisplay();
});

window.showScreen = showScreen;
window.showAuthScreen = showAuthScreen;
window.showRegisterScreen = showRegisterScreen;
window.showChargeTypeScreen = showChargeTypeScreen;
window.startCharging = startCharging;
window.simulateNFCTap = simulateNFCTap;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.state = state;
window.TARIFF = TARIFF;
window.WALLET_BALANCE = WALLET_BALANCE;
window.BATTERY_CAPACITY = BATTERY_CAPACITY;