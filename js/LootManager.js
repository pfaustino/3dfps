import * as THREE from 'three';

export class LootManager {
    constructor(game) {
        this.game = game;
        this.drops = [];
        this.models = {};

        // Configuration
        this.pickupRadius = 1.5;
        this.rotateSpeed = 2.0;
        this.floatSpeed = 2.0;
        this.floatHeight = 0.5;
    }

    init() {
        // Models are loaded by World.js and passed here, or accessed via game.world
        console.log('LootManager initialized');
    }

    spawnLoot(position, type) {
        let modelName;
        if (type === 'coin') modelName = 'CoinDollarSign.glb';
        else if (type === 'cowboyhat') modelName = 'SheriffHat.glb';
        else if (type === 'potion') modelName = 'ComplexHealthPotion.glb';

        // Find model in loaded assets
        let mesh = null;

        // Try to clone from loaded assets if available (Player/World should cache these)
        // Placeholder check
        const asset = this.game.world.getAsset(modelName);
        if (asset) {
            mesh = asset.clone();
        } else {
            console.warn(`Loot model ${modelName} not found, using primitive.`);
            const geo = type === 'coin' ? new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16) : new THREE.ConeGeometry(0.3, 0.5, 16);
            const mat = new THREE.MeshStandardMaterial({ color: type === 'coin' ? 0xffd700 : 0x8b4513 });
            mesh = new THREE.Mesh(geo, mat);
            if (type === 'coin') mesh.rotation.x = Math.PI / 2;
        }

        if (mesh) {
            // Adjust inner mesh orientation if needed
            if (type === 'coin') {
                if (mesh.geometry && mesh.geometry.type === 'CylinderGeometry') {
                    mesh.rotation.x = Math.PI / 2;
                } else {
                    // GLB Model - Adjust scale/rotation if needed.
                    mesh.scale.set(3, 3, 3); // Make coin visible
                }
            } else if (type === 'cowboyhat') {
                mesh.scale.set(0.2, 0.2, 0.2);
            } else if (type === 'potion') {
                mesh.scale.set(8, 8, 8); // Significantly larger
            }

            // Ensure mesh is centered in group
            mesh.position.set(0, 0, 0);

            // Wrapper Group for consistent rotation/floating
            const group = new THREE.Group();
            group.position.copy(position);
            group.position.y += 0.5;
            group.add(mesh);

            this.game.scene.add(group);

            // Add to physics list
            this.drops.push({
                group: group, // Rotate the group
                mesh: mesh,
                type: type,
                spawnTime: Date.now(),
                startY: group.position.y,
                active: true
            });

            // Effect
            // if (this.game.audioManager) this.game.audioManager.playLootSpawn();
        }
    }

    update(delta) {
        const playerPos = this.game.player.controls.object.position;
        const time = Date.now() * 0.001;

        for (let i = this.drops.length - 1; i >= 0; i--) {
            const drop = this.drops[i];
            if (!drop.active) continue;

            // Animate: Rotate and Bob
            drop.group.rotation.y += this.rotateSpeed * delta;
            drop.group.position.y = drop.startY + Math.sin(time * this.floatSpeed) * 0.2;

            // Check Pickup Collision
            const dist = drop.group.position.distanceTo(playerPos);
            if (dist < this.pickupRadius) {
                this.collectLoot(drop, i);
            }
        }
    }

    collectLoot(drop, index) {
        drop.active = false;

        // Remove visual
        this.game.scene.remove(drop.group);

        // Remove from list
        this.drops.splice(index, 1);

        // Give to player
        this.game.player.collectLoot(drop.type);
    }
}
