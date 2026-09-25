const API_BASE_URL = (window.GOODWE_API_URL || 'http://127.0.0.1:8000/api');

const AUTH_TOKEN_KEY = 'goodwe_api_token';
const API_MODE_KEY = 'goodwe_api_mode';
const SIM_DB_KEY = 'goodwe_sim_db_v1';

let runtimeMode = window.GOODWE_FORCE_SIMULATION
    ? 'simulation'
    : (localStorage.getItem(API_MODE_KEY) || 'unknown');

if (window.GOODWE_FORCE_SIMULATION) {
    localStorage.setItem(API_MODE_KEY, 'simulation');
}

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token) {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
}

function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

function emitModeChange() {
    const label = runtimeMode === 'simulation' ? 'Modo Simulacao' : (runtimeMode === 'real' ? 'Conectado ao Servidor' : 'Conectando...');
    window.dispatchEvent(new CustomEvent('goodwe-api-mode', {
        detail: {
            mode: runtimeMode,
            label,
            apiUrl: API_BASE_URL,
        },
    }));
}

function setRuntimeMode(mode) {
    if (runtimeMode === mode) return;
    runtimeMode = mode;
    localStorage.setItem(API_MODE_KEY, mode);
    emitModeChange();
}

function isSimulationMode() {
    return !!window.GOODWE_FORCE_SIMULATION || runtimeMode === 'simulation';
}

function firstValidationError(errors) {
    if (!errors) return null;
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return null;
    const val = errors[firstKey];
    return Array.isArray(val) ? val[0] : val;
}

function createApiError(message, status, data) {
    const err = new Error(message);
    err.status = status;
    err.data = data || null;
    return err;
}

async function apiFetch(path, options) {
    options = options || {};
    const token = getAuthToken();

    const headers = Object.assign(
        {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        options.headers || {}
    );

    if (token) headers['Authorization'] = 'Bearer ' + token;

    let response;
    try {
        response = await fetch(API_BASE_URL + path, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
    } catch (_) {
        const err = new Error('Nao foi possivel conectar ao servidor.');
        err.isNetworkError = true;
        throw err;
    }

    let data = null;
    try {
        data = await response.json();
    } catch (_) {
        data = null;
    }

    if (!response.ok) {
        const message = (data && (data.message || firstValidationError(data.errors))) || 'Erro inesperado (' + response.status + ')';
        throw createApiError(message, response.status, data);
    }

    return data;
}

function seedSimulationDb() {
    const now = Date.now();
    return {
        users: [],
        chargers: [
            { id: 'CG-001', name: 'Torre A - Norte', location: 'Parking Norte, Piso 1', power_kw: 22, connector: 'Type 2', lat: -23.5505, lng: -46.6333, occupied_until: null, vehicle_plate: null },
            { id: 'CG-002', name: 'Torre A - Sul', location: 'Parking Sul, Piso 2', power_kw: 11, connector: 'Type 2', lat: -23.5620, lng: -46.6540, occupied_until: now + (25 * 60 * 1000), vehicle_plate: 'ABC-1D23' },
            { id: 'CG-003', name: 'Estádio - Setor B', location: 'Estacionamento B, vaga 12', power_kw: 50, connector: 'CCS 2', lat: -23.5670, lng: -46.6920, occupied_until: null, vehicle_plate: null },
            { id: 'CG-004', name: 'Garagem Empresarial', location: 'Avenida Paulista, 1000', power_kw: 7, connector: 'Type 2', lat: -23.5615, lng: -46.6559, occupied_until: now + (70 * 60 * 1000), vehicle_plate: 'XYZ-9Z87' },
            { id: 'CG-005', name: 'Pátio Central', location: 'Pátio Central, portão principal', power_kw: 22, connector: 'Type 2', lat: -23.5470, lng: -46.6380, occupied_until: null, vehicle_plate: null },
        ],
        tokens: {},
        transactions: [],
        charging_sessions: [],
        next_user_id: 1,
        next_transaction_id: 1,
        next_session_id: 1,
    };
}

function getSimulationDb() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SIM_DB_KEY) || 'null');
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.users) && Array.isArray(parsed.chargers)) {
            const defaultChargers = seedSimulationDb().chargers;
            const defaultIds = defaultChargers.map(charger => charger.id);
            const hasCurrentCatalog = defaultIds.every(id => parsed.chargers.some(charger => charger.id === id));
            if (!hasCurrentCatalog) {
                parsed.chargers = defaultChargers;
                localStorage.setItem(SIM_DB_KEY, JSON.stringify(parsed));
            }
            return parsed;
        }
    } catch (_) {
    }
    const seeded = seedSimulationDb();
    localStorage.setItem(SIM_DB_KEY, JSON.stringify(seeded));
    return seeded;
}

