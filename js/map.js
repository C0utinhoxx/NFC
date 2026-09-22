let map = null;
let userMarker = null;
let chargerMarkers = [];
let routeLine = null;
let userPosition = null;
let chargersLayer = null;

const STATIONS = [
    { name: "Shell Recharge - Jardins", lat: -23.5615, lng: -46.6559, operator: "Shell Recharge" },
    { name: "WBES - Paulista", lat: -23.5620, lng: -46.6540, operator: "WBES" },
    { name: "Electromaps - Pinheiros", lat: -23.5670, lng: -46.6920, operator: "Electromaps" },
    { name: "Shell Recharge - Morumbi", lat: -23.6010, lng: -46.6970, operator: "Shell Recharge" },
    { name: "ReeCharge - Vila Madalena", lat: -23.5480, lng: -46.6910, operator: "ReeCharge" },
    { name: "WBES - Vila Olímpia", lat: -23.5970, lng: -46.6830, operator: "WBES" },
    { name: "Electromaps - Moema", lat: -23.6160, lng: -46.6710, operator: "Electromaps" },
    { name: "Shell Recharge - Aeroporto", lat: -23.4310, lng: -46.4730, operator: "Shell Recharge" },
    { name: "Carregaê - São Caetano", lat: -23.6250, lng: -46.5990, operator: "Carregaê" },
    { name: "WBES - Santo Amaro", lat: -23.6220, lng: -46.6610, operator: "WBES" },
    { name: "Electromaps - Guarulhos", lat: -23.4680, lng: -46.5330, operator: "Electromaps" },
    { name: "Shell Recharge - Campinas", lat: -22.9050, lng: -47.0600, operator: "Shell Recharge" },
    { name: "WBES - Campinas", lat: -22.9100, lng: -47.0550, operator: "WBES" },
    { name: "Shell Recharge - Santo André", lat: -23.6650, lng: -46.5300, operator: "Shell Recharge" },
    { name: "Electromaps - Santo André", lat: -23.6700, lng: -46.5350, operator: "Electromaps" },
    { name: "WBES - Pinheiros", lat: -23.5630, lng: -46.6800, operator: "WBES" },
    { name: "Electromaps - Itaim Bibi", lat: -23.5900, lng: -46.6700, operator: "Electromaps" },
    { name: "Shell Recharge - Barra Funda", lat: -23.5350, lng: -46.6700, operator: "Shell Recharge" },
    { name: "WBES - Lapa", lat: -23.5480, lng: -46.6750, operator: "WBES" },
    { name: "Electromaps - Consolação", lat: -23.5550, lng: -46.6600, operator: "Electromaps" },
    { name: "Shell Recharge - Brooklin", lat: -23.6110, lng: -46.6600, operator: "Shell Recharge" },
    { name: "WBES - Jardins", lat: -23.5650, lng: -46.6650, operator: "WBES" },
    { name: "Electromaps - Vila Nova Conceição", lat: -23.6040, lng: -46.6580, operator: "Electromaps" },
    { name: "Shell Recharge - Taboão", lat: -23.6420, lng: -46.7200, operator: "Shell Recharge" },
    { name: "Electromaps - Guaianases", lat: -23.5620, lng: -46.5150, operator: "Electromaps" },
    { name: "WBES - Tatuapé", lat: -23.5550, lng: -46.5550, operator: "WBES" },
    { name: "Electromaps - Penha", lat: -23.5350, lng: -46.5500, operator: "Electromaps" },
    { name: "Shell Recharge - Santo Amaro", lat: -23.6400, lng: -46.6700, operator: "Shell Recharge" },
    { name: "WBES - Campo Belo", lat: -23.6080, lng: -46.6500, operator: "WBES" },
    { name: "Electromaps - Jardim Paulista", lat: -23.5700, lng: -46.6700, operator: "Electromaps" },
    { name: "Shell Recharge - Lapa", lat: -23.5400, lng: -46.6780, operator: "Shell Recharge" },
    { name: "WBES - Perdizes", lat: -23.5500, lng: -46.6720, operator: "WBES" },
    { name: "Electromaps - Barra Funda", lat: -23.5320, lng: -46.6750, operator: "Electromaps" },
    { name: "Shell Recharge - Parelheiros", lat: -23.6360, lng: -46.7280, operator: "Shell Recharge" },
    { name: "WBES - Cidade Ademar", lat: -23.6250, lng: -46.6500, operator: "WBES" },
    { name: "Electromaps - M'Boi Mirim", lat: -23.6450, lng: -46.7100, operator: "Electromaps" },
    { name: "Shell Recharge - São Mateus", lat: -23.6280, lng: -46.5400, operator: "Shell Recharge" },
    { name: "WBES - Jabaquara", lat: -23.6360, lng: -46.6400, operator: "WBES" },
    { name: "Electromaps - Interlagos", lat: -23.6500, lng: -46.6900, operator: "Electromaps" },
    { name: "Shell Recharge - Capão Redondo", lat: -23.6600, lng: -46.7100, operator: "Shell Recharge" },
    { name: "WBES - Marsilac", lat: -23.6800, lng: -46.7500, operator: "WBES" },
    { name: "Electromaps - ABC", lat: -23.6900, lng: -46.7300, operator: "Electromaps" },
    { name: "Shell Recharge - Diadema", lat: -23.6850, lng: -46.6250, operator: "Shell Recharge" },
    { name: "WBES - São Bernardo", lat: -23.6950, lng: -46.5700, operator: "WBES" },
    { name: "Electromaps - Mauá", lat: -23.6600, lng: -46.4600, operator: "Electromaps" },
    { name: "Shell Recharge - Ribeirão Pires", lat: -23.6600, lng: -46.4000, operator: "Shell Recharge" },
    { name: "WBES - Rio Grande da Serra", lat: -23.7300, lng: -46.4000, operator: "WBES" },
    { name: "Electromaps - Mogi das Cruzes", lat: -23.5200, lng: -46.1900, operator: "Electromaps" },
    { name: "Shell Recharge - Suzano", lat: -23.5100, lng: -46.3100, operator: "Shell Recharge" },
    { name: "WBES - Ferraz de Vasconcelos", lat: -23.5400, lng: -46.2600, operator: "WBES" },
];

