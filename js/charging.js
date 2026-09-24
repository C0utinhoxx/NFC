function startCharging() {
    showChargeTypeScreen();
}

function brl(n) {
    return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
}

function kwhFromPercentDelta(deltaPercent) {
    return (Math.max(0, deltaPercent) / 100) * BATTERY_CAPACITY;
}

function percentFromKwh(kwh) {
    return (kwh / BATTERY_CAPACITY) * 100;
}

function computePartialFromPercent(targetPercent) {
    const current = state.batteryCurrent || 0;
    const capped = Math.min(100, Math.max(current, targetPercent));
    const kwh = kwhFromPercentDelta(capped - current);
    return { targetPercent: capped, kwh, cost: kwh * TARIFF };
}

function computePartialFromValue(value) {
    const current = state.batteryCurrent || 0;
    const desiredKwh = value / TARIFF;
    const targetPercent = Math.min(100, current + percentFromKwh(desiredKwh));
    const kwh = kwhFromPercentDelta(targetPercent - current);
    return { targetPercent, kwh, cost: kwh * TARIFF, cappedAtFull: targetPercent >= 100 && desiredKwh > kwh + 0.001 };
}

function computeFullEstimate() {
    const current = state.batteryCurrent || 0;
    const kwh = kwhFromPercentDelta(100 - current);
    return { targetPercent: 100, kwh, cost: kwh * TARIFF };
}

function estimateHtml(est, opts) {
    opts = opts || {};
    const insufficient = est.cost > state.walletBalance + 0.001;
    return `
        <div class="estimate-box">
            ${opts.title ? `<div class="estimate-title">${opts.title}</div>` : ''}
            <div class="estimate-row">
                <span>Energia necessária</span>
                <strong>${est.kwh.toFixed(1)} kWh</strong>
            </div>
            <div class="estimate-row">
                <span>Custo estimado</span>
                <strong class="estimate-cost">${brl(est.cost)}</strong>
            </div>
            <div class="estimate-row">
                <span>Saldo disponível</span>
                <strong>${brl(state.walletBalance)}</strong>
            </div>
            ${opts.extra || ''}
            ${insufficient ? `<div class="estimate-warn">Saldo insuficiente para esta carga. Faltam ${brl(est.cost - state.walletBalance)}.</div>` : ''}
        </div>
    `;
}