function saveSimulationDb(db) {
    localStorage.setItem(SIM_DB_KEY, JSON.stringify(db));
}

function simTransformUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        balance: Number(user.balance || 0),
        points: Number(user.points || 0),
        is_admin: !!user.is_admin,
    };
}

function refreshChargerState(charger) {
    if (charger.occupied_until && Date.now() >= charger.occupied_until) {
        charger.occupied_until = null;
        charger.vehicle_plate = null;
    }
}

function simTransformCharger(charger) {
    refreshChargerState(charger);
    const occupiedMs = charger.occupied_until ? Math.max(0, charger.occupied_until - Date.now()) : 0;
    const available = occupiedMs <= 0;
    return {
        id: charger.id,
        name: charger.name,
        location: charger.location,
        power_kw: charger.power_kw,
        connector: charger.connector,
        status: available ? 'available' : 'occupied',
        is_available: available,
        vehicle_plate: available ? null : charger.vehicle_plate,
        available_in_minutes: available ? null : Math.max(1, Math.ceil(occupiedMs / 60000)),
        estimated_price_per_hour: Number((charger.power_kw * 0.9).toFixed(2)),
        lat: charger.lat,
        lng: charger.lng,
    };
}

function simulationToken(userId) {
    return 'sim-token-' + userId + '-' + Math.random().toString(36).slice(2, 10);
}

function simGetAuthenticatedUserOrFail(db) {
    const token = getAuthToken();
    const userId = token ? db.tokens[token] : null;
    if (!userId) throw createApiError('Nao autenticado.', 401);
    const user = db.users.find(item => item.id === userId);
    if (!user) throw createApiError('Nao autenticado.', 401);
    return user;
}

function createSimTransaction(db, transaction) {
    const row = Object.assign({
        id: db.next_transaction_id++,
        created_at: new Date().toISOString(),
        status: 'approved',
    }, transaction);
    db.transactions.push(row);
    return row;
}

function grantCashbackPoints(db, user, amount, reference) {
    const points = Number((amount * 0.1).toFixed(2));
    if (points <= 0) return 0;
    user.points = Number((Number(user.points || 0) + points).toFixed(2));
    createSimTransaction(db, {
        user_id: user.id,
        type: 'cashback',
        amount: Number((amount * 0.1).toFixed(2)),
        description: 'Cashback de 10% - ' + points.toFixed(2) + ' pontos',
        reference: reference || null,
    });
    return points;
}

function simLogin(email, password) {
    const db = getSimulationDb();
    const user = db.users.find(item => String(item.email).toLowerCase() === String(email).toLowerCase());
    if (!user || String(user.password) !== String(password)) {
        throw createApiError('Credenciais invalidas.', 401);
    }

    const token = simulationToken(user.id);
    db.tokens[token] = user.id;
    saveSimulationDb(db);
    setAuthToken(token);
    return simTransformUser(user);
}

function simRegister(name, email, phone, password) {
    const db = getSimulationDb();
    const existing = db.users.find(item => String(item.email).toLowerCase() === String(email).toLowerCase());
    if (existing) throw createApiError('Este e-mail ja esta em uso.', 422);

    const user = {
        id: db.next_user_id++,
        name,
        email,
        phone,
        password,
        balance: 100,
        points: 0,
        is_admin: false,
    };
    db.users.push(user);
    const token = simulationToken(user.id);
    db.tokens[token] = user.id;
    saveSimulationDb(db);
    setAuthToken(token);
    return simTransformUser(user);
}

function simMe() {
    const db = getSimulationDb();
    const user = simGetAuthenticatedUserOrFail(db);
    saveSimulationDb(db);
    return simTransformUser(user);
}

function simLogout() {
    const db = getSimulationDb();
    const token = getAuthToken();
    if (token && db.tokens[token]) delete db.tokens[token];
    saveSimulationDb(db);
    clearAuthToken();
}

function simListChargers() {
    const db = getSimulationDb();
    const chargers = db.chargers.map(simTransformCharger);
    saveSimulationDb(db);
    return chargers;
}

