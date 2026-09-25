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
    points: 0,
    selectedCouponId: null,
    chargeDiscount: 0,
    chargeFinalCost: null,
    chargeTotalKwh: null,
    chargePaymentMethod: 'wallet',
    selectedCharger: null,
    currentCharger: null,
    activeSession: null,
    chargeStartBalance: null,
    seconds: 0,
    kwh: 0,
    percent: 0,
    chargingInterval: null,
    isFullChargeConfirmed: false,
    apiMode: 'unknown',
};

function selectedRadioValue(name, fallback) {
    const selected = document.querySelector('input[name="' + name + '"]:checked');
    return selected ? selected.value : fallback;
}

function syncPointsForCurrentUser(points) {
    if (!state.currentUser) return;
    Loyalty.setPoints(state.currentUser.id, Number(points || 0));
    state.points = Number(points || 0);
    state.currentUser.points = state.points;
}

function updateApiEnvironmentBadge(detail) {
    const text = document.getElementById('api-environment-text');
    const dot = document.getElementById('api-environment-dot');
    if (!text || !dot) return;

    const mode = detail && detail.mode ? detail.mode : 'unknown';
    if (mode === 'real') {
        text.textContent = 'Servidor Online';
        dot.className = 'api-env-dot real';
    } else if (mode === 'simulation') {
        text.textContent = 'Modo Simulacao';
        dot.className = 'api-env-dot simulation';
    } else {
        text.textContent = 'Conectando...';
        dot.className = 'api-env-dot unknown';
    }
    state.apiMode = mode;
}

function initPaymentMethodSelectors() {
    const paymentGroups = ['deposit-payment-method', 'charge-payment-method'];
    paymentGroups.forEach(groupName => {
        document.querySelectorAll('input[name="' + groupName + '"]').forEach(input => {
            input.addEventListener('change', () => {
                document.querySelectorAll('input[name="' + groupName + '"]').forEach(item => {
                    const wrapper = item.closest('.payment-method-option');
                    if (!wrapper) return;
                    wrapper.classList.toggle('selected', item.checked);
                });
            });
        });
    });
}

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
    state.selectedCouponId = null;
    state.chargeDiscount = 0;
    state.chargeFinalCost = null;
    state.chargeTotalKwh = null;
    state.chargePaymentMethod = 'wallet';
    document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('type-detail').classList.remove('active');
    document.getElementById('btn-confirm-type').style.display = 'none';
    showScreen('screen-type');
}

function updateWalletDisplay() {
    const walletEl = document.getElementById('wallet-balance');
    if (walletEl) {
        walletEl.textContent = 'R$ ' + Number(state.walletBalance || 0).toFixed(2).replace('.', ',');
    }
    const pointsEl = document.getElementById('wallet-screen-points');
    if (pointsEl) pointsEl.textContent = formatPoints(state.points);
    const balanceEl = document.getElementById('wallet-screen-balance');
    if (balanceEl) balanceEl.textContent = 'R$ ' + Number(state.walletBalance || 0).toFixed(2).replace('.', ',');
    const walletCard = document.getElementById('wallet-card');
    if (walletCard) {
        const canCharge = state.walletBalance > 0;
        walletCard.style.borderColor = canCharge ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    }
}

function formatPoints(points) {
    return Number(points || 0).toFixed(2).replace('.', ',') + ' pontos';
}

function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showWalletScreen() {
    if (!state.isAuthenticated) {
        showAuthScreen();
        return;
    }
    renderWalletScreen();
    showScreen('screen-wallet');
}

function renderWalletScreen() {
    const data = Loyalty.getData();
    state.points = Number(data.points || 0);
    updateWalletDisplay();
    renderBenefits();
    renderCoupons();
    renderPointsHistory();
    renderManagerSummary();
}

