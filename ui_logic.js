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
        const h = ray.intersectObject(scene.children.find(o=>o.type==="GridHelper"));
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
        else if(e.button===2){
            isBoxSelecting=true; boxStart.set(e.clientX, e.clientY);
            selectBoxEl.style.display='block'; selectBoxEl.style.width='0px'; selectBoxEl.style.height='0px';
            updateSelectionVisuals([]); controls.enabled=false;
        }
    }
}

function onMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    if(isBoxSelecting){
        const x=Math.min(boxStart.x, e.clientX), y=Math.min(boxStart.y, e.clientY), w=Math.abs(e.clientX-boxStart.x), h=Math.abs(e.clientY-boxStart.y);
        selectBoxEl.style.left=x+'px'; selectBoxEl.style.top=y+'px'; selectBoxEl.style.width=w+'px'; selectBoxEl.style.height=h+'px';
        const bX=((x-rect.left)/rect.width)*2-1, bY=-((y-rect.top)/rect.height)*2+1, eX=((x+w-rect.left)/rect.width)*2-1, eY=-((y+h-rect.top)/rect.height)*2+1;
        const box=new THREE.Box2(new THREE.Vector2(Math.min(bX,eX),Math.min(bY,eY)), new THREE.Vector2(Math.max(bX,eX),Math.max(bY,eY)));
        const sel=[]; scene.children.forEach(o=>{ if(o.userData.isEgg){ const p=o.position.clone().project(camera); if(box.containsPoint(new THREE.Vector2(p.x,p.y))) sel.push(o); } });
        updateSelectionVisuals(sel); return;
    }
    if(!isDragging || !dragTarget) return;
    const pl = new THREE.Plane(camera.getWorldDirection(new THREE.Vector3()).negate(), -dragTarget.position.dot(camera.getWorldDirection(new THREE.Vector3()).negate()));
    let intersect = new THREE.Vector3();
    if(ray.ray.intersectPlane(pl, intersect)){
        if(currentSelection.length>1 && currentSelection.includes(dragTarget) && mouseButton===0 && !dragTarget.userData.isHandle && !dragTarget.userData.isGroupHandle){
            currentSelection.forEach((eg,i)=>eg.position.copy(intersect).add(startGroupData[i].offset));
            updateGroupGizmoVisuals();
        } else if(currentEgg){
            if(dragTarget.userData.isRotationHandle){
                const ang=getMouseAngle(e,currentEgg), da=ang-lastMouseAngle;
                const ax=dragTarget.userData.axis==='x'?new THREE.Vector3(1,0,0):dragTarget.userData.axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
                currentEgg.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(ax,-da)); lastMouseAngle=ang;
            } else if(dragTarget.userData.isEgg) dragTarget.position.copy(intersect);
            else if(dragTarget.userData.isHandle){
                const id=dragTarget.userData.id, data=currentEgg.userData.data;
                if(mouseButton===0 && e.ctrlKey){
                    const ld=intersect.clone().sub(startIntersect).applyQuaternion(currentEgg.quaternion.clone().invert());
                    data.offsets[id].copy(dragTarget.userData.startOffset).add(ld); updateMesh(currentEgg);
                } else {
                    const r=Math.max(0.01, intersect.distanceTo(worldAnchorPos)/startHandleDist);
                    if(mouseButton===0) data.scale.copy(startScale).multiplyScalar(r);
                    else if(mouseButton===2){
                        const d=(id<2)?'y':(id<4?'x':'z');
                        data.scale.copy(startScale); data.scale[d]*=r;
                        const ctrls=[new THREE.Vector3(0,10,0),new THREE.Vector3(0,-10,0),new THREE.Vector3(-7,0,0),new THREE.Vector3(7,0,0),new THREE.Vector3(0,0,7),new THREE.Vector3(0,0,-7)], opp=(id%2===0)?id+1:id-1;
                        const co=ctrls[opp].clone().multiply(data.scale).applyQuaternion(currentEgg.quaternion).add(currentEgg.position);
                        currentEgg.position.add(worldAnchorPos.clone().sub(co));
                    } updateMesh(currentEgg);
                }
            }
        } else if(currentSelection.length>1){
            const b=new THREE.Box3(); currentSelection.forEach(e=>{e.geometry.computeBoundingBox(); b.union(e.geometry.boundingBox.clone().applyMatrix4(e.matrixWorld));});
            const c=b.getCenter(new THREE.Vector3());
            if(dragTarget.userData.isGroupHandle){
                const r=Math.max(0.01, intersect.distanceTo(c)/startHandleDist);
                currentSelection.forEach((e,i)=>{e.userData.data.scale.copy(startGroupData[i].scale).multiplyScalar(r); updateMesh(e); e.position.copy(c).add(startGroupData[i].pos.clone().sub(c).multiplyScalar(r));});
            } else if(dragTarget.userData.isGroupRotationHandle){
                const da=getMouseAngle(e,{position:c})-lastMouseAngle;
                const ax=dragTarget.userData.axis==='x'?new THREE.Vector3(1,0,0):dragTarget.userData.axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
                const rq=new THREE.Quaternion().setFromAxisAngle(ax,-da);
                currentSelection.forEach(eg=>{eg.position.sub(c).applyQuaternion(rq).add(c); eg.quaternion.premultiply(rq);});
                lastMouseAngle+=da;
            } updateGroupGizmoVisuals();
        } updateRealTimeSize();
    }
}

