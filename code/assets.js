window.AssetManager = {
    models: {},
    loading: false,
    loaded: false,
    callbacks: [],
    
    modelPaths: {
        streetLight: '../blender_models/StreetLight.gltf',
        build: '../blender_models/build.gltf',
        build2: '../blender_models/build2.gltf',
        caixas: '../blender_models/caixas.gltf',
        hidrante: '../blender_models/hidrante.gltf',
        lixo: '../blender_models/lixo.gltf',
        lixo2: '../blender_models/lixo2.gltf'
    },

    loadAll: function(onProgress, onComplete) {
        if (this.loaded) {
            if (onComplete) onComplete();
            return;
        }

        if (this.loading) {
            if (onComplete) this.callbacks.push(onComplete);
            return;
        }

        this.loading = true;
        if (onComplete) this.callbacks.push(onComplete);

        // We assume window.GLTFLoader is available (set in CarSelection or game.html)
        if (typeof window.GLTFLoader === 'undefined') {
            console.error('AssetManager: GLTFLoader is not available on window.');
            return;
        }

        const loader = new window.GLTFLoader();
        const keys = Object.keys(this.modelPaths);
        let loadedCount = 0;
        const totalCount = keys.length;

        keys.forEach(key => {
            loader.load(
                this.modelPaths[key],
                (gltf) => {
                    const scene = gltf.scene || gltf.scenes[0];
                    scene.traverse((node) => {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                            // Ensure materials are DoubleSide just in case
                            if (node.material) {
                                if (Array.isArray(node.material)) {
                                    node.material.forEach(m => m.side = 2); // THREE.DoubleSide
                                } else {
                                    node.material.side = 2; // THREE.DoubleSide
                                }
                            }
                        }
                    });

                    this.models[key] = scene;
                    loadedCount++;

                    if (onProgress) onProgress(loadedCount / totalCount);

                    if (loadedCount === totalCount) {
                        this.loading = false;
                        this.loaded = true;
                        this.callbacks.forEach(cb => cb());
                        this.callbacks = [];
                        console.log('AssetManager: All models loaded successfully.');
                    }
                },
                undefined,
                (error) => {
                    console.error(`AssetManager: Failed to load ${key}`, error);
                    loadedCount++; // Increment anyway to avoid hanging
                    if (loadedCount === totalCount) {
                        this.loading = false;
                        this.loaded = true;
                        this.callbacks.forEach(cb => cb());
                        this.callbacks = [];
                    }
                }
            );
        });
    },

    get: function(key) {
        if (this.models[key]) {
            return this.models[key].clone(true);
        }
        return null;
    }
};
