/*
 * GoodWe PWA - Service Worker
 *
 * Estrategia de cache (conservadora de proposito):
 *
 *   1. Navegacao (index.html)  -> NETWORK FIRST
 *      Sempre tenta a rede. So usa o cache se a rede falhar.
 *      => Depois de um deploy na Vercel o usuario recebe o HTML novo
 *         imediatamente, sem depender de cache.
 *
 *   2. Assets estaticos (css/js/imagens) -> STALE WHILE REVALIDATE
 *      Responde instantaneamente do cache e atualiza em segundo plano.
 *      Risco baixo: no proximo carregamento ja vem a versao nova.
 *
 *   3. Tudo o que for de outra origem (Leaflet CDN, tiles do mapa,
 *      fontes, API) -> NAO E CACHEADO. Vai direto para a rede.
 *
 * Regra de ouro: nao cachear sw.js nem manifest.json, senao o navegador
 * ficaria preso numa versao antiga do proprio service worker.
 *
 * Para publicar uma mudanca que afete o cache, altere CACHE_VERSION.
 * O activate apaga todos os caches antigos automaticamente.
 */

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'goodwe-pwa-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

/* Resolvidos contra a URL do proprio sw.js -> funcionam na raiz do dominio. */
const OFFLINE_FALLBACK = new URL('./index.html', self.location.href).href;

/* Lista minima do "app shell". Nao inclua arquivos que mudam sozinhos. */
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/api.js',
    './js/loyalty.js',
    './js/app.js',
    './js/map.js',
    './js/charging.js',
    './js/nfc.js',
    './js/pwa.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
];

/* INSTALL: pré-carrega o app shell. */
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        // allSettled: se UM arquivo falhar, o install nao inteiro quebra.
        // 'reload' ignora o cache HTTP para pegar a versao mais recente.
        await Promise.allSettled(
            PRECACHE_URLS.map((url) =>
                cache.add(new Request(new URL(url, self.location.href).href, { cache: 'reload' }))
            )
        );
        await self.skipWaiting();
    })());
});

/* ACTIVATE: limpa versoes antigas e assume o controle das abas abertas. */
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

/* Permite forcar a ativacao via postMessage (usado pelo js/pwa.js). */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // 1. Apenas GET. POST da API passa direto.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // 2. Somente mesma origem. Leaflet CDN, tiles, fontes e API ficam de fora.
    if (url.origin !== self.location.origin) return;

    // 3. Nunca cachear o proprio SW nem o manifest.
    if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/manifest.json')) return;

    // 4. Navegacao -> network first (prioriza atualizacao).
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    // 5. Demais assets mesma origem -> stale while revalidate.
    event.respondWith(staleWhileRevalidate(request));
});

/* HTML: rede primeiro, cache so como reserva offline. */
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        // Guarda sempre sob a MESMA chave para nao encher o cache com
        // variantes do tipo /?utm=1, /?ref=abc...
        if (response && response.ok && response.type === 'basic') {
            cache.put(OFFLINE_FALLBACK, response.clone());
        }
        return response;
    } catch (error) {
        const cached =
            (await cache.match(OFFLINE_FALLBACK)) ||
            (await cache.match('./index.html')) ||
            (await cache.match('./'));
        if (cached) return cached;
        throw error;
    }
}

/* Assets: cache instantaneo + revalidacao em segundo plano. */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const fromNetwork = fetch(request)
        .then((response) => {
            if (response && response.ok && response.type === 'basic') {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    if (cached) return cached;

    const network = await fromNetwork;
    if (network) return network;

    // Sem cache e sem rede: deixa o erro do fetch propagar.
    return fetch(request);
}
