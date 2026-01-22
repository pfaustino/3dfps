import * as THREE from 'three';

/**
 * Enemy class - AI-controlled enemy with patrol/chase/attack behaviors
 */
export class Enemy {
    // AI States
    static STATE = {
        IDLE: 'idle',
        PATROL: 'patrol',
        CHASE: 'chase',
        ATTACK: 'attack',
        DEAD: 'dead'
    };

    // Enemy Types
    static TYPE = {
        ROBOT: 'robot',
        GHOST: 'ghost',
        ZOMBIE: 'zombie',
        DEMON: 'demon'
    };

    constructor(game, position, type = null) {
        this.game = game;
        this.mesh = null;
        this.position = position.clone();

        // Assign random type if not specified
        const types = Object.values(Enemy.TYPE);
        this.type = type || types[Math.floor(Math.random() * types.length)];

        // AI state
        this.state = Enemy.STATE.PATROL;
        this.targetPosition = null;
        this.patrolRadius = 15;
        this.detectionRange = 20;
        this.attackRange = 2;
        this.loseInterestRange = 30;

        // Stats (vary by type)
        this.health = 100;
        this.maxHealth = 100;
        this.damage = 10;
        this.attackCooldown = 0;
        this.attackRate = 1;

        // Movement (vary by type)
        this.speed = 3;
        this.chaseSpeed = 5;
        this.rotationSpeed = 5;

        // Apply type-specific stats
        this.applyTypeStats();

        // Timers
        this.stateTimer = 0;
        this.patrolWaitTime = 2;

        // Visual elements
        this.healthBar = null;
        this.healthBarBg = null;
        this.floatOffset = 0; // For floating enemies
        this.glowLight = null; // For glowing enemies
    }

    applyTypeStats() {
        switch (this.type) {
            case Enemy.TYPE.ROBOT:
                this.health = 150;
                this.maxHealth = 150;
                this.damage = 15;
                this.speed = 2;
                this.chaseSpeed = 4;
                break;
            case Enemy.TYPE.GHOST:
                this.health = 60;
                this.maxHealth = 60;
                this.damage = 8;
                this.speed = 4;
                this.chaseSpeed = 7;
                this.detectionRange = 25;
                break;
            case Enemy.TYPE.ZOMBIE:
                this.health = 120;
                this.maxHealth = 120;
                this.damage = 12;
                this.speed = 1.5;
                this.chaseSpeed = 3;
                this.attackRate = 1.5;
                break;
            case Enemy.TYPE.DEMON:
                this.health = 100;
                this.maxHealth = 100;
                this.damage = 20;
                this.speed = 3.5;
                this.chaseSpeed = 6;
                this.attackRate = 0.8;
                break;
        }
    }

    init() {
        this.createMesh();
        this.createHealthBar();
        this.pickNewPatrolTarget();
    }

    createMesh() {
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        this.mesh.userData.enemy = this;

        switch (this.type) {
            case Enemy.TYPE.ROBOT:
                this.createRobotMesh();
                break;
            case Enemy.TYPE.GHOST:
                this.createGhostMesh();
                break;
            case Enemy.TYPE.ZOMBIE:
                this.createZombieMesh();
                break;
            case Enemy.TYPE.DEMON:
                this.createDemonMesh();
                break;
        }

        this.game.scene.add(this.mesh);
    }

    // ═══════════════════════════════════════════════════════════
    // ROBOT - Angular metallic cubes
    // ═══════════════════════════════════════════════════════════
    createRobotMesh() {
        // Metallic body cube
        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.0, 0.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a5568,
            roughness: 0.3,
            metalness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.0;
        body.castShadow = true;
        body.name = 'enemy_body';
        this.mesh.add(body);

        // Head cube
        const headGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.4);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d3748,
            roughness: 0.2,
            metalness: 0.9
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.7;
        head.castShadow = true;
        head.name = 'enemy_head';
        this.mesh.add(head);

