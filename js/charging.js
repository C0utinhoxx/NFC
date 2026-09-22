function startCharging() {
    if (!state.isAuthenticated) {
        showAuthScreen();
        return;
    }
    showChargeTypeScreen();
}

function selectChargeType(type) {
    state.chargeType = type;

    document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
    const selectedCard = document.querySelector(`.type-card[data-type="${type}"]`);
    if (selectedCard) selectedCard.classList.add('selected');

    const detail = document.getElementById('type-detail');
    const btnConfirm = document.getElementById('btn-confirm-type');
    detail.classList.add('active');
    btnConfirm.style.display = 'block';

    if (type === 'full') {
        detail.innerHTML = `
            <div class="battery-indicator" style="margin-bottom: 16px;">
                <svg class="battery-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="6" width="18" height="12" rx="2"></rect>
                    <line x1="23" y1="13" x2="23" y2="11"></line>
                </svg>
                <div class="battery-bar-track">
                    <div class="battery-bar-fill" id="battery-fill" style="width:30%"></div>
                </div>
                <span class="battery-text" id="battery-text">30%</span>
            </div>
            <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px;text-align:center;">Carregando de <strong>30%</strong> até <strong>100%</strong></p>
            <div class="tariff-badge" style="margin: 0 auto;">Tarifa: R$ ${TARIFF.toFixed(2)}/kWh</div>
        `;
    } else if (type === 'partial-percent') {
        detail.innerHTML = `
            <div class="form-group">
                <label>Porcentagem desejada</label>
                <div class="input-prefix">
                    <span class="prefix">%</span>
                    <input type="number" id="input-percent" min="1" max="100" placeholder="Ex: 80" />
                </div>
            </div>
            <div class="tariff-badge" style="margin: 0 auto;">Tarifa: R$ ${TARIFF.toFixed(2)}/kWh</div>
        `;
        const input = document.getElementById('input-percent');
        if (input) {
            input.addEventListener('input', function() {
                btnConfirm.style.display = this.value ? 'block' : 'none';
            });
        }
    } else if (type === 'partial-value') {
        detail.innerHTML = `
            <div class="form-group">
                <label>Valor desejado (R$)</label>
                <div class="input-prefix">
                    <span class="prefix">R$</span>
                    <input type="number" id="input-value" min="1" step="0.01" placeholder="Ex: 30.00" />
                </div>
            </div>
            <div class="tariff-badge" style="margin: 0 auto;">Tarifa: R$ ${TARIFF.toFixed(2)}/kWh</div>
        `;
        const input = document.getElementById('input-value');
        if (input) {
            input.addEventListener('input', function() {
                btnConfirm.style.display = this.value ? 'block' : 'none';
            });
        }
    }
}

function confirmChargeType() {
    if (state.chargeType === 'full') {
        startChargingWithType();
    } else if (state.chargeType === 'partial-percent') {
        const val = document.getElementById('input-percent') ? parseInt(document.getElementById('input-percent').value) : null;
        if (!val || val < 1 || val > 100) {
            alert('Informe uma porcentagem válida (1-100%)');
            return;
        }
        state.chargePercent = val;
        startChargingWithType();
    } else if (state.chargeType === 'partial-value') {
        const val = document.getElementById('input-value') ? parseFloat(document.getElementById('input-value').value) : null;
        if (!val || val < 1) {
            alert('Informe um valor válido');
            return;
        }
        state.chargeValue = val;
        startChargingWithType();
    }
}

function startChargingWithType() {
    if (!state.isAuthenticated) return;

    showScreen('screen-charging');
    state.seconds = 0;
    state.percent = state.batteryCurrent || 0;
    updateDisplay();

    const typeLabel = document.getElementById('charge-type-label');
    const typeBadge = document.getElementById('charge-type-badge');
    if (typeLabel) typeLabel.textContent = getChargeTypeName(state.chargeType);

    const currentFrom = state.batteryCurrent || 0;
    let targetPercent = 100;

    if (state.chargeType === 'full') {
        targetPercent = 100;
    } else if (state.chargeType === 'partial-percent') {
        targetPercent = state.chargePercent || 100;
    } else if (state.chargeType === 'partial-value') {
        const value = state.chargeValue || 0;
        const kwhFromValue = value / TARIFF;
        targetPercent = Math.min(100, (kwhFromValue / 50) * 100);
    }

    const range = Math.max(1, targetPercent - currentFrom);
    const increment = range / 200;

    state.chargingInterval = setInterval(() => {
        state.seconds++;
        state.percent = Math.min(targetPercent, state.percent + increment);
        if (state.percent > targetPercent) state.percent = targetPercent;
        updateDisplay();
        if (state.percent >= targetPercent) {
            stopCharging();
        }
    }, 500);
}

function stopCharging() {
    clearInterval(state.chargingInterval);
    state.chargingInterval = null;
    document.getElementById('final-time').textContent = formatTime(state.seconds);
    document.getElementById('final-energy').textContent = calcEnergy() + ' kWh';
    document.getElementById('final-cost').textContent = calcCost();
    document.getElementById('final-percent').textContent = Math.floor(state.percent) + '%';
    document.getElementById('final-tariff').textContent = 'Tarifa: R$ ' + TARIFF.toFixed(2) + '/kWh';
    document.getElementById('final-type').textContent = getChargeTypeName(state.chargeType);
    document.getElementById('final-user').textContent = state.currentUser ? state.currentUser.name : 'Não identificado';
    showScreen('screen-done');
}

function resetAll() {
    state.seconds = 0;
    state.percent = 0;
    state.chargeType = null;
    state.chargeValue = null;
    state.chargePercent = null;
    updateDisplay();
    document.getElementById('btn-confirm-type').style.display = 'none';
    showScreen('screen-charger');
}

function updateDisplay() {
    const pctEl = document.getElementById('percent');
    const barEl = document.getElementById('progress-bar');
    if (pctEl) pctEl.textContent = Math.floor(state.percent);
    if (barEl) barEl.style.width = state.percent + '%';
    const timeEl = document.getElementById('time');
    if (timeEl) timeEl.textContent = formatTime(state.seconds);
    const energyEl = document.getElementById('energy');
    if (energyEl) energyEl.textContent = calcEnergy() + ' kWh';
    const costEl = document.getElementById('cost');
    if (costEl) costEl.textContent = calcCost();
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function calcEnergy() {
    return (state.seconds * 0.005).toFixed(1);
}

function calcCost() {
    return 'R$ ' + (state.seconds * 0.005 * TARIFF).toFixed(2).replace('.', ',');
}

function getChargeTypeName(type) {
    const names = {
        'full': 'Carga Total',
        'partial-percent': 'Carga Parcial (%)',
        'partial-value': 'Carga Parcial (Valor)'
    };
    return names[type] || 'Desconhecido';
}

window.startCharging = startCharging;
window.selectChargeType = selectChargeType;
window.confirmChargeType = confirmChargeType;
window.stopCharging = stopCharging;
window.resetAll = resetAll;
