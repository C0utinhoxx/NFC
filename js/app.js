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
    currentCharger: null,
    activeSession: null,
    chargeStartBalance: null,
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
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    showScreen('screen-auth');
}

function showRegisterScreen() {
    document.getElementById('auth-form').style.display = 'none';
    document.getElementById('auth-register-form').style.display = 'block';
    document.getElementById('register-error').classList.remove('active');
    document.getElementById('register-loading').classList.remove('active');
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-phone').value = '';
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

function applyAuthenticatedUser(user) {
    state.currentUser = user;
    state.isAuthenticated = true;
    state.walletBalance = Number(user.balance || 0);
}

async function refreshWalletFromServer() {
    try {
        const wallet = await GoodWeAPI.getWallet();
        state.walletBalance = Number(wallet.balance || 0);
        if (state.currentUser) {
            state.currentUser.balance = state.walletBalance;
            state.currentUser.points = wallet.points;
        }
        updateWalletDisplay();
    } catch (err) {
        console.warn('Não foi possível atualizar a carteira:', err.message);
    }
}

async function handleLogin() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!email || !password) {
        document.getElementById('auth-error').textContent = 'Preencha todos os campos';
        document.getElementById('auth-error').classList.add('active');
        return;
    }

    document.getElementById('auth-error').classList.remove('active');
    document.getElementById('auth-loading').classList.add('active');

    try {
        const user = await GoodWeAPI.login(email, password);
        applyAuthenticatedUser(user);
        document.getElementById('auth-loading').classList.remove('active');
        showReadyScreen();
    } catch (err) {
        document.getElementById('auth-loading').classList.remove('active');
        document.getElementById('auth-error').textContent = err.message;
        document.getElementById('auth-error').classList.add('active');
    }
}

async function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    if (!name || !email || !phone || !password) {
        document.getElementById('register-error').textContent = 'Preencha todos os campos';
        document.getElementById('register-error').classList.add('active');
        return;
    }

    document.getElementById('register-error').classList.remove('active');
    document.getElementById('register-loading').classList.add('active');

    try {
        const user = await GoodWeAPI.register(name, email, phone, password);
        applyAuthenticatedUser(user);
        document.getElementById('register-loading').classList.remove('active');
        document.getElementById('reg-success').style.display = 'block';
        setTimeout(() => {
            showReadyScreen();
        }, 1200);
    } catch (err) {
        document.getElementById('register-loading').classList.remove('active');
        document.getElementById('register-error').textContent = err.message;
        document.getElementById('register-error').classList.add('active');
    }
}

async function handleLogout() {
    await GoodWeAPI.logout();
    state.currentUser = null;
    state.isAuthenticated = false;
    state.walletBalance = WALLET_BALANCE;
    resetAll();
}

function startCharging() {
    showChargeTypeScreen();
}

function simulateNFCTap() {
    showNFCTapOverlay();
    setTimeout(async () => {
        hideNFCTapOverlay();
        state.batteryCurrent = Math.floor(Math.random() * 60) + 20;

        if (GoodWeAPI.isAuthenticated()) {
            try {
                const user = await GoodWeAPI.me();
                applyAuthenticatedUser(user);
                showReadyScreen();
                return;
            } catch (err) {
                clearAuthToken();
            }
        }

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
    loadKioskCharger();
    setInterval(loadKioskCharger, 15000);
});

async function loadKioskCharger() {
    try {
        const chargers = await GoodWeAPI.listChargers();
        if (!chargers || chargers.length === 0) return;

        let charger = state.currentCharger
            ? chargers.find(c => c.id === state.currentCharger.id)
            : null;

        if (!charger) {
            charger = chargers.find(c => c.is_available) || chargers[0];
        }

        state.currentCharger = charger;
        renderKioskCharger(charger);
    } catch (err) {
        console.warn('Não foi possível sincronizar o carregador:', err.message);
    }
}

function renderKioskCharger(charger) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText('kiosk-charger-name', charger.name);
    setText('kiosk-charger-id', charger.id);
    setText('kiosk-type', charger.power_kw + ' kW');
    setText('kiosk-connector', charger.connector);
    setText('kiosk-status-label', charger.is_available ? 'Disponível' : 'Ocupado');

    const badge = document.getElementById('kiosk-status-badge');
    const btnNfc = document.querySelector('.nfc-tap-btn');
    const btnStart = document.getElementById('btn-start-charge');

    if (badge) badge.classList.toggle('unavailable', !charger.is_available);

    const lockedByOther = !charger.is_available && !state.activeSession;
    [btnNfc, btnStart].forEach(btn => {
        if (!btn) return;
        btn.disabled = lockedByOther;
        btn.style.opacity = lockedByOther ? '0.5' : '';
        btn.style.pointerEvents = lockedByOther ? 'none' : '';
    });
}

window.showScreen = showScreen;
window.showAuthScreen = showAuthScreen;
window.showRegisterScreen = showRegisterScreen;
window.showChargeTypeScreen = showChargeTypeScreen;
window.startCharging = startCharging;
window.simulateNFCTap = simulateNFCTap;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.refreshWalletFromServer = refreshWalletFromServer;
window.state = state;
window.TARIFF = TARIFF;
window.WALLET_BALANCE = WALLET_BALANCE;
window.BATTERY_CAPACITY = BATTERY_CAPACITY;