function onUp() { if(isBoxSelecting){ isBoxSelecting=false; selectBoxEl.style.display='none'; } if(isDragging) captureState(); isDragging=false; dragTarget=null; controls.enabled=true; }

function updateSelectionVisuals(sel) {
    currentSelection=sel; updateRealTimeSize();
    [...handles, rotX_H, rotY_H, rotZ_H, ...groupHandles, ...groupRotHandles].forEach(h=>h.visible=false);
    groupGizmo.visible=false; document.getElementById('palette').style.display='none';
    if(sel.length===0){ currentEgg=null; return; }
    document.getElementById('palette').style.display='grid';
    if(sel.length===1){ currentEgg=sel[0]; [...handles, rotX_H, rotY_H, rotZ_H].forEach(h=>h.visible=true); }
    else { currentEgg=null; groupGizmo.visible=true; [...groupHandles, ...groupRotHandles].forEach(h=>h.visible=true); updateGroupGizmoVisuals(); }
}

function createHandles() {
    const mkH=(id)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1.8,16,16),new THREE.MeshBasicMaterial({color:0xffcc00,depthTest:false})); m.renderOrder=999; m.visible=false; m.userData={isHandle:true,id}; scene.add(m); return m;};
    handles=[0,1,2,3,4,5].map(id=>mkH(id));
    const mkR=(c,a)=>{const r=new THREE.Mesh(new THREE.TorusGeometry(22,0.3,16,64),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.4,depthTest:false})); r.renderOrder=998; r.visible=false; r.userData={isRotationHandle:true,axis:a}; scene.add(r); return r;};
    rotX_H=mkR(0xff0000,'x'); rotY_H=mkR(0x00ff00,'y'); rotZ_H=mkR(0x0000ff,'z');
}

function createGroupGizmo() {
    groupGizmo=new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)), 0xff69b4); groupGizmo.visible=false; scene.add(groupGizmo);
    const mkG=(id)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(2.5,16,16),new THREE.MeshBasicMaterial({color:0xff69b4,depthTest:false})); m.renderOrder=999; m.visible=false; m.userData={isGroupHandle:true,id}; scene.add(m); return m;};
    groupHandles=[0,1,2,3,4,5,6,7].map(id=>mkG(id));
    const mkGR=(c,a)=>{const r=new THREE.Mesh(new THREE.TorusGeometry(28,0.5,16,64),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.6,depthTest:false})); r.renderOrder=998; r.visible=false; r.userData={isGroupRotationHandle:true,axis:a}; scene.add(r); return r;};
    groupRotHandles=[mkGR(0xff0000,'x'), mkGR(0x00ff00,'y'), mkGR(0x0000ff,'z')];
}

function updateGroupGizmoVisuals() {
    if(currentSelection.length<2) return;
    const b=new THREE.Box3(); currentSelection.forEach(e=>{e.geometry.computeBoundingBox(); b.union(e.geometry.boundingBox.clone().applyMatrix4(e.matrixWorld));});
    const c=b.getCenter(new THREE.Vector3()), s=b.getSize(new THREE.Vector3());
    const hb=new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.1,s.x),Math.max(0.1,s.y),Math.max(0.1,s.z))); hb.position.copy(c); groupGizmo.update(hb);
    const crn=[new THREE.Vector3(-0.5,0.5,0.5),new THREE.Vector3(-0.5,0.5,-0.5),new THREE.Vector3(-0.5,-0.5,0.5),new THREE.Vector3(-0.5,-0.5,-0.5),new THREE.Vector3(0.5,0.5,0.5),new THREE.Vector3(0.5,0.5,-0.5),new THREE.Vector3(0.5,-0.5,0.5),new THREE.Vector3(0.5,-0.5,-0.5)];
    groupHandles.forEach((h,i)=>h.position.copy(c).add(crn[i].clone().multiply(s)));
    groupRotHandles.forEach((r,i)=>{r.position.copy(c); r.rotation.set(0,0,0); if(i===0) r.rotateY(Math.PI/2); if(i===1) r.rotateX(Math.PI/2);});
}

