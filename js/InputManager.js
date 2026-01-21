/**
 * InputManager class - centralized input handling
 * Currently lightweight, but will grow as we add more controls
 */
export class InputManager {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.mouse = {
            x: 0,
            y: 0,
            leftDown: false,
            rightDown: false
        };
    }

    init() {
        // Track all key states
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.handleKeyAction(e.code, true);
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.handleKeyAction(e.code, false);
        });

        // Track mouse position
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        // Prevent context menu on right-click
        document.addEventListener('contextmenu', (e) => {
            if (this.game.isRunning) {
                e.preventDefault();
            }
        });
    }

    handleKeyAction(code, isDown) {
        // Handle special key actions here
        if (isDown) {
            switch (code) {
                case 'KeyR':
                    if (this.game.isRunning && this.game.player) {
                        this.game.player.reload();
                    }
                    break;
            }
        }
    }

    isKeyDown(code) {
        return this.keys[code] === true;
    }
}