function initMap() {
    map = L.map('main-map', {
        center: [-23.5505, -46.6333],
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
            userPosition = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            const userIcon = L.divIcon({
                className: 'user-marker',
                html: '',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            userMarker = L.marker([userPosition.lat, userPosition.lng], { icon: userIcon }).addTo(map);
            userMarker.bindPopup('Você está aqui');
            map.setView([userPosition.lat, userPosition.lng], 14);
            loadNearbyChargers(userPosition.lat, userPosition.lng);
        },
        (error) => {
            console.warn('Geolocalização negada:', error);
            userPosition = { lat: -23.5505, lng: -46.6333 };
            const userIcon = L.divIcon({
                className: 'user-marker',
                html: '',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            userMarker = L.marker([userPosition.lat, userPosition.lng], { icon: userIcon }).addTo(map);
            userMarker.bindPopup('Localização padrão');
            map.setView([userPosition.lat, userPosition.lng], 14);
            loadNearbyChargers(-23.5505, -46.6333);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function loadNearbyChargers(lat, lng) {
    if (!chargersLayer) return;
    chargersLayer.clearLayers();
    chargerMarkers = [];

    const loadingEl = document.getElementById('map-loading');
    const countEl = document.getElementById('map-count');
    if (loadingEl) loadingEl.classList.add('active');
    if (countEl) countEl.classList.remove('active');

    setTimeout(() => {
        const nearby = STATIONS.map(station => ({
            ...station,
            _dist: calculateDistance(lat, lng, station.lat, station.lng)
        })).sort((a, b) => a._dist - b._dist);
        renderStations(nearby, lat, lng);
    }, 300);
}

function renderStations(stations, lat, lng) {
    const loadingEl = document.getElementById('map-loading');
    const countEl = document.getElementById('map-count');
    if (loadingEl) loadingEl.classList.remove('active');

    stations.forEach(station => {
        const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>`;

        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:#e53935;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;">${iconSvg}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18]
        });

        const marker = L.marker([station.lat, station.lng], { icon }).addTo(chargersLayer);
        const popupContent = `
            <div class="charger-popup">
                <h3>${station.name}</h3>
                <span class="popup-type">Posto de Recarga</span>
                ${station.operator ? `<p><strong>Operador:</strong> ${station.operator}</p>` : ''}
                <p><strong>Distância:</strong> ${station._dist < 1 ? (station._dist * 1000).toFixed(0) + ' m' : station._dist.toFixed(1) + ' km'}</p>
                <button class="popup-btn" onclick="window.selectAndStartRoute(${station.lat}, ${station.lng}, '${station.name.replace(/'/g, "\\'")}')">Ver Rota</button>
            </div>
        `;
        marker.bindPopup(popupContent, { maxWidth: 260 });
        chargerMarkers.push({ marker, station });
    });

    if (stations.length > 0) {
        if (countEl) {
            countEl.innerHTML = `<strong>${stations.length}</strong> posto(s) elétrico(s) encontrado(s)`;
            countEl.classList.add('active');
        }
    } else {
        if (countEl) {
            countEl.innerHTML = 'Nenhum posto encontrado por perto';
            countEl.classList.add('active');
        }
    }
}

function selectAndStartRoute(destLat, destLng, name) {
    state.selectedCharger = {
        name: name,
        lat: destLat,
        lng: destLng,
        distance: calculateDistance(userPosition.lat, userPosition.lng, destLat, destLng)
    };
    startRoute(destLat, destLng, name);
}

window.selectAndStartRoute = selectAndStartRoute;
window.startRoute = startRoute;
window.cancelRoute = cancelRoute;

function startRoute(destLat, destLng, name) {
    if (!userPosition) {
        alert('Aguarde sua localização ser detectada.');
        return;
    }

    map.closePopup();

    const distance = calculateDistance(userPosition.lat, userPosition.lng, destLat, destLng);
    const timeEstimate = Math.ceil(distance * 3);

    state.selectedCharger = {
        name: name,
        lat: destLat,
        lng: destLng,
        distance: distance
    };

    if (routeLine) map.removeLayer(routeLine);

    routeLine = L.polyline([
        [userPosition.lat, userPosition.lng],
        [destLat, destLng]
    ], {
        color: '#e53935',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10',
        lineCap: 'round'
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    const routeControl = document.getElementById('route-control');
    if (routeControl) {
        routeControl.classList.add('active');
        routeControl.innerHTML = `
            <div class="route-info-box">
                <p class="route-info-title">Rota para ${name}</p>
                <p class="route-info-detail">${distance < 1 ? (distance * 1000).toFixed(0) + ' m' : distance.toFixed(1) + ' km'} | ~${timeEstimate} min</p>
                <a class="route-info-link" href="https://www.google.com/maps/dir/?api=1&origin=${userPosition.lat},${userPosition.lng}&destination=${destLat},${destLng}&travelmode=driving" target="_blank">Abrir no Google Maps</a>
            </div>
            <button class="btn-cancel-route" onclick="cancelRoute()">Cancelar Rota</button>
        `;
    }
}

function cancelRoute() {
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }
    const routeControl = document.getElementById('route-control');
    if (routeControl) {
        routeControl.classList.remove('active');
        routeControl.innerHTML = '';
    }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
