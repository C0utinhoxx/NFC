/*
 * GoodWe PWA - registro do Service Worker.
 *
 * Arquivo NOVO e isolado de proposito: nao altera nenhum comportamento
 * existente. Se algo der errado aqui, o site continua funcionando
 * normalmente, so sem instalacao offline.
 *
 * O Service Worker so funciona em contexto seguro (HTTPS ou localhost).
 * Na Vercel o site ja e servido em HTTPS, entao funciona direto.
 */

(function () {
    'use strict';

    var SW_URL = './sw.js';
    var SCOPE = './';

    var state = {
        supported: false,
        registered: false,
        secureContext: false,
        error: null,
    };

    //Espelho no console: window.GoodWePWA
    window.GoodWePWA = state;

    function isLocalDev() {
        var host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
    }

    if (!('serviceWorker' in navigator)) {
        return;
    }

    // Fora de HTTPS (e fora de localhost) o navegador nem expoe a API.
    if (!window.isSecureContext && !isLocalDev()) {
        return;
    }

    state.supported = true;
    state.secureContext = window.isSecureContext;

    function register() {
        navigator.serviceWorker.register(SW_URL, { scope: SCOPE })
            .then(function (registration) {
                state.registered = true;
                state.scope = registration.scope;
                console.log('[GoodWe PWA] Service Worker registrado em', registration.scope);

                // Se houver uma versao nova esperando, avisamos no console.
                // NAO recarregamos a pagina automaticamente: isso
                // reiniciaria uma sessao de carga em andamento. A versao
                // nova entra sozinha no proximo carregamento da pagina.
                if (registration.waiting) {
                    console.log('[GoodWe PWA] Nova versao disponivel, sera aplicada no proximo carregamento.');
                }

                registration.addEventListener('updatefound', function () {
                    var installing = registration.installing;
                    if (!installing) return;
                    installing.addEventListener('statechange', function () {
                        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[GoodWe PWA] Atualizacao instalada e aguardando a proxima visita.');
                        }
                    });
                });
            })
            .catch(function (error) {
                state.error = String(error);
                console.warn('[GoodWe PWA] Falha ao registrar o Service Worker:', error);
            });
    }

    // Registrar no 'load' para nao competir com os recursos do site.
    if (document.readyState === 'complete') {
        register();
    } else {
        window.addEventListener('load', register);
    }

    // Recarrega UMA vez quando um SW novo assumir o controle.
    // Protegido contra loop: so acontece quando o controle realmente troca.
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloading) return;
        reloading = true;
        console.log('[GoodWe PWA] Service Worker assumiu o controle.');
    });
})();
