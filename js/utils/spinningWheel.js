/**
 * Spinning Wheel Component
 * גלגל הגרלה מסתובב לבחירת זוכה
 */

/**
 * Create and show spinning wheel modal
 * @param {Array} participants - Array of participant objects with name property
 * @param {Function} onComplete - Callback when winner is selected
 */
export function showSpinningWheel(participants, onComplete) {
    if (!participants || participants.length === 0) {
        alert('אין משתתפים להגרלה');
        return;
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'wheel-overlay';
    overlay.innerHTML = `
        <div class="wheel-modal">
            <h2 class="wheel-title">🎲 הגרלת הזוכה</h2>
            <div class="wheel-container">
                <div class="wheel-pointer">▼</div>
                <canvas id="lottery-wheel" width="350" height="350"></canvas>
            </div>
            <div class="wheel-result hidden">
                <div class="winner-announce">🎉 הזוכה הוא 🎉</div>
                <div class="winner-name" id="winner-name"></div>
            </div>
            <div class="wheel-actions">
                <button class="btn btn-primary btn-large" id="btn-spin">סובב את הגלגל!</button>
                <button class="btn btn-outline" id="btn-close-wheel">סגור</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    addWheelStyles();
    
    // Initialize wheel
    const canvas = document.getElementById('lottery-wheel');
    const ctx = canvas.getContext('2d');
    const wheel = new LotteryWheel(canvas, ctx, participants);
    wheel.draw();
    
    // Event listeners
    document.getElementById('btn-spin').addEventListener('click', () => {
        const spinBtn = document.getElementById('btn-spin');
        spinBtn.disabled = true;
        spinBtn.textContent = 'מגריל...';
        
        wheel.spin((winner) => {
            // Show result
            document.querySelector('.wheel-result').classList.remove('hidden');
            document.getElementById('winner-name').textContent = winner.fullName || winner.name;
            spinBtn.textContent = 'הגרלה הסתיימה!';
            
            if (onComplete) {
                onComplete(winner);
            }
        });
    });
    
    document.getElementById('btn-close-wheel').addEventListener('click', () => {
        overlay.remove();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

/**
 * Lottery Wheel Class
 */
class LotteryWheel {
    constructor(canvas, ctx, participants) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.participants = participants;
        this.rotation = 0;
        this.isSpinning = false;
        this.colors = [
            '#6366f1', '#22c55e', '#f59e0b', '#ef4444', 
            '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'
        ];
    }
    
    draw() {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        const sliceAngle = (2 * Math.PI) / this.participants.length;
        
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.rotation);
        ctx.translate(-centerX, -centerY);
        
        // Draw slices
        this.participants.forEach((participant, i) => {
            const startAngle = i * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            
            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = this.colors[i % this.colors.length];
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw text
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Heebo';
            
            // Truncate name if too long
            let name = participant.fullName || participant.name || `משתתף ${i + 1}`;
            if (name.length > 10) {
                name = name.substring(0, 10) + '...';
            }
            ctx.fillText(name, radius - 20, 5);
            ctx.restore();
        });
        
        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw center text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Heebo';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎲', centerX, centerY);
        
        ctx.restore();
    }
    
    spin(callback) {
        if (this.isSpinning) return;
        this.isSpinning = true;
        
        const totalRotation = Math.PI * 2 * (5 + Math.random() * 5); // 5-10 full rotations
        const duration = 5000; // 5 seconds
        const startTime = Date.now();
        const startRotation = this.rotation;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease out cubic)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            this.rotation = startRotation + totalRotation * easeOut;
            this.draw();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isSpinning = false;
                
                // Calculate winner based on final rotation
                const normalizedRotation = this.rotation % (2 * Math.PI);
                const sliceAngle = (2 * Math.PI) / this.participants.length;
                // The pointer is at the top (3π/2 or -π/2), adjust calculation
                const pointerAngle = (3 * Math.PI / 2 - normalizedRotation + 2 * Math.PI) % (2 * Math.PI);
                const winnerIndex = Math.floor(pointerAngle / sliceAngle) % this.participants.length;
                
                callback(this.participants[winnerIndex]);
            }
        };
        
        requestAnimationFrame(animate);
    }
}

/**
 * Add wheel styles to document
 */
function addWheelStyles() {
    if (document.getElementById('wheel-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'wheel-styles';
    style.textContent = `
        .wheel-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        }
        
        .wheel-modal {
            background: white;
            border-radius: 24px;
            padding: 32px;
            text-align: center;
            max-width: 450px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: wheel-modal-in 0.3s ease-out;
        }
        
        @keyframes wheel-modal-in {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        .wheel-title {
            font-size: 28px;
            margin-bottom: 24px;
            color: #1e293b;
        }
        
        .wheel-container {
            position: relative;
            display: inline-block;
            margin-bottom: 24px;
        }
        
        .wheel-pointer {
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 32px;
            color: #ef4444;
            z-index: 10;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        
        #lottery-wheel {
            display: block;
            border-radius: 50%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
        
        .wheel-result {
            margin: 24px 0;
            padding: 20px;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            border-radius: 16px;
            color: white;
        }
        
        .winner-announce {
            font-size: 18px;
            margin-bottom: 8px;
        }
        
        .winner-name {
            font-size: 32px;
            font-weight: 700;
        }
        
        .wheel-actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .wheel-actions .btn {
            width: 100%;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Quick random winner selection (without animation)
 * @param {Array} participants 
 * @returns {Object} Random winner
 */
export function selectRandomWinner(participants) {
    if (!participants || participants.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * participants.length);
    return participants[randomIndex];
}
