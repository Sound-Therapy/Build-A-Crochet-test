// SceneManager.js

class SceneManager {
    constructor() {
        this.scenes = {};
        this.activeScene = null;
    }

    addScene(name, scene) {
        this.scenes[name] = scene;
    }

    setActiveScene(name) {
        if (this.scenes[name]) {
            this.activeScene = this.scenes[name];
            this.activeScene.initialize();
        } else {
            console.error(`Scene ${name} does not exist.`);
        }
    }

    render(ctx) {
        if (this.activeScene) {
            this.activeScene.render(ctx);
        } else {
            console.warn('No active scene to render.');
        }
    }
}

export default SceneManager;