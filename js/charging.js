function startCharging() {
    showChargeTypeScreen();
}

function brl(n) {
    return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
}

function isChargingSimulationMode() {
    return window.GoodWeAPI && typeof window.GoodWeAPI.isSimulationMode === 'function' && window.GoodWeAPI.isSimulationMode();
}

function paymentMethodLabel(method) {
    if (method === 'pix') return 'PIX';
    if (method === 'card') return 'Cartao';
    return 'Carteira';
}

function getChargePricing(estimate) {
    const original = Math.max(0, Number(estimate && estimate.cost || 0));
    const coupon = state.selectedCouponId
        ? Loyalty.getAvailableCoupons().find(item => item.id === state.selectedCouponId)
        : null;
    const discount = coupon ? Math.max(0, original * Number(coupon.discount_percentage) / 100) : 0;
    return {
        original,
        discount: Math.min(original, discount),
        final: Math.max(0, original - discount),
        coupon,
    };
}

function renderCouponSelector(estimate) {
    const container = document.getElementById('coupon-selector');
    if (!container) return;
    const coupons = Loyalty.getAvailableCoupons();
    const pricing = getChargePricing(estimate);
    const options = coupons.length
        ? `<label class="coupon-option ${!state.selectedCouponId ? 'selected' : ''}">
                <input type="radio" name="charge-coupon" value="" ${!state.selectedCouponId ? 'checked' : ''} />
                <span>Usar saldo integral</span>
            </label>` + coupons.map(coupon => `<label class="coupon-option ${state.selectedCouponId === coupon.id ? 'selected' : ''}">
                <input type="radio" name="charge-coupon" value="${coupon.id}" ${state.selectedCouponId === coupon.id ? 'checked' : ''} />
                <span>Cupom ${coupon.discount_percentage}% OFF</span>
            </label>`).join('')
        : '<div class="empty-list">Nenhum cupom disponível para esta recarga.</div>';
    container.innerHTML = `<div class="coupon-selector">
        <div class="coupon-selector-title">Cupom de desconto</div>
        <div class="coupon-selector-hint">Selecione no máximo um cupom disponível.</div>
        ${options}
        <div class="coupon-pricing">
            <div class="estimate-row"><span>Valor original</span><strong>${brl(pricing.original)}</strong></div>
            <div class="estimate-row"><span>Desconto</span><strong class="discount-value">${brl(pricing.discount)}</strong></div>
            <div class="estimate-row"><span>Valor final</span><strong class="final-value">${brl(pricing.final)}</strong></div>
        </div>
    </div>`;
    container.querySelectorAll('input[name="charge-coupon"]').forEach(input => {
        input.addEventListener('change', () => {
            state.selectedCouponId = input.value || null;
            const updated = getChargePricing(estimate);
            state.chargeDiscount = updated.discount;
            state.chargeFinalCost = updated.final;
            renderCouponSelector(estimate);
        });
    });
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
    const pricing = getChargePricing(est);
    const insufficient = !isChargingSimulationMode() && pricing.final > state.walletBalance + 0.001;
    const postChargeNotice = isChargingSimulationMode()
        ? `<div class="estimate-note">Pagamento definido no final da recarga.</div>`
        : '';
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
            ${postChargeNotice}
            ${insufficient ? `<div class="estimate-warn">Saldo insuficiente para esta carga. Faltam ${brl(pricing.final - state.walletBalance)}.</div>` : ''}
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
     state.selectedCouponId = null;
     state.chargeDiscount = 0;
     state.chargeFinalCost = null;

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
             <div id="coupon-selector"></div>
             <div class="tariff-badge" style="margin: 16px auto 0;">Tarifa: ${brl(TARIFF)}/kWh</div>
         `;
        state.chargeFinalCost = est.cost;
        renderCouponSelector(est);
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
             <div id="coupon-selector"></div>
             <div class="tariff-badge" style="margin: 16px auto 0;">Tarifa: ${brl(TARIFF)}/kWh</div>
        `;

        const inputPercent = document.getElementById('input-percent');
        const inputValue = document.getElementById('input-value');
        let syncing = false;

         function renderPartialEstimate(est, note) {
             const box = document.getElementById('partial-estimate');
             if (!box) return;
             const pricing = getChargePricing(est);
              const insufficient = !isChargingSimulationMode() && pricing.final > state.walletBalance + 0.001;
              box.innerHTML = `
                  <div class="estimate-row">
                      <span>Energia estimada</span>
                     <strong>${est.kwh.toFixed(1)} kWh</strong>
                 </div>
                 <div class="estimate-row">
                     <span>Custo estimado</span>
                     <strong class="estimate-cost">${brl(pricing.original)}</strong>
                 </div>
                 <div class="estimate-row">
                     <span>Chega a</span>
                     <strong>${Math.floor(est.targetPercent)}% da bateria</strong>
                 </div>
                 <div class="estimate-row">
                     <span>Saldo após</span>
                     <strong>${brl(Math.max(0, state.walletBalance - pricing.final))}</strong>
                  </div>
                  ${note ? `<div class="estimate-note">${note}</div>` : ''}
                  ${isChargingSimulationMode() ? `<div class="estimate-note">Pagamento definido no final da recarga.</div>` : ''}
                  ${insufficient ? `<div class="estimate-warn">Saldo insuficiente. Faltam ${brl(pricing.final - state.walletBalance)}.</div>` : ''}
              `;
              renderCouponSelector(est);
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
         const pricing = getChargePricing(est);
         if (!isChargingSimulationMode() && pricing.final > state.walletBalance + 0.001) {
              alert('Saldo insuficiente para carga total.\nValor final: ' + brl(pricing.final) + '\nSaldo: ' + brl(state.walletBalance));
              return;
          }
         state.estimatedCost = est.cost;
         state.chargeDiscount = pricing.discount;
         state.chargeFinalCost = pricing.final;
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
         const pricing = getChargePricing(est);
         if (!isChargingSimulationMode() && pricing.final > state.walletBalance + 0.001) {
              alert('Saldo insuficiente.\nValor final: ' + brl(pricing.final) + '\nSaldo: ' + brl(state.walletBalance));
              return;
          }

         state.chargeDiscount = pricing.discount;
         state.chargeFinalCost = pricing.final;
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

     const totalKwh = kwhFromPercentDelta(targetPercent - startPercent);
     if (totalKwh <= 0) {
         alert('A bateria já está nesse nível.');
         return;
     }
     const pricing = getChargePricing({ cost: targetCost });
     if (!isChargingSimulationMode() && pricing.final > state.walletBalance + 0.001) {
          alert('Saldo insuficiente para iniciar o carregamento.');
          return;
      }

     state.targetPercent = targetPercent;
     state.estimatedCost = targetCost;
     state.chargeDiscount = pricing.discount;
     state.chargeFinalCost = pricing.final;
     state.chargeTotalKwh = totalKwh;
     targetCost = pricing.final;

     if (!state.currentCharger && typeof loadKioskCharger === 'function') {
         await loadKioskCharger();
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
             original_amount: Number(state.estimatedCost.toFixed(2)),
             discount_amount: Number(state.chargeDiscount.toFixed(2)),
             discount_percentage: pricing.coupon ? pricing.coupon.discount_percentage : 0,
             coupon_id: state.selectedCouponId,
             charge_type: state.chargeType,
             target_percent: Math.round(targetPercent),
         });
    } catch (err) {
        if (btnConfirm) btnConfirm.disabled = false;
        alert('Não foi possível iniciar a recarga: ' + err.message);
        return;
    }

     if (state.selectedCouponId) {
         Loyalty.setCouponDiscountValue(state.selectedCouponId, state.chargeDiscount);
         Loyalty.useCoupon(Loyalty.getUserId(), state.selectedCouponId);
         state.selectedCouponId = null;
     }
     state.points = Loyalty.getPoints();
     state.activeSession = result.session;
     state.chargeStartBalance = isChargingSimulationMode()
         ? Number(result.user.balance || state.walletBalance)
         : Number(result.user.balance || 0) + targetCost;
     state.walletBalance = result.user.balance;
    if (state.currentUser) {
        state.currentUser.balance = result.user.balance;
         state.currentUser.points = state.points;
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

     const kwhPerTick = Math.max(totalKwh / 16, 0.01);

    state.chargingInterval = setInterval(() => {
        state.seconds++;
        state.kwh = Math.min(totalKwh, state.kwh + kwhPerTick);
        state.percent = Math.min(targetPercent, startPercent + percentFromKwh(state.kwh));

         const spent = currentChargeCost();
         updateDisplay();
         updateChargingWallet();

         if (state.kwh >= totalKwh - 0.0001 || state.percent >= targetPercent - 0.01 || spent >= targetCost - 0.01) {
            state.kwh = totalKwh;
            state.percent = targetPercent;
            stopCharging();
        }
    }, 500);
}

