import * as THREE from 'three';
import { Game } from './Game.js';
import { initDevPanel } from './dev/DevPanel.js';

// Initialize the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
    window.game = game;
    initDevPanel({ getStatus: () => '3dfps dev' });
});