function simStartCharging(chargerId, payload) {
    const db = getSimulationDb();
    const user = simGetAuthenticatedUserOrFail(db);
    const charger = db.chargers.find(item => item.id === chargerId);
    if (!charger) throw createApiError('Carregador nao encontrado.', 404);

    refreshChargerState(charger);
    if (charger.occupied_until) throw createApiError('Carregador indisponivel no momento.', 422);

    const energy = Number(payload.energy_kwh || 0);
    const amount = Number(payload.amount || 0);
    if (energy <= 0 || amount <= 0) throw createApiError('Dados de recarga invalidos.', 422);

    const estimatedMinutes = Math.max(5, Math.ceil((energy / Math.max(1, Number(charger.power_kw || 1))) * 60));
    charger.occupied_until = Date.now() + (estimatedMinutes * 60 * 1000);
    charger.vehicle_plate = 'SIM-' + String(user.id).padStart(4, '0');

    const session = {
        id: db.next_session_id++,
        user_id: user.id,
        charger_id: charger.id,
        charger_name: charger.name,
        energy_kwh: Number(energy.toFixed(2)),
        amount_charged: Number(amount.toFixed(2)),
        payment_method: null,
        status: 'pending_payment',
        created_at: new Date().toISOString(),
        charge_type: payload.charge_type || 'partial',
        target_percent: payload.target_percent != null ? Number(payload.target_percent) : null,
    };
    db.charging_sessions.push(session);
    saveSimulationDb(db);

    return {
        message: 'Recarga iniciada com sucesso.',
        charger: simTransformCharger(charger),
        session: {
            id: session.id,
            charger_name: session.charger_name,
            energy_kwh: session.energy_kwh,
            amount_charged: session.amount_charged,
            status: session.status,
            payment_method: session.payment_method,
        },
        user: {
            balance: Number(user.balance || 0),
            points: Number(user.points || 0),
        },
    };
}

function simReleaseCharger(chargerId) {
    const db = getSimulationDb();
    const charger = db.chargers.find(item => item.id === chargerId);
    if (!charger) throw createApiError('Carregador nao encontrado.', 404);
    charger.occupied_until = null;
    charger.vehicle_plate = null;
    saveSimulationDb(db);
    return {
        message: 'Carregador liberado.',
        charger: simTransformCharger(charger),
    };
}

function simGetWallet() {
    const db = getSimulationDb();
    const user = simGetAuthenticatedUserOrFail(db);
    const history = db.transactions
        .filter(item => item.user_id === user.id)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map(item => ({
            id: item.id,
            type: item.type,
            amount: Number(item.amount),
            description: item.description,
            status: item.status || 'approved',
            payment_method: item.payment_method || null,
            created_at: item.created_at,
        }));

    saveSimulationDb(db);
    return {
        balance: Number(user.balance || 0),
        points: Number(user.points || 0),
        history,
    };
}

function simDeposit(amount, options) {
    const db = getSimulationDb();
    const user = simGetAuthenticatedUserOrFail(db);
    const numericAmount = Number(amount || 0);
    if (numericAmount <= 0) throw createApiError('Informe um valor maior que zero.', 422);

    const method = (options && options.payment_method) || 'wallet';
    if (!['wallet', 'pix', 'card'].includes(method)) throw createApiError('Metodo de pagamento invalido.', 422);

    user.balance = Number((Number(user.balance || 0) + numericAmount).toFixed(2));
    const transaction = createSimTransaction(db, {
        user_id: user.id,
        type: 'deposit',
        amount: Number(numericAmount.toFixed(2)),
        description: 'Deposito de R$ ' + numericAmount.toFixed(2),
        payment_method: method,
        status: method === 'wallet' ? 'approved' : 'pending',
    });

    grantCashbackPoints(db, user, numericAmount, 'deposit_' + transaction.id);

    if (method !== 'wallet') {
        transaction.status = 'approved';
    }

    saveSimulationDb(db);
    return {
        message: 'Credito confirmado.',
        balance: Number(user.balance || 0),
        points: Number(user.points || 0),
        payment_method: method,
        status: transaction.status,
        transaction_id: transaction.id,
    };
}

function simPayCharge(sessionId, options) {
    const db = getSimulationDb();
    const user = simGetAuthenticatedUserOrFail(db);
    const method = options && options.payment_method ? options.payment_method : 'wallet';
    if (!['wallet', 'pix', 'card'].includes(method)) throw createApiError('Metodo de pagamento invalido.', 422);

    const session = db.charging_sessions.find(item => item.id === Number(sessionId) && item.user_id === user.id);
    if (!session) throw createApiError('Sessao de recarga nao encontrada.', 404);
    if (session.status === 'completed') {
        return {
            message: 'Sessao ja esta paga.',
            user: { balance: Number(user.balance || 0), points: Number(user.points || 0) },
            session: {
                id: session.id,
                status: session.status,
                amount_charged: Number(session.amount_charged || 0),
                payment_method: session.payment_method,
            },
            payment: { method, status: 'approved' },
        };
    }

    const amount = Number(session.amount_charged || 0);
    if (method === 'wallet' && Number(user.balance || 0) < amount) {
        throw createApiError('Saldo insuficiente para concluir o pagamento via carteira.', 422);
    }

    if (method === 'wallet') {
        user.balance = Number((Number(user.balance || 0) - amount).toFixed(2));
    }

    createSimTransaction(db, {
        user_id: user.id,
        type: 'charge_payment',
        amount,
        description: 'Pagamento de recarga - ' + session.charger_name,
        payment_method: method,
        status: method === 'wallet' ? 'approved' : 'pending',
    });

    grantCashbackPoints(db, user, amount, 'charge_' + session.id);

    session.status = 'completed';
    session.payment_method = method;

    saveSimulationDb(db);
    return {
        message: 'Pagamento aprovado.',
        user: {
            balance: Number(user.balance || 0),
            points: Number(user.points || 0),
        },
        session: {
            id: session.id,
            status: session.status,
            amount_charged: amount,
            payment_method: session.payment_method,
        },
        payment: {
            method,
            status: 'approved',
        },
    };
}

async function withFallback(realOperation, simulationOperation) {
    if (window.GOODWE_FORCE_SIMULATION || isSimulationMode()) {
        setRuntimeMode('simulation');
        return simulationOperation();
    }

    try {
        const data = await realOperation();
        setRuntimeMode('real');
        return data;
    } catch (err) {
        if (!err || !err.isNetworkError) throw err;
        setRuntimeMode('simulation');
        return simulationOperation();
    }
}

const GoodWeAPI = {
    isAuthenticated() {
        return !!getAuthToken();
    },

    isSimulationMode() {
        return isSimulationMode();
    },

    getEnvironmentLabel() {
        return runtimeMode === 'simulation' ? 'Modo Simulacao' : (runtimeMode === 'real' ? 'Conectado ao Servidor' : 'Conectando...');
    },

    async login(email, password) {
        const user = await withFallback(
            async () => {
                const data = await apiFetch('/login', {
                    method: 'POST',
                    body: { email, password },
                });
                setAuthToken(data.token);
                return data.user;
            },
            async () => simLogin(email, password)
        );
        return user;
    },

    async register(name, email, phone, password) {
        const user = await withFallback(
            async () => {
                const data = await apiFetch('/register', {
                    method: 'POST',
                    body: {
                        name,
                        email,
                        phone,
                        password,
                        password_confirmation: password,
                    },
                });
                setAuthToken(data.token);
                return data.user;
            },
            async () => simRegister(name, email, phone, password)
        );
        return user;
    },

    async logout() {
        if (isSimulationMode()) {
            simLogout();
            return;
        }
        try {
            await apiFetch('/logout', { method: 'POST' });
            setRuntimeMode('real');
        } catch (err) {
            if (err && err.isNetworkError) {
                setRuntimeMode('simulation');
                simLogout();
                return;
            }
        }
        clearAuthToken();
    },

    async me() {
        if (isSimulationMode()) return simMe();
        const data = await withFallback(
            async () => apiFetch('/user'),
            async () => ({ user: simMe() })
        );
        return data.user;
    },

    async listChargers() {
        const data = await withFallback(
            async () => apiFetch('/chargers'),
            async () => ({ chargers: simListChargers() })
        );
        return data.chargers;
    },

    async startCharging(chargerId, payload) {
        if (isSimulationMode()) return simStartCharging(chargerId, payload || {});
        return withFallback(
            async () => apiFetch('/chargers/' + encodeURIComponent(chargerId) + '/start', {
                method: 'POST',
                body: payload,
            }),
            async () => simStartCharging(chargerId, payload || {})
        );
    },

    async releaseCharger(chargerId) {
        if (isSimulationMode()) return simReleaseCharger(chargerId);
        return withFallback(
            async () => apiFetch('/chargers/' + encodeURIComponent(chargerId) + '/release', {
                method: 'POST',
            }),
            async () => simReleaseCharger(chargerId)
        );
    },

    async getWallet() {
        if (isSimulationMode()) return simGetWallet();
        return withFallback(
            async () => apiFetch('/wallet'),
            async () => simGetWallet()
        );
    },

    async deposit(amount, options) {
        if (isSimulationMode()) return simDeposit(amount, options || {});
        return withFallback(
            async () => apiFetch('/wallet/deposit', {
                method: 'POST',
                body: {
                    amount,
                },
            }),
            async () => simDeposit(amount, options || {})
        );
    },

    async payCharge(sessionId, options) {
        if (isSimulationMode()) return simPayCharge(sessionId, options || {});
        throw createApiError('Pagamento pos-recarga esta disponivel no modo simulacao.', 400);
    },
};

window.GoodWeAPI = GoodWeAPI;
window.clearAuthToken = clearAuthToken;
emitModeChange();
