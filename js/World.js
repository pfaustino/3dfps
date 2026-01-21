import * as THREE from 'three';

/**
 * World class - manages the game environment, obstacles, and props
 */
export class World {
    constructor(game) {
        this.game = game;
        this.collidables = []; // Objects that can be shot/collided with
    }

    init() {
        this.createGround();
        this.createObstacles();
        this.createDecorations();
    }

    createGround() {
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d2d44,
            roughness: 0.9,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.name = 'ground';
        this.game.scene.add(ground);
        this.collidables.push(ground);

        // Grid helper for visual reference (optional, can remove later)
        const grid = new THREE.GridHelper(100, 50, 0x444466, 0x333344);
        grid.position.y = 0.01;
        this.game.scene.add(grid);
    }

    createObstacles() {
        // Create some boxes to shoot at and navigate around
        const boxPositions = [
            { x: -5, z: -10, scale: { x: 2, y: 3, z: 2 }, color: 0x4a5568 },
            { x: 5, z: -15, scale: { x: 3, y: 2, z: 3 }, color: 0x5a6578 },
            { x: 0, z: -20, scale: { x: 4, y: 4, z: 1 }, color: 0x6a7588 },
            { x: -8, z: -25, scale: { x: 2, y: 5, z: 2 }, color: 0x4a5568 },
            { x: 8, z: -25, scale: { x: 2, y: 5, z: 2 }, color: 0x4a5568 },
            { x: -3, z: -8, scale: { x: 1, y: 1, z: 1 }, color: 0x7b68ee },
            { x: 4, z: -5, scale: { x: 1.5, y: 1.5, z: 1.5 }, color: 0x9b59b6 },
        ];

        boxPositions.forEach((pos, index) => {
            const geometry = new THREE.BoxGeometry(pos.scale.x, pos.scale.y, pos.scale.z);
            const material = new THREE.MeshStandardMaterial({
                color: pos.color,
                roughness: 0.7,
                metalness: 0.2
            });
            const box = new THREE.Mesh(geometry, material);
            box.position.set(pos.x, pos.scale.y / 2, pos.z);
            box.castShadow = true;
            box.receiveShadow = true;
            box.name = `obstacle_${index}`;
            this.game.scene.add(box);
            this.collidables.push(box);
        });
    }

    createDecorations() {
        // Floating orbs with glow effect
        const orbPositions = [
            { x: -10, y: 3, z: -15 },
            { x: 10, y: 4, z: -20 },
            { x: 0, y: 5, z: -30 },
        ];

        orbPositions.forEach((pos, index) => {
            // Core sphere
            const geometry = new THREE.SphereGeometry(0.3, 16, 16);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00d4ff,
            });
            const orb = new THREE.Mesh(geometry, material);
            orb.position.set(pos.x, pos.y, pos.z);
            orb.name = `orb_${index}`;
            this.game.scene.add(orb);
            this.collidables.push(orb);

            // Point light for glow
            const light = new THREE.PointLight(0x00d4ff, 1, 10);
            light.position.copy(orb.position);
            this.game.scene.add(light);

            // Store reference for animation
            orb.userData.light = light;
            orb.userData.baseY = pos.y;
            orb.userData.phase = Math.random() * Math.PI * 2;
        });
    }

    update(delta) {
        // Animate floating orbs
        const time = Date.now() * 0.001;

        this.collidables.forEach(obj => {
            if (obj.name.startsWith('orb_')) {
                const baseY = obj.userData.baseY;
                const phase = obj.userData.phase;
                obj.position.y = baseY + Math.sin(time * 2 + phase) * 0.5;
                obj.rotation.y += delta;

                // Update light position
                if (obj.userData.light) {
                    obj.userData.light.position.copy(obj.position);
                }
            }
        });
    }
}
