import * as THREE from 'three';

export class FloatingText {
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('floating-text-container');
    }

    spawn(text, position, color = '#fff', size = '20px') {
        const div = document.createElement('div');
        div.className = 'floating-text';
        div.textContent = text;
        div.style.color = color;
        div.style.fontSize = size;

        // Initial positioning
        this.updatePosition(div, position);

        this.container.appendChild(div);

        // Remove after animation (1s defined in CSS)
        setTimeout(() => {
            if (div.parentNode) div.parentNode.removeChild(div);
        }, 1000);
    }

    updatePosition(element, position) {
        // Project 3D position to 2D screen space
        const vector = position.clone();
        vector.project(this.game.camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    }

    // We don't necessarily need an update loop for all texts if we use CSS animations for standardized movement,
    // BUT if the camera moves, the text should ideally track the world position. 
    // CSS-only "floatUp" is screen-space relative.
    // For a simple FPS, static screen-space spawn at impact point is often "good enough" and cleaner than tracking 50 divs.
    // If the player turns quickly, the numbers will "float" in screen space (like old arcade games).
    // Let's stick to spawn-at-point for simplicity and performance first. 
    // If it feels bad, we can add a tracking loop.
}
