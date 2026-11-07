import * as THREE from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';

const baseURL = new URL('../assets/arx-x5/',import.meta.url);
export const motion = await fetch(new URL('motion.json',baseURL)).then(r=>{if(!r.ok)throw Error('ARX motion unavailable');return r.json();});
export const precisionMotion = await fetch(new URL('precision-motion.json?v=21',baseURL)).then(r=>{if(!r.ok)throw Error('ARX precision motion unavailable');return r.json();});
const names=['base_link',...Array.from({length:8},(_,i)=>'link'+(i+1))];
const loader=new STLLoader();
const geometries=Object.fromEntries(await Promise.all(names.map(async name=>[name,await loader.loadAsync(new URL(name+'.STL',baseURL).href)])));
const dark=new THREE.MeshStandardMaterial({color:0x384553,metalness:.60,roughness:.34});
const alloy=new THREE.MeshStandardMaterial({color:0xbfc9d2,metalness:.65,roughness:.3});
const rubber=new THREE.MeshStandardMaterial({color:0x101821,metalness:.1,roughness:.7});

export function sampleMotion(time,clip=motion) {
 const t=((time%clip.duration)+clip.duration)%clip.duration;
 const index=Math.min(clip.frames.length-2,Math.floor(t/.025));
 const a=clip.frames[index],b=clip.frames[index+1],u=(t-a[0])/(b[0]-a[0]);
 const v=a.map((n,i)=>n+(b[i]-n)*u);
 return {t,q:v.slice(1,7),position:new THREE.Vector3(...v.slice(7,10)),opening:v[10],objectY:v[11]};
}
export function createArm(scene,position,accent=0x65dfc1) {
 const root=new THREE.Group();root.rotation.x=-Math.PI/2;root.scale.setScalar(motion.scale);root.position.fromArray(position);scene.add(root);
 const links={base_link:new THREE.Group()};root.add(links.base_link);
 const articulations=[];
 for(const spec of motion.joints){
  const origin=new THREE.Group();origin.position.fromArray(spec.xyz);
  origin.quaternion.setFromEuler(new THREE.Euler(...spec.rpy,'ZYX'));
  const joint=new THREE.Group();origin.add(joint);links[spec.parent].add(origin);links[spec.child]=joint;
  articulations.push({joint,axis:new THREE.Vector3(...spec.axis),type:spec.type});
 }
 for(const name of names){
  const mesh=new THREE.Mesh(geometries[name],name==='link3'?alloy:name==='link7'||name==='link8'?rubber:dark);
  mesh.castShadow=true;mesh.receiveShadow=true;links[name].add(mesh);
 }
 const tcp=new THREE.Object3D();tcp.position.fromArray(motion.tcp);links.link6.add(tcp);
 // A fixed, illustrative wrist-camera mount; the six arm joints and fingers use the URDF.
 const cameraMount=new THREE.Group();cameraMount.position.set(.05,0,.065);
 cameraMount.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(.14,0,0),cameraMount.position,new THREE.Vector3(0,0,1)));
 links.link6.add(cameraMount);
 const housing=new THREE.Mesh(new THREE.BoxGeometry(.075,.023,.024),dark);housing.castShadow=true;cameraMount.add(housing);
 const glass=new THREE.Mesh(new THREE.BoxGeometry(.066,.015,.003),new THREE.MeshStandardMaterial({color:0x102837,metalness:.7,roughness:.15}));glass.position.z=.013;cameraMount.add(glass);
 for(const x of [-.023,.023]){
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.003,24),new THREE.MeshStandardMaterial({color:accent,metalness:.5,roughness:.13}));
  lens.rotation.x=Math.PI/2;lens.position.set(x,0,.016);cameraMount.add(lens);
 }
 const optical=new THREE.Object3D();optical.position.set(0,0,.018);cameraMount.add(optical);
 function pose(q,opening){
  articulations.forEach((a,i)=>{if(a.type==='revolute')a.joint.quaternion.setFromAxisAngle(a.axis,q[i]);else a.joint.position.copy(a.axis).multiplyScalar(opening);});
  root.updateMatrixWorld(true);
 }
 function cameraPose(camera){
  camera.position.copy(optical.getWorldPosition(new THREE.Vector3()));
  const forward=cameraMount.localToWorld(new THREE.Vector3(0,0,1));
  const up=new THREE.Vector3(0,1,0).transformDirection(cameraMount.matrixWorld);
  camera.up.copy(up);camera.lookAt(forward);camera.updateMatrixWorld();
 }
 return {root,links,tcp,optical,pose,cameraPose};
}
