import * as THREE from 'three';
import { Enemy } from './Enemy.js';

/**
 * EnemyManager class - spawns and manages all enemies in the game
 */
export class EnemyManager {
    constructor(game) {
        this.game = game;
        this.enemies = [];
        this.killCount = 0;

        // Wave settings
        this.currentWave = 1;
        this.waveTotalEnemies = 5;
        this.waveEnemiesSpawned = 0;
        this.waveKilled = 0;
        this.waveInProgress = false;

        // Spawn settings - larger map = more enemies
        this.maxSimultaneousEnemies = 8;
        this.spawnRadius = 60;
        this.minSpawnDistance = 15; // Minimum distance from player to spawn

        // DOM
        this.killsDisplay = document.getElementById('kills');
        this.waveDisplay = document.getElementById('wave');
        this.notificationDisplay = document.getElementById('notification');
    }

    init() {
        // Start Wave 1
        this.startWave();
    }

    startWave() {
        this.waveInProgress = true;
        this.waveEnemiesSpawned = 0;
        this.waveKilled = 0;
        const baseEnemies = 5 + (this.currentWave - 1) * 3;
        const multiplier = this.spawnMultiplier || 1.5; // Default Normal (Level 3 is x2.0, so 1.5 is reasonable default)
        this.waveTotalEnemies = Math.ceil(baseEnemies * multiplier);
        console.log(`Starting Wave ${this.currentWave} with ${this.waveTotalEnemies} enemies.`);

        this.updateWaveDisplay();
        this.updateKillDisplay();
        this.showNotification(`Wave ${this.currentWave}`);

        // Initial spawn
        this.checkSpawns();
    }

    checkSpawns() {
        if (!this.waveInProgress) return;

        const activeCount = this.enemies.filter(e => e.state !== Enemy.STATE.DEAD).length;

        // Spawn if we haven't reached wave total AND we aren't at max screen cap
        if (this.waveEnemiesSpawned < this.waveTotalEnemies && activeCount < this.maxSimultaneousEnemies) {
            this.spawnEnemy();
        }
    }

    spawnEnemy() {
        // Find a valid spawn position
        let attempts = 0;
        let position = null;

        while (attempts < 20) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.minSpawnDistance + Math.random() * (this.spawnRadius - this.minSpawnDistance);

            position = new THREE.Vector3(
                Math.cos(angle) * distance,
                0,
                Math.sin(angle) * distance - 15 // Offset to spawn in front of player
            );

            // Check if position is valid (not too close to obstacles)
            if (this.isValidSpawnPosition(position)) {
                break;
            }
            attempts++;
        }

        if (position) {
            const enemy = new Enemy(this.game, position);
            enemy.init();
            this.enemies.push(enemy);

            this.waveEnemiesSpawned++;
            console.log(`Enemy spawned at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
        }
    }

    isValidSpawnPosition(position) {
        // 1. Check distance to other enemies
        for (const enemy of this.enemies) {
            if (enemy.state !== Enemy.STATE.DEAD) {
                const dist = enemy.mesh.position.distanceTo(position);
                if (dist < 3) return false;
            }
        }

        // 2. Check collision with world obstacles
        // Use a slightly larger radius for spawn safety
        const spawnRadius = 1.0;
        const obstacles = this.game.world.collidables;

        for (const obstacle of obstacles) {
            // Skip ground
            if (obstacle.name === 'ground') continue;

            const box = new THREE.Box3().setFromObject(obstacle);

            // Simple AABB vs point/radius check
            // Expand box by radius to check if point is inside extended box
            if (position.x >= box.min.x - spawnRadius && position.x <= box.max.x + spawnRadius &&
                position.z >= box.min.z - spawnRadius && position.z <= box.max.z + spawnRadius) {
                return false; // Inside an obstacle
            }
        }

        return true;
    }

    update(delta) {
        // Update all enemies
        for (const enemy of this.enemies) {
            enemy.update(delta);
        }

        // Clean up dead enemies from list periodically to avoid memory leak if game runs long
        // But for now, we just filter for active checks, keeping dead ones is fine unless we have thousands

        // Spawn management loop (simple: check every frame, could be optimized)
        if (this.waveInProgress) {
            this.checkSpawns();
        }
    }

    onEnemyKilled(enemy) {
        this.killCount++;
        this.waveKilled++;
        this.updateKillDisplay();
        this.updateWaveDisplay();

        // Check Wave Complete
        if (this.waveKilled >= this.waveTotalEnemies) {
            this.completeWave();
        }
    }

    completeWave() {
        this.waveInProgress = false;
        console.log(`Wave ${this.currentWave} Complete!`);

        this.showNotification(`Wave Complete!`);

        // Start next wave after delay
        setTimeout(() => {
            this.currentWave++;
            this.startWave();
        }, 5000);
    }

    updateKillDisplay() {
        if (this.killsDisplay) {
            this.killsDisplay.textContent = `Total Kills: ${this.killCount}`;
        }
    }

    updateWaveDisplay() {
        if (this.waveDisplay) {
            this.waveDisplay.textContent = `Wave ${this.currentWave}: ${this.waveKilled}/${this.waveTotalEnemies}`;
        }
    }

    showNotification(text) {
        if (!this.notificationDisplay) return;

        this.notificationDisplay.textContent = text;
        this.notificationDisplay.style.opacity = '1';

        // Clear previous timeout if any
        if (this.notificationTimeout) clearTimeout(this.notificationTimeout);

        // Fade out
        this.notificationTimeout = setTimeout(() => {
            this.notificationDisplay.style.opacity = '0';
        }, 3000);
    }

    setDifficulty(level) {
        // Level 1 (Very Easy) to 6 (Nightmare)
        this.difficulty = level;

        // Scale enemy count cap
        // 1->5, 2->6, 3->8, 4->10, 5->12, 6->15
        const caps = [5, 6, 8, 10, 12, 15];
        this.maxSimultaneousEnemies = caps[level - 1] || 8;

        // Scale wave size multiplier
        // 1(x1), 3(x3), 6(x6)
        this.spawnMultiplier = 0.5 + (level * 0.5);

        console.log(`Difficulty set to ${level}: Max Enemies ${this.maxSimultaneousEnemies}`);
    }

    // Get all enemy hitboxes for raycasting
    getAllHitboxes() {
        const hitboxes = [];
        for (const enemy of this.enemies) {
            if (enemy.state !== Enemy.STATE.DEAD) {
                // Assuming enemy has a getHitboxes method or we just use the mesh
                // The previous code had ...enemy.getHitboxes(), let's verify Enemy has that.
                // If not, we fall back to mesh.
                if (typeof enemy.getHitboxes === 'function') {
                    hitboxes.push(...enemy.getHitboxes());
                } else {
                    hitboxes.push(enemy.mesh);
                }
            }
        }
        return hitboxes;
    }

    // Find which enemy owns a particular mesh
    getEnemyFromMesh(mesh) {
        // Traverse up to find the group with userData.enemy
        let current = mesh;
        while (current) {
            if (current.userData && current.userData.enemy) {
                return current.userData.enemy;
            }
            current = current.parent;
        }
        return null;
    }
}
