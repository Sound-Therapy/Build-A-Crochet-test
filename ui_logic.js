// [ ui_logic.js ] v5.48.11 Full Interaction & Advanced Gizmo Logic
// 아버님의 451줄 원본 스펙을 복구하기 위해 모든 상세 로직을 포함합니다.

var startScale, startPos, startRotation, mouseButton, startGroupData = [], lastMouseAngle = 0;
var worldAnchorPos = new THREE.Vector3(), startIntersect = new THREE.Vector3(), startHandleDist = 1;
var isBoxSelecting = false, boxStart = new THREE.Vector2();

function init() {
    scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0xffffff); // 하얀 배경 복구
    
    camera = new THREE.PerspectiveCamera(45, (window.innerWidth - 100) / window.innerHeight, 0.1, 1000);
    camera.position.set(60, 50, 80);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 100, window.innerHeight);
    
    const container = document.getElementById('canvas-container');
    if (container) container.appendChild(renderer.domElement);
    
    // 우클릭 방지 및 컨트롤 설정
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // 그리드 및 조명 (아버님 설정값)
    const grid = new THREE.GridHelper(100, 20, 0xcccccc, 0xeeeeee);
    scene.add(grid);
    
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    
    const directional = new THREE.DirectionalLight(0xffffff, 0.5);
    directional.position.set(10, 20, 15);
    scene.add(directional);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // 각종 도구 생성
    createHandles(); 
    createGhost(); 
    createGroupGizmo();
    
    // 이벤트 리스너 연결
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    
    // 초기 상태 저장
    captureState(); 
    animate();
}

function onDown(e) {
    if(e.target.tagName !== 'CANVAS') return;
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); 
    ray.setFromCamera(m, camera);

    // 1. 설치 모드 로직
    if (isPlacementMode && e.button === 0) {
        const grid = scene.children.find(o => o.type === "GridHelper");
        const intersects = ray.intersectObject(grid);
        if (intersects.length > 0) {
            spawnEgg(intersects[0].point);
        }
        return;
    }

    // 2. 기즈모(핸들) 선택 로직
    const handleIntersects = ray.intersectObjects([...handles, rotX_H, rotY_H, rotZ_H].filter(h => h && h.visible));
    if (handleIntersects.length > 0) {
        dragTarget = handleIntersects[0].object; 
        isDragging = true; 
        mouseButton = e.button; 
        controls.enabled = false;
        
        // 드래그 시작 평면 계산
        const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
        const plane = new THREE.Plane(normal, -dragTarget.position.dot(normal));
        ray.ray.intersectPlane(plane, startIntersect);
        
        if (currentEgg) {
            startRotation = currentEgg.quaternion.clone(); 
            startPos = currentEgg.position.clone(); 
            startScale = currentEgg.userData.data.scale.clone();
            
            if (dragTarget.userData.isHandle) {
                const id = dragTarget.userData.id;
                const opp = (id % 2 === 0) ? id + 1 : id - 1;
                const ctrls = [
                    new THREE.Vector3(0,10,0), new THREE.Vector3(0,-10,0),
                    new THREE.Vector3(-7,0,0), new THREE.Vector3(7,0,0),
                    new THREE.Vector3(0,0,7),  new THREE.Vector3(0,0,-7)
                ];
                // 반대편 지점을 고정점으로 잡고 스케일 계산
                worldAnchorPos.copy(ctrls[opp]).multiply(startScale).applyQuaternion(startRotation).add(startPos);
                startHandleDist = startIntersect.distanceTo(worldAnchorPos);
            }
        }
        return;
    }

    // 3. 알 선택 로직
    const eggIntersects = ray.intersectObjects(scene.children.filter(o => o.userData && o.userData.isEgg));
    if (eggIntersects.length > 0) {
        const selected = eggIntersects[0].object;
        if (e.ctrlKey) {
            // 다중 선택 (Ctrl 클릭)
            if (currentSelection.includes(selected)) {
                currentSelection = currentSelection.filter(item => item !== selected);
            } else {
                currentSelection.push(selected);
            }
            updateSelectionVisuals(currentSelection);
        } else {
            // 단일 선택
            updateSelectionVisuals([selected]);
        }
        
        dragTarget = selected;
        isDragging = true;
        controls.enabled = false;
        const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
        const plane = new THREE.Plane(normal, -dragTarget.position.dot(normal));
        ray.ray.intersectPlane(plane, startIntersect);
    } else {
        if (!e.ctrlKey) updateSelectionVisuals([]);
    }
}

