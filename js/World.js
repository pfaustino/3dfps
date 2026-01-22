import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * World class - loads 3D city assets from CityPack
 */
export class World {
    constructor(game) {
        this.game = game;
        this.collidables = [];
        this.loader = new GLTFLoader();
        this.loadedModels = {};
    }

    init() {
        this.createGround();
        this.createRoads();
        this.loadCityAssets();
        this.createDecorations();
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a3a,
            roughness: 0.95,
            metalness: 0.05
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.name = 'ground';
        this.game.scene.add(ground);
        this.collidables.push(ground);

        // Grid
        const grid = new THREE.GridHelper(200, 40, 0x333355, 0x222233);
        grid.position.y = 0.01;
        this.game.scene.add(grid);
    }

    createRoads() {
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333344,
            roughness: 0.9
        });

        const roads = [
            { x: 0, z: 0, w: 8, d: 200 },
            { x: 0, z: 0, w: 200, d: 8 },
            { x: -40, z: 0, w: 6, d: 120 },
            { x: 40, z: 0, w: 6, d: 120 },
            { x: 0, z: -40, w: 120, d: 6 },
            { x: 0, z: 40, w: 120, d: 6 },
        ];

        roads.forEach(road => {
            const geometry = new THREE.PlaneGeometry(road.w, road.d);
            const mesh = new THREE.Mesh(geometry, roadMaterial);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(road.x, 0.02, road.z);
            mesh.receiveShadow = true;
            this.game.scene.add(mesh);
        });
    }

    loadCityAssets() {
        // Fetch world configuration
        fetch('assets/world.json')
            .then(response => response.json())
            .then(data => {
                console.log('World data loaded:', data);

                // Load assets from JSON
                if (data.buildings) data.buildings.forEach(b => this.loadModel(b, true));
                if (data.vehicles) data.vehicles.forEach(v => this.loadModel(v, true));
                if (data.props) data.props.forEach(p => this.loadModel(p, false, true));

                // Store loaded data reference for editor
                this.loadedWorldData = data;
            })
            .catch(error => {
                console.error('Error loading world.json:', error);

                // Fallback / Default if file missing (optional, or just log error)
            });
    }

    loadModel(config, isCollidable = false, isMoveable = false) {
        // Use config.collidable if present, otherwise default to argument
        const shouldCollide = config.collidable !== undefined ? config.collidable : isCollidable;

        const path = `assets/CityPack/${config.model}`;

        this.loader.load(
            path,
            (gltf) => {
                const model = gltf.scene;

                // Store model name for tooltip display
                model.name = config.model;
                model.userData.modelName = config.model;

                // Enable shadows and tag children with model name
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.userData.modelName = config.model;
                        child.userData.isMoveable = isMoveable;
                    }
                });

                model.userData.isMoveable = isMoveable;

                // Add collision for buildings/vehicles (BEFORE transforms to get local AABB)
                if (shouldCollide) {
                    // Ensure model is at origin/unscaled for accurate local bounds
                    model.position.set(0, 0, 0);
                    model.rotation.set(0, 0, 0);
                    model.scale.set(1, 1, 1);
                    model.updateMatrixWorld(true);

                    // Create collision box
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());

                    const collisionGeom = new THREE.BoxGeometry(size.x, size.y, size.z);
                    const collisionMat = new THREE.MeshBasicMaterial({ visible: false });
                    const collisionMesh = new THREE.Mesh(collisionGeom, collisionMat);

                    // Center the box relative to the model
                    collisionMesh.position.copy(center);
                    collisionMesh.name = `obstacle_child`;

                    // Attach to model (so it moves/rotates/scales with it)
                    model.add(collisionMesh);
                    this.collidables.push(collisionMesh);
                }

                // Apply transforms to the parent model
                const scale = config.scale || 1;
                model.scale.set(scale, scale, scale);
                model.position.set(config.x, config.y || 0, config.z);
                if (config.rotY) model.rotation.y = config.rotY;

                this.game.scene.add(model);
            },
            undefined,
            (error) => {
                console.error(`Error loading ${config.model}:`, error);
            }
        );
    }

    createDecorations() {
        // Floating orbs for visual interest
        const orbPositions = [
            { x: -20, y: 5, z: -30 },
            { x: 20, y: 6, z: -40 },
            { x: 0, y: 8, z: -60 },
            { x: -40, y: 4, z: -20 },
            { x: 40, y: 5, z: -25 },
            { x: 30, y: 4, z: 40 },
            { x: -30, y: 5, z: 30 },
        ];

        orbPositions.forEach((pos, index) => {
            const geometry = new THREE.SphereGeometry(0.4, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
            const orb = new THREE.Mesh(geometry, material);
            orb.position.set(pos.x, pos.y, pos.z);
            orb.name = `orb_${index} `;
            this.game.scene.add(orb);
            this.collidables.push(orb);

            const light = new THREE.PointLight(0x00d4ff, 1, 12);
            light.position.copy(orb.position);
            this.game.scene.add(light);

            orb.userData.light = light;
            orb.userData.baseY = pos.y;
            orb.userData.phase = Math.random() * Math.PI * 2;
        });
    }

    update(delta) {
        const time = Date.now() * 0.001;

        // Animate orbs
        this.collidables.forEach(obj => {
            if (obj.name && obj.name.startsWith('orb_')) {
                const baseY = obj.userData.baseY;
                const phase = obj.userData.phase;
                obj.position.y = baseY + Math.sin(time * 2 + phase) * 0.5;
                obj.rotation.y += delta;

                if (obj.userData.light) {
                    obj.userData.light.position.copy(obj.position);
                }
            }
        });
    }
}
