// [ ui_logic.js ] v5.48.11 전체 상호작용 로직
function init() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
    camera = new THREE.PerspectiveCamera(45, (window.innerWidth - 100) / window.innerHeight, 0.1, 1000);
    camera.position.set(60, 50, 80);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 100, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    scene.add(new THREE.GridHelper(100, 20, 0xcccccc, 0xeeeeee));
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const ml = new THREE.DirectionalLight(0xffffff, 0.6); ml.position.set(10, 20, 15); scene.add(ml);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    createHandles(); createGhost(); createGroupGizmo();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    captureState(); animate();
}

function onDown(e) {
    if(e.target.tagName !== 'CANVAS') return;
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    if(isPlacementMode && e.button===0) {
        const grid = scene.children.find(o=>o.type==="GridHelper");
        const h = ray.intersectObject(grid);
        if(h.length>0) spawnEgg(h[0].point); return;
    }
    const gh = ray.intersectObjects([...handles, rotX_H, rotY_H, rotZ_H, ...groupHandles, ...groupRotHandles]);
    if(gh.length>0) {
        dragTarget = gh[0].object; isDragging=true; mouseButton=e.button; controls.enabled=false;
        const pl = new THREE.Plane(camera.getWorldDirection(new THREE.Vector3()).negate(), -dragTarget.position.dot(camera.getWorldDirection(new THREE.Vector3()).negate()));
        ray.ray.intersectPlane(pl, startIntersect);
        if(currentEgg){
            startRotation=currentEgg.quaternion.clone(); startPos=currentEgg.position.clone(); startScale=currentEgg.userData.data.scale.clone();
            if(dragTarget.userData.isHandle){
                const id=dragTarget.userData.id, opp=(id%2===0)?id+1:id-1;
                const ctrls=[new THREE.Vector3(0,10,0),new THREE.Vector3(0,-10,0),new THREE.Vector3(-7,0,0),new THREE.Vector3(7,0,0),new THREE.Vector3(0,0,7),new THREE.Vector3(0,0,-7)];
                worldAnchorPos.copy(ctrls[opp]).multiply(startScale).applyQuaternion(startRotation).add(startPos);
                startHandleDist=startIntersect.distanceTo(worldAnchorPos);
                dragTarget.userData.startOffset=currentEgg.userData.data.offsets[id].clone();
            } else startHandleDist=startIntersect.distanceTo(currentEgg.position);
            lastMouseAngle=getMouseAngle(e,currentEgg);
        } else if(currentSelection.length>1){
            const b=new THREE.Box3(); currentSelection.forEach(e=>{e.geometry.computeBoundingBox(); b.union(e.geometry.boundingBox.clone().applyMatrix4(e.matrixWorld));});
            const c=b.getCenter(new THREE.Vector3());
            startGroupData=currentSelection.map(e=>({pos:e.position.clone(),scale:e.userData.data.scale.clone(),rot:e.quaternion.clone()}));
            startHandleDist=startIntersect.distanceTo(c); lastMouseAngle=getMouseAngle(e,{position:c});
        } return;
    }
    const eh = ray.intersectObjects(scene.children.filter(o=>o.userData.isEgg));
    if(eh.length>0) {
        dragTarget=eh[0].object; isDragging=true; mouseButton=e.button; controls.enabled=false;
        if(e.button===0 && !e.ctrlKey) updateSelectionVisuals([dragTarget]);
        else if(e.button===0 && e.ctrlKey) updateSelectionVisuals([...currentSelection, dragTarget]);
        const pl=new THREE.Plane(camera.getWorldDirection(new THREE.Vector3()).negate(), -dragTarget.position.dot(camera.getWorldDirection(new THREE.Vector3()).negate()));
        ray.ray.intersectPlane(pl, startIntersect);
        if(currentSelection.length>1 && currentSelection.includes(dragTarget)) startGroupData=currentSelection.map(eg=>({offset:eg.position.clone().sub(startIntersect)}));
    } else {
        if(e.button===0){ updateSelectionVisuals([]); controls.enabled=true; }
    }
}

function onMove(e) {
    if(!isDragging || !dragTarget) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    const pl = new THREE.Plane(camera.getWorldDirection(new THREE.Vector3()).negate(), -dragTarget.position.dot(camera.getWorldDirection(new THREE.Vector3()).negate()));
    let intersect = new THREE.Vector3();
    if(ray.ray.intersectPlane(pl, intersect)){
        if(dragTarget.userData.isEgg) dragTarget.position.copy(intersect);
        else if(currentEgg && dragTarget.userData.isHandle) {
            const id=dragTarget.userData.id, data=currentEgg.userData.data;
            const r=Math.max(0.01, intersect.distanceTo(worldAnchorPos)/startHandleDist);
            data.scale.copy(startScale).multiplyScalar(r); updateMesh(currentEgg);
        }
        updateRealTimeSize();
    }
}

function onUp() { isDragging=false; dragTarget=null; controls.enabled=true; }
function createHandles() { 
    const mkH=(id)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1.5,16,16),new THREE.MeshBasicMaterial({color:0xffcc00})); m.visible=false; m.userData={isHandle:true,id}; scene.add(m); return m;};
    handles=[0,1,2,3,4,5].map(id=>mkH(id));
    const mkR=(c,a)=>{const r=new THREE.Mesh(new THREE.TorusGeometry(20,0.2),new THREE.MeshBasicMaterial({color:c})); r.visible=false; r.userData={isRotationHandle:true,axis:a}; scene.add(r); return r;};
    rotX_H=mkR(0xff0000,'x'); rotY_H=mkR(0x00ff00,'y'); rotZ_H=mkR(0x0000ff,'z');
}
function createGroupGizmo() { groupGizmo=new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)), 0xff69b4); groupGizmo.visible=false; scene.add(groupGizmo); groupHandles=[]; groupRotHandles=[]; }
function createGhost() { ghostEgg=createEgg(0x28a745,true); ghostEgg.visible=false; scene.add(ghostEgg); }
function togglePlacementMode() { isPlacementMode=!isPlacementMode; document.getElementById('egg-spawn-btn').classList.toggle('active', isPlacementMode); }
function spawnEgg(p) { const eg=createEgg(0xff69b4); eg.position.copy(p).y+=10.01; scene.add(eg); captureState(); updateSelectionVisuals([eg]); isPlacementMode=false; document.getElementById('egg-spawn-btn').classList.remove('active'); }
function updateSelectionVisuals(sel) { currentSelection=sel; currentEgg=sel.length===1?sel[0]:null; handles.forEach(h=>h.visible=!!currentEgg); [rotX_H,rotY_H,rotZ_H].forEach(r=>r.visible=!!currentEgg); document.getElementById('palette').style.display=sel.length>0?'grid':'none'; }
function updateRealTimeSize() { /* 사이즈 표시 */ }
function getMouseAngle(e, t) { return 0; }
function captureState() { history.push(JSON.stringify([])); }
function animate() { requestAnimationFrame(animate); if(currentEgg){ const p=currentEgg.position; handles.forEach(h=>h.position.copy(p)); [rotX_H,rotY_H,rotZ_H].forEach(r=>r.position.copy(p)); } renderer.render(scene, camera); controls.update(); }
window.onload = init;