function renderBenefits() {
    const container = document.getElementById('benefits-list');
    if (!container) return;
    const points = state.points;
    container.innerHTML = LOYALTY_BENEFITS.map(benefit => {
        const available = points >= benefit.points_cost;
        const missing = Math.max(0, benefit.points_cost - points);
        return `<div class="benefit-item">
            <div class="benefit-info">
                <div class="benefit-title">${benefit.discount_percentage}% OFF</div>
                <div class="benefit-cost">${formatPoints(benefit.points_cost)}</div>
            </div>
            <div class="benefit-action ${available ? '' : 'locked'}">
                ${available
                    ? `<button class="btn-primary btn-small" onclick="redeemBenefit(${benefit.points_cost}, ${benefit.discount_percentage})">Resgatar</button>`
                    : `Faltam ${formatPoints(missing)}`}
            </div>
        </div>`;
    }).join('');
}

function renderCoupons() {
    const container = document.getElementById('coupons-list');
    if (!container) return;
    const coupons = Loyalty.getCoupons();
    if (!coupons.length) {
        container.innerHTML = '<div class="empty-list">Você ainda não resgatou cupons.</div>';
        return;
    }
    container.innerHTML = coupons.map(coupon => {
        const available = coupon.status === 'available';
        return `<div class="coupon-item">
            <div class="coupon-info">
                <div class="coupon-title">${coupon.discount_percentage}% OFF</div>
                <div class="coupon-meta">Resgatado com ${formatPoints(coupon.points_cost)} · ${formatDate(coupon.redeemed_at)}</div>
            </div>
            <div class="coupon-status ${available ? 'available' : 'used'}">${available ? 'Disponível' : 'Utilizado'}</div>
        </div>`;
    }).join('');
}

function renderPointsHistory() {
    const container = document.getElementById('points-history');
    if (!container) return;
    const transactions = Loyalty.getPointTransactions();
    if (!transactions.length) {
        container.innerHTML = '<div class="empty-list">As movimentações de pontos aparecerão aqui.</div>';
        return;
    }
    container.innerHTML = transactions.slice(0, 12).map(transaction => {
        const earned = Number(transaction.points || 0) >= 0;
        return `<div class="point-history-item">
            <div class="point-history-info">
                <div class="point-history-title">${earned ? '+' : ''}${Number(transaction.points || 0).toFixed(2).replace('.', ',')} pontos</div>
                <div class="point-history-description">${transaction.description} · ${formatDate(transaction.created_at)}</div>
            </div>
        </div>`;
    }).join('');
}

function renderManagerSummary() {
    const container = document.getElementById('manager-summary');
    if (!container) return;
    const summary = Loyalty.getManagerSummary();
    const items = [
        ['Usuários participantes', summary.participants],
        ['Pontos distribuídos', formatPoints(summary.points_distributed)],
        ['Cupons resgatados', summary.coupons_redeemed],
        ['Cupons utilizados', summary.coupons_used],
        ['Desconto concedido', 'R$ ' + Number(summary.discount_value || 0).toFixed(2).replace('.', ',')],
        ['Créditos adicionados', 'R$ ' + Number(summary.wallet_credits || 0).toFixed(2).replace('.', ',')],
    ];
    container.innerHTML = items.map(item => `<div class="manager-summary-item"><strong>${item[1]}</strong><span>${item[0]}</span></div>`).join('');
}

function parseMoney(value) {
    return Number(String(value || '').replace(',', '.'));
}

function walletBalanceFromResponse(response, fallback) {
    if (response && response.wallet && response.wallet.balance != null) return Number(response.wallet.balance);
    if (response && response.user && response.user.balance != null) return Number(response.user.balance);
    if (response && response.balance != null) return Number(response.balance);
    return Number(fallback);
}

