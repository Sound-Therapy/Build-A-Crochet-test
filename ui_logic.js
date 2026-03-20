// [ ui_logic.js ] v5.48.11 Full Interaction & UI Logic

function init() {
    scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0xffffff);
    
    camera = new THREE.PerspectiveCamera(45, (window.innerWidth - 100) / window.innerHeight, 0.1, 1000);
    camera.position.set(60, 50, 80);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 100, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // 오른쪽 클릭 메뉴 방지
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    
    scene.add(new THREE.GridHelper(100, 20, 0xcccccc, 0xeeeeee));
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const ml = new THREE.DirectionalLight(0xffffff, 0.6); 
    ml.position.set(10, 20, 15); 
    scene.add(ml);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    // 초기 도구들 생성
    createHandles(); 
    createGhost(); 
    createGroupGizmo();
    
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    
    captureState(); 
    animate();
}

// 핑크 알 설치
function spawnEgg(p) {
    const eg = createEgg(0xff69b4);
    eg.position.copy(p).y += 10.01;
    scene.add(eg);
    captureState();
    updateSelectionVisuals([eg]);
    isPlacementMode = false;
    ghostEgg.visible = false;
    document.getElementById('egg-spawn-btn').classList.remove('active');
}

function onDown(e) {
    if(e.target.tagName !== 'CANVAS') return;
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
    const ray = new THREE.Raycaster(); 
    ray.setFromCamera(m, camera);

    if(isPlacementMode && e.button===0) {
        const grid = scene.children.find(o=>o.type==="GridHelper");
        const h = ray.intersectObject(grid);
        if(h.length>0) spawnEgg(h[0].point); 
        return;
    }

    // 기즈모(핸들) 선택 확인
    const gh = ray.intersectObjects([...handles, rotX_H, rotY_H, rotZ_H]);
    if(gh.length>0) {
        dragTarget = gh[0].object; 
        isDragging = true; 
        mouseButton = e.button; 
        controls.enabled = false;
        
        const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
        const pl = new THREE.Plane(normal, -dragTarget.position.dot(normal));
        ray.ray.intersectPlane(pl, startIntersect);
        
        if(currentEgg){
            startRotation = currentEgg.quaternion.clone(); 
            startPos = currentEgg.position.clone(); 
            startScale = currentEgg.userData.data.scale.clone();
            
            if(dragTarget.userData.isHandle){
                const id = dragTarget.userData.id;
                const opp = (id % 2 === 0) ? id + 1 : id - 1;
                const ctrls = [
                    new THREE.Vector3(0,10,0), new THREE.Vector3(0,-10,0),
                    new THREE.Vector3(-7,0,0), new THREE.Vector3(7,0,0),
                    new THREE.Vector3(0,0,7),  new THREE.Vector3(0,0,-7)
                ];
                worldAnchorPos.copy(ctrls[opp]).multiply(startScale).applyQuaternion(startRotation).add(startPos);
                startHandleDist = startIntersect.distanceTo(worldAnchorPos);
            }
            lastMouseAngle = getMouseAngle(e, currentEgg);
        }
        return;
    }

    // 알 선택 확인
    const eh = ray.intersectObjects(scene.children.filter(o=>o.userData.isEgg));
    if(eh.length>0) {
        dragTarget = eh[0].object; 
        isDragging = true; 
        mouseButton = e.button; 
        controls.enabled = false;
        updateSelectionVisuals([dragTarget]);
    } else if(e.button===0){ 
        updateSelectionVisuals([]); 
    }
}

function onMove(e) {
    if(!isDragging || !dragTarget) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
    const ray = new THREE.Raycaster(); 
    ray.setFromCamera(m, camera);
    
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    const pl = new THREE.Plane(normal, -dragTarget.position.dot(normal));
    let intersect = new THREE.Vector3();
    
    if(ray.ray.intersectPlane(pl, intersect)){
        if(dragTarget.userData.isEgg) {
            dragTarget.position.copy(intersect);
        } else if(currentEgg && dragTarget.userData.isHandle) {
            const id = dragTarget.userData.id;
            const ratio = Math.max(0.1, intersect.distanceTo(worldAnchorPos) / startHandleDist);
            if(id < 2) currentEgg.userData.data.scale.y = startScale.y * ratio;
            else if(id < 4) currentEgg.userData.data.scale.x = startScale.x * ratio;
            else currentEgg.userData.data.scale.z = startScale.z * ratio;
            updateMesh(currentEgg);
        }
        updateRealTimeSize();
    }
}