function currentChargeCost() {
    const total = Number(state.chargeTotalKwh || 0);
    const progress = total > 0 ? Math.min(1, Number(state.kwh || 0) / total) : 0;
    const finalCost = Number(state.chargeFinalCost != null ? state.chargeFinalCost : state.estimatedCost || 0);
    return finalCost * progress;
}

function updateChargingWallet() {
    const walletEl = document.getElementById('charging-wallet');
    if (walletEl) {
        if (isChargingSimulationMode()) {
            walletEl.textContent = 'Pagar ao final: ' + brl(state.chargeFinalCost || state.estimatedCost || 0);
            walletEl.style.color = '#ff6b6b';
            return;
        }

        const spent = currentChargeCost();
        const baseline = state.chargeStartBalance != null ? state.chargeStartBalance : state.walletBalance;
        const remaining = baseline - spent;
        walletEl.textContent = brl(Math.max(0, remaining));
        walletEl.style.color = remaining <= 0 ? '#ef4444' : 'var(--success)';
    }
}

function renderChargePaymentPanel() {
    const panel = document.getElementById('charge-payment-panel');
    const options = document.getElementById('charge-payment-options');
    const message = document.getElementById('charge-payment-message');
    const payButton = document.getElementById('btn-charge-pay');
    const newChargeButton = document.getElementById('btn-new-charge');

    if (!panel || !options || !message || !payButton) return;

    const canShow = isChargingSimulationMode() && state.activeSession && state.activeSession.status !== 'completed';
    panel.style.display = canShow ? 'block' : 'none';
    if (newChargeButton) newChargeButton.style.display = canShow ? 'none' : '';
    if (!canShow) return;

    const currentMethod = state.chargePaymentMethod || 'wallet';
    options.innerHTML = [
        { value: 'wallet', label: 'Carteira' },
        { value: 'pix', label: 'PIX (simulado)' },
        { value: 'card', label: 'Cartao (simulado)' },
    ].map(item => `
        <label class="payment-method-option ${currentMethod === item.value ? 'selected' : ''}">
            <input type="radio" name="charge-payment-method" value="${item.value}" ${currentMethod === item.value ? 'checked' : ''} />
            <span>${item.label}</span>
        </label>
    `).join('');

    message.className = 'wallet-message';
    message.textContent = 'Total a pagar: ' + brl(state.chargeFinalCost || state.estimatedCost || 0);

    options.querySelectorAll('input[name="charge-payment-method"]').forEach(input => {
        input.addEventListener('change', () => {
            state.chargePaymentMethod = input.value;
            options.querySelectorAll('.payment-method-option').forEach(option => {
                option.classList.toggle('selected', option.contains(input) && input.checked);
            });
        });
    });
}

