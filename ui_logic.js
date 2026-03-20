var startScale, startPos, startRotation, startHandleDist = 1, worldAnchorPos = new THREE.Vector3();

function init() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
    camera = new THREE.PerspectiveCamera(45, (window.innerWidth - 100) / window.innerHeight, 0.1, 1000);
    camera.position.set(60, 50, 80);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 100, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    scene.add(new THREE.GridHelper(100, 20, 0xcccccc, 0xeeeeee));
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    const mkH=(id)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1.2),new THREE.MeshBasicMaterial({color:0xffcc00})); m.visible=false; m.userData={isHandle:true,id}; scene.add(m); return m;};
    handles = [0,1,2,3,4,5].map(id => mkH(id));
    
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', () => { isDragging = false; controls.enabled = true; });
    animate();
}

function togglePlacementMode() {
    isPlacementMode = !isPlacementMode;
    document.getElementById('egg-spawn-btn').classList.toggle('active', isPlacementMode);
}

function onDown(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    
    if (isPlacementMode) {
        const h = ray.intersectObject(scene.children.find(o => o.type === "GridHelper"));
        if (h.length > 0) {
            const eg = createEgg(0xff69b4); eg.position.copy(h[0].point).y += 10;
            scene.add(eg); togglePlacementMode(); updateSelection(eg);
        }
        return;
    }

    const hh = ray.intersectObjects(handles);
    if (hh.length > 0) {
        isDragging = true; dragTarget = hh[0].object; controls.enabled = false;
        startScale = currentEgg.userData.data.scale.clone();
        const id = dragTarget.userData.id, opp = (id%2===0)?id+1:id-1;
        const ctrls = [new THREE.Vector3(0,10,0),new THREE.Vector3(0,-10,0),new THREE.Vector3(-7,0,0),new THREE.Vector3(7,0,0),new THREE.Vector3(0,0,7),new THREE.Vector3(0,0,-7)];
        worldAnchorPos.copy(ctrls[opp]).multiply(startScale).add(currentEgg.position);
        startHandleDist = hh[0].point.distanceTo(worldAnchorPos);
        return;
    }

    const eh = ray.intersectObjects(scene.children.filter(o => o.userData.isEgg));
    if (eh.length > 0) updateSelection(eh[0].object);
    else updateSelection(null);
}

function onMove(e) {
    if (!isDragging || !currentEgg) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    const pl = new THREE.Plane(camera.getWorldDirection(new THREE.Vector3()).negate(), -dragTarget.position.dot(camera.getWorldDirection(new THREE.Vector3()).negate()));
    let intersect = new THREE.Vector3();
    if (ray.ray.intersectPlane(pl, intersect)) {
        const ratio = Math.max(0.1, intersect.distanceTo(worldAnchorPos) / startHandleDist);
        const id = dragTarget.userData.id;
        if (id < 2) currentEgg.userData.data.scale.y = startScale.y * ratio;
        else if (id < 4) currentEgg.userData.data.scale.x = startScale.x * ratio;
        else currentEgg.userData.data.scale.z = startScale.z * ratio;
        updateMesh(currentEgg);
    }
}

function updateSelection(egg) {
    currentEgg = egg;
    handles.forEach((h, i) => {
        h.visible = !!egg;
        if (egg) {
            const ctrls = [new THREE.Vector3(0,10,0),new THREE.Vector3(0,-10,0),new THREE.Vector3(-7,0,0),new THREE.Vector3(7,0,0),new THREE.Vector3(0,0,7),new THREE.Vector3(0,0,-7)];
            h.position.copy(ctrls[i]).multiply(egg.userData.data.scale).add(egg.position);
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}
window.onload = init;
