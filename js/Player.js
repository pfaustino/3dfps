import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/**
 * Player class - handles first-person controls, movement, and shooting
 */
export class Player {
    constructor(game) {
        this.game = game;
        this.controls = null;

        // Movement state
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.jumpCount = 0;
        this.maxJumps = 2; // Double jump!

        // Player stats
        this.health = 100;
        this.ammo = 30;
        this.maxAmmo = 30;

        // Physics constants
        this.moveSpeed = 10;
        this.jumpForce = 8;
        this.gravity = 25;
        this.playerHeight = 1.7;
        this.playerRadius = 0.4; // Collision radius

        // Shooting
        this.shootCooldown = 0;
        this.shootRate = 0.15; // seconds between shots
        this.raycaster = new THREE.Raycaster();
        this.collisionRaycaster = new THREE.Raycaster();

        // DOM
        this.healthDisplay = document.getElementById('health');
        this.ammoDisplay = document.getElementById('ammo');
    }

    init() {
        // Setup pointer lock controls
        this.controls = new PointerLockControls(
            this.game.camera,
            document.body
        );

        // Add camera to scene (controls manipulate camera position)
        this.game.scene.add(this.controls.object);

        // Pointer lock events
        this.controls.addEventListener('lock', () => {
            this.game.start();
        });

        this.controls.addEventListener('unlock', () => {
            this.game.pause();
        });

        // Click to start
        this.game.blocker.addEventListener('click', () => {
            this.controls.lock();
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Mouse controls
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));

        // Set initial position
        this.controls.object.position.set(0, this.playerHeight, 5);
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = true;
                break;
            case 'Space':
                if (this.jumpCount < this.maxJumps) {
                    // Second jump is slightly weaker
                    const jumpMultiplier = this.jumpCount === 0 ? 1.0 : 0.8;
                    this.velocity.y = this.jumpForce * jumpMultiplier;
                    this.jumpCount++;
                    if (this.game.audioManager) this.game.audioManager.playJump();
                }
                break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = false;
                break;
        }
    }

    onMouseDown(event) {
        if (!this.game.isRunning) return;

        if (event.button === 0) { // Left click
            this.shoot();
        }
    }

    shoot() {
        if (this.shootCooldown > 0) return;

        if (this.ammo <= 0) {
            // Empty gun click
            if (this.game.audioManager) this.game.audioManager.playEmptyGun();
            return;
        }

        this.shootCooldown = this.shootRate;
        this.ammo--;
        this.updateHUD();

        // Play gunshot sound
        if (this.game.audioManager) this.game.audioManager.playGunshot();

        // Raycast from center of screen
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);

        // Combine world objects and enemy hitboxes for hit detection
        const hitTargets = [
            ...this.game.world.collidables,
            ...this.game.enemyManager.getAllHitboxes()
        ];

        const intersects = this.raycaster.intersectObjects(hitTargets, true);

        if (intersects.length > 0) {
            const hit = intersects[0];

            // Check if we hit an enemy
            const enemy = this.game.enemyManager.getEnemyFromMesh(hit.object);
            if (enemy) {
                enemy.takeDamage(25);
                this.createHitEffect(hit.point, hit.face.normal, 0xff4444);
                if (this.game.audioManager) this.game.audioManager.playEnemyHit();
                console.log('Hit enemy at distance:', hit.distance.toFixed(2));
            } else {
                this.createHitEffect(hit.point, hit.face.normal, 0xffaa00);
                if (this.game.audioManager) this.game.audioManager.playHit();
                console.log('Hit:', hit.object.name || 'unnamed', 'at distance:', hit.distance.toFixed(2));
            }
        }

        // Muzzle flash effect (simple for now)
        this.createMuzzleFlash();
    }

    createHitEffect(position, normal, color = 0xffaa00) {
        // Simple hit marker - a small sphere that fades out
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1
        });
        const hitMarker = new THREE.Mesh(geometry, material);
        hitMarker.position.copy(position);
        hitMarker.position.add(normal.multiplyScalar(0.01)); // Offset slightly
        this.game.scene.add(hitMarker);

        // Animate and remove
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed < 0.3) {
                material.opacity = 1 - (elapsed / 0.3);
                hitMarker.scale.setScalar(1 + elapsed * 2);
                requestAnimationFrame(animate);
            } else {
                this.game.scene.remove(hitMarker);
                geometry.dispose();
                material.dispose();
            }
        };
        animate();
    }

    createMuzzleFlash() {
        // Quick screen flash effect via CSS could be added
        // For now, just a console indicator
        // Could add a point light briefly at gun position
    }

    update(delta) {
        // Update shoot cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown -= delta;
        }

        // Apply gravity
        this.velocity.y -= this.gravity * delta;

        // Calculate movement direction
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        // Apply horizontal movement
        if (this.moveForward || this.moveBackward) {
            this.velocity.z = -this.direction.z * this.moveSpeed;
        } else {
            this.velocity.z = 0;
        }

        if (this.moveLeft || this.moveRight) {
            this.velocity.x = -this.direction.x * this.moveSpeed;
        } else {
            this.velocity.x = 0;
        }

        // Store old position for collision rollback
        const oldPosition = this.controls.object.position.clone();

        // Move the player
        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);

        // Check horizontal collision and rollback if needed
        if (this.checkHorizontalCollision()) {
            this.controls.object.position.x = oldPosition.x;
            this.controls.object.position.z = oldPosition.z;
        }

        // Apply vertical velocity
        this.controls.object.position.y += this.velocity.y * delta;

        // Check for standing on obstacles
        const groundHeight = this.getGroundHeight();
        const feetPosition = this.controls.object.position.y - this.playerHeight;

        if (feetPosition <= groundHeight) {
            this.velocity.y = 0;
            this.controls.object.position.y = groundHeight + this.playerHeight;
            this.jumpCount = 0; // Reset double jump
        }
    }

    /**
     * Check if player is colliding horizontally with obstacles
     */
    checkHorizontalCollision() {
        const position = this.controls.object.position;
        const obstacles = this.game.world.collidables.filter(obj => obj.name.startsWith('obstacle_'));

        for (const obstacle of obstacles) {
            // Get obstacle bounds
            const box = new THREE.Box3().setFromObject(obstacle);

            // Check if player cylinder intersects with box
            const playerMin = new THREE.Vector3(
                position.x - this.playerRadius,
                position.y - this.playerHeight,
                position.z - this.playerRadius
            );
            const playerMax = new THREE.Vector3(
                position.x + this.playerRadius,
                position.y,
                position.z + this.playerRadius
            );
            const playerBox = new THREE.Box3(playerMin, playerMax);

            if (playerBox.intersectsBox(box)) {
                // Allow if we're on top of the obstacle
                const feetY = position.y - this.playerHeight;
                if (feetY >= box.max.y - 0.2) {
                    continue; // Standing on top, no horizontal collision
                }
                return true; // Collision!
            }
        }
        return false;
    }

    /**
     * Get the ground height at player's position (floor or top of obstacle)
     */
    getGroundHeight() {
        const position = this.controls.object.position;
        let groundHeight = 0; // Default floor

        // Cast ray downward to find ground
        this.collisionRaycaster.set(
            new THREE.Vector3(position.x, position.y, position.z),
            new THREE.Vector3(0, -1, 0)
        );

        const obstacles = this.game.world.collidables.filter(obj =>
            obj.name.startsWith('obstacle_') || obj.name === 'ground'
        );

        const intersects = this.collisionRaycaster.intersectObjects(obstacles, true);

        if (intersects.length > 0) {
            // Find the highest surface we're above
            for (const hit of intersects) {
                if (hit.distance <= this.playerHeight + 0.1) {
                    groundHeight = Math.max(groundHeight, hit.point.y);
                }
            }
        }

        return groundHeight;
    }

    updateHUD() {
        this.healthDisplay.textContent = `Health: ${this.health}`;
        this.ammoDisplay.textContent = `Ammo: ${this.ammo}`;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHUD();

        // Play damage sound
        if (this.game.audioManager) this.game.audioManager.playPlayerDamage();

        if (this.health <= 0) {
            console.log('Player died!');
            // Handle death
        }
    }

    reload() {
        this.ammo = this.maxAmmo;
        this.updateHUD();
        if (this.game.audioManager) this.game.audioManager.playReload();
    }
}