async function payChargeSession() {
    if (!state.activeSession || !state.activeSession.id) {
        alert('Nao ha sessao pendente para pagamento.');
        return;
    }

    const panelMessage = document.getElementById('charge-payment-message');
    const payButton = document.getElementById('btn-charge-pay');
    const paymentMethod = (state.chargePaymentMethod || (document.querySelector('input[name="charge-payment-method"]:checked') || {}).value || 'wallet');

    try {
        if (payButton) payButton.disabled = true;
        if (panelMessage) {
            panelMessage.className = 'wallet-message';
            panelMessage.textContent = 'Processando pagamento...';
        }

        const result = await GoodWeAPI.payCharge(state.activeSession.id, { payment_method: paymentMethod });
        const previousPoints = Number(state.points || 0);
        const nextPoints = Number(result.user.points != null ? result.user.points : previousPoints);
        const earnedPoints = Number((nextPoints - previousPoints).toFixed(2));
        const sessionId = state.activeSession.id;
        const chargedAmount = Number(result.session.amount_charged || state.chargeFinalCost || 0);

        state.walletBalance = Number(result.user.balance || state.walletBalance);
        if (result.user.points != null) {
            if (earnedPoints > 0 && window.Loyalty) {
                Loyalty.addPointTransaction(
                    Loyalty.getUserId(),
                    earnedPoints,
                    'earned',
                    'Cashback de 10% da recarga - GoodWe',
                    'charge_' + sessionId,
                    chargedAmount
                );
            }
            state.points = nextPoints;
            if (state.currentUser) state.currentUser.points = state.points;
            if (window.Loyalty && state.currentUser) {
                Loyalty.setPoints(state.currentUser.id, state.points);
            }
        }
        if (state.currentUser) state.currentUser.balance = state.walletBalance;

        state.activeSession.status = result.session.status;
        state.activeSession.payment_method = result.session.payment_method;

        const paymentEl = document.getElementById('final-payment-method');
        if (paymentEl) paymentEl.textContent = paymentMethodLabel(result.session.payment_method || paymentMethod);
        const walletEl = document.getElementById('final-wallet');
        if (walletEl) walletEl.textContent = brl(state.walletBalance);

        const pointsRow = document.getElementById('final-points-row');
        const pointsEl = document.getElementById('final-points');
        if (pointsRow && pointsEl) {
            pointsRow.style.display = earnedPoints > 0 ? 'flex' : 'none';
            pointsEl.textContent = '+' + formatPoints(earnedPoints);
        }

        if (panelMessage) {
            panelMessage.className = 'wallet-message';
            panelMessage.textContent = 'Pagamento aprovado com sucesso.';
        }

        renderChargePaymentPanel();
        if (typeof updateWalletDisplay === 'function') updateWalletDisplay();
        if (typeof refreshWalletFromServer === 'function') refreshWalletFromServer();

        setTimeout(() => {
            state.activeSession = null;
            const newChargeButton = document.getElementById('btn-new-charge');
            if (newChargeButton) newChargeButton.style.display = '';
        }, 1000);
    } catch (err) {
        if (panelMessage) {
            panelMessage.className = 'wallet-message error';
            panelMessage.textContent = err.message;
        }
    } finally {
        if (payButton) payButton.disabled = false;
    }
}

