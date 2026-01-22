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

        // Spawn settings - larger map = more enemies
        this.maxEnemies = 12;
        this.spawnRadius = 60;
        this.minSpawnDistance = 15; // Minimum distance from player to spawn

        // DOM
        this.killsDisplay = document.getElementById('kills');
    }

    init() {
        // Spawn initial enemies
        this.spawnEnemies(this.maxEnemies);
        this.updateKillDisplay();
    }

    spawnEnemies(count) {
        for (let i = 0; i < count; i++) {
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
            console.log(`Enemy spawned at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
        }
    }

    isValidSpawnPosition(position) {
        // Simple check - ensure not too close to existing enemies
        for (const enemy of this.enemies) {
            if (enemy.state !== Enemy.STATE.DEAD) {
                const dist = enemy.mesh.position.distanceTo(position);
                if (dist < 3) return false;
            }
        }
        return true;
    }

    update(delta) {
        // Update all enemies
        for (const enemy of this.enemies) {
            enemy.update(delta);
        }

        // Clean up dead enemies
        this.enemies = this.enemies.filter(enemy => enemy.state !== Enemy.STATE.DEAD || enemy.mesh.parent);
    }

    onEnemyKilled(enemy) {
        this.killCount++;
        this.updateKillDisplay();

        // Respawn after a delay
        setTimeout(() => {
            if (this.enemies.filter(e => e.state !== Enemy.STATE.DEAD).length < this.maxEnemies) {
                this.spawnEnemy();
            }
        }, 3000);
    }

    updateKillDisplay() {
        if (this.killsDisplay) {
            this.killsDisplay.textContent = `Kills: ${this.killCount}`;
        }
    }

    // Get all enemy hitboxes for raycasting
    getAllHitboxes() {
        const hitboxes = [];
        for (const enemy of this.enemies) {
            if (enemy.state !== Enemy.STATE.DEAD) {
                hitboxes.push(...enemy.getHitboxes());
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
