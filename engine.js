// [ engine.js ] v5.48.11 - 핵심 엔진
var scene, camera, renderer, controls, currentEgg, ghostEgg;
var isPlacementMode = false, dragTarget = null, isDragging = false;
var handles = [], rotX_H, rotY_H, rotZ_H;
var currentSelection = [], history = [], redoStack = [];
var CM_RATIO = 0.5; 
var BASE_H = 20; 
var BASE_R = 7;

function updateMesh(egg) {
    const pos = egg.geometry.attributes.position, orig = egg.geometry.userData.origPos;
    const { scale, offsets } = egg.userData.data;
    const ctrls = [new THREE.Vector3(0,10,0), new THREE.Vector3(0,-10,0), new THREE.Vector3(-7,0,0), new THREE.Vector3(7,0,0), new THREE.Vector3(0,0,7), new THREE.Vector3(0,0,-7)];
    for (let i = 0; i < orig.count; i++) {
        const v = new THREE.Vector3(orig.getX(i), orig.getY(i), orig.getZ(i)), sV = v.clone().multiply(scale);
        let tw = 0; const sOff = new THREE.Vector3();
        for (let j = 0; j < 6; j++) {
            const w = 1 / Math.pow(v.distanceTo(ctrls[j]) + 1, 3.5);
            tw += w; sOff.add(offsets[j].clone().multiplyScalar(w));
        }
        pos.setXYZ(i, sV.x + (sOff.x/tw), sV.y + (sOff.y/tw), sV.z + (sOff.z/tw));
    }
    pos.needsUpdate = true;
}

function createEgg(color, isGhost = false) {
    const points = [];
    for (let i = 0; i <= 20; i++) {
        const t = i / 20, y = t * 20, r = 7 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 10) / 10, 2)));
        points.push(new THREE.Vector2(Math.max(0.1, r), y));
    }
    const geo = new THREE.LatheGeometry(points, 32);
    geo.translate(0, -10, 0);
    geo.userData.origPos = geo.attributes.position.clone();
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: isGhost ? 0.3 : 1.0 });
    const egg = new THREE.Mesh(geo, mat);
    egg.userData.isEgg = true;
    egg.userData.data = { scale: new THREE.Vector3(1, 1, 1), offsets: [0,1,2,3,4,5].map(()=>new THREE.Vector3()) };
    return egg;
}