async function stopCharging() {
    clearInterval(state.chargingInterval);
    state.chargingInterval = null;

    const session = state.activeSession;
    const actualEnergy = session ? Number(session.energy_kwh) : (state.kwh || 0);
    const actualCost = session ? Number(session.amount_charged) : currentChargeCost();

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('final-time', formatTime(state.seconds));
    setText('final-energy', actualEnergy.toFixed(1) + ' kWh');
    setText('final-cost', brl(actualCost));
    setText('final-estimated', brl(state.estimatedCost || actualCost));
    setText('final-discount', brl(state.chargeDiscount || 0));
    const discountRow = document.getElementById('final-discount-row');
    if (discountRow) discountRow.style.display = state.chargeDiscount > 0 ? 'flex' : 'none';
    setText('final-percent', Math.floor(state.percent) + '%');
    setText('final-tariff', 'Tarifa: ' + brl(TARIFF) + '/kWh');
    setText('final-type', getChargeTypeName(state.chargeType));
    setText('final-user', state.currentUser ? state.currentUser.name : 'Convidado');
    setText('final-wallet', brl(state.walletBalance));
    setText('final-payment-method', paymentMethodLabel(session && session.payment_method ? session.payment_method : 'wallet'));
    showScreen('screen-done');
    renderChargePaymentPanel();

    if (state.currentCharger) {
        try {
            await GoodWeAPI.releaseCharger(state.currentCharger.id);
        } catch (err) {
            console.warn('Não foi possível liberar o carregador:', err.message);
        }
    }

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
     state.selectedCouponId = null;
     state.chargeDiscount = 0;
     state.chargeFinalCost = null;
     state.chargeTotalKwh = null;
     state.isFullChargeConfirmed = false;
     state.chargePaymentMethod = 'wallet';
    state.batteryCurrent = 30;
    state.activeSession = null;
    const paymentPanel = document.getElementById('charge-payment-panel');
    if (paymentPanel) paymentPanel.style.display = 'none';
    const newChargeButton = document.getElementById('btn-new-charge');
    if (newChargeButton) newChargeButton.style.display = '';
    updateDisplay();
    if (GoodWeAPI.isAuthenticated() && typeof refreshWalletFromServer === 'function') {
        refreshWalletFromServer();
    } else {
        state.walletBalance = WALLET_BALANCE;
        updateWalletDisplay();
    }
    const btn = document.getElementById('btn-confirm-type');
    if (btn) {
        btn.style.display = 'none';
        btn.disabled = false;
    }
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
    if (costEl) costEl.textContent = brl(currentChargeCost());
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
    return brl(currentChargeCost());
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