function selectChargeType(type) {
    state.chargeType = type;
    state.isFullChargeConfirmed = false;
    state.chargePercent = null;
    state.chargeValue = null;
    state.chargeMode = null;
    state.estimatedCost = null;
    state.targetPercent = null;

    document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
    const selectedCard = document.querySelector(`.type-card[data-type="${type}"]`);
    if (selectedCard) selectedCard.classList.add('selected');

    const detail = document.getElementById('type-detail');
    const btnConfirm = document.getElementById('btn-confirm-type');
    detail.classList.add('active');
    btnConfirm.style.display = 'none';
    btnConfirm.style.background = '';
    btnConfirm.style.border = '';

    const current = state.batteryCurrent || 0;

    if (type === 'full') {
        const est = computeFullEstimate();
        state.estimatedCost = est.cost;
        state.targetPercent = 100;
        btnConfirm.style.display = 'block';
        btnConfirm.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Confirmar Carga Total
        `;
        detail.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span style="color: #ef4444; font-weight: 700; font-size: 15px;">Aviso Importante</span>
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                    Carga total carregará do nível atual até <strong>100%</strong>. <strong>Não será possível cancelar</strong> durante o carregamento. Tem certeza?
                </p>
            </div>
            <div class="battery-indicator" style="margin-bottom: 12px; max-width: none;">
                <svg class="battery-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="6" width="18" height="12" rx="2"></rect>
                    <line x1="23" y1="13" x2="23" y2="11"></line>
                </svg>
                <div class="battery-bar-track">
                    <div class="battery-bar-fill" style="width:${current}%"></div>
                </div>
                <span class="battery-text">${current}%</span>
            </div>
            <p style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;text-align:center;">Nível atual: <strong>${current}%</strong> → <strong>100%</strong></p>
            ${estimateHtml(est, { title: 'Simulação de custo' })}
            <div class="tariff-badge" style="margin: 16px auto 0;">Tarifa: ${brl(TARIFF)}/kWh</div>
        `;
    } else if (type === 'partial') {
        detail.innerHTML = `
            <div class="partial-fields">
                <div class="form-group">
                    <label>Porcentagem</label>
                    <div class="input-prefix">
                        <span class="prefix">%</span>
                        <input type="number" id="input-percent" min="1" max="100" placeholder="Ex: 80" inputmode="numeric" />
                    </div>
                </div>
                <div class="form-group">
                    <label>Valor em R$</label>
                    <div class="input-prefix">
                        <span class="prefix">R$</span>
                        <input type="number" id="input-value" min="0" step="0.01" placeholder="Ex: 30,00" inputmode="decimal" />
                    </div>
                </div>
            </div>
            <p class="partial-hint">Preencha a porcentagem ou o valor — os dois campos se sincronizam automaticamente.</p>
            <div id="partial-estimate" class="estimate-box">
                <div class="estimate-empty">Informe a porcentagem ou o valor para ver a simulação de custo</div>
            </div>
            <div class="tariff-badge" style="margin: 16px auto 0;">Tarifa: ${brl(TARIFF)}/kWh</div>
        `;

        const inputPercent = document.getElementById('input-percent');
        const inputValue = document.getElementById('input-value');
        let syncing = false;

        function renderPartialEstimate(est, note) {
            const box = document.getElementById('partial-estimate');
            if (!box) return;
            const insufficient = est.cost > state.walletBalance + 0.001;
            box.innerHTML = `
                <div class="estimate-row">
                    <span>Energia estimada</span>
                    <strong>${est.kwh.toFixed(1)} kWh</strong>
                </div>
                <div class="estimate-row">
                    <span>Custo estimado</span>
                    <strong class="estimate-cost">${brl(est.cost)}</strong>
                </div>
                <div class="estimate-row">
                    <span>Chega a</span>
                    <strong>${Math.floor(est.targetPercent)}% da bateria</strong>
                </div>
                <div class="estimate-row">
                    <span>Saldo após</span>
                    <strong>${brl(Math.max(0, state.walletBalance - est.cost))}</strong>
                </div>
                ${note ? `<div class="estimate-note">${note}</div>` : ''}
                ${insufficient ? `<div class="estimate-warn">Saldo insuficiente. Faltam ${brl(est.cost - state.walletBalance)}.</div>` : ''}
            `;
        }

        function clearPartial() {
            state.chargeMode = null;
            state.chargePercent = null;
            state.chargeValue = null;
            state.estimatedCost = null;
            state.targetPercent = null;
            btnConfirm.style.display = 'none';
            const box = document.getElementById('partial-estimate');
            if (box) box.innerHTML = '<div class="estimate-empty">Informe a porcentagem ou o valor para ver a simulação de custo</div>';
        }

        inputPercent.addEventListener('input', function () {
            if (syncing) return;
            const raw = parseFloat(this.value);
            if (!raw || raw <= 0) {
                if (!inputValue.value) clearPartial();
                return;
            }
            syncing = true;
            const capped = Math.min(100, Math.round(raw));
            const est = computePartialFromPercent(capped);
            state.chargeMode = 'percent';
            state.chargePercent = est.targetPercent;
            state.chargeValue = est.cost;
            state.estimatedCost = est.cost;
            state.targetPercent = est.targetPercent;
            inputValue.value = est.cost.toFixed(2);
            let note = '';
            if (raw > 100) note = 'Limite máximo é 100%. Valor ajustado.';
            else if (est.targetPercent <= current) note = 'A porcentagem precisa ser maior que o nível atual (' + current + '%).';
            renderPartialEstimate(est, note);
            btnConfirm.style.display = est.targetPercent > current ? 'block' : 'none';
            syncing = false;
        });

        inputValue.addEventListener('input', function () {
            if (syncing) return;
            const raw = parseFloat(this.value);
            if (!raw || raw <= 0) {
                if (!inputPercent.value) clearPartial();
                return;
            }
            syncing = true;
            const est = computePartialFromValue(raw);
            if (est.targetPercent <= current) {
                state.chargeMode = null;
                state.chargePercent = null;
                state.chargeValue = null;
                state.estimatedCost = null;
                state.targetPercent = null;
                btnConfirm.style.display = 'none';
                const box = document.getElementById('partial-estimate');
                if (box) box.innerHTML = `<div class="estimate-warn">Valor muito baixo. Mínimo para sair de ${current}%: ${brl(kwhFromPercentDelta(1) * TARIFF)}.</div>`;
                syncing = false;
                return;
            }
            state.chargeMode = 'value';
            state.chargePercent = est.targetPercent;
            state.chargeValue = est.cost;
            state.estimatedCost = est.cost;
            state.targetPercent = est.targetPercent;
            inputPercent.value = String(Math.floor(est.targetPercent));
            let note = est.cappedAtFull ? 'Valor excede 100% — a carga para em 100% e o custo é limitado ao necessário.' : '';
            renderPartialEstimate(est, note);
            btnConfirm.style.display = 'block';
            syncing = false;
        });
    }
}