function createGhost() { ghostEgg=createEgg(0x28a745,true); ghostEgg.visible=false; scene.add(ghostEgg); }
function togglePlacementMode() { isPlacementMode=!isPlacementMode; ghostEgg.visible=false; document.getElementById('egg-spawn-btn').classList.toggle('active', isPlacementMode); }
function spawnEgg(p) { const eg=createEgg(0xff69b4); eg.position.copy(p).y+=10.01; scene.add(eg); captureState(); updateSelectionVisuals([eg]); isPlacementMode=false; ghostEgg.visible=false; document.getElementById('egg-spawn-btn').classList.remove('active'); }
function getMouseAngle(e, t) { const rect=renderer.domElement.getBoundingClientRect(); const sp=t.position.clone().project(camera); return Math.atan2(e.clientY-(rect.top+(1-sp.y)*rect.height/2), e.clientX-(rect.left+(1+sp.x)*rect.width/2)); }
function updateRealTimeSize() { const box=new THREE.Box3(); if(currentSelection.length===0) { document.getElementById('info-w').innerText="0.0"; document.getElementById('info-h').innerText="0.0"; document.getElementById('info-d').innerText="0.0"; return; } currentSelection.forEach(e => { e.geometry.computeBoundingBox(); box.union(e.geometry.boundingBox.clone().applyMatrix4(e.matrixWorld)); }); const sz = box.getSize(new THREE.Vector3()); document.getElementById('info-w').innerText=(sz.x*CM_RATIO).toFixed(1); document.getElementById('info-h').innerText=(sz.y*CM_RATIO).toFixed(1); document.getElementById('info-d').innerText=(sz.z*CM_RATIO).toFixed(1); }
window.updateColor=(c)=>{ currentSelection.forEach(e=>e.material.color.set(c)); captureState(); };
window.executeUndo=()=>{if(history.length<2) return; redoStack.push(history.pop()); applyState(history[history.length-1]);};
window.executeRedo=()=>{if(redoStack.length===0) return; const n=redoStack.pop(); history.push(n); applyState(n);};
function updateNavButtons(){ document.getElementById('undo-btn').disabled=(history.length<2); document.getElementById('redo-btn').disabled=(redoStack.length===0); }
function onKeyDown(e) { if(e.key === "Delete" || e.key === "Backspace") { if(currentSelection.length > 0) { currentSelection.forEach(obj => { scene.remove(obj); }); updateSelectionVisuals([]); captureState(); } } }
function captureState() { const s=scene.children.filter(o=>o.userData.isEgg).map(e=>({pos:{x:e.position.x,y:e.position.y,z:e.position.z},rot:{x:e.quaternion.x,y:e.quaternion.y,z:e.quaternion.z,w:e.quaternion.w},scale:{x:e.userData.data.scale.x,y:e.userData.data.scale.y,z:e.userData.data.scale.z},offsets:e.userData.data.offsets.map(o=>({x:o.x,y:o.y,z:o.z})),col:e.material.color.getHex()})); const str=JSON.stringify(s); history.push(str); redoStack=[]; updateNavButtons(); }
function applyState(str) { try { const data=JSON.parse(str); scene.children.filter(o=>o.userData.isEgg).forEach(e=>{scene.remove(e);}); data.forEach(d=>{const e=createEgg(new THREE.Color(d.col)); e.position.set(d.pos.x,d.pos.y,d.pos.z); e.quaternion.set(d.rot.x,d.rot.y,d.rot.z,d.rot.w); e.userData.data.scale.set(d.scale.x,d.scale.y,d.scale.z); e.userData.data.offsets=d.offsets.map(o=>new THREE.Vector3(o.x,o.y,o.z)); updateMesh(e); scene.add(e);}); updateSelectionVisuals([]); updateNavButtons(); } catch(e) {} }
window.saveProject=()=>{const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([history[history.length-1]],{type:"application/json"})); a.download=`crochet_v5.48_${Date.now()}.json`; a.click();};
window.triggerFileSelect=()=>document.getElementById('file-input').click();
window.handleFileSelect=(e)=>{ const f=e.target.files[0]; if(f) { const r=new FileReader(); r.onload=(ev)=>{ applyState(ev.target.result); captureState(); }; r.readAsText(f); } };
function animate() { requestAnimationFrame(animate); if(currentEgg){ const {scale,offsets}=currentEgg.userData.data, p=currentEgg.position, q=currentEgg.quaternion; const ctrls=[new THREE.Vector3(0,10,0),new THREE.Vector3(0,-10,0),new THREE.Vector3(-7,0,0),new THREE.Vector3(7,0,0),new THREE.Vector3(0,0,7),new THREE.Vector3(0,0,-7)]; handles.forEach((h,i)=>{ const lP=ctrls[i].clone().multiply(scale).add(offsets[i]).add(ctrls[i].clone().normalize().multiplyScalar(H_OFFSET)); h.position.copy(p).add(lP.applyQuaternion(q)); }); [rotX_H, rotY_H, rotZ_H].forEach(r=>{r.position.copy(p); r.quaternion.copy(q); if(r===rotX_H) r.rotateY(Math.PI/2); if(r===rotY_H) r.rotateX(Math.PI/2);}); } renderer.render(scene, camera); controls.update(); }
window.onload = init;
