function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    camera = new THREE.PerspectiveCamera(45, (window.innerWidth - 100) / window.innerHeight, 0.1, 1000);
    camera.position.set(60, 50, 80);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 100, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    scene.add(new THREE.GridHelper(100, 20, 0xcccccc, 0xeeeeee));
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    window.addEventListener('pointerdown', onDown);
    animate();
}

function togglePlacementMode() {
    isPlacementMode = !isPlacementMode;
    document.getElementById('egg-spawn-btn').classList.toggle('active', isPlacementMode);
}

function onDown(e) {
    if (!isPlacementMode) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(m, camera);
    const grid = scene.children.find(o => o.type === "GridHelper");
    const intersects = ray.intersectObject(grid);
    if (intersects.length > 0) {
        const eg = createEgg(0xff69b4);
        eg.position.copy(intersects[0].point).y += 10;
        scene.add(eg);
        togglePlacementMode();
    }
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}

window.onload = init;
