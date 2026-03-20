// [ engine.js ] v5.48.11 Core Physics Engine
// 모든 변수를 전역(var)으로 선언하여 ui_logic.js에서 참조 가능하게 합니다.
var scene, camera, renderer, controls, currentEgg, ghostEgg;
var isPlacementMode = false, dragTarget = null, isDragging = false;
var rotX_H, rotY_H, rotZ_H, handles = [];
var groupGizmo, groupHandles = [], groupRotHandles = [];
var startScale, startPos, startRotation, mouseButton, startGroupData = [], lastMouseAngle = 0;
var worldAnchorPos = new THREE.Vector3(), startIntersect = new THREE.Vector3(), startHandleDist = 1;
var isBoxSelecting = false, boxStart = new THREE.Vector2();
var history = [], redoStack = [], currentSelection = [];

// 아버님이 정하신 상수값
const CM_RATIO = 0.5; 
const BASE_H = 20; 
const BASE_R = 7; 
const H_OFFSET = 7;

// [핵심] 아버님의 3.5제곱 가중치 변형 로직 (원본 그대로)
function updateMesh(egg) {
    const pos = egg.geometry.attributes.position;
    const orig = egg.geometry.userData.origPos;
    const { scale, offsets } = egg.userData.data;
    
    // 6방향 제어점 (상, 하, 좌, 우, 전, 후)
    const ctrls = [
        new THREE.Vector3(0, 10, 0),  new THREE.Vector3(0, -10, 0),
        new THREE.Vector3(-7, 0, 0), new THREE.Vector3(7, 0, 0),
        new THREE.Vector3(0, 0, 7),  new THREE.Vector3(0, 0, -7)
    ];
    
    for (let i = 0; i < orig.count; i++) {
        const v = new THREE.Vector3(orig.getX(i), orig.getY(i), orig.getZ(i));
        const sV = v.clone().multiply(scale);
        let tw = 0; 
        const sOff = new THREE.Vector3();
        
        for (let j = 0; j < 6; j++) {
            // 아버님의 전매특허 3.5제곱 거리 가중치 공식
            const w = 1 / Math.pow(v.distanceTo(ctrls[j]) + 1, 3.5);
            tw += w; 
            sOff.add(offsets[j].clone().multiplyScalar(w));
        }
        pos.setXYZ(i, sV.x + (sOff.x / tw), sV.y + (sOff.y / tw), sV.z + (sOff.z / tw));
    }
    pos.needsUpdate = true;
}

// [공장] 알 생성 로직 (원본 그대로)
function createEgg(color, isGhost = false) {
    const points = [];
    for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const y = t * BASE_H;
        // 아버님의 타원 곡선 공식
        const r = BASE_R * Math.sqrt(Math.max(0, 1 - Math.pow((y - 10) / 10, 2)));
        points.push(new THREE.Vector2(Math.max(0.1, r), y));
    }
    
    const geo = new THREE.LatheGeometry(points, 32);
    geo.translate(0, -10, 0);
    geo.userData.origPos = geo.attributes.position.clone();
    
    const mat = new THREE.MeshLambertMaterial({ 
        color: color, 
        transparent: true, 
        opacity: isGhost ? 0.3 : 1.0 
    });
    
    const egg = new THREE.Mesh(geo, mat);
    
    if (!isGhost) { 
        egg.userData.isEgg = true;
        // 데이터 구조 보존
        egg.userData.data = { 
            scale: new THREE.Vector3(1, 1, 1), 
            offsets: [0,1,2,3,4,5].map(() => new THREE.Vector3()) 
        };
    }
    return egg;
}
