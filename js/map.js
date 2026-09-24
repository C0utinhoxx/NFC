let map = null;
let userMarker = null;
let chargerMarkers = [];
let routeLine = null;
let userPosition = null;
let chargersLayer = null;
let chargersById = {};

const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 };

function initMap() {
    if (map) return;
    map = L.map('main-map', {
        center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        zoom: 13,
        zoomControl: true,
        preferCanvas: true,
        renderer: L.canvas({ padding: 0.5 })
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    chargersLayer = L.layerGroup().addTo(map);

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
            const userIcon = L.divIcon({ className: 'user-marker', html: '', iconSize: [20, 20], iconAnchor: [10, 10] });
            userMarker = L.marker([userPosition.lat, userPosition.lng], { icon: userIcon }).addTo(map);
            userMarker.bindPopup('Você está aqui');
            map.setView([userPosition.lat, userPosition.lng], 14);
            loadNearbyChargers(userPosition.lat, userPosition.lng);
        },
        (error) => {
            console.warn('Geolocalização negada:', error);
            userPosition = { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };
            const userIcon = L.divIcon({ className: 'user-marker', html: '', iconSize: [20, 20], iconAnchor: [10, 10] });
            userMarker = L.marker([userPosition.lat, userPosition.lng], { icon: userIcon }).addTo(map);
            userMarker.bindPopup('Localização padrão');
            map.setView([userPosition.lat, userPosition.lng], 14);
            loadNearbyChargers(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

async function loadNearbyChargers(lat, lng) {
    if (!chargersLayer) return;
    const loadingEl = document.getElementById('map-loading');
    const countEl = document.getElementById('map-count');
    if (loadingEl) loadingEl.classList.add('active');
    if (countEl) countEl.classList.remove('active');

    try {
        const chargers = await GoodWeAPI.listChargers();
        const withCoords = chargers.filter(c => c.lat != null && c.lng != null);
        const nearby = withCoords
            .map(charger => ({ ...charger, _dist: calculateDistance(lat, lng, charger.lat, charger.lng) }))
            .sort((a, b) => a._dist - b._dist);
        renderStations(nearby);
    } catch (err) {
        console.warn('Não foi possível carregar carregadores da rede GoodWe:', err.message);
        if (loadingEl) loadingEl.classList.remove('active');
        if (countEl) {
            countEl.innerHTML = 'Não foi possível carregar os carregadores.';
            countEl.classList.add('active');
        }
    }
}

function renderStations(chargers) {
    chargersLayer.clearLayers();
    chargerMarkers = [];
    chargersById = {};

    const loadingEl = document.getElementById('map-loading');
    const countEl = document.getElementById('map-count');
    if (loadingEl) loadingEl.classList.remove('active');

    chargers.forEach(charger => {
        chargersById[charger.id] = charger;
        const available = charger.is_available;
        const color = available ? '#e53935' : '#8a8f98';
        const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;">${iconSvg}</div>`,
            iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18]
        });
        const marker = L.marker([charger.lat, charger.lng], { icon }).addTo(chargersLayer);
        const distanceLabel = charger._dist < 1 ? (charger._dist * 1000).toFixed(0) + ' m' : charger._dist.toFixed(1) + ' km';
        const statusLabel = available
            ? '<span style="color:#10b981;font-weight:600;">Disponível</span>'
            : `<span style="color:#ef4444;font-weight:600;">Ocupado${charger.available_in_minutes != null ? ' · libera em ~' + charger.available_in_minutes + ' min' : ''}</span>`;
        const popupContent = `<div class="charger-popup">
            <h3>${charger.name}</h3>
            <span class="popup-type">Rede GoodWe · ${charger.connector}</span>
            <p><strong>Potência:</strong> ${charger.power_kw} kW</p>
            <p><strong>Status:</strong> ${statusLabel}</p>
            <p><strong>Distância:</strong> ${distanceLabel}</p>
            <button class="popup-btn" onclick="window.selectAndStartRoute('${charger.id}')">Ver Rota</button>
        </div>`;
        marker.bindPopup(popupContent, { maxWidth: 260 });
        chargerMarkers.push({ marker, charger });
    });

    if (countEl) {
        if (chargers.length > 0) {
            countEl.innerHTML = `<strong>${chargers.length}</strong> carregador(es) da rede GoodWe encontrado(s)`;
        } else {
            countEl.innerHTML = 'Nenhum carregador encontrado por perto';
        }
        countEl.classList.add('active');
    }
}

function selectAndStartRoute(chargerId) {
    const charger = chargersById[chargerId];
    if (!charger) return;
    const distance = calculateDistance(userPosition.lat, userPosition.lng, charger.lat, charger.lng);
    state.selectedCharger = { id: charger.id, name: charger.name, lat: charger.lat, lng: charger.lng, distance };
    startRoute(charger.lat, charger.lng, charger.name);
}

function startRoute(destLat, destLng, name) {
    if (!userPosition) { alert('Aguarde sua localização ser detectada.'); return; }
    map.closePopup();
    const distance = calculateDistance(userPosition.lat, userPosition.lng, destLat, destLng);
    const timeEstimate = Math.ceil(distance * 3);
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline([[userPosition.lat, userPosition.lng], [destLat, destLng]], { color: '#e53935', weight: 4, opacity: 0.8, dashArray: '10, 10', lineCap: 'round' }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
    const routeControl = document.getElementById('route-control');
    if (routeControl) {
        routeControl.classList.add('active');
        routeControl.innerHTML = `<div class="route-info-box"><p class="route-info-title">Rota para ${name}</p><p class="route-info-detail">${distance < 1 ? (distance * 1000).toFixed(0) + ' m' : distance.toFixed(1) + ' km'} | ~${timeEstimate} min</p><a class="route-info-link" href="https://www.google.com/maps/dir/?api=1&origin=${userPosition.lat},${userPosition.lng}&destination=${destLat},${destLng}&travelmode=driving" target="_blank">Abrir no Google Maps</a></div><button class="btn-cancel-route" onclick="cancelRoute()">Cancelar Rota</button>`;
    }
}

function cancelRoute() {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    const routeControl = document.getElementById('route-control');
    if (routeControl) { routeControl.classList.remove('active'); routeControl.innerHTML = ''; }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

window.selectAndStartRoute = selectAndStartRoute;
window.startRoute = startRoute;
window.cancelRoute = cancelRoute;