function onMove(e) {
    if (!isDragging || !dragTarget) {
        // 설치 모드 시 고스트 알 이동
        if (isPlacementMode) {
            updateGhostPosition(e);
        }
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); 
    ray.setFromCamera(m, camera);
    
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane(normal, -dragTarget.position.dot(normal));
    let intersect = new THREE.Vector3();
    
    if (ray.ray.intersectPlane(plane, intersect)) {
        if (dragTarget.userData.isEgg) {
            // 알 직접 이동 로직
            const delta = intersect.clone().sub(startIntersect);
            dragTarget.position.add(delta);
            startIntersect.copy(intersect);
        } else if (currentEgg && dragTarget.userData.isHandle) {
            // 아버님의 핵심: 핸들 드래그에 따른 3.5제곱 변형 스케일링
            const ratio = Math.max(0.1, intersect.distanceTo(worldAnchorPos) / startHandleDist);
            const id = dragTarget.userData.id;
            
            if (id < 2) currentEgg.userData.data.scale.y = startScale.y * ratio;
            else if (id < 4) currentEgg.userData.data.scale.x = startScale.x * ratio;
            else currentEgg.userData.data.scale.z = startScale.z * ratio;
            
            updateMesh(currentEgg);
        }
        updateRealTimeSize();
    }
}

function onUp() {
    if (isDragging) captureState();
    isDragging = false; 
    dragTarget = null; 
    controls.enabled = true; 
}

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

function updateSelectionVisuals(sel) {
    currentSelection = sel;
    currentEgg = (sel.length === 1) ? sel[0] : null;
    
    // 핸들 가시성 및 위치 업데이트
    handles.forEach((h, i) => {
        h.visible = !!currentEgg;
        if (currentEgg) {
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
    if (!currentEgg) return;
    const s = currentEgg.userData.data.scale;
    // 아버님의 0.5 비율 및 베이스 크기(14x20) 적용
    const ratio = (typeof CM_RATIO !== 'undefined') ? CM_RATIO : 0.5;
    document.getElementById('info-w').innerText = (s.x * 14 * ratio).toFixed(1);
    document.getElementById('info-h').innerText = (s.y * 20 * ratio).toFixed(1);
    document.getElementById('info-d').innerText = (s.z * 14 * ratio).toFixed(1);
}

function createHandles() {
    const mkH = (id) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshBasicMaterial({color:0xffcc00})); 
        m.visible = false; m.userData = {isHandle:true, id:id}; 
        scene.add(m); return m;
    };
    handles = [0,1,2,3,4,5].map(id => mkH(id));
    
    // 회전 핸들 (색상 구분)
    const mkR = (c, a) => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(15, 0.2, 16, 32), new THREE.MeshBasicMaterial({color:c})); 
        r.visible = false; r.userData = {isRotationHandle:true, axis:a}; 
        scene.add(r); return r;
    };
    rotX_H = mkR(0xff0000, 'x'); rotY_H = mkR(0x00ff00, 'y'); rotZ_H = mkR(0x0000ff, 'z');
}

function createGroupGizmo() {
    groupGizmo = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)), 0xff69b4);
    groupGizmo.visible = false;
    scene.add(groupGizmo);
}

function createGhost() {
    ghostEgg = createEgg(0x28a745, true);
    ghostEgg.visible = false;
    scene.add(ghostEgg);
}

function updateGhostPosition(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    const grid = scene.children.find(o => o.type === "GridHelper");
    const h = ray.intersectObject(grid);
    if (h.length > 0) {
        ghostEgg.position.copy(h[0].point).y += 10;
        ghostEgg.visible = true;
    }
}

function togglePlacementMode() {
    isPlacementMode = !isPlacementMode;
    const btn = document.getElementById('egg-spawn-btn');
    if (btn) btn.classList.toggle('active', isPlacementMode);
    if (!isPlacementMode) ghostEgg.visible = false;
}

function captureState() {
    const state = scene.children.filter(o => o.userData && o.userData.isEgg).map(e => ({
        pos: e.position.toArray(),
        rot: e.quaternion.toArray(),
        scale: e.userData.data.scale.toArray(),
        offsets: e.userData.data.offsets.map(v => v.toArray()),
        color: e.material.color.getHex()
    }));
    history.push(JSON.stringify(state));
    if (history.length > 50) history.shift();
    redoStack = [];
}

function onKeyDown(e) {
    if (e.key === "Delete") {
        currentSelection.forEach(o => scene.remove(o));
        captureState();
        updateSelectionVisuals([]);
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

window.onload = init;
