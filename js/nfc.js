function showNFCTapOverlay() {
    const overlay = document.getElementById('nfc-overlay');
    if (overlay) overlay.classList.add('active');
}

function hideNFCTapOverlay() {
    const overlay = document.getElementById('nfc-overlay');
    if (overlay) overlay.classList.remove('active');
}

function simulateNFCTap() {
    showNFCTapOverlay();
    setTimeout(() => {
        hideNFCTapOverlay();
        state.batteryCurrent = Math.floor(Math.random() * 60) + 20;
        showAuthScreen();
    }, 2000);
}

function initNFCListener() {
    if ('NDEFReader' in window) {
        console.log('NFC API suportado');
    }
}

window.simulateNFCTap = simulateNFCTap;
window.initNFCListener = initNFCListener;