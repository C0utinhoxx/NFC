const LOYALTY_STORAGE_KEY = 'powertag_loyalty_v1';
const LOYALTY_BENEFITS = [
    { discount_percentage: 5, points_cost: 10 },
    { discount_percentage: 10, points_cost: 25 },
    { discount_percentage: 15, points_cost: 50 },
];

const Loyalty = {
    getStore() {
        try {
            const value = JSON.parse(localStorage.getItem(LOYALTY_STORAGE_KEY) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch (_) {
            return {};
        }
    },

    saveStore(store) {
        localStorage.setItem(LOYALTY_STORAGE_KEY, JSON.stringify(store));
    },

    getUserId() {
        return String(state.currentUser && (state.currentUser.id || state.currentUser.user_id) || 'guest');
    },

    getData(userId) {
        const store = this.getStore();
        const id = String(userId || this.getUserId());
        if (!store[id]) {
            store[id] = { points: 0, coupons: [], point_transactions: [] };
            this.saveStore(store);
        }
        return store[id];
    },

    getPoints(userId) {
        return Number(this.getData(userId).points || 0);
    },

    setPoints(userId, points) {
        const store = this.getStore();
        const id = String(userId || this.getUserId());
        if (!store[id]) store[id] = { points: 0, coupons: [], point_transactions: [] };
        store[id].points = Math.max(0, Number(points || 0));
        this.saveStore(store);
    },

    getAvailableCoupons(userId) {
        return this.getData(userId).coupons.filter(coupon => coupon.status === 'available');
    },

    getCoupons(userId) {
        return this.getData(userId).coupons.slice().sort((a, b) => {
            if (a.status === b.status) return String(b.redeemed_at).localeCompare(String(a.redeemed_at));
            return a.status === 'available' ? -1 : 1;
        });
    },

    getPointTransactions(userId) {
        return this.getData(userId).point_transactions.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    },

    addPointTransaction(userId, points, type, description, referenceId, creditAmount) {
        const store = this.getStore();
        const id = String(userId || this.getUserId());
        if (!store[id]) store[id] = { points: 0, coupons: [], point_transactions: [] };
        if (referenceId && store[id].point_transactions.some(transaction => transaction.reference_id === referenceId)) return false;
        store[id].points = Math.max(0, Number(store[id].points || 0) + Number(points || 0));
        store[id].point_transactions.unshift({
            id: 'pt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            points: Number(points || 0),
            type,
            description,
            reference_id: referenceId || null,
            credit_amount: creditAmount != null ? Number(creditAmount) : null,
            created_at: new Date().toISOString(),
        });
        this.saveStore(store);
        return true;
    },

    confirmDeposit(userId, amount, referenceId) {
        const numericAmount = Number(amount || 0);
        if (numericAmount <= 0) return { points: 0, created: false };
        const points = Math.round(numericAmount * 0.10 * 100) / 100;
        const id = referenceId || 'deposit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const created = this.addPointTransaction(
            userId,
            points,
            'earned',
            'Crédito de R$ ' + numericAmount.toFixed(2).replace('.', ',') + ' adicionado à carteira.',
            id,
            numericAmount
        );
        return { points, created, referenceId: id };
    },

    redeemBenefit(userId, pointsCost, discountPercentage) {
        const store = this.getStore();
        const id = String(userId || this.getUserId());
        if (!store[id]) store[id] = { points: 0, coupons: [], point_transactions: [] };
        const cost = Number(pointsCost || 0);
        if (cost <= 0 || Number(store[id].points || 0) < cost) return null;
        store[id].points = Math.round((Number(store[id].points || 0) - cost) * 100) / 100;
        const coupon = {
            id: 'coupon_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            discount_percentage: Number(discountPercentage || 0),
            points_cost: cost,
            status: 'available',
            redeemed_at: new Date().toISOString(),
            used_at: null,
        };
        store[id].coupons.unshift(coupon);
        store[id].point_transactions.unshift({
            id: 'pt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            points: -cost,
            type: 'redeemed',
            description: 'Resgate do cupom ' + coupon.discount_percentage + '% OFF.',
            reference_id: coupon.id,
            created_at: new Date().toISOString(),
        });
        this.saveStore(store);
        return coupon;
    },

    useCoupon(userId, couponId) {
        const store = this.getStore();
        const id = String(userId || this.getUserId());
        const data = store[id];
        if (!data) return null;
        const coupon = data.coupons.find(item => item.id === couponId && item.status === 'available');
        if (!coupon) return null;
        coupon.status = 'used';
        coupon.used_at = new Date().toISOString();
        this.saveStore(store);
        return coupon;
    },

    getManagerSummary() {
        const store = this.getStore();
        const users = Object.values(store);
        const transactions = users.flatMap(user => user.point_transactions || []);
        const coupons = users.flatMap(user => user.coupons || []);
        return {
            participants: users.filter(user => Number(user.points || 0) > 0 || (user.coupons || []).length > 0).length,
            points_distributed: transactions.filter(transaction => transaction.type === 'earned').reduce((total, transaction) => total + Number(transaction.points || 0), 0),
            coupons_redeemed: coupons.length,
            coupons_used: coupons.filter(coupon => coupon.status === 'used').length,
            discount_value: coupons.filter(coupon => coupon.status === 'used').reduce((total, coupon) => total + Number(coupon.discount_value || 0), 0),
            wallet_credits: transactions.filter(transaction => transaction.type === 'earned').reduce((total, transaction) => total + Number(transaction.credit_amount || 0), 0),
        };
    },

    setCouponDiscountValue(couponId, discountValue) {
        const store = this.getStore();
        Object.values(store).forEach(user => {
            const coupon = (user.coupons || []).find(item => item.id === couponId);
            if (coupon) coupon.discount_value = Number(discountValue || 0);
        });
        this.saveStore(store);
    },
};

window.Loyalty = Loyalty;
window.LOYALTY_BENEFITS = LOYALTY_BENEFITS;
