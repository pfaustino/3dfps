import * as THREE from 'three';
import { PointerLockControls } from './PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
        this.armor = 0;
        this.money = 0;
        this.ammo = 30;
        this.maxAmmo = 30;

        // Physics constants
        this.moveSpeed = 10;
        this.jumpForce = 8;
        this.gravity = 25;
        this.playerHeight = 1.7;
        this.playerRadius = 0.4; // Collision radius
        this.ghostMode = false; // Press G to toggle noclip

        // Shooting
        this.shootCooldown = 0;
        this.shootRate = 0.15; // seconds between shots
        this.raycaster = new THREE.Raycaster();
        this.collisionRaycaster = new THREE.Raycaster();

        // DOM
        this.healthDisplay = document.getElementById('health');
        this.ammoDisplay = document.getElementById('ammo');

        // Level Editor
        this.editMode = false;
        this.selectedObject = null;
        this.editorStep = 1.0; // Movement step size
        this.editorRotateStep = Math.PI / 4; // 45 degrees
        this.lastActionTime = 0;

        // Vehicle System
        this.isDriving = false;
        this.currentVehicle = null;
        this.vehicleSpeed = 0;
        this.vehicleSteering = 0;

        // Weapon system
        this.weapons = [
            {
                name: 'Pistol',
                model: null,
                path: 'assets/Pistol.glb',
                scale: 0.12,
                position: { x: 0.25, y: -0.2, z: -0.4 },
                rotation: { x: 0, y: Math.PI / 2, z: 0 }, // Rotate to face forward
                damage: 20,
                fireRate: 0.3,
                ammo: 12,
                maxAmmo: 12,
                recoil: 0.1,
                cameraRecoil: 0.0,
                reloadTime: 1.5
            },
            {
                name: 'Assault Rifle',
                model: null,
                path: 'assets/AssaultRifle.glb',
                scale: 0.15,
                position: { x: 0.3, y: -0.25, z: -0.5 },
                rotation: { x: 0, y: 0, z: 0 },
                damage: 25,
                fireRate: 0.12,
                ammo: 30,
                maxAmmo: 30,
                recoil: 0.25,
                cameraRecoil: 0.005,
                reloadTime: 2.5
            }
        ];
        this.currentWeapon = 0;
        this.weaponRecoil = 0;
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
            // Don't pause if we are in Editor Mode and holding an object
            if (this.editMode && this.selectedObject) {
                return;
            }
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
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('wheel', (e) => this.onWheel(e));
        document.addEventListener('contextmenu', (e) => e.preventDefault()); // Disable context menu for right click

        // Set initial position (clear spot on road)
        this.controls.object.position.set(62, this.playerHeight, 30);

        // Load all weapons
        this.loadWeapons();
    }

    loadWeapons() {
        const loader = new GLTFLoader();

        this.weapons.forEach((weapon, index) => {
            loader.load(
                weapon.path,
                (gltf) => {
                    weapon.model = gltf.scene;

                    // Apply weapon-specific transforms
                    const s = weapon.scale;
                    weapon.model.scale.set(s, s, s);
                    weapon.model.position.set(
                        weapon.position.x,
                        weapon.position.y,
                        weapon.position.z
                    );
                    // Apply rotation from config
                    if (weapon.rotation) {
                        weapon.model.rotation.set(
                            weapon.rotation.x,
                            weapon.rotation.y,
                            weapon.rotation.z
                        );
                    }

                    // Disable shadows for weapons (performance)
                    weapon.model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = false;
                            child.receiveShadow = false;
                        }
                    });

                    // Only show current weapon
                    weapon.model.visible = (index === this.currentWeapon);

                    // Attach to camera
                    this.game.camera.add(weapon.model);

                    console.log(`Loaded: ${weapon.name}`);

                    // Update ammo display when first weapon loads
                    if (index === this.currentWeapon) {
                        this.ammo = weapon.ammo;
                        this.maxAmmo = weapon.maxAmmo;
                        this.shootRate = weapon.fireRate;
                        // Update HUD
                        this.updateHUD();
                    }
                },
                undefined,
                (error) => {
                    console.error(`Error loading ${weapon.name}:`, error);
                }
            );
        });
    }

    switchWeapon(index) {
        if (index < 0 || index >= this.weapons.length) return;
        if (index === this.currentWeapon) return;

        // Hide current weapon
        if (this.weapons[this.currentWeapon].model) {
            this.weapons[this.currentWeapon].model.visible = false;
        }

        // Store current weapon's ammo
        this.weapons[this.currentWeapon].ammo = this.ammo;

        // Switch to new weapon
        this.currentWeapon = index;
        const weapon = this.weapons[index];

        // Show new weapon
        if (weapon.model) {
            weapon.model.visible = true;
        }

        // Update player stats from weapon
        this.ammo = weapon.ammo;
        this.maxAmmo = weapon.maxAmmo;
        this.shootRate = weapon.fireRate;
        this.updateHUD();

        console.log(`Switched to: ${weapon.name}`);

        // Play switch sound
        if (this.game.audioManager) this.game.audioManager.playReload();
    }

    getCurrentWeapon() {
        return this.weapons[this.currentWeapon];
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
            case 'Digit1':
                this.switchWeapon(0); // Pistol
                break;
            case 'Digit2':
                this.switchWeapon(1); // Assault Rifle
                break;
            case 'KeyG':
                this.ghostMode = !this.ghostMode;
                console.log('Ghost mode:', this.ghostMode ? 'ON (no collision)' : 'OFF');
                break;
            case 'KeyE': // Enter/Exit Vehicle
                if (this.isDriving) {
                    this.exitVehicle();
                } else {
                    this.tryEnterVehicle();
                }
                break;
            case 'KeyR':
                this.reloadWeapon();
                break;
            case 'KeyK': // Toggle Editor Mode
                this.toggleEditorMode();
                break;
            case 'KeyP': // Download World JSON
                if (this.game.world.loadedWorldData) {
                    const exportData = { buildings: [], vehicles: [], props: [] };

                    this.game.scene.children.forEach(obj => {
                        if (obj.userData && obj.userData.modelName) {
                            const item = {
                                model: obj.userData.modelName,
                                x: parseFloat(obj.position.x.toFixed(2)),
                                y: parseFloat(obj.position.y.toFixed(2)),
                                z: parseFloat(obj.position.z.toFixed(2)),
                                scale: parseFloat(obj.scale.x.toFixed(2)),
                                rotY: parseFloat(obj.rotation.y.toFixed(4))
                            };

                            // Categorize (heuristic)
                            if (item.model.includes('Building') || item.model.includes('Corner')) {
                                item.collidable = true;
                                exportData.buildings.push(item);
                            } else if (['Car', 'Bus', 'Truck', 'Van', 'SUV', 'Motorcycle', 'Police'].some(s => item.model.includes(s))) {
                                item.collidable = true;
                                exportData.vehicles.push(item);
                            } else {
                                item.collidable = false;
                                exportData.props.push(item);
                            }
                        }
                    });

                    // Trigger Download
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 4));
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", "world.json");
                    document.body.appendChild(downloadAnchorNode); // required for firefox
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();

                    console.log('World JSON downloaded');

                    // Show small notification on HUD
                    const status = document.getElementById('editor-status');
                    if (status) {
                        const originalText = status.innerHTML;
                        status.innerHTML = '<span style="color:#0f0">Downloaded world.json!</span>';
                        setTimeout(() => { if (this.editMode) status.innerHTML = originalText; }, 2000);
                    }
                }
                break;
            case 'Delete':
                if (this.editMode && this.selectedObject) {
                    this.deleteSelectedObject();
                }
                break;
        }

        // Editor Controls (Rotation/Scaling only, Movement is Mouse-based)
        if (this.editMode && this.selectedObject) {
            const obj = this.selectedObject;

            // Rotation
            if (event.code === 'KeyQ') obj.rotation.y += this.editorRotateStep;
            if (event.code === 'KeyE') obj.rotation.y -= this.editorRotateStep;

            // Scaling
            if (event.key === '+') obj.scale.multiplyScalar(1.1);
            if (event.key === '-') obj.scale.multiplyScalar(0.9);

            this.updateEditorHUD();
        }
    }

    onMouseMove(event) {
        if (!this.editMode || !this.selectedObject) return;

        const obj = this.selectedObject;
        const sensitivity = 0.05; // Movement speed

        if (event.shiftKey) {
            // Move Y (Vertical) - Shift + Mouse Y
            obj.position.y -= event.movementY * sensitivity;
        }
        // Horizontal movement is now handled by updateHeldObject loop

        this.updateEditorHUD();

        this.updateEditorHUD();
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

        if (event.button === 0) { // Left click - Always Shoot
            if (!this.editMode) {
                this.shoot();
            }
        }

        if (event.button === 2) { // Right click - Select Object in Editor
            if (this.editMode) {
                this.selectObject(event.ctrlKey);
            }
        }
    }

    reloadWeapon() {
        if (this.isReloading) return;
        const weapon = this.getCurrentWeapon();
        if (this.ammo === this.maxAmmo) return; // Full already

        this.isReloading = true;
        this.reloadTimer = weapon.reloadTime || 1.5;

        console.log("Reloading...");

        if (this.game.audioManager) {
            this.game.audioManager.playWeaponAction(weapon.name, 'reload');
        }
    }

    updateReloadAnimation(delta) {
        if (!this.isReloading) return;

        this.reloadTimer -= delta;
        const weapon = this.getCurrentWeapon();

        if (this.reloadTimer <= 0) {
            this.finishReload();
            return;
        }

        // Animation: Tilt weapon up (Pistol) or down (Rifle)
        if (weapon.model) {
            // Simple sine wave for "lifting" gun to check mag
            const totalTime = weapon.reloadTime || 1.5;
            const progress = 1 - (this.reloadTimer / totalTime); // 0 to 1

            // Peak rotation at 50%
            const peak = Math.sin(progress * Math.PI);

            // Add to base X rotation (which is -recoil)
            // Rotate X positive = Down.
            const dipAmount = 1.0; // radians
            weapon.model.rotation.x = (peak * dipAmount);
        }
    }

    finishReload() {
        this.isReloading = false;
        this.ammo = this.maxAmmo;
        this.updateHUD();
        console.log("Reload Complete");

        // Reset weapon rotation
        const weapon = this.getCurrentWeapon();
        if (weapon && weapon.model) {
            weapon.model.rotation.x = 0; // Reset
        }
    }

    shoot() {
        if (this.shootCooldown > 0) return;
        if (this.isReloading) return; // Block shooting while reloading

        if (this.ammo <= 0) {
            // Empty gun click
            if (this.game.audioManager) this.game.audioManager.playEmptyGun();
            return;
        }

        this.shootCooldown = this.shootRate;
        this.ammo--;
        this.updateHUD();

        // Play gunshot sound
        // Play gunshot sound
        if (this.game.audioManager) {
            this.game.audioManager.playWeaponAction(this.getCurrentWeapon().name, 'shot');
        }

        // Trigger weapon recoil
        const weapon = this.getCurrentWeapon();
        this.weaponRecoil = weapon.recoil || 0.15;

        // Camera Recoil (Kick Up)
        const camRecoil = weapon.cameraRecoil || 0;
        if (camRecoil > 0) {
            this.controls.object.rotation.x += camRecoil;
        }

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

    onWheel(event) {
        if (!this.editMode || !this.selectedObject) return;

        const obj = this.selectedObject;

        // Determine multiplier (1.1 for UP, 0.9 for DOWN)
        const multiplier = event.deltaY > 0 ? 0.9 : 1.1;

        // Apply uniform scale
        const targetScale = obj.scale.x * multiplier;
        const newScale = Math.max(0.001, targetScale); // Prevent zero/negative

        obj.scale.set(newScale, newScale, newScale);

        this.updateEditorHUD();
    }

    createMuzzleFlash() {
        const weapon = this.getCurrentWeapon();
        if (!weapon || !weapon.model) return;

        // Create flash if it doesn't exist
        if (!weapon.flash) {
            const geometry = new THREE.PlaneGeometry(0.3, 0.3);
            const material = this.flashMaterial || new THREE.MeshBasicMaterial({ color: 0xffff00 });
            weapon.flash = new THREE.Mesh(geometry, material);

            // Apply muzzle offset
            if (weapon.muzzleOffset) {
                weapon.flash.position.set(weapon.muzzleOffset.x, weapon.muzzleOffset.y, weapon.muzzleOffset.z);
            } else {
                weapon.flash.position.set(0, 0.1, -1); // Default
            }

            weapon.model.add(weapon.flash);
        }

        // Activate Flash
        weapon.flash.visible = true;
        weapon.flash.rotation.z = Math.random() * Math.PI; // Randomize rotation

        // Hide after short duration
        setTimeout(() => {
            if (weapon.flash) weapon.flash.visible = false;
        }, 50);
    }

    update(delta) {
        if (!this.controls.isLocked) return;

        // Camera Stabilization
        const cam = this.controls.object;
        // 1. Clamp Pitch (Prevent Flip) - approx 85 degrees
        cam.rotation.x = Math.max(-1.5, Math.min(1.5, cam.rotation.x));
        // 2. Lock Roll (Prevent Tilt)
        if (Math.abs(cam.rotation.z) > 0.001) cam.rotation.z = 0;

        // VEHICLE LOGIC
        if (this.isDriving && this.currentVehicle) {
            this.updateVehiclePhysics(delta);
            return;
        }

        // Standard Player Logic
        // Update shoot cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown -= delta;
        }

        // Update weapon recoil animation
        // Update weapon animation
        const currentWeapon = this.getCurrentWeapon();
        if (currentWeapon && currentWeapon.model) {
            if (this.isReloading) {
                this.updateReloadAnimation(delta);
            } else {
                // Recoil Recovery
                if (this.weaponRecoil > 0) {
                    this.weaponRecoil -= delta * 2;
                    if (this.weaponRecoil < 0) this.weaponRecoil = 0;
                }
                // Apply recoil to weapon position/rotation
                currentWeapon.model.position.z = currentWeapon.position.z + this.weaponRecoil;
                currentWeapon.model.rotation.x = -this.weaponRecoil * 0.5;
            }
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

        // Check horizontal collision and rollback if needed (skip in ghost mode)
        if (!this.ghostMode && this.checkHorizontalCollision()) {
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

        // Update position display for debugging
        const pos = this.controls.object.position;
        const posDisplay = document.getElementById('position');
        if (posDisplay) {
            posDisplay.textContent = `Pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        }

        // Raycast to detect what model we're looking at
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
        const allObjects = [];
        this.game.scene.traverse((obj) => {
            if (obj.isMesh && obj.visible) {
                // Ignore collision boxes and helper objects
                if (obj.name && (obj.name.startsWith('obstacle_') || obj.name === 'hitMarker')) {
                    return;
                }
                allObjects.push(obj);
            }
        });
        const hits = this.raycaster.intersectObjects(allObjects, false);

        const targetDisplay = document.getElementById('target');
        if (targetDisplay) {
            if (hits.length > 0) {
                const hit = hits[0];
                // Find the model name by traversing up to find userData with model info
                let modelName = hit.object.name || '';
                let current = hit.object;
                while (current && !modelName.includes('.glb')) {
                    if (current.userData && current.userData.modelName) {
                        modelName = current.userData.modelName;
                        break;
                    }
                    if (current.name && current.name.includes('.glb')) {
                        modelName = current.name;
                        break;
                    }
                    current = current.parent;
                }
                if (!modelName) modelName = hit.object.name || 'unnamed';
                targetDisplay.textContent = `Looking at: ${modelName} (dist: ${hit.distance.toFixed(1)})`;
            } else {
                targetDisplay.textContent = 'Looking at: -';
            }
        }

        // Update Held Object (Editor Mode)
        if (this.editMode) {
            this.updateHeldObject();
        }
    }

    tryEnterVehicle() {
        if (this.editMode) return;

        // Simple distance check to all vehicles
        // (Could optimize with spatial hash or specific list, but iteration is fine for now)
        const playerPos = this.controls.object.position;
        let closestVehicle = null;
        let closestDist = 3.0; // Max enter distance

        // Find all interactable vehicles
        this.game.world.collidables.forEach(obj => {
            // Check if it's a vehicle (obstacle_child usually parented to model)
            // We need the model root.
            let model = obj;
            while (model.parent && model.parent.type !== 'Scene') {
                model = model.parent;
            }

            // Check name
            const name = model.userData.modelName || model.name || '';
            const isVehicle = ['Car', 'Bus', 'Truck', 'Van', 'SUV', 'Police'].some(s => name.includes(s));

            if (isVehicle) {
                // Get distance to model center
                const dist = playerPos.distanceTo(model.position);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestVehicle = model;
                }
            }
        });

        if (closestVehicle) {
            console.log('Entering vehicle:', closestVehicle.name);
            this.enterVehicle(closestVehicle);
        } else {
            console.log('No vehicle nearby');
        }
    }

    enterVehicle(vehicle) {
        this.isDriving = true;
        this.currentVehicle = vehicle;
        this.vehicleSpeed = 0;
        this.vehicleSteering = 0;

        // 1. Hide Player Weapon
        if (this.weapons[this.currentWeapon].model) {
            this.weapons[this.currentWeapon].model.visible = false;
        }

        // 2. Switch Camera to Third Person Follow
        // Detach camera from controls object temporarily?
        // Or just move the controls object to follow the car?
        // It's cleaner to detach camera from controls for smooth physics, 
        // BUT PointerLockControls binds camera rotation to mouse.
        // Let's Keep controls active for "Looking around" but move the controls object to the car.

        // Actually simpler: Just set velocity to 0 and handle position in update
        this.velocity.set(0, 0, 0);

        // Show HUD Message
        const targetDisplay = document.getElementById('target');
        if (targetDisplay) targetDisplay.textContent = 'Driving: ' + (vehicle.userData.modelName || 'Car');
    }

    exitVehicle() {
        if (!this.currentVehicle) return;

        // Teleport player slightly to the left of the car
        const carPos = this.currentVehicle.position;
        // Offset left (local -X)
        const offset = new THREE.Vector3(-2.5, 0, 0);
        offset.applyEuler(this.currentVehicle.rotation);

        this.controls.object.position.copy(carPos).add(offset);
        this.controls.object.position.y = this.playerHeight + 0.5; // Ensure above ground

        // Reset state
        this.isDriving = false;
        this.currentVehicle = null;
        this.vehicleSpeed = 0;

        // Show Weapon
        if (this.weapons[this.currentWeapon].model) {
            this.weapons[this.currentWeapon].model.visible = true;
        }

        // Ensure velocity is reset
        this.velocity.set(0, 0, 0);
    }

    updateVehiclePhysics(delta) {
        const vehicle = this.currentVehicle;
        const maxSpeed = 25.0;
        const acceleration = 15.0;
        const friction = 10.0;
        const turnSpeed = 2.0;

        // Input
        // Forward/Back
        if (this.moveForward) {
            this.vehicleSpeed += acceleration * delta;
        } else if (this.moveBackward) {
            this.vehicleSpeed -= acceleration * delta;
        } else {
            // Friction
            if (this.vehicleSpeed > 0) this.vehicleSpeed = Math.max(0, this.vehicleSpeed - friction * delta);
            if (this.vehicleSpeed < 0) this.vehicleSpeed = Math.min(0, this.vehicleSpeed + friction * delta);
        }

        // Cap speed
        this.vehicleSpeed = Math.max(-maxSpeed / 2, Math.min(maxSpeed, this.vehicleSpeed));

        // Steering (only when moving)
        if (Math.abs(this.vehicleSpeed) > 0.1) {
            const dir = this.vehicleSpeed > 0 ? 1 : -1;
            if (this.moveLeft) {
                vehicle.rotation.y += turnSpeed * delta * dir;
            }
            if (this.moveRight) {
                vehicle.rotation.y -= turnSpeed * delta * dir;
            }
        }

        // Apply movement
        vehicle.translateZ(this.vehicleSpeed * delta);

        // Environment Collision
        if (Math.abs(this.vehicleSpeed) > 0.1) {
            const vehicleBox = new THREE.Box3().setFromObject(vehicle);
            const obstacles = this.game.world.collidables.filter(obj => {
                if (obj.name === 'ground' || obj.name.startsWith('road') || obj.name.startsWith('orb')) return false;

                // Avoid self
                let root = obj;
                while (root.parent && root.parent.type !== 'Scene') {
                    root = root.parent;
                }
                if (root === vehicle) return false;

                return true;
            });

            for (const obstacle of obstacles) {
                const obstacleBox = new THREE.Box3().setFromObject(obstacle);
                if (vehicleBox.intersectsBox(obstacleBox)) {
                    // Find root object
                    let root = obstacle;
                    while (root.parent && root.parent.type !== 'Scene') root = root.parent;

                    if (root.userData.isMoveable) {
                        // Push Moveable Object
                        const pushDir = new THREE.Vector3(0, 0, 1).applyQuaternion(vehicle.quaternion).normalize();
                        const pushForce = this.vehicleSpeed * delta;

                        root.position.add(pushDir.multiplyScalar(pushForce));

                        // Transfer momentum (slow car down)
                        this.vehicleSpeed *= 0.98;
                    } else {
                        // Hit Static Wall -> Stop
                        console.log("Crashed into:", root.name);

                        // Undo movement
                        vehicle.translateZ(-this.vehicleSpeed * delta);

                        // Stop (bounce slightly?)
                        this.vehicleSpeed = -this.vehicleSpeed * 0.3; // Small bounce back
                        if (Math.abs(this.vehicleSpeed) < 1) this.vehicleSpeed = 0;
                    }
                }
            }
        }

        // Ground following (Raycast down from center)
        const vPos = vehicle.position;
        this.collisionRaycaster.set(new THREE.Vector3(vPos.x, vPos.y + 2, vPos.z), new THREE.Vector3(0, -1, 0));
        const obstacles = this.game.world.collidables.filter(obj => obj.name === 'ground' || obj.name.startsWith('road')); // Restrict to driveable surfaces? Or just everything excluding self?
        // Actually, just colliding with 'ground' and 'road' is safest for now to avoid climbing buildings.
        // But World.js collidables includes buildings.
        // Let's filter for just ground for smooth driving, or all?
        // Let's use all but exclude self.

        const validGround = this.game.world.collidables.filter(c => {
            // Avoid self-collision (vehicle children have colliders)
            let p = c;
            while (p.parent && p.parent.type !== 'Scene') {
                if (p === vehicle) return false;
                p = p.parent;
            }
            return true;
        });

        const hits = this.collisionRaycaster.intersectObjects(validGround, true);
        if (hits.length > 0) {
            // Find highest point
            let groundY = -999;
            for (let h of hits) {
                if (h.distance < 10) { // check reasonable range
                    groundY = Math.max(groundY, h.point.y);
                }
            }
            if (groundY > -999) {
                // Smooth lerp for suspension effect? Or snap?
                // Snap for now
                vehicle.position.y = groundY;
            }
        }

        // Camera Follow Logic (Third Person)
        // Offset: Behind and Up relative to car
        const offset = new THREE.Vector3(0, 3, -6); // Behind (-Z is forward in basic Three.js, but our car moves +Z? wait translateZ moves along local Z)
        // Let's check rotation. By default GLTF models might face +Z or -Z. 
        // We might need to debug this. Assuming +Z is forward for translateZ.

        const relativeOffset = offset.clone().applyEuler(vehicle.rotation);
        const cameraPos = vehicle.position.clone().add(relativeOffset);

        // Smooth camera lerp
        this.controls.object.position.lerp(cameraPos, delta * 5);
        this.controls.object.lookAt(vehicle.position.clone().add(new THREE.Vector3(0, 1, 0))); // Look at slightly above car center

        // ENEMY COLLISION LOGIC
        // Only checking if moving fast enough to do damage
        if (Math.abs(this.vehicleSpeed) > 5.0 && this.game.enemyManager) {
            const vehicleBox = new THREE.Box3().setFromObject(vehicle);
            // Expand box slightly for impact tolerance
            vehicleBox.expandByScalar(-0.2);

            this.game.enemyManager.enemies.forEach(enemy => {
                // Skip dead or already dying enemies
                if (enemy.state === 'dead') return; // 'dead' string from Enemy.STATE.DEAD (checked in Enemy.js)
                // Actually safer to check if mesh exists and visible
                if (!enemy.mesh || !enemy.mesh.parent) return;

                // Simple radius check first for performance
                if (vehicle.position.distanceTo(enemy.mesh.position) < 5.0) {
                    // Precise Box Check
                    // We can approximate enemy as a point or small box
                    const enemyPos = enemy.mesh.position;
                    if (vehicleBox.containsPoint(enemyPos) || vehicleBox.intersectsBox(new THREE.Box3().setFromObject(enemy.mesh))) {

                        // Hit detected! 
                        // Calculate Damage
                        const impactForce = Math.abs(this.vehicleSpeed);
                        const damage = Math.floor(impactForce * 4); // 25 speed * 4 = 100 dmg (Instant kill)

                        // Apply Damage
                        enemy.takeDamage(damage);
                        console.log(`Vehicle hit enemy! Speed: ${impactForce.toFixed(1)}, Damage: ${damage}`);

                        // Optional: Knockback?
                        // Enemy.js doesn't seem to have knockback vector support, just animation.
                        // We could manually push the mesh, but Enemy.update might overwrite it.
                        // Let's just rely on the damage for now.

                        // Slow down car slightly on impact
                        this.vehicleSpeed *= 0.8;
                    }
                }
            });
        }
    }

    /**
     * Check if player is colliding horizontally with obstacles (Walking Only)
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
        this.healthDisplay.textContent = `Health: ${Math.ceil(this.health)}`;
        this.ammoDisplay.textContent = `Ammo: ${this.ammo}`;

        // Create/Update Armor and Money displays if they exist, or append them
        // For simplicity, we assume they are added to the existing elements or we update textContent dynamically
        // Let's modify index.html to add IDs for them, or just append here.

        // Actually, let's look at index.html first to add the elements properly.
        // But for now, let's just make sure we update them if they exist.
        const armorDisp = document.getElementById('armor-display');
        if (armorDisp) armorDisp.textContent = `Armor: ${(this.armor || 0).toFixed(1)}`;

        const moneyDisp = document.getElementById('money-display');
        if (moneyDisp) moneyDisp.textContent = `$: ${(this.money || 0)}`;
    }

    // Level Editor Methods
    updateHeldObject() {
        if (!this.selectedObject || !this.dragDistance) return;

        const obj = this.selectedObject;

        // Get Camera Forward Vector (Projected to XZ plane)
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.game.camera.quaternion);

        // Normalize on XZ plane to keep distance consistent regardless of pitch
        // If looking straight up/down, forward.x/z approach 0. 
        // We handle this by checking length.
        const forwardXZ = new THREE.Vector3(forward.x, 0, forward.z);
        if (forwardXZ.lengthSq() > 0.001) {
            forwardXZ.normalize();
        } else {
            // Edge case: looking straight up/down. Keep previous XZ direction or just stop moving?
            // Let's just stop updating position to avoid singularity jitter.
            return;
        }

        const worldCamPos = new THREE.Vector3();
        this.game.camera.getWorldPosition(worldCamPos);

        // Calculate new position
        const newX = worldCamPos.x + forwardXZ.x * this.dragDistance;
        const newZ = worldCamPos.z + forwardXZ.z * this.dragDistance;

        obj.position.x = newX;
        obj.position.z = newZ;

        // Update HUD
        this.updateEditorHUD();
    }

    toggleEditorMode() {
        this.editMode = !this.editMode;
        const hud = document.getElementById('editor-hud');
        if (hud) hud.style.display = this.editMode ? 'block' : 'none';

        if (!this.editMode) {
            this.selectedObject = null;
        } else {
            // Auto-enable ghost mode in editor for easier movement
            this.ghostMode = true;
        }
        console.log('Editor Mode:', this.editMode ? 'ON' : 'OFF');
    }

    selectObject(isCtrlPressed = false) {
        // TOGGLE LOGIC: If something is already selected
        if (this.selectedObject) {
            if (isCtrlPressed) {
                // CLONE ON DROP (Stamp)
                // Leave a copy here, keep holding original
                this.cloneObject(this.selectedObject);
                // Visual feedback?
                console.log('Stamped Object');
                return;
            } else {
                // DROP
                this.selectedObject = null;
                this.updateEditorHUD();

                // UNFREEZE CAMERA when dropping object
                if (this.controls) this.controls.lock();

                return;
            }
        }

        // reuse raycasting logic from update method
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
        const allObjects = [];
        this.game.scene.traverse((obj) => {
            if (obj.isMesh && obj.visible) {
                // Allow selecting collision boxes in editor to find them, but prefer visible models
                allObjects.push(obj);
            }
        });
        const hits = this.raycaster.intersectObjects(allObjects, false);

        if (hits.length > 0) {
            // Find root object
            let target = hits[0].object;
            // Traverse up to find the main group/mesh that has the transform
            while (target.parent && target.parent.type !== 'Scene') {
                target = target.parent;
            }

            // ONLY select if it's a valid loaded model (has modelName)
            if (target.userData && target.userData.modelName) {

                if (isCtrlPressed) {
                    // CLONE ON PICKUP
                    const clone = this.cloneObject(target);
                    this.selectedObject = clone;
                    console.log('Cloned & Picked Up:', clone.name);
                } else {
                    // NORMAL PICKUP
                    this.selectedObject = target;
                    console.log('Selected:', target.name || 'Unnamed Object');
                }

                this.updateEditorHUD();

                // Snap Object to Camera View Center
                this.snapObjectToView(this.selectedObject);

                // Initialize Drag Distance (XZ)
                const worldCamPos = new THREE.Vector3();
                this.game.camera.getWorldPosition(worldCamPos);
                const dx = this.selectedObject.position.x - worldCamPos.x;
                const dz = this.selectedObject.position.z - worldCamPos.z;
                this.dragDistance = Math.sqrt(dx * dx + dz * dz);

                return;
            }
        }

        // If no hit, or hit something invalid (ground/sky) -> Deselect
        this.selectedObject = null;
        this.updateEditorHUD();

        // UNFREEZE CAMERA when dropping object
        if (this.controls) this.controls.lock();
    }

    cloneObject(original) {
        const clone = original.clone();

        // Copy User Data explicitly if needed (clone usually does shallow copy)
        clone.userData = JSON.parse(JSON.stringify(original.userData));

        // Add to Scene
        this.game.scene.add(clone);

        // Register Colliders
        // clone() copies children, so it has the collision mesh, but we need to add it to game.world.collidables
        clone.traverse((child) => {
            if (child.name === 'obstacle_child' || child.userData.modelName) {
                // Check if it's a collider
                if (child.name === 'obstacle_child') {
                    this.game.world.collidables.push(child);
                }

                // Ensure shadows are enabled on cloned meshes
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            }
        });

        return clone;
    }

    deleteSelectedObject() {
        if (!this.selectedObject) return;

        const obj = this.selectedObject;
        console.log('Deleting:', obj.name);

        // 1. Remove from Scene
        this.game.scene.remove(obj);

        // 2. Cleanup Collidables
        // We need to remove the object and any of its children from the global collidables list
        const idsToRemove = new Set();
        idsToRemove.add(obj.id);
        obj.traverse(child => idsToRemove.add(child.id));

        this.game.world.collidables = this.game.world.collidables.filter(item => !idsToRemove.has(item.id));

        // 3. Reset Selection
        this.selectedObject = null;
        this.updateEditorHUD();
    }

    snapObjectToView(object) {
        if (!this.game.camera) return;

        // 1. Get current distance from camera to object center
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const worldCamPos = new THREE.Vector3();
        this.game.camera.getWorldPosition(worldCamPos);

        const distance = worldCamPos.distanceTo(center);

        // 2. Get Camera Forward Vector
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.game.camera.quaternion);

        // 3. Calculate Target Center Position
        const targetCenter = worldCamPos.clone().add(forward.multiplyScalar(distance));

        // 4. Calculate Offset from Object Pivot to Object Center
        // Pivot is object.position. We need to move Pivot such that Center lands on TargetCenter.
        // Center = Pivot + (Center - Pivot)
        // NewPivot = TargetCenter - (Center - Pivot)

        const pivotToCenter = center.clone().sub(object.position);

        const newPos = targetCenter.clone().sub(pivotToCenter);

        object.position.copy(newPos);
    }

    updateEditorHUD() {
        const status = document.getElementById('editor-status');
        if (!status) return;

        if (this.selectedObject) {
            const obj = this.selectedObject;
            const name = obj.userData.modelName || obj.name || 'Unnamed';
            const x = obj.position.x.toFixed(2);
            const y = obj.position.y.toFixed(2);
            const z = obj.position.z.toFixed(2);
            const rot = (obj.rotation.y * (180 / Math.PI)).toFixed(0);
            const scale = obj.scale.x.toFixed(3);

            status.innerHTML = `Selected: <span style="color:#fff">${name}</span><br>
                    Pos: ${x}, ${y}, ${z}<br>
                    Rot Y: ${rot}°<br>
                    Scale: ${scale}`;
        } else {
            status.textContent = 'Select an object';
        }
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

    collectLoot(type) {
        if (type === 'coin') {
            this.money += 10;
            console.log(`Collected Coin! Money: ${this.money}`);
            // Play sound
            if (this.game.audioManager) this.game.audioManager.playTone(1200, 0.1, 0.4, 'sine');
        } else if (type === 'cowboyhat') {
            // Armor Formula: Gain = 100 / (100 + CurrentArmor)
            const armorGain = 100 / (100 + this.armor);
            this.armor += armorGain;
            console.log(`Collected Hat! Armor: ${this.armor.toFixed(2)} (+${armorGain.toFixed(2)})`);
            // Play sound
            if (this.game.audioManager) this.game.audioManager.playTone(400, 0.1, 0.4, 'square');
        } else if (type === 'potion') {
            this.health = Math.min(100, this.health + 25);
            console.log(`Collected Potion! Health: ${this.health}`);
            // Play sound
            if (this.game.audioManager) this.game.audioManager.playTone(600, 0.3, 0.5, 'sine'); // Higher pitch magical sound
        }
        this.updateHUD();
    }
}
