import * as THREE from 'three';
import { Player } from './Player.js';
import { World } from './World.js';
import { InputManager } from './InputManager.js';
import { EnemyManager } from './EnemyManager.js';
import { AudioManager } from './AudioManager.js';
import { LootManager } from './LootManager.js';

/**
 * Main Game class - orchestrates all game systems
 */
export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        this.player = null;
        this.world = null;
        this.inputManager = null;
        this.enemyManager = null;
        this.audioManager = null;

        this.isRunning = false;

        // DOM elements
        this.blocker = document.getElementById('blocker');
        this.crosshair = document.getElementById('crosshair');
        this.hud = document.getElementById('hud');
    }

    init() {
        this.setupRenderer();
        this.setupScene();
        this.setupCamera();
        this.setupLighting();

        // Initialize game systems
        this.inputManager = new InputManager(this);
        this.world = new World(this);
        this.player = new Player(this);
        this.enemyManager = new EnemyManager(this);
        this.audioManager = new AudioManager(this);
        this.lootManager = new LootManager(this);

        this.world.init();
        this.player.init();
        this.inputManager.init();
        this.enemyManager.init();
        this.audioManager.init();
        this.lootManager.init();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Start game loop
        this.animate();

        console.log('Game initialized');
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 10, 100);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 1.7, 5); // Eye height
        this.camera.rotation.order = 'YXZ'; // Important for First Person Controls
    }

    setupLighting() {
        // Ambient light for base illumination
        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambient);

        // Directional light (sun)
        const sun = new THREE.DirectionalLight(0xffffff, 1);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 500;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 50;
        sun.shadow.camera.bottom = -50;
        this.scene.add(sun);

        // Hemisphere light for sky/ground color variation
        const hemi = new THREE.HemisphereLight(0x7b68ee, 0x2d2d44, 0.3);
        this.scene.add(hemi);
    }

    start() {
        this.isRunning = true;
        this.blocker.classList.add('hidden');
        this.crosshair.classList.add('visible');
        this.hud.classList.add('visible');
    }

    pause() {
        this.isRunning = false;
        this.blocker.classList.remove('hidden');
        this.crosshair.classList.remove('visible');
        this.hud.classList.remove('visible');
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        if (this.isRunning) {
            this.player.update(delta);
            this.world.update(delta);
            this.enemyManager.update(delta);
            this.lootManager.update(delta);
        }

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