        // Glowing visor
        const visorGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.05);
        const visorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const visor = new THREE.Mesh(visorGeometry, visorMaterial);
        visor.position.set(0, 1.72, 0.2);
        this.mesh.add(visor);

        // Robot arms (angular)
        const armGeometry = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const armMaterial = new THREE.MeshStandardMaterial({
            color: 0x718096,
            roughness: 0.4,
            metalness: 0.7
        });

        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.55, 1.0, 0);
        leftArm.castShadow = true;
        this.mesh.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.55, 1.0, 0);
        rightArm.castShadow = true;
        this.mesh.add(rightArm);

        // Robot legs
        const legGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.2);

        const leftLeg = new THREE.Mesh(legGeometry, armMaterial);
        leftLeg.position.set(-0.2, 0.25, 0);
        leftLeg.castShadow = true;
        this.mesh.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, armMaterial);
        rightLeg.position.set(0.2, 0.25, 0);
        rightLeg.castShadow = true;
        this.mesh.add(rightLeg);
    }

    // ═══════════════════════════════════════════════════════════
    // GHOST - Ethereal floating specter
    // ═══════════════════════════════════════════════════════════
    createGhostMesh() {
        // Main ghostly body (tapered sphere)
        const bodyGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        bodyGeometry.scale(1, 1.5, 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xaaddff,
            roughness: 0.1,
            metalness: 0.0,
            transparent: true,
            opacity: 0.7
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        body.name = 'enemy_body';
        this.mesh.add(body);

        // Trailing wisps
        for (let i = 0; i < 3; i++) {
            const wispGeometry = new THREE.ConeGeometry(0.15, 0.6, 8);
            const wispMaterial = new THREE.MeshBasicMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.5
            });
            const wisp = new THREE.Mesh(wispGeometry, wispMaterial);
            wisp.position.set((i - 1) * 0.25, 0.8, 0);
            wisp.rotation.x = Math.PI;
            this.mesh.add(wisp);
        }

        // Glowing eyes
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.15, 1.6, 0.35);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.15, 1.6, 0.35);
        this.mesh.add(rightEye);

        // Add glow light
        this.glowLight = new THREE.PointLight(0x88ccff, 0.5, 5);
        this.glowLight.position.set(0, 1.5, 0);
        this.mesh.add(this.glowLight);

        // Float offset for animation
        this.floatOffset = Math.random() * Math.PI * 2;
    }

    // ═══════════════════════════════════════════════════════════
    // ZOMBIE - Shambling undead
    // ═══════════════════════════════════════════════════════════
    createZombieMesh() {
        // Decayed body
        const bodyGeometry = new THREE.CylinderGeometry(0.35, 0.4, 1.1, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x556b2f,
            roughness: 0.9,
            metalness: 0.0
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.85;
        body.rotation.z = 0.1; // Slightly hunched
        body.castShadow = true;
        body.name = 'enemy_body';
        this.mesh.add(body);

        // Rotting head
        const headGeometry = new THREE.SphereGeometry(0.28, 10, 10);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b9a6b,
            roughness: 0.95,
            metalness: 0.0
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0.05, 1.55, 0);
        head.scale.set(1, 0.9, 1);
        head.castShadow = true;
        head.name = 'enemy_head';
        this.mesh.add(head);

        // Glowing dead eyes
        const eyeGeometry = new THREE.SphereGeometry(0.05, 6, 6);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xccff00 });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.08, 1.58, 0.22);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 1.55, 0.22);
        this.mesh.add(rightEye);

        // Tattered arms (asymmetric)
        const armMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a5a3f,
            roughness: 0.9
        });

        const leftArmGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6);
        const leftArm = new THREE.Mesh(leftArmGeometry, armMaterial);
        leftArm.position.set(-0.45, 0.95, 0.2);
        leftArm.rotation.set(0.5, 0, 0.4);
        leftArm.castShadow = true;
        this.mesh.add(leftArm);

        const rightArmGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.6, 6);
        const rightArm = new THREE.Mesh(rightArmGeometry, armMaterial);
        rightArm.position.set(0.45, 1.0, 0.1);
        rightArm.rotation.set(0.3, 0, -0.3);
        rightArm.castShadow = true;
        this.mesh.add(rightArm);

        // Shambling legs
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6);

        const leftLeg = new THREE.Mesh(legGeometry, armMaterial);
        leftLeg.position.set(-0.15, 0.3, 0);
        leftLeg.rotation.z = 0.1;
        leftLeg.castShadow = true;
        this.mesh.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, armMaterial);
        rightLeg.position.set(0.18, 0.3, 0);
        rightLeg.rotation.z = -0.05;
        rightLeg.castShadow = true;
        this.mesh.add(rightLeg);
    }

    // ═══════════════════════════════════════════════════════════
    // DEMON - Fiery hellspawn
    // ═══════════════════════════════════════════════════════════
    createDemonMesh() {
        // Fiery body
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.45, 1.3, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b0000,
            roughness: 0.5,
            metalness: 0.3,
            emissive: 0x330000,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.95;
        body.castShadow = true;
        body.name = 'enemy_body';
        this.mesh.add(body);

        // Demonic head
        const headGeometry = new THREE.SphereGeometry(0.3, 12, 12);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xaa2222,
            roughness: 0.4,
            metalness: 0.2,
            emissive: 0x440000,
            emissiveIntensity: 0.2
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.75;
        head.castShadow = true;
        head.name = 'enemy_head';
        this.mesh.add(head);

        // Horns
        const hornGeometry = new THREE.ConeGeometry(0.06, 0.3, 6);
        const hornMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.3,
            metalness: 0.5
        });

        const leftHorn = new THREE.Mesh(hornGeometry, hornMaterial);
        leftHorn.position.set(-0.2, 2.0, 0);
        leftHorn.rotation.z = 0.3;
        this.mesh.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeometry, hornMaterial);
        rightHorn.position.set(0.2, 2.0, 0);
        rightHorn.rotation.z = -0.3;
        this.mesh.add(rightHorn);

        // Burning eyes
        const eyeGeometry = new THREE.SphereGeometry(0.07, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 1.78, 0.25);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 1.78, 0.25);
        this.mesh.add(rightEye);

        // Clawed arms
        const armGeometry = new THREE.CylinderGeometry(0.08, 0.12, 0.7, 6);
        const armMaterial = new THREE.MeshStandardMaterial({
            color: 0x660000,
            roughness: 0.6,
            emissive: 0x220000,
            emissiveIntensity: 0.2
        });

        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.5, 1.1, 0);
        leftArm.rotation.z = 0.4;
        leftArm.castShadow = true;
        this.mesh.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.5, 1.1, 0);
        rightArm.rotation.z = -0.4;
        rightArm.castShadow = true;
        this.mesh.add(rightArm);

        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.14, 0.6, 6);

        const leftLeg = new THREE.Mesh(legGeometry, armMaterial);
        leftLeg.position.set(-0.18, 0.3, 0);
        leftLeg.castShadow = true;
        this.mesh.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, armMaterial);
        rightLeg.position.set(0.18, 0.3, 0);
        rightLeg.castShadow = true;
        this.mesh.add(rightLeg);

        // Add fire glow
        this.glowLight = new THREE.PointLight(0xff4400, 0.8, 8);
        this.glowLight.position.set(0, 1.2, 0);
        this.mesh.add(this.glowLight);
    }

    createHealthBar() {
        // Background bar
        const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            side: THREE.DoubleSide
        });
        this.healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
        this.healthBarBg.position.y = 2.2;
        this.mesh.add(this.healthBarBg);

        // Health bar (foreground)
        const barGeometry = new THREE.PlaneGeometry(0.96, 0.06);
        const barMaterial = new THREE.MeshBasicMaterial({
            color: 0x44ff44,
            side: THREE.DoubleSide
        });
        this.healthBar = new THREE.Mesh(barGeometry, barMaterial);
        this.healthBar.position.y = 2.2;
        this.healthBar.position.z = 0.01;
        this.mesh.add(this.healthBar);
    }

    pickNewPatrolTarget() {
        // Random point within patrol radius of spawn
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.patrolRadius;
        this.targetPosition = new THREE.Vector3(
            this.position.x + Math.cos(angle) * distance,
            0,
            this.position.z + Math.sin(angle) * distance
        );
    }

    getPlayerPosition() {
        return this.game.player.controls.object.position;
    }

    distanceToPlayer() {
        const playerPos = this.getPlayerPosition();
        return this.mesh.position.distanceTo(playerPos);
    }

    canSeePlayer() {
        const distance = this.distanceToPlayer();
        if (distance > this.detectionRange) return false;

        // Simple line of sight check using raycaster
        const direction = new THREE.Vector3();
        const playerPos = this.getPlayerPosition();
        direction.subVectors(playerPos, this.mesh.position).normalize();

        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(this.mesh.position.x, 1, this.mesh.position.z),
            direction,
            0,
            distance
        );

        // Check if any world obstacles block the view
        const intersects = raycaster.intersectObjects(this.game.world.collidables, true);

        // If first hit is close to player distance, we can see them
        if (intersects.length === 0) return true;
        return intersects[0].distance >= distance - 1;
    }

    update(delta) {
        if (this.state === Enemy.STATE.DEAD) return;

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= delta;
        }

        // State machine
        switch (this.state) {
            case Enemy.STATE.IDLE:
                this.updateIdle(delta);
                break;
            case Enemy.STATE.PATROL:
                this.updatePatrol(delta);
                break;
            case Enemy.STATE.CHASE:
                this.updateChase(delta);
                break;
            case Enemy.STATE.ATTACK:
                this.updateAttack(delta);
                break;
        }

        // Always face health bar toward camera
        if (this.healthBarBg && this.healthBar) {
            this.healthBarBg.lookAt(this.game.camera.position);
            this.healthBar.lookAt(this.game.camera.position);
        }

        // Type-specific animations
        if (this.type === Enemy.TYPE.GHOST) {
            // Floating bob animation
            const time = Date.now() * 0.001;
            this.mesh.position.y = 0.3 + Math.sin(time * 2 + this.floatOffset) * 0.3;
        }

        if (this.glowLight && (this.type === Enemy.TYPE.DEMON || this.type === Enemy.TYPE.GHOST)) {
            // Flickering glow
            const flicker = 0.8 + Math.random() * 0.4;
            this.glowLight.intensity = this.type === Enemy.TYPE.DEMON ? flicker : 0.4 + Math.random() * 0.2;
        }

        // Check for player detection (except when dead or already attacking)
        if (this.state !== Enemy.STATE.DEAD && this.state !== Enemy.STATE.ATTACK) {
            if (this.canSeePlayer()) {
                // Aggro Trigger: If we were previously passive, play sound
                if (this.state === Enemy.STATE.IDLE || this.state === Enemy.STATE.PATROL) {
                    if (this.game.audioManager) {
                        this.activeAttackSoundGain = this.game.audioManager.playEnemyAttack(this.type);
                    }
                }

                if (this.distanceToPlayer() <= this.attackRange) {
                    this.state = Enemy.STATE.ATTACK;
                } else {
                    this.state = Enemy.STATE.CHASE;
                }
            } else if (this.state === Enemy.STATE.CHASE) {
                // Lost sight of player
                if (this.distanceToPlayer() > this.loseInterestRange) {
                    this.state = Enemy.STATE.PATROL;
                    this.pickNewPatrolTarget();
                }
            }
        }
    }

    updateIdle(delta) {
        this.stateTimer -= delta;
        if (this.stateTimer <= 0) {
            this.state = Enemy.STATE.PATROL;
            this.pickNewPatrolTarget();
        }
    }

    updatePatrol(delta) {
        if (!this.targetPosition) {
            this.pickNewPatrolTarget();
            return;
        }

        const distance = this.mesh.position.distanceTo(this.targetPosition);

        if (distance < 0.5) {
            // Reached target, wait then pick new one
            this.state = Enemy.STATE.IDLE;
            this.stateTimer = this.patrolWaitTime;
            return;
        }

        // Move toward target
        this.moveToward(this.targetPosition, this.speed, delta);
    }

    updateChase(delta) {
        const playerPos = this.getPlayerPosition();
        const distance = this.distanceToPlayer();

        if (distance <= this.attackRange) {
            this.state = Enemy.STATE.ATTACK;
            return;
        }

        // Move toward player
        this.moveToward(playerPos, this.chaseSpeed, delta);
    }

    updateAttack(delta) {
        const distance = this.distanceToPlayer();

        // Face the player
        const playerPos = this.getPlayerPosition();
        this.lookAt(playerPos);

        if (distance > this.attackRange * 1.5) {
            // Player moved away, chase them
            this.state = Enemy.STATE.CHASE;
            return;
        }

        // Attack if cooldown is ready
        if (this.attackCooldown <= 0) {
            this.attack();
            this.attackCooldown = this.attackRate;
        }
    }

    moveToward(target, speed, delta) {
        const direction = new THREE.Vector3();
        direction.subVectors(target, this.mesh.position);
        direction.y = 0; // Keep on ground
        direction.normalize();

        // Rotate toward target
        this.lookAt(target);

        // Calculate new position
        const newX = this.mesh.position.x + direction.x * speed * delta;
        const newZ = this.mesh.position.z + direction.z * speed * delta;

        // Check for collision with obstacles
        if (!this.checkObstacleCollision(newX, newZ)) {
            this.mesh.position.x = newX;
            this.mesh.position.z = newZ;
        } else {
            // Try sliding along walls
            if (!this.checkObstacleCollision(newX, this.mesh.position.z)) {
                this.mesh.position.x = newX;
            } else if (!this.checkObstacleCollision(this.mesh.position.x, newZ)) {
                this.mesh.position.z = newZ;
            }
            // If both blocked, don't move
        }
    }

    /**
     * Check if position would collide with an obstacle
     */
    checkObstacleCollision(x, z) {
        const enemyRadius = 0.5;
        const obstacles = this.game.world.collidables.filter(obj => obj.name.startsWith('obstacle_'));

        for (const obstacle of obstacles) {
            const box = new THREE.Box3().setFromObject(obstacle);

            // Simple AABB vs circle collision
            const closestX = Math.max(box.min.x, Math.min(x, box.max.x));
            const closestZ = Math.max(box.min.z, Math.min(z, box.max.z));

            const distX = x - closestX;
            const distZ = z - closestZ;
            const distSquared = distX * distX + distZ * distZ;

            if (distSquared < enemyRadius * enemyRadius) {
                return true; // Collision!
            }
        }
        return false;
    }

    lookAt(target) {
        const lookTarget = new THREE.Vector3(target.x, this.mesh.position.y, target.z);
        this.mesh.lookAt(lookTarget);
    }

    attack() {
        // Deal damage to player
        this.game.player.takeDamage(this.damage);

        // Play attack sound (Optional: Add a physical 'whoosh' or hit sound here instead of the vocal growl)
        // Refactored: Vocal sound now plays on Aggro start.

        console.log(`Enemy attacks! Player takes ${this.damage} damage.`);

        // Visual feedback - enemy lunges forward briefly
        const originalZ = this.mesh.position.z;
        const lunge = () => {
            const direction = new THREE.Vector3();
            direction.subVectors(this.getPlayerPosition(), this.mesh.position).normalize();
            this.mesh.position.add(direction.multiplyScalar(0.3));

            setTimeout(() => {
                const backDirection = new THREE.Vector3();
                backDirection.subVectors(this.getPlayerPosition(), this.mesh.position).normalize();
                this.mesh.position.sub(backDirection.multiplyScalar(0.3));
            }, 100);
        };
        lunge();
    }

    takeDamage(amount) {
        if (this.state === Enemy.STATE.DEAD) return;

        this.health -= amount;
        this.updateHealthBar();

        // Flash red on hit
        this.flashDamage();

        console.log(`Enemy takes ${amount} damage. Health: ${this.health}`);

        if (this.health <= 0) {
            this.die();
        }
    }

    updateHealthBar() {
        const healthPercent = Math.max(0, this.health / this.maxHealth);
        this.healthBar.scale.x = healthPercent;
        this.healthBar.position.x = (1 - healthPercent) * -0.48;

        // Change color based on health
        if (healthPercent > 0.5) {
            this.healthBar.material.color.setHex(0x44ff44);
        } else if (healthPercent > 0.25) {
            this.healthBar.material.color.setHex(0xffff44);
        } else {
            this.healthBar.material.color.setHex(0xff4444);
        }
    }

    flashDamage() {
        // Flash the enemy body white briefly
        this.mesh.traverse((child) => {
            if (child.isMesh && child.material && child.name.startsWith('enemy_')) {
                const originalColor = child.material.color.clone();
                child.material.color.setHex(0xffffff);
                setTimeout(() => {
                    child.material.color.copy(originalColor);
                }, 100);
            }
        });
    }

    die() {
        this.state = Enemy.STATE.DEAD;

        // Play death sound
        if (this.game.audioManager) this.game.audioManager.playEnemyDeath();

        // Fade out any active attack sound
        if (this.activeAttackSoundGain && this.game.audioManager && this.game.audioManager.context) {
            try {
                const ctx = this.game.audioManager.context;
                const gain = this.activeAttackSoundGain.gain;

                // Cancel scheduled ramp
                gain.cancelScheduledValues(ctx.currentTime);
                // Ramp to 0
                gain.setValueAtTime(gain.value, ctx.currentTime);
                gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            } catch (e) {
                // Ignore audio errors during cleanup
            }
        }

        console.log('Enemy died!');

        // Death animation - shrink and fade
        const startTime = Date.now();
        const duration = 500;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            this.mesh.scale.setScalar(1 - progress * 0.8);
            this.mesh.position.y = -progress * 0.5;
            this.mesh.rotation.x = progress * 0.5;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.dispose();
            }
        };
        animate();

        // Notify manager
        if (this.game.enemyManager) {
            this.game.enemyManager.onEnemyKilled(this);
        }

        // Spawn Loot
        if (this.game.lootManager) {
            const rand = Math.random();
            if (rand < 0.1) { // 10% Chance for Potion
                this.game.lootManager.spawnLoot(this.mesh.position, 'potion');
            } else if (rand < 0.1) { // 10% Chance for Hat (0.1 to 0.2)
                this.game.lootManager.spawnLoot(this.mesh.position, 'cowboyhat');
            } else if (rand < 0.8) { // 60% Chance for Coin
                this.game.lootManager.spawnLoot(this.mesh.position, 'coin');
            }
        }
    }

    dispose() {
        // Remove from scene and clean up
        this.game.scene.remove(this.mesh);

        this.mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    // Get all meshes that can be hit by raycaster
    getHitboxes() {
        const hitboxes = [];
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                hitboxes.push(child);
            }
        });
        return hitboxes;
    }
}
