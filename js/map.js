let map = null;
let userMarker = null;
let chargerMarkers = [];
let routeLine = null;
let userPosition = null;
let chargersLayer = null;
let chargersById = {};

const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 };
const PUBLIC_CHARGING_URL = 'https://overpass-api.de/api/interpreter';
const PUBLIC_CHARGING_CACHE_KEY = 'goodwe_public_chargers_v1';
const DEFAULT_PUBLIC_CHARGERS = [
    ['osm-node-5649812371', 'Assai Vila Guilherme', -23.5220436, -46.6017625],
    ['osm-node-6361077255', 'Mobike', -23.5720384, -46.6965196],
    ['osm-node-7098550069', 'Eletroposto', -23.5015679, -46.733278],
    ['osm-node-12190026409', 'ChargePoint', -23.524961, -46.6670982],
    ['osm-node-12303216043', 'Eletroposto', -23.618914, -46.602196],
    ['osm-node-12474286528', 'Eletroposto', -23.5258218, -46.7326867],
    ['osm-node-12474324132', 'Eletroposto', -23.5179967, -46.7270876],
    ['osm-node-13189098501', 'Phone charging station', -23.5249094, -46.6675212],
    ['osm-node-13235612198', 'Eletroposto', -23.667906, -46.6780725],
    ['osm-node-13408712444', 'Intelbras', -23.7043841, -46.5778873],
    ['osm-node-13952255937', 'Troove Lopes | Robert Kennedy SBC', -23.7038527, -46.5766502],
    ['osm-node-13988044273', 'Eletroposto Karg', -23.6933276, -46.5509385],
    ['osm-way-371432992', 'Go Eletric', -23.5684088, -46.6117302],
    ['osm-way-909127223', 'Enel', -23.5485132, -46.7359186],
    ['osm-way-1349984736', 'AES Brasil', -23.6083194, -46.6964068],
    ['osm-way-1415079809', 'Eletroposto', -23.5737453, -46.642004],
].map(([id, name, lat, lng]) => ({
    id,
    name,
    location: 'Local informado no OpenStreetMap',
    power_kw: 7,
    connector: 'Não informado',
    lat,
    lng,
    status: 'available',
    is_available: true,
    vehicle_plate: null,
    available_in_minutes: null,
    estimated_price_per_hour: null,
    source: 'openstreetmap',
    source_label: 'OpenStreetMap',
}));

async function fetchPublicChargingStations(lat, lng) {
    const radius = 20000;
    const query = `[out:json][timeout:20];(node["amenity"="charging_station"](around:${radius},${lat},${lng});way["amenity"="charging_station"](around:${radius},${lat},${lng});relation["amenity"="charging_station"](around:${radius},${lat},${lng}););out center tags;`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let cached = [];

    try {
        cached = JSON.parse(localStorage.getItem(PUBLIC_CHARGING_CACHE_KEY) || '[]');
        if (!Array.isArray(cached)) cached = [];
    } catch (_) {
        cached = [];
    }

    try {
        const response = await fetch(PUBLIC_CHARGING_URL + '?data=' + encodeURIComponent(query), {
            signal: controller.signal,
        });
        if (!response.ok) throw new Error('Overpass respondeu ' + response.status);
        const data = await response.json();
        const chargers = (data.elements || []).map(element => {
            const tags = element.tags || {};
            const point = element.center || { lat: element.lat, lng: element.lon };
            const name = tags.name || tags.brand || 'Eletroposto';
            const location = tags['addr:street'] || tags['addr:city'] || 'Local informado no OpenStreetMap';
            const power = Number(tags['charging:power'] || tags.power || 0);
            const connector = tags.connector || tags['charging:connector'] || 'Não informado';

            return {
                id: 'osm-' + element.type + '-' + element.id,
                name,
                location,
                power_kw: power > 0 ? power : 7,
                connector,
                lat: point.lat,
                lng: point.lon != null ? point.lon : point.lng,
                status: 'available',
                is_available: true,
                vehicle_plate: null,
                available_in_minutes: null,
                estimated_price_per_hour: null,
                source: 'openstreetmap',
                source_label: 'OpenStreetMap',
            };
        }).filter(charger => charger.lat != null && charger.lng != null);
        localStorage.setItem(PUBLIC_CHARGING_CACHE_KEY, JSON.stringify(chargers));
        return chargers;
    } catch (_) {
        const fallback = cached.length ? cached : DEFAULT_PUBLIC_CHARGERS;
        return fallback.filter(charger => calculateDistance(lat, lng, charger.lat, charger.lng) <= radius);
    } finally {
        clearTimeout(timeout);
    }
}

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

    const prepareChargers = chargers => chargers
        .filter(charger => charger.lat != null && charger.lng != null)
        .map(charger => ({ ...charger, _dist: calculateDistance(lat, lng, charger.lat, charger.lng) }))
        .sort((a, b) => a._dist - b._dist);

    let goodweChargers = [];
    try {
        goodweChargers = (await GoodWeAPI.listChargers()).map(charger => ({ ...charger, source: 'goodwe', source_label: 'GoodWe' }));
        renderStations(prepareChargers(goodweChargers));
    } catch (err) {
        console.warn('Não foi possível carregar carregadores da rede GoodWe:', err.message);
    }

    try {
        const publicChargers = await fetchPublicChargingStations(lat, lng);
        renderStations(prepareChargers(goodweChargers.concat(publicChargers)));
    } catch (err) {
        console.warn('Não foi possível buscar eletropostos públicos:', err.message);
        if (countEl && goodweChargers.length === 0) {
            countEl.innerHTML = 'Não foi possível carregar os eletropostos.';
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
        const available = charger.is_available !== false;
        const color = available ? '#e53935' : '#8a8f98';
        const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;">${iconSvg}</div>`,
            iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18]
        });
        const marker = L.marker([charger.lat, charger.lng], { icon }).addTo(chargersLayer);
        const distanceLabel = charger._dist < 1 ? (charger._dist * 1000).toFixed(0) + ' m' : charger._dist.toFixed(1) + ' km';
        const statusLabel = charger.source === 'openstreetmap'
            ? '<span style="color:#ff6b6b;font-weight:600;">Informado no mapa</span>'
            : (available
                ? '<span style="color:#10b981;font-weight:600;">Disponível</span>'
                : `<span style="color:#ef4444;font-weight:600;">Ocupado${charger.available_in_minutes != null ? ' · libera em ~' + charger.available_in_minutes + ' min' : ''}</span>`);
        const popupContent = `<div class="charger-popup">
            <h3>${charger.name}</h3>
            <span class="popup-type">${charger.source_label || 'GoodWe'} · ${charger.connector}</span>
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
            const goodweCount = chargers.filter(charger => charger.source === 'goodwe').length;
            const publicCount = chargers.length - goodweCount;
            countEl.innerHTML = `<strong>${chargers.length}</strong> eletroposto(s) encontrado(s) · ${goodweCount} GoodWe + ${publicCount} públicos`;
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
