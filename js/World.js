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
        this.assetCache = {}; // Cache for cloning
    }

    init() {
        this.createGround();
        this.createRoads();
        this.loadCityAssets();

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

        // Preload Loot Models (Hidden off-stage)
        // Preload Loot Models (Hidden off-stage)
        const lootModels = ['CoinDollarSign.glb', 'SheriffHat.glb', 'ComplexHealthPotion.glb'];
        lootModels.forEach(modelName => {
            this.loadModel({ model: modelName, path: 'assets', x: 0, y: -500, z: 0, scale: 1, rotY: 0, collidable: false });
        });
    }

    loadModel(config, isCollidable = false, isMoveable = false) {
        const shouldCollide = config.collidable !== undefined ? config.collidable : isCollidable;

        let path = `assets/CityPack/${config.model}`;
        if (config.path) {
            path = `${config.path}/${config.model}`;
        }

        this.loader.load(
            path,
            (gltf) => {
                const model = gltf.scene;

                // Cache for LootManager
                if (this.assetCache && !this.assetCache[config.model]) {
                    this.assetCache[config.model] = model.clone();
                }

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



    update(delta) {
        const time = Date.now() * 0.001;

        // Animate orbs

    }

    getAsset(name) {
        // Simple search in loaded assets (this assumes we keep a cache or can clone from scene)
        // Since we don't have a dedicated asset cache in World yet, we rely on the implementation pattern.
        // Let's look if we loaded them as props with modelName.

        // Actually, we need to ensure these are loaded even if not in world.json.
        // We will add a "preload" step or just check our props lookup.

        // For now, let's search the template cache if we add one, or just search known props.
        // But better: Store loaded GLTFs in a dictionary in loadModel.
        return this.assetCache ? this.assetCache[name] : null;
    }
}
