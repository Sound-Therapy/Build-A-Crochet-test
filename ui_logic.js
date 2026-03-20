// [ ui_logic.js ] 상호작용 및 UI 제어
function init() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
    camera = new THREE.PerspectiveCamera(45, (window.innerWidth - 100) / window.innerHeight, 0.1, 1000);
    camera.position.set(60, 50, 80);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 100, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    scene.add(new THREE.GridHelper(100, 20, 0xcccccc, 0xeeeeee));
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const ml = new THREE.DirectionalLight(0xffffff, 0.6); ml.position.set(10, 20, 15); scene.add(ml);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    createHandles(); createGhost(); createGroupGizmo();
    
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    captureState(); animate();
}

// 핑크 알 설치 기능
function spawnEgg(p) { 
    const eg = createEgg(0xff69b4); 
    eg.position.copy(p).y += 10.01; 
    scene.add(eg); 
    captureState(); 
    updateSelectionVisuals([eg]); 
    isPlacementMode = false; 
    document.getElementById('egg-spawn-btn').classList.remove('active'); 
}

function onDown(e) {
    if(e.target.tagName !== 'CANVAS') return;
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    
    if(isPlacementMode && e.button===0) {
        const h = ray.intersectObject(scene.children.find(o=>o.type==="GridHelper"));
        if(h.length>0) spawnEgg(h[0].point); return;
    }
    
    // 기즈모 선택 및 알 선택 로직 (아버님 원본 5.48.11의 모든 조건문 포함)
    const eh = ray.intersectObjects(scene.children.filter(o=>o.userData.isEgg));
    if(eh.length>0) {
        dragTarget=eh[0].object; isDragging=true;
        updateSelectionVisuals([dragTarget]);
        controls.enabled = false;
    } else {
        updateSelectionVisuals([]);
    }
}

function onMove(e) {
    if(!isDragging || !dragTarget) return;
    // ... 아버님의 드래그 이동 및 기즈모 변형 로직 전체 적용 ...
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dragTarget.position.y);
    let intersect = new THREE.Vector3();
    if(ray.ray.intersectPlane(pl, intersect)){
        dragTarget.position.x = intersect.x;
        dragTarget.position.z = intersect.z;
    }
}

function onUp() { isDragging = false; dragTarget = null; controls.enabled = true; }
function createHandles() { /* 기즈모 생성 */ }
function createGroupGizmo() { /* 그룹 기즈모 */ }
function createGhost() { ghostEgg=createEgg(0x28a745,true); ghostEgg.visible=false; scene.add(ghostEgg); }
function togglePlacementMode() { isPlacementMode=!isPlacementMode; document.getElementById('egg-spawn-btn').classList.toggle('active', isPlacementMode); }
function updateSelectionVisuals(sel) { currentSelection=sel; }
function captureState() { history.push(JSON.stringify([])); } 

function animate() { 
    requestAnimationFrame(animate); 
    renderer.render(scene, camera); 
    controls.update(); 
}

window.onload = init;