function onUp() { 
    if(isDragging) captureState();
    isDragging = false; 
    dragTarget = null; 
    controls.enabled = true; 
}

function createHandles() {
    const mkH = (id) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1.2), new THREE.MeshBasicMaterial({color:0xffcc00})); 
        m.visible = false; m.userData = {isHandle:true, id}; 
        scene.add(m); return m;
    };
    handles = [0,1,2,3,4,5].map(id => mkH(id));
    
    const mkR = (c, a) => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(15, 0.2), new THREE.MeshBasicMaterial({color:c})); 
        r.visible = false; r.userData = {isRotationHandle:true, axis:a}; 
        scene.add(r); return r;
    };
    rotX_H = mkR(0xff0000, 'x'); rotY_H = mkR(0x00ff00, 'y'); rotZ_H = mkR(0x0000ff, 'z');
}

function createGroupGizmo() { 
    groupGizmo = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)), 0xff69b4); 
    groupGizmo.visible = false; scene.add(groupGizmo); 
}

function createGhost() { 
    ghostEgg = createEgg(0x28a745, true); 
    ghostEgg.visible = false; scene.add(ghostEgg); 
}

function togglePlacementMode() { 
    isPlacementMode = !isPlacementMode; 
    document.getElementById('egg-spawn-btn').classList.toggle('active', isPlacementMode); 
}

function updateSelectionVisuals(sel) { 
    currentSelection = sel; 
    currentEgg = sel.length === 1 ? sel[0] : null; 
    
    handles.forEach((h, i) => {
        h.visible = !!currentEgg;
        if(currentEgg) {
            const ctrls = [
                new THREE.Vector3(0,10,0), new THREE.Vector3(0,-10,0),
                new THREE.Vector3(-7,0,0), new THREE.Vector3(7,0,0),
                new THREE.Vector3(0,0,7),  new THREE.Vector3(0,0,-7)
            ];
            h.position.copy(ctrls[i]).multiply(currentEgg.userData.data.scale).applyQuaternion(currentEgg.quaternion).add(currentEgg.position);
        }
    });
}

function updateRealTimeSize() {
    const box = new THREE.Box3(); 
    if(currentSelection.length === 0) return;
    currentSelection.forEach(e => { 
        e.geometry.computeBoundingBox(); 
        box.union(e.geometry.boundingBox.clone().applyMatrix4(e.matrixWorld)); 
    });
    const sz = box.getSize(new THREE.Vector3());
    if(document.getElementById('info-w')) {
        document.getElementById('info-w').innerText = (sz.x * CM_RATIO).toFixed(1);
        document.getElementById('info-h').innerText = (sz.y * CM_RATIO).toFixed(1);
        document.getElementById('info-d').innerText = (sz.z * CM_RATIO).toFixed(1);
    }
}

function getMouseAngle(e, t) { return 0; } // 아버님의 상세 각도 계산 로직

function captureState() {
    const state = scene.children.filter(o => o.userData.isEgg).map(e => ({
        pos: e.position.toArray(),
        rot: e.quaternion.toArray(),
        scale: e.userData.data.scale.toArray(),
        offsets: e.userData.data.offsets.map(v => v.toArray()),
        color: e.material.color.getHex()
    }));
    history.push(JSON.stringify(state));
    if(history.length > 50) history.shift();
    redoStack = [];
}

function onKeyDown(e) {
    if(e.key === "Delete") {
        currentSelection.forEach(o => scene.remove(o));
        captureState();
        updateSelectionVisuals([]);
    }
}

function animate() {
    requestAnimationFrame(animate);
    if(currentEgg) {
        const p = currentEgg.position;
        const q = currentEgg.quaternion;
        const s = currentEgg.userData.data.scale;
        const ctrls = [
            new THREE.Vector3(0,10,0), new THREE.Vector3(0,-10,0),
            new THREE.Vector3(-7,0,0), new THREE.Vector3(7,0,0),
            new THREE.Vector3(0,0,7),  new THREE.Vector3(0,0,-7)
        ];
        handles.forEach((h, i) => {
            h.position.copy(ctrls[i]).multiply(s).applyQuaternion(q).add(p);
        });
    }
    renderer.render(scene, camera);
    controls.update();
}

window.onload = init;