async function submitWalletDeposit() {
    const amount = parseMoney(document.getElementById('deposit-amount').value);
    const message = document.getElementById('deposit-message');
    if (!amount || amount <= 0) {
        message.className = 'wallet-message error';
        message.textContent = 'Informe um valor maior que zero.';
        return;
    }
    const submit = document.getElementById('deposit-submit');
    const paymentMethod = selectedRadioValue('deposit-payment-method', 'wallet');
    submit.disabled = true;
    message.className = 'wallet-message';
    message.textContent = 'Confirmando credito...';
    try {
        const response = await GoodWeAPI.deposit(amount, { payment_method: paymentMethod });
        state.walletBalance = walletBalanceFromResponse(response, state.walletBalance + amount);
        if (response && response.points != null) {
            syncPointsForCurrentUser(response.points);
        }
        const referenceId = response && (response.transaction_id || response.deposit_id || response.wallet_transaction_id || response.id);
        const result = paymentMethod === 'wallet'
            ? { points: 0, created: false }
            : Loyalty.confirmDeposit(Loyalty.getUserId(), amount, referenceId);
        if (response && response.points != null) {
            syncPointsForCurrentUser(response.points);
        } else {
            state.points = Loyalty.getPoints();
            if (state.currentUser) state.currentUser.points = state.points;
        }
        document.getElementById('deposit-amount').value = '';
        message.className = 'wallet-message';
        const paymentText = paymentMethod === 'wallet' ? 'saldo' : (paymentMethod === 'pix' ? 'PIX' : 'cartao');
        message.textContent = paymentMethod === 'wallet'
            ? 'Credito confirmado via ' + paymentText + '. Nenhum cashback para pagamento com carteira.'
            : (result.created
                ? 'Credito confirmado via ' + paymentText + '. Voce recebeu ' + formatPoints(result.points) + '.'
                : 'Credito confirmado via ' + paymentText + '. Os pontos ja estavam registrados.');
        updateWalletDisplay();
        renderWalletScreen();
    } catch (err) {
        message.className = 'wallet-message error';
        message.textContent = err.message;
    } finally {
        submit.disabled = false;
    }
}

function redeemBenefit(pointsCost, discountPercentage) {
    const coupon = Loyalty.redeemBenefit(Loyalty.getUserId(), pointsCost, discountPercentage);
    if (!coupon) {
        renderWalletScreen();
        return;
    }
    state.points = Loyalty.getPoints();
    renderWalletScreen();
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
    state.selectedCouponId = null;
    state.chargeDiscount = 0;
    state.chargeFinalCost = null;
    state.chargeTotalKwh = null;
    state.chargePaymentMethod = 'wallet';
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
    if (user.points != null) {
        syncPointsForCurrentUser(user.points);
    } else {
        state.points = Loyalty.getPoints(Loyalty.getUserId());
        if (state.currentUser) state.currentUser.points = state.points;
    }
}

async function refreshWalletFromServer() {
    try {
        const wallet = await GoodWeAPI.getWallet();
        state.walletBalance = Number(wallet.balance || 0);
        if (wallet.points != null) {
            syncPointsForCurrentUser(wallet.points);
        } else {
            state.points = Loyalty.getPoints();
        }
        if (state.currentUser) {
            state.currentUser.balance = state.walletBalance;
            state.currentUser.points = state.points;
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
        await refreshWalletFromServer();
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
        await refreshWalletFromServer();
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
    state.points = 0;
    state.selectedCouponId = null;
    state.chargeDiscount = 0;
    state.chargeFinalCost = null;
    state.chargeTotalKwh = null;
    resetAll();
}

function startCharging() {
    showChargeTypeScreen();
}

function simulateNFCTap() {
    showNFCTapOverlay();
    setTimeout(async () => {
        hideNFCTapOverlay();
        state.batteryCurrent = 30;

        if (GoodWeAPI.isAuthenticated()) {
            try {
                const user = await GoodWeAPI.me();
                applyAuthenticatedUser(user);
                await refreshWalletFromServer();
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
    initPaymentMethodSelectors();
    if (window.GoodWeAPI && typeof window.GoodWeAPI.getEnvironmentLabel === 'function') {
        updateApiEnvironmentBadge({ mode: window.GoodWeAPI.isSimulationMode() ? 'simulation' : 'unknown' });
    }
    window.addEventListener('goodwe-api-mode', event => updateApiEnvironmentBadge(event.detail || {}));
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
window.showWalletScreen = showWalletScreen;
window.submitWalletDeposit = submitWalletDeposit;
window.redeemBenefit = redeemBenefit;
window.formatPoints = formatPoints;
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
