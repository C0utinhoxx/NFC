function showNFCTapOverlay() {
    const overlay = document.getElementById('nfc-overlay');
    if (overlay) overlay.classList.add('active');
}

function hideNFCTapOverlay() {
    const overlay = document.getElementById('nfc-overlay');
    if (overlay) overlay.classList.remove('active');
}

function initNFCListener() {
    if ('NDEFReader' in window) {
        console.log('NFC API suportado');
    }
}

window.showNFCTapOverlay = showNFCTapOverlay;
window.hideNFCTapOverlay = hideNFCTapOverlay;
window.initNFCListener = initNFCListener;