function confirmChargeType() {
    if (state.chargeType === 'full') {
        if (!state.isFullChargeConfirmed) {
            state.isFullChargeConfirmed = true;
            const btnConfirm = document.getElementById('btn-confirm-type');
            if (btnConfirm) {
                btnConfirm.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Confirmado - Iniciar
                `;
                btnConfirm.style.background = 'var(--success)';
                btnConfirm.style.border = 'none';
            }
            return;
        }
        const est = computeFullEstimate();
        if (est.cost > state.walletBalance) {
            alert('Saldo insuficiente para carga total.\nCusto estimado: ' + brl(est.cost) + '\nSaldo: ' + brl(state.walletBalance));
            return;
        }
        state.estimatedCost = est.cost;
        state.targetPercent = 100;
        state.chargeMode = 'full';
        startChargingWithType();
    } else if (state.chargeType === 'partial') {
        const pctInput = document.getElementById('input-percent');
        const valInput = document.getElementById('input-value');
        const pct = pctInput ? parseFloat(pctInput.value) : null;
        const val = valInput ? parseFloat(valInput.value) : null;

        if ((!pct || pct <= 0) && (!val || val <= 0)) {
            alert('Informe a porcentagem ou o valor da carga parcial.');
            return;
        }

        let est;
        if (state.chargeMode === 'value' && val > 0) {
            est = computePartialFromValue(val);
        } else if (pct > 0) {
            est = computePartialFromPercent(pct);
        } else {
            est = computePartialFromValue(val);
        }

        if (est.targetPercent <= (state.batteryCurrent || 0)) {
            alert('A carga precisa ser maior que o nível atual da bateria (' + (state.batteryCurrent || 0) + '%).');
            return;
        }
        if (est.cost > state.walletBalance) {
            alert('Saldo insuficiente.\nCusto estimado: ' + brl(est.cost) + '\nSaldo: ' + brl(state.walletBalance));
            return;
        }

        state.chargePercent = est.targetPercent;
        state.chargeValue = est.cost;
        state.estimatedCost = est.cost;
        state.targetPercent = est.targetPercent;
        startChargingWithType();
    }
}

async function startChargingWithType() {
    const startPercent = state.batteryCurrent || 0;
    let targetPercent = state.targetPercent;
    let targetCost = state.estimatedCost;

    if (state.chargeType === 'full') {
        const est = computeFullEstimate();
        targetPercent = est.targetPercent;
        targetCost = est.cost;
    } else if (!targetPercent || !targetCost) {
        if (state.chargeMode === 'value' && state.chargeValue) {
            const est = computePartialFromValue(state.chargeValue);
            targetPercent = est.targetPercent;
            targetCost = est.cost;
        } else if (state.chargePercent) {
            const est = computePartialFromPercent(state.chargePercent);
            targetPercent = est.targetPercent;
            targetCost = est.cost;
        } else {
            alert('Defina o tipo e o valor da carga.');
            return;
        }
    }

    if (targetCost > state.walletBalance) {
        alert('Saldo insuficiente para iniciar o carregamento.');
        return;
    }

    state.targetPercent = targetPercent;
    state.estimatedCost = targetCost;

    const totalKwh = kwhFromPercentDelta(targetPercent - startPercent);
    if (totalKwh <= 0) {
        alert('A bateria já está nesse nível.');
        return;
    }

    if (!state.currentCharger) {
        alert('Carregador indisponível no momento. Tente novamente em instantes.');
        return;
    }

    const btnConfirm = document.getElementById('btn-confirm-type');
    if (btnConfirm) btnConfirm.disabled = true;

    let result;
    try {
        result = await GoodWeAPI.startCharging(state.currentCharger.id, {
            energy_kwh: Number(totalKwh.toFixed(2)),
            amount: Number(targetCost.toFixed(2)),
            charge_type: state.chargeType,
            target_percent: Math.round(targetPercent),
        });
    } catch (err) {
        if (btnConfirm) btnConfirm.disabled = false;
        alert('Não foi possível iniciar a recarga: ' + err.message);
        return;
    }

    state.activeSession = result.session;
    state.chargeStartBalance = result.user.balance + targetCost;
    state.walletBalance = result.user.balance;
    if (state.currentUser) {
        state.currentUser.balance = result.user.balance;
        state.currentUser.points = result.user.points;
    }
    state.currentCharger = result.charger;

    showScreen('screen-charging');
    state.seconds = 0;
    state.kwh = 0;
    state.percent = startPercent;
    state.isFullChargeConfirmed = false;
    updateDisplay();

    const typeLabel = document.getElementById('charge-type-label');
    if (typeLabel) typeLabel.textContent = getChargeTypeName(state.chargeType);

    const estimateEl = document.getElementById('charging-estimate');
    if (estimateEl) {
        estimateEl.textContent = 'Estimado: ' + brl(targetCost) + ' · ' + totalKwh.toFixed(1) + ' kWh';
    }

    const kwhPerTick = Math.max(totalKwh / 100, 0.01);

    state.chargingInterval = setInterval(() => {
        state.seconds++;
        state.kwh = Math.min(totalKwh, state.kwh + kwhPerTick);
        state.percent = Math.min(targetPercent, startPercent + percentFromKwh(state.kwh));

        const spent = state.kwh * TARIFF;
        updateDisplay();
        updateChargingWallet();

        if (state.kwh >= totalKwh - 0.0001 || state.percent >= targetPercent - 0.01 || spent >= targetCost - 0.01) {
            state.kwh = totalKwh;
            state.percent = targetPercent;
            stopCharging();
        }
    }, 500);
}

function updateChargingWallet() {
    const walletEl = document.getElementById('charging-wallet');
    if (walletEl) {
        const spent = state.kwh * TARIFF;
        const baseline = state.chargeStartBalance != null ? state.chargeStartBalance : state.walletBalance;
        const remaining = baseline - spent;
        walletEl.textContent = brl(Math.max(0, remaining));
        walletEl.style.color = remaining <= 0 ? '#ef4444' : 'var(--success)';
    }
}

async function stopCharging() {
    clearInterval(state.chargingInterval);
    state.chargingInterval = null;

    const session = state.activeSession;
    const actualEnergy = session ? Number(session.energy_kwh) : (state.kwh || 0);
    const actualCost = session ? Number(session.amount_charged) : (state.kwh || 0) * TARIFF;

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('final-time', formatTime(state.seconds));
    setText('final-energy', actualEnergy.toFixed(1) + ' kWh');
    setText('final-cost', brl(actualCost));
    setText('final-estimated', brl(state.estimatedCost || actualCost));
    setText('final-percent', Math.floor(state.percent) + '%');
    setText('final-tariff', 'Tarifa: ' + brl(TARIFF) + '/kWh');
    setText('final-type', getChargeTypeName(state.chargeType));
    setText('final-user', state.currentUser ? state.currentUser.name : 'Convidado');
    setText('final-wallet', brl(state.walletBalance));
    showScreen('screen-done');

    if (state.currentCharger) {
        try {
            await GoodWeAPI.releaseCharger(state.currentCharger.id);
        } catch (err) {
            console.warn('Não foi possível liberar o carregador:', err.message);
        }
    }

    state.activeSession = null;
    if (typeof loadKioskCharger === 'function') loadKioskCharger();
    if (typeof refreshWalletFromServer === 'function') refreshWalletFromServer();
}

function resetAll() {
    if (state.chargingInterval) clearInterval(state.chargingInterval);
    state.chargingInterval = null;
    state.seconds = 0;
    state.kwh = 0;
    state.percent = 0;
    state.chargeType = null;
    state.chargeValue = null;
    state.chargePercent = null;
    state.chargeMode = null;
    state.estimatedCost = null;
    state.targetPercent = null;
    state.isFullChargeConfirmed = false;
    state.batteryCurrent = 30;
    updateDisplay();
    if (GoodWeAPI.isAuthenticated() && typeof refreshWalletFromServer === 'function') {
        refreshWalletFromServer();
    } else {
        state.walletBalance = WALLET_BALANCE;
        updateWalletDisplay();
    }
    const btn = document.getElementById('btn-confirm-type');
    if (btn) btn.style.display = 'none';
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
    if (energyEl) energyEl.textContent = (state.kwh || 0).toFixed(1) + ' kWh';
    const costEl = document.getElementById('cost');
    if (costEl) costEl.textContent = brl((state.kwh || 0) * TARIFF);
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function calcEnergy() {
    return (state.kwh || 0).toFixed(1);
}

function calcCost() {
    return brl((state.kwh || 0) * TARIFF);
}

function getChargeTypeName(type) {
    const names = {
        'full': 'Carga Total',
        'partial': state.chargeMode === 'value' ? 'Carga Parcial (Valor)' : 'Carga Parcial (%)'
    };
    return names[type] || 'Desconhecido';
}

window.startCharging = startCharging;
window.selectChargeType = selectChargeType;
window.confirmChargeType = confirmChargeType;
window.stopCharging = stopCharging;
window.resetAll = resetAll;
window.updateChargingWallet = updateChargingWallet;
window.brl = brl;