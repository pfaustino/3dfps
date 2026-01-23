/**
 * AudioManager class - handles all game audio using Web Audio API
 * Uses procedural audio generation (no external files needed)
 */
export class AudioManager {
    constructor(game) {
        this.game = game;
        this.context = null;
        this.masterGain = null;
        this.initialized = false;

        // Volume settings
        this.masterVolume = 0.5;
        this.sfxVolume = 0.7;
        this.musicVolume = 0.3;
    }

    init() {
        // Audio context must be created after user interaction
        document.addEventListener('click', () => this.initContext(), { once: true });
    }

    initContext() {
        if (this.initialized) return;

        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();

            // Master gain node
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.context.destination);

            this.buffers = {};
            this.loadMonsterSounds();

            this.initialized = true;
            console.log('Audio system initialized');

            // Start ambient background
            this.startAmbient();
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    loadMonsterSounds() {
        this.loadSound('robot', 'assets/sounds/creepy-sound-creepy-robot-380620.mp3');
        this.loadSound('ghost', 'assets/sounds/halloween-ghost-whisper-410557.mp3');
        this.loadSound('zombie', 'assets/sounds/zombie-sound-357975.mp3');
        this.loadSound('demon', 'assets/sounds/horror-demonic-sound-1-vol-001-140997.mp3');

        // Weapon Sounds
        this.loadSound('pistol-shot', 'assets/sounds/pistol-shot.mp3');
        this.loadSound('pistol-reload', 'assets/sounds/pistol-reload.mp3');
        this.loadSound('ak47-shot', 'assets/sounds/ak47-shot.mp3');
        this.loadSound('ak47-reload', 'assets/sounds/ak47-reload.mp3');
    }

    loadSound(key, url) {
        fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.context.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.buffers[key] = audioBuffer;
                console.log(`Loaded sound: ${key}`);
            })
            .catch(e => console.error(`Error loading sound ${key}:`, e));
    }

    // ═══════════════════════════════════════════════════════════
    // SOUND EFFECTS
    // ═══════════════════════════════════════════════════════════

    /**
     * Gunshot sound - short burst of filtered noise
     */
    /**
     * Play weapon-specific sound
     */
    playWeaponAction(weaponName, action) {
        if (!this.initialized) return;

        let key = '';
        const name = weaponName.toLowerCase();

        // Map weapon names to sound keys
        if (name.includes('pistol')) {
            key = `pistol-${action}`;
        } else if (name.includes('rifle') || name.includes('ak47')) {
            key = `ak47-${action}`;
        }

        // Try to play loaded buffer
        if (key && this.buffers[key]) {
            const source = this.context.createBufferSource();
            source.buffer = this.buffers[key];

            const gain = this.context.createGain();
            // Adjust volume based on action
            gain.gain.value = (action === 'shot' ? 0.8 : 0.5) * this.sfxVolume;

            source.connect(gain);
            gain.connect(this.masterGain);
            source.start();
            return;
        }

        // Fallback to procedural if file missing
        if (action === 'shot') this.playProceduralGunshot();
        else if (action === 'reload') this.playProceduralReload();
    }

    playGunshot() {
        // Legacy fallback
        this.playProceduralGunshot();
    }

    playProceduralGunshot() {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        // Create noise buffer
        const bufferSize = this.context.sampleRate * 0.1;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        // Noise source
        const noise = this.context.createBufferSource();
        noise.buffer = buffer;

        // Filter for gunshot character
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.1);

        // Envelope
        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.8 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        // Connect
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.1);

        // Add a "thump" for bass
        this.playTone(80, 0.05, 0.3, 'sine');
    }

    /**
     * Hit impact sound
     */
    playHit() {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        // Short click/thud
        const osc = this.context.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    /**
     * Enemy hit sound - higher pitched impact
     */
    playEnemyHit() {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        // Squelchy hit
        const osc = this.context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.3 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    /**
     * Enemy death sound - descending tone
     */
    playEnemyDeath() {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        // Descending wail
        const osc = this.context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.4);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.35 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.45);
    }

    /**
     * Player damage sound - low grunt
     */
    playPlayerDamage() {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        // Low rumble/grunt
        const osc = this.context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.5 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.2);

        // Add distortion hit
        this.playTone(60, 0.08, 0.4, 'square');
    }

    /**
     * Enemy attack/growl sound
     */
    playEnemyAttack(type) {
        if (!this.initialized) return;

        // Try to play loaded sound
        if (type && this.buffers[type]) {
            const source = this.context.createBufferSource();
            source.buffer = this.buffers[type];

            const gain = this.context.createGain();
            gain.gain.value = 0.6 * this.sfxVolume;

            source.connect(gain);
            gain.connect(this.masterGain);

            source.start();
            return gain;
        }

        const now = this.context.currentTime;

        // Aggressive growl (Fallback)
        const osc = this.context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.setValueAtTime(140, now + 0.05);
        osc.frequency.setValueAtTime(100, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.3 * this.sfxVolume, now);
        gain.gain.linearRampToValueAtTime(0.35 * this.sfxVolume, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.25);

        return gain;
    }

    /**
     * Footstep sound
     */
    playFootstep() {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        // Soft thud
        const osc = this.context.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80 + Math.random() * 20, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    /**
     * Jump sound
     */
    playJump() {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        // Ascending whoosh
        const osc = this.context.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    /**
     * Reload sound
     */
    playReload() {
        this.playProceduralReload();
    }

    playProceduralReload() {
        // Silenced to prevent Echo with MP3s
        // if (!this.initialized) return;
        // this.playTone(800, 0.03, 0.2, 'square');
        // setTimeout(() => this.playTone(600, 0.03, 0.2, 'square'), 100);
        // setTimeout(() => this.playTone(1000, 0.05, 0.3, 'square'), 200);
    }

    /**
     * Empty gun click
     */
    playEmptyGun() {
        if (!this.initialized) return;
        this.playTone(400, 0.02, 0.15, 'square');
    }

    // ═══════════════════════════════════════════════════════════
    // AMBIENT / MUSIC
    // ═══════════════════════════════════════════════════════════

    startAmbient() {
        if (!this.initialized) return;

        // Low drone ambient
        const now = this.context.currentTime;

        // Create oscillators for ambient drone
        const osc1 = this.context.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 55; // Low A

        const osc2 = this.context.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 82.5; // E

        // Very quiet gain
        const ambientGain = this.context.createGain();
        ambientGain.gain.value = 0.05 * this.musicVolume;

        // LFO for subtle movement
        const lfo = this.context.createOscillator();
        lfo.frequency.value = 0.1;
        const lfoGain = this.context.createGain();
        lfoGain.gain.value = 0.02;

        lfo.connect(lfoGain);
        lfoGain.connect(ambientGain.gain);

        osc1.connect(ambientGain);
        osc2.connect(ambientGain);
        ambientGain.connect(this.masterGain);

        osc1.start();
        osc2.start();
        lfo.start();
    }

    // ═══════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════

    /**
     * Play a simple tone
     */
    playTone(frequency, duration, volume, type = 'sine') {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        const osc = this.context.createOscillator();
        osc.type = type;
        osc.frequency.value = frequency;

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(volume * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + duration);
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.value = this.masterVolume;
        }
    }
}
