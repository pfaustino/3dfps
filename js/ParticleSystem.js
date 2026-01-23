import * as THREE from 'three';

export class ParticleSystem {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.maxParticles = 500;

        // Material for blood
        this.bloodMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.bloodGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    }

    init() {
        console.log('ParticleSystem initialized');
    }

    createParticle(position, color = 0xff0000, size = 0.1, speed = 1.0, life = 1.0) {
        if (this.particles.length >= this.maxParticles) {
            // Remove oldest
            const old = this.particles.shift();
            this.game.scene.remove(old.mesh);
        }

        const mesh = new THREE.Mesh(this.bloodGeometry, this.bloodMaterial); // Clone if different materials needed
        mesh.position.copy(position);
        mesh.scale.setScalar(size);

        // Random velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * speed,
            Math.random() * speed, // Upward bias
            (Math.random() - 0.5) * speed
        );

        this.game.scene.add(mesh);

        this.particles.push({
            mesh: mesh,
            velocity: velocity,
            life: life,
            maxLife: life
        });
    }

    spawnBlood(position, count = 10, explosive = false) {
        // Radius/Spread comes from speed
        const speed = explosive ? 8.0 : 6.0; // Much faster spread
        const size = explosive ? 0.3 : 0.2;  // Bigger chunks

        for (let i = 0; i < count; i++) {
            // Add initial radius (jitter) so they don't spawn from a single point
            const jitter = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            );

            this.createParticle(position.clone().add(jitter), 0xff0000, size, speed, 1.0 + Math.random());
        }
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.life -= delta;

            // Physics
            p.velocity.y -= 9.8 * delta; // Gravity
            p.mesh.position.addScaledVector(p.velocity, delta);

            // Floor collision
            if (p.mesh.position.y < 0.05) {
                p.mesh.position.y = 0.05;
                p.velocity.y *= -0.5; // Bounce
                p.velocity.x *= 0.5; // Friction
                p.velocity.z *= 0.5;
            }

            // Shrink on death
            if (p.life < 0.2) {
                p.mesh.scale.setScalar(p.life * 5 * 0.1);
            }

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }
    }
}
