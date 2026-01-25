/**
 * Confetti Animation Utility
 * אנימציית קונפטי לחגיגת הרשמה מוצלחת
 */

// Confetti configuration
const CONFETTI_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
const CONFETTI_COUNT = 150;

/**
 * Create and animate confetti
 */
export function launchConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
    `;
    document.body.appendChild(container);

    // Create confetti pieces
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        createConfettiPiece(container, i);
    }

    // Remove container after animation
    setTimeout(() => {
        container.remove();
    }, 5000);
}

/**
 * Create a single confetti piece
 * @param {HTMLElement} container 
 * @param {number} index 
 */
function createConfettiPiece(container, index) {
    const piece = document.createElement('div');
    
    // Random properties
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size = Math.random() * 10 + 5;
    const left = Math.random() * 100;
    const delay = Math.random() * 2;
    const duration = Math.random() * 3 + 2;
    const rotation = Math.random() * 360;
    const shape = Math.random() > 0.5 ? 'circle' : 'rect';
    
    piece.style.cssText = `
        position: absolute;
        top: -20px;
        left: ${left}%;
        width: ${size}px;
        height: ${shape === 'circle' ? size : size * 0.4}px;
        background: ${color};
        border-radius: ${shape === 'circle' ? '50%' : '2px'};
        transform: rotate(${rotation}deg);
        animation: confetti-fall ${duration}s ease-out ${delay}s forwards;
    `;
    
    container.appendChild(piece);
}

/**
 * Add confetti CSS animation to document
 */
export function initConfettiStyles() {
    if (document.getElementById('confetti-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'confetti-styles';
    style.textContent = `
        @keyframes confetti-fall {
            0% {
                transform: translateY(0) rotate(0deg) scale(1);
                opacity: 1;
            }
            100% {
                transform: translateY(100vh) rotate(720deg) scale(0.5);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Initialize styles on load
initConfettiStyles();
