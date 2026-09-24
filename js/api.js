const API_BASE_URL = (window.GOODWE_API_URL || 'http://127.0.0.1:8000/api');

const AUTH_TOKEN_KEY = 'goodwe_api_token';

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
    } catch (networkError) {
        const err = new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
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
        const err = new Error(message);
        err.status = response.status;
        err.data = data;
        throw err;
    }

    return data;
}

function firstValidationError(errors) {
    if (!errors) return null;
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return null;
    const val = errors[firstKey];
    return Array.isArray(val) ? val[0] : val;
}

const GoodWeAPI = {
    isAuthenticated() {
        return !!getAuthToken();
    },

    async login(email, password) {
        const data = await apiFetch('/login', {
            method: 'POST',
            body: { email, password },
        });
        setAuthToken(data.token);
        return data.user;
    },

    async register(name, email, phone, password) {
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

    async logout() {
        try {
            await apiFetch('/logout', { method: 'POST' });
        } catch (_) {
        }
        clearAuthToken();
    },

    async me() {
        const data = await apiFetch('/user');
        return data.user;
    },

    async listChargers() {
        const data = await apiFetch('/chargers');
        return data.chargers;
    },

    async startCharging(chargerId, payload) {
        return apiFetch('/chargers/' + encodeURIComponent(chargerId) + '/start', {
            method: 'POST',
            body: payload,
        });
    },

    async releaseCharger(chargerId) {
        return apiFetch('/chargers/' + encodeURIComponent(chargerId) + '/release', {
            method: 'POST',
        });
    },

    async getWallet() {
        return apiFetch('/wallet');
    },

    async deposit(amount) {
        return apiFetch('/wallet/deposit', {
            method: 'POST',
            body: { amount },
        });
    },
};

window.GoodWeAPI = GoodWeAPI;
window.clearAuthToken = clearAuthToken;
