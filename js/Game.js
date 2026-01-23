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

        // Setup UI
        this.setupUI();

        // Start game loop
        this.animate();

        console.log('Game initialized');
    }

    setupUI() {
        // Menu Navigation
        const screens = {
            main: document.getElementById('main-menu'),
            settings: document.getElementById('settings-menu'),
            about: document.getElementById('about-menu'),
            credits: document.getElementById('credits-menu')
        };

        const showScreen = (screenName) => {
            Object.values(screens).forEach(s => s.classList.add('hidden'));
            screens[screenName].classList.remove('hidden');
        };

        // Main Menu Buttons
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.player.controls.lock();
        });

        document.getElementById('btn-settings').addEventListener('click', () => showScreen('settings'));
        document.getElementById('btn-about').addEventListener('click', () => showScreen('about'));
        document.getElementById('btn-credits').addEventListener('click', () => showScreen('credits'));

        // Back Buttons
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => {
                showScreen(btn.dataset.target || 'main');
            });
        });

        // Settings Sliders
        const musicSlider = document.getElementById('slider-music');
        const sfxSlider = document.getElementById('slider-sfx');
        const diffSlider = document.getElementById('slider-difficulty');
        const diffLabel = document.getElementById('difficulty-label');

        // Audio Settings
        musicSlider.addEventListener('input', (e) => {
            if (this.audioManager) {
                this.audioManager.musicVolume = e.target.value / 100;
                this.audioManager.startAmbient(); // Refresh
                // Or update gain directly if implemented
                // For now, next ambient loop update will catch it, or we can add a method
            }
        });

        sfxSlider.addEventListener('input', (e) => {
            if (this.audioManager) {
                this.audioManager.sfxVolume = e.target.value / 100;
                this.audioManager.playTone(440, 0.1, 0.5); // Test tone
            }
        });

        // Difficulty Settings
        const diffNames = ['Very Easy', 'Easy', 'Normal', 'Hard', 'Very Hard', 'Nightmare'];
        const diffColors = ['#4ade80', '#88ff88', '#fff', '#ffaa00', '#ff4444', '#aa0000'];

        diffSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value) - 1;
            diffLabel.textContent = diffNames[val];
            diffLabel.style.color = diffColors[val];

            if (this.enemyManager) {
                this.enemyManager.setDifficulty(val + 1);
            }
        });
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
