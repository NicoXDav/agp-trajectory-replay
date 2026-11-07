import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {motion, precisionMotion, sampleMotion, createArm} from './arx.js?v=21';
import {triangulateRays,simulatePixelSpread} from './ray-geometry.mjs';

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const colors = [0x92bdff,0x64e2c4,0xffbd80];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const material = (color,metalness=.0,roughness=.45) => new THREE.MeshStandardMaterial({color,metalness,roughness});
function rounded(parent,w,h,d,mat,pos=[0,0,0],r=.025) {
 const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),mat);
 mesh.position.set(...pos); mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,r1,r2,h,mat,pos=[0,0,0]) {
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,48),mat);
 mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function ball(parent,r,color,pos=[0,0,0]) {
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,24,16),new THREE.MeshBasicMaterial({color}));
 mesh.position.set(...pos);parent.add(mesh);return mesh;
}
function segment(a,b,color,r=.008,opacity=1) {
 const mat=new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1});
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,12),mat);
 const d=b.clone().sub(a);
 mesh.position.copy(a).add(b).multiplyScalar(.5);
 mesh.scale.y=d.length();
 mesh.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());
 return mesh;
}
function studio(canvas) {
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b111c);
 scene.fog=new THREE.Fog(0x0b111c,9,18);
 const pmrem=new THREE.PMREMGenerator(renderer);
 const room=new RoomEnvironment();
 const env=pmrem.fromScene(room,.04).texture;scene.environment=env;scene.environmentIntensity=.7;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xc5d9ff,0x19202c,1.6));
 const key=new THREE.DirectionalLight(0xfff3df,3.5);key.position.set(-3,6,4);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:15});
 key.shadow.normalBias=.025;key.shadow.bias=-.0002;scene.add(key);
 const rim=new THREE.DirectionalLight(0x8ab9ff,2);rim.position.set(3,2,-4);scene.add(rim);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material(0x101722,0,.8));
 ground.rotation.x=-Math.PI/2;ground.position.y=-1.5;ground.receiveShadow=true;scene.add(ground);
 return {renderer,scene,ground};
}
function projectToDOM(point,camera,width,height) {
 const p=point.clone().project(camera);
 return {x:(p.x*.5+.5)*width,y:(-p.y*.5+.5)*height,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};
}
class Illustration {
 constructor(figure,duration,stageTimes) {
  this.figure=figure;this.stage=figure.querySelector('.scene-stage');this.canvas=figure.querySelector('canvas');
  Object.assign(this,studio(this.canvas));
  this.duration=duration;this.stageTimes=stageTimes;this.time=0;this.visible=false;
  this.paused=reduced.matches;this.width=0;this.height=0;this.manual=false;
  this.play=figure.querySelector('[data-play]');
  this.play.addEventListener('click',()=>{this.paused=!this.paused;this.sync();});
  figure.querySelector('[data-replay]').addEventListener('click',()=>{this.time=0;this.paused=false;this.sync();});
  figure.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>{
   this.time=stageTimes[Number(button.dataset.stage)];this.paused=true;this.sync();this.update(0);this.render();
  }));
  this.sync();
  this.resize=new ResizeObserver(()=>this.measure());this.resize.observe(this.stage);
  figure.querySelector('.scene-loading').hidden=true;
  this.canvas.addEventListener('webglcontextlost',e=>{
   e.preventDefault();this.paused=true;this.sync();
   const message=figure.querySelector('.scene-loading');message.hidden=false;message.textContent='3D rendering was interrupted. Reload the page to restart.';
  });
 }
 sync(){this.play.textContent=this.paused?'Play':'Pause';this.play.setAttribute('aria-pressed',String(this.paused));}
 measure(){this.width=this.stage.clientWidth;this.height=this.stage.clientHeight;this.renderer.setSize(this.width,this.height,false);}
 story(index,title,description) {
  this.figure.querySelector('[data-stage-count]').textContent=String(index+1).padStart(2,'0')+' / '+String(this.stageTimes.length).padStart(2,'0');
  this.figure.querySelector('[data-stage-title]').textContent=title;
  this.figure.querySelector('[data-stage-description]').textContent=description;
  this.figure.querySelectorAll('[data-stage]').forEach(b=>{
   const active=Number(b.dataset.stage)===index;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));
  });
  this.figure.querySelector('.scene-progress i').style.transform='scaleX('+(this.time%this.duration)/this.duration+')';
 }
}
function workcell(scene) {
 const deck=material(0x313f50,.35,.48),metal=material(0x28323e,.65,.32);
 rounded(scene,3.3,.13,2.5,deck,[0,-.08,-.05],.06);
 rounded(scene,3.22,.018,2.42,material(0x4b5967,.2,.6),[0,-.007,-.05],.04);
 for(const x of [-1.4,1.4])for(const z of [-1.05,.95])rounded(scene,.11,1.3,.11,metal,[x,-.8,z]);
 const grid=new THREE.GridHelper(2.5,20,0x8293a4,0x65788b);grid.position.y=.003;grid.material.transparent=true;grid.material.opacity=.15;scene.add(grid);
 const left=createArm(scene,motion.leftBase,colors[1]);
 const right=createArm(scene,motion.rightBase,colors[2]);right.pose(motion.idle,.041);
 // Head-camera gantry is attached to the same bench as both arms.
 for(const x of [-1.35,1.35])rounded(scene,.055,2.35,.055,metal,[x,1.16,-1.12],.008);
 rounded(scene,2.76,.055,.055,metal,[0,2.35,-1.12],.008);
 const head=new THREE.Group();head.position.set(0,2.30,-1.05);head.lookAt(0,.115,.35);scene.add(head);
 rounded(head,.30,.105,.095,metal,[0,0,0],.02);
 rounded(head,.27,.075,.008,material(0x112b3a,.7,.18),[0,0,.05],.008);
 for(const x of [-.095,.095]){const lens=cylinder(head,.026,.026,.015,material(colors[0],.6,.2),[x,0,.06]);lens.rotation.x=Math.PI/2;}
 const headOptical=new THREE.Object3D();headOptical.position.z=.073;head.add(headOptical);
 const target=rounded(scene,.22,.22,.22,material(0xe8ab62,.35,.32),[0,.115,.35],.025);
 rounded(target,.14,.006,.14,material(0xffd6a0,.25,.38),[0,.113,0],.008);
 rounded(scene,.21,.09,.16,material(0x65889a,.35,.43),[-.70,.05,.62],.02).rotation.y=-.3;
 cylinder(scene,.09,.09,.18,material(0x50617a,.4,.38),[.66,.09,.7]);
 // Small physical base nameplates make the embodiment recognizable without floating labels.
 const label=document.createElement('canvas');label.width=384;label.height=96;
 const ctx=label.getContext('2d');ctx.fillStyle='#18232e';ctx.fillRect(0,0,384,96);ctx.fillStyle='#dce8f5';ctx.font='600 43px sans-serif';ctx.fillText('ARX  X5',34,64);
 const tex=new THREE.CanvasTexture(label);tex.colorSpace=THREE.SRGBColorSpace;
 const badge=new THREE.Mesh(new THREE.PlaneGeometry(.52,.13),new THREE.MeshBasicMaterial({map:tex}));badge.position.set(0,-.08,1.208);scene.add(badge);
 return {left,right,headOptical,target};
}
class GraspIllustration extends Illustration {
 constructor(figure) {
  super(figure,44,[0,7,9.5,14,22,28]);
  this.rig=workcell(this.scene);
  this.rig.target.scale.set(.08/.22,1,.10/.22);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.13,.004,8,64),new THREE.MeshBasicMaterial({color:0xd8ae73}));halo.rotation.x=Math.PI/2;halo.position.set(0,.008,.35);this.scene.add(halo);
  this.mainCamera=new THREE.PerspectiveCamera(36,1,.01,30);
  this.mainCamera.position.set(3.3,2.8,4.7);this.mainCamera.lookAt(0,.75,-.03);
  this.wristCamera=new THREE.PerspectiveCamera(78,1,.008,20);
  this.contextInset=figure.querySelector('.context-inset');
  this.wrist=figure.querySelector('.wrist-frame');this.bracket=figure.querySelector('.target-bracket');this.line=figure.querySelector('.alignment-line');this.reticle=figure.querySelector('.reticle');this.readout=figure.querySelector('.wrist-readout');
  figure.querySelector('[data-guides]').addEventListener('click',e=>{
   const show=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(show));e.currentTarget.textContent=show?'Hide reticle':'Show reticle';this.wrist.classList.toggle('hide-reticle',!show);
  });
  this.update();this.measure();
 }
 update(delta=0){
  const p=sampleMotion(this.time,precisionMotion);this.pose=p;this.rig.left.pose(p.q,p.opening);this.rig.target.position.y=p.objectY;
  this.rig.left.cameraPose(this.wristCamera);
  this.frameDelta=this.paused?0:delta;this.seeked=this.previousTime===undefined||p.t<this.previousTime||p.t-this.previousTime>.15;this.previousTime=p.t;
  const i=p.t<6.8?0:p.t<8?1:p.t<12?2:p.t<22?3:p.t<26?4:5;
  const titles=['Search with a visible reference','The target crosses the reticle','Move past it. The cue disappears.','Reduce the visible offset','Hold alignment before closing',p.t<28?'Close around the centered pin':p.t<34?'Lift and verify retention':'Place and reset'];
  const descriptions=['The wrist image moves with the hand; the grasp-center mark stays attached to the gripper.','A brief green pulse makes the moment of alignment visible.','The target moves away from the crosshair. Correct the hand position.','Follow the shrinking line back toward the target; this view is enlarged.','Approach along the viewing ray while keeping the target on the crosshair.',p.t<28?'Close only after the alignment has settled.':p.t<34?'The pin rises with the hand: the outcome is now visible.':'Set the pin down, open the fingers, and begin the next search.'];
  this.story(i,titles[i],descriptions[i]);
  this.figure.querySelector('.precision-metrics').classList.remove('unguided');
  this.wrist.classList.remove('guide-off');
  const zoom=THREE.MathUtils.smoothstep(p.t,12,17)*(1-THREE.MathUtils.smoothstep(p.t,26,29));
  this.wristCamera.fov=78-16*zoom;
 }
 render(){
  const w=this.width,h=this.height;if(!w||!h)return;
  const mobile=w<750;
  // The wrist image is the main view; the establishing shot shrinks into context.
  const intro=THREE.MathUtils.smoothstep(this.pose.t,1,3);
  const ix=THREE.MathUtils.lerp(0,mobile?.64*w:.745*w,intro),iy=THREE.MathUtils.lerp(0,.045*h,intro);
  const iw=THREE.MathUtils.lerp(w,mobile?.32*w:.23*w,intro),ih=THREE.MathUtils.lerp(h,mobile?.22*h:.34*h,intro);
  const vw=w,vh=h;
  this.wristCamera.aspect=w/h;this.wristCamera.updateProjectionMatrix();
  this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,w,h);this.renderer.clear();this.renderer.render(this.scene,this.wristCamera);
  this.mainCamera.aspect=iw/ih;this.mainCamera.updateProjectionMatrix();
  this.renderer.setScissorTest(true);this.renderer.setScissor(ix,h-iy-ih,iw,ih);this.renderer.setViewport(ix,h-iy-ih,iw,ih);this.renderer.clear();this.renderer.render(this.scene,this.mainCamera);this.renderer.setScissorTest(false);
  Object.assign(this.contextInset.style,{left:ix+'px',top:iy+'px',width:iw+'px',height:ih+'px',opacity:String(intro)});
  Object.assign(this.wrist.style,{left:'0px',top:'0px',width:w+'px',height:h+'px',opacity:String(intro)});
  const target=projectToDOM(this.rig.target.position,this.wristCamera,vw,vh);
  const tcp=projectToDOM(this.rig.left.tcp.getWorldPosition(V()),this.wristCamera,vw,vh);
  const pads=this.figure.querySelectorAll('[data-pad]');
  for(let i=0;i<2;i++){
   // Nominal inner-pad reference in the TCP frame; spacing follows finger travel.
   const local=V(.14,(i?1:-1)*(this.pose.opening+.0005),0);
   const q=projectToDOM(this.rig.left.links.link6.localToWorld(local),this.wristCamera,vw,vh);
   Object.assign(pads[i].style,{left:q.x+'px',top:q.y+'px',opacity:q.visible?'1':'0'});
  }
  const dx=target.x-tcp.x,dy=target.y-tcp.y,error=Math.hypot(dx,dy);
  // Evaluate the camera-to-TCP ray at the target-center plane. This expresses
  // the image alignment error in metric units without confusing hover height
  // with lateral error. It is an illustration cue, not a contact measurement.
  const optical=this.wristCamera.position,center=this.rig.left.tcp.getWorldPosition(V());
  const ray=center.clone().sub(optical),lambda=(this.rig.target.position.y-optical.y)/ray.y;
  const projected=optical.clone().addScaledVector(ray,lambda);
  const offset=projected.distanceTo(this.rig.target.position)/motion.scale*1000;
  const aligned=target.visible&&lambda>0&&offset<1;
  if(this.seeked||!aligned)this.alignedHold=0;
  else this.alignedHold=Math.min(1,(this.alignedHold||0)+this.frameDelta);
  this.wrist.classList.toggle('is-aligned',aligned);
  this.wrist.classList.toggle('alignment-settled',aligned&&this.alignedHold>=.5);
  this.reticle.style.setProperty('--hold-angle',(Math.min(1,(this.alignedHold||0)/.5)*360)+'deg');
  Object.assign(this.reticle.style,{left:tcp.x+'px',top:tcp.y+'px'});
  Object.assign(this.bracket.style,{left:target.x+'px',top:target.y+'px',opacity:target.visible?'1':'0'});
  Object.assign(this.line.style,{left:tcp.x+'px',top:tcp.y+'px',width:error+'px',transform:'rotate('+Math.atan2(dy,dx)+'rad)',opacity:target.visible&&!aligned?'.95':'0'});
  this.figure.querySelector('[data-offset]').innerHTML=offset.toFixed(1)+' <small>mm</small>';
  const held=this.pose.t>=28&&this.pose.t<34,closing=this.pose.t>=26&&this.pose.t<28;
  const status=held?'Pin lifted · retention visible':closing?'Aligned · closing':aligned&&this.alignedHold>=.5&&this.pose.t>=22?'Aligned — ready to close':aligned?'Target aligned · hold position':this.pose.t>=8&&this.pose.t<12?'Alignment lost · correct the hand':'Bring target onto the crosshair';
  this.figure.querySelector('[data-comparison]').textContent=status;
  this.figure.querySelector('[data-comparison]').classList.toggle('guided',aligned);
  this.figure.querySelector('[data-grasp-outcome]').textContent=held?'The pin moves with the gripper.':aligned?'Green indicates alignment, not grasp success.':'Shorten the line to reduce the alignment error.';
  this.readout.textContent=aligned?'Aligned · '+Math.round(error)+' px image offset':'Image offset · '+Math.round(error)+' px';

 }
}
function setSegment(mesh,a,b){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=d.length();mesh.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());}
class TriIllustration extends Illustration {
 constructor(figure){
  super(figure,36,[0,4,8,14,24]);
  this.world=new THREE.Group();this.scene.add(this.world);this.rig=workcell(this.world);this.target=V();
  this.world.remove(this.rig.target);this.scene.add(this.rig.target);
  this.rays=colors.map(c=>{const line=segment(V(),V(0,1,0),c,.009,.8);this.scene.add(line);return line;});
  this.packets=colors.map(c=>ball(this.scene,.022,c));
  this.marker=new THREE.Group();this.scene.add(this.marker);ball(this.marker,.028,0xffffff);
  for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.11,.004,8,60),new THREE.MeshBasicMaterial({color:0x83d9ff}));if(i===0)ring.rotation.x=Math.PI/2;if(i===1)ring.rotation.y=Math.PI/2;this.marker.add(ring);}
  this.ambiguity=[.62,.81,1].map(()=>{
   const m=new THREE.Mesh(new THREE.SphereGeometry(.065,24,16),new THREE.MeshBasicMaterial({color:0xffc58e,transparent:true,opacity:.65,depthTest:false,depthWrite:false}));this.scene.add(m);return m;
  });
  this.spreadCloud=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xffbd80,size:.021,transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));
  this.scene.add(this.spreadCloud);this.spreadCache=null;this.outlier=false;
  this.spreadEnvelope=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshBasicMaterial({color:0xffbd80,transparent:true,opacity:.13,depthWrite:false,wireframe:true}));this.scene.add(this.spreadEnvelope);
  figure.querySelector('[data-outlier]').addEventListener('click',e=>{
   this.outlier=!this.outlier;e.currentTarget.setAttribute('aria-pressed',String(this.outlier));e.currentTarget.textContent=this.outlier?'Restore matched view':'Try mismatched view';this.time=8;this.paused=true;this.sync();
  });
  this.headCamera=new THREE.PerspectiveCamera(55,1,.01,20);
  this.headFrame=figure.querySelector('.head-frame');
  this.depthRange=figure.querySelector('[data-depth-range]');this.depthPoint=figure.querySelector('[data-depth-point]');
  this.camera=new THREE.PerspectiveCamera(37,1,.01,30);this.camera.position.set(3.9,2.6,3.1);
  this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.set(0,.85,0);this.controls.enablePan=false;this.controls.enableDamping=true;this.controls.minDistance=4.2;this.controls.maxDistance=9;this.controls.minPolarAngle=.35;this.controls.maxPolarAngle=1.5;this.controls.autoRotateSpeed=.45;
  this.controls.addEventListener('start',()=>{this.manual=true;});
  figure.querySelector('[data-reset]').addEventListener('click',()=>{this.camera.position.set(3.9,2.6,3.1);this.controls.target.set(0,.85,0);this.manual=false;this.controls.update();});
  this.canvas.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();this.manual=true;
   const s=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
   if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;if(e.key==='ArrowUp')s.phi-=.1;if(e.key==='ArrowDown')s.phi+=.1;if(e.key==='+'||e.key==='=')s.radius-=.25;if(e.key==='-')s.radius+=.25;
   s.phi=THREE.MathUtils.clamp(s.phi,.35,1.5);s.radius=THREE.MathUtils.clamp(s.radius,4.2,9);this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s));this.controls.update();
  });
  this.labels=['Head camera','Left wrist','Right wrist'].map((name,i)=>{const el=document.createElement('span');el.textContent=name;el.style.setProperty('--label-color','#'+colors[i].toString(16));figure.querySelector('.camera-labels').append(el);return el;});
  this.update(0);this.measure();
 }
 update(delta){
  const t=this.time%36;
  let mt=8;
  if(t>=14&&t<19)mt=8+(t-14)*3/5;
  else if(t>=19&&t<21)mt=11+(t-19);
  else if(t>=21&&t<25)mt=13+(t-21)*3/4;
  else if(t>=25&&t<28)mt=16;
  else if(t>=28&&t<34)mt=19+(t-28)*5/6;
  else if(t>=34)mt=24+(t-34)*2/2;
  const p=sampleMotion(mt);this.rig.left.pose(p.q,p.opening);this.rig.target.position.y=p.objectY;
  this.scene.updateMatrixWorld(true);this.target.copy(this.rig.target.position).add(V(0,.118,0));
  this.positions=[this.rig.headOptical.getWorldPosition(V()),this.rig.left.optical.getWorldPosition(V()),this.rig.right.optical.getWorldPosition(V())];
  this.headCamera.position.copy(this.positions[0]);this.headCamera.up.set(0,1,0);
  this.headCamera.lookAt(this.rig.headOptical.localToWorld(V(0,0,1)));this.headCamera.updateMatrixWorld();
  const index=t<4?0:t<8?1:t<14?2:t<21?3:4;
  // Each wrist camera appears with its whole arm; the head stays on its gantry.
  this.rig.left.root.visible=index>=1;this.rig.right.root.visible=index>=2;
  this.world.visible=true;this.ground.visible=true;
  this.story(index,t>=28?'Return the object':['One pixel. Several possible depths.','Two views recover depth','A third view tightens the estimate','Reach to the 3D position','Close at the right place'][index],t>=28?'The arm places the object down and opens the gripper.':['The amber hypotheses project onto the same head-camera pixel.','Pixel uncertainty becomes a spread of possible 3D estimates.','A complementary view reduces the spread in this simulated example.','The full ARX arm approaches the estimated 3D location.','The fingers close around the target and the arm lifts it.'][index]);
  this.figure.querySelector('[data-geometry]').textContent=['Depth unresolved','Two-view estimate','Three-view agreement','Metric reach target','Object retained'][index];
  this.figure.querySelector('[data-geometry-detail]').textContent=['One image point fixes direction, not distance.','Intersect calibrated RGB rays to recover depth.','A useful third view reduces the simulated scatter.','Use the recovered position to approach the object.','The object now moves with the gripper.'][index];
  const disturbed=this.outlier&&index>=2&&index<=3;
  const rayTargets=this.positions.map((_,i)=>this.target.clone().add(i===2&&disturbed?V(.6,.1,0):V()));
  const provisional=V(...triangulateRays(this.positions.slice(0,2).map(v=>v.toArray()),this.positions.slice(0,2).map(v=>this.target.clone().sub(v).toArray())));
  const thirdDirection=rayTargets[2].clone().sub(this.positions[2]).normalize();
  const deltaPoint=provisional.clone().sub(this.positions[2]),forward=deltaPoint.dot(thirdDirection);
  const pixelResidual=forward>0?deltaPoint.clone().addScaledVector(thirdDirection,-forward).length()/forward*600:Infinity;
  const rejected=index>=2&&pixelResidual>4;
  this.rays.forEach((ray,i)=>{ray.visible=i<=index;ray.material.opacity=i===2&&rejected?.3:t<14?.85:.23;ray.material.color.setHex(i===2&&rejected?0xff7984:colors[i]);setSegment(ray,this.positions[i],rayTargets[i]);this.packets[i].visible=t<14&&i<=index&&!(i===2&&rejected);this.packets[i].position.copy(this.positions[i]).lerp(rayTargets[i],(t*.36+i*.2)%1);});
  this.labels[2].textContent=rejected?'Right wrist · rejected':'Right wrist';
  this.ambiguity.forEach((dot,i)=>{dot.visible=index===0;dot.position.copy(this.positions[0]).lerp(this.target,[.62,.81,1][i]);});
  const count=index===0?1:index===1||rejected?2:3;
  if(count>1){const origins=this.positions.slice(0,count).map(v=>v.toArray());const directions=rayTargets.slice(0,count).map((v,i)=>v.clone().sub(this.positions[i]).normalize().toArray());this.estimate=V(...triangulateRays(origins,directions));}
  // The noisy trial cloud is explanatory geometry, separate from scripted arm motion.
  if(!this.spreadCache){
   const origins=this.positions.map(v=>v.toArray());
   this.spreadCache=[simulatePixelSpread(origins.slice(0,2),this.target.toArray()),simulatePixelSpread(origins,this.target.toArray())];
  }
  const spread=this.spreadCache[count===3?1:0];
  this.spreadCloud.visible=index>0&&t<14;
  if(this.cloudCount!==count){
   this.cloudCount=count;this.spreadCloud.geometry.setAttribute('position',new THREE.Float32BufferAttribute(spread.offsets.flatMap(p=>p.map(v=>v*20)),3));
   this.spreadCloud.geometry.computeBoundingSphere();
  }
  this.spreadCloud.position.copy(this.target);this.spreadCloud.material.color.setHex(count===3?0x64e2c4:0xffbd80);
  const axisZ=this.target.clone().sub(this.positions[0]).normalize(),axisX=V(0,1,0).cross(axisZ).normalize(),axisY=axisZ.clone().cross(axisX);
  const sd=axis=>Math.sqrt(spread.offsets.reduce((sum,p)=>sum+V(...p).dot(axis)**2,0)/spread.offsets.length);
  this.spreadEnvelope.visible=this.spreadCloud.visible;this.spreadEnvelope.position.copy(this.target);
  this.spreadEnvelope.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axisX,axisY,axisZ));
  this.spreadEnvelope.scale.set(sd(axisX)*40,sd(axisY)*40,sd(axisZ)*40);this.spreadEnvelope.material.color.copy(this.spreadCloud.material.color);
  this.figure.querySelector('[data-spread]').textContent=index===0?'One view · depth unconstrained':t<14?'Simulated 3D spread: '+(spread.rms/motion.scale*1000).toFixed(1)+' mm · cloud ×20':'RGB + calibration → metric position';
  if(rejected){this.story(index,'Reject the mismatched view','The third ray fails the reprojection check. Keep the valid pair.');this.figure.querySelector('[data-geometry]').textContent='Mismatched view excluded';this.figure.querySelector('[data-geometry-detail]').textContent='Keep the two-view estimate. More views help only when they match.';}
  this.marker.visible=index>0;this.marker.position.copy(index>0?this.estimate:this.target);this.marker.rotation.y=t*.4;
  const z=(index>0?this.estimate:this.target).clone().sub(this.headCamera.position).dot(this.headCamera.getWorldDirection(V()))/motion.scale;
  this.figure.querySelector('[data-depth-label]').textContent=index===0?'Example depths on the same ray':'Recovered head-camera depth Z';
  this.figure.querySelector('[data-depth]').innerHTML=index===0?'Unknown':z.toFixed(3)+' <small>m</small>';
  this.figure.querySelector('[data-geometry-detail]').textContent=index===0?[.62,.81,1].map(n=>(z*n).toFixed(2)+' m').join(' · ')+' — same pixel.':this.figure.querySelector('[data-geometry-detail]').textContent;
  const band=30*spread.rms/this.spreadCache[0].rms;this.depthRange.style.width=index===0?'74%':band+'%';this.depthRange.style.left=index===0?'13%':(50-band/2)+'%';this.depthPoint.hidden=index===0;
  this.figure.querySelector('[data-ray-explanation]').textContent=index===0?'Same pixel · depth still ambiguous':'Same landmark · depth recovered from other views';
  this.controls.autoRotate=!this.paused&&!this.manual&&!reduced.matches;this.controls.update(delta);
 }
 render(){
  const w=this.width,h=this.height;if(!w||!h)return;
  const mobile=w<750,mainW=w,mainH=mobile?.65*h:h;
  this.camera.aspect=mainW/mainH;this.camera.updateProjectionMatrix();
  this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,w,h);this.renderer.clear();this.renderer.setScissorTest(true);
  this.renderer.setScissor(0,h-mainH,mainW,mainH);this.renderer.setViewport(0,h-mainH,mainW,mainH);this.renderer.render(this.scene,this.camera);
  this.positions.forEach((p,i)=>{const q=projectToDOM(p.clone().add(V(0,.16,0)),this.camera,mainW,mainH);this.labels[i].style.transform='translate('+q.x+'px,'+q.y+'px) translate(-50%,-100%)';this.labels[i].hidden=!q.visible||i>(this.time%36<4?0:this.time%36<8?1:2);});
  const transition=THREE.MathUtils.smoothstep(this.time%36,1.5,3.8);
  const x=THREE.MathUtils.lerp(.10*w,.025*w,transition),y=THREE.MathUtils.lerp(.14*h,.14*h,transition);
  const vw=THREE.MathUtils.lerp(.80*w,mobile?.29*w:.23*w,transition),vh=THREE.MathUtils.lerp(mobile?.42*h:.62*h,mobile?.12*h:.27*h,transition);
  this.headCamera.aspect=vw/vh;this.headCamera.updateProjectionMatrix();
  // The inset is RGB only: geometric hypotheses stay in the explanatory 3D view.
  const annotations=[...this.rays,...this.packets,...this.ambiguity,this.marker,this.spreadCloud,this.spreadEnvelope],states=annotations.map(o=>o.visible);annotations.forEach(o=>o.visible=false);

  this.renderer.setScissor(x,h-y-vh,vw,vh);this.renderer.setViewport(x,h-y-vh,vw,vh);this.renderer.clear();this.renderer.render(this.scene,this.headCamera);this.renderer.setScissorTest(false);annotations.forEach((o,i)=>o.visible=states[i]);
  Object.assign(this.headFrame.style,{left:x+'px',top:y+'px',width:vw+'px',height:vh+'px'});
  const pixel=projectToDOM(this.target,this.headCamera,vw,vh);Object.assign(this.headFrame.querySelector('.image-landmark').style,{left:pixel.x+'px',top:pixel.y+'px'});
 }

}

const planningMotion = await fetch(new URL('../assets/arx-x5/planning-motion.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Planning illustration unavailable');return r.json();});
class PlanningIllustration extends Illustration {
 constructor(figure){
  super(figure,43,[0,4,9,16,21,31]);
  this.rig=workcell(this.scene);this.rig.target.visible=false;
  this.nodes=planningMotion.nodes;this.points=this.nodes.map(n=>V(...n.position));
  this.camera=new THREE.PerspectiveCamera(35,1,.01,30);this.camera.position.set(1.8,3.8,3.4);
  this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.set(0,.68,.03);this.controls.enablePan=false;this.controls.enableDamping=true;this.controls.minDistance=3.8;this.controls.maxDistance=8;this.controls.maxPolarAngle=1.45;this.controls.minPolarAngle=.3;
  figure.querySelector('[data-reset]').addEventListener('click',()=>{this.camera.position.set(1.8,3.8,3.4);this.controls.target.set(0,.68,.03);this.controls.update();});
  this.canvas.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();
   const s=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
   if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;if(e.key==='ArrowUp')s.phi-=.1;if(e.key==='ArrowDown')s.phi+=.1;if(e.key==='+'||e.key==='=')s.radius-=.25;if(e.key==='-')s.radius+=.25;
   s.phi=THREE.MathUtils.clamp(s.phi,.3,1.45);s.radius=THREE.MathUtils.clamp(s.radius,3.8,8);this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s));this.controls.update();
  });
  this.ghost=createArm(this.scene,motion.leftBase,colors[0]);
  this.ghost.root.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:0x87baff,transparent:true,opacity:.16,depthWrite:false});o.castShadow=false;o.receiveShadow=false;}});
  this.poseTrail=[planningMotion.anchors[1],planningMotion.anchors[2]].map(index=>{
   const arm=createArm(this.scene,motion.leftBase,colors[0]);
   const mat=new THREE.MeshBasicMaterial({color:0x9acbff,transparent:true,opacity:.075,depthWrite:false});
   arm.root.traverse(o=>{if(o.isMesh){o.material=mat;o.castShadow=false;o.receiveShadow=false;}});arm.pose(this.nodes[index].q,.0272);return {arm,index};
  });
  this.route=new THREE.Group();this.scene.add(this.route);
  this.edges=this.points.slice(1).map((p,i)=>{const line=segment(this.points[i],p,colors[0],.006,.65);this.route.add(line);return line;});
  this.dots=this.points.map(p=>ball(this.route,.020,colors[0],p.toArray()));
  this.halos=planningMotion.anchors.map(i=>{
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.065,.004,8,48),new THREE.MeshBasicMaterial({color:colors[0],transparent:true,opacity:.7}));ring.rotation.x=Math.PI/2;ring.position.copy(this.points[i]);this.route.add(ring);return ring;
  });
  this.probe=ball(this.scene,.034,0xffffff);
  this.scanRing=new THREE.Mesh(new THREE.TorusGeometry(.10,.006,8,64),new THREE.MeshBasicMaterial({color:colors[1]}));this.scene.add(this.scanRing);
  this.goal=new THREE.Group();this.goal.position.copy(this.points.at(-1));this.scene.add(this.goal);
  const ghostCup=new THREE.Mesh(new THREE.CylinderGeometry(.105,.08,.24,40,1,true),new THREE.MeshBasicMaterial({color:colors[1],transparent:true,opacity:.22,wireframe:true}));ghostCup.position.y=-.02;this.goal.add(ghostCup);
  this.goal.add(new THREE.AxesHelper(.22));
  this.cup=new THREE.Group();this.scene.add(this.cup);
  const cupMat=new THREE.MeshStandardMaterial({color:0xd89955,metalness:.42,roughness:.28,side:THREE.DoubleSide});
  cylinder(this.cup,.105,.08,.24,cupMat,[0,-.02,0]);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.105,.008,10,64),material(0xffd6a1,.55,.2));rim.rotation.x=Math.PI/2;rim.position.y=.10;this.cup.add(rim);
  cylinder(this.cup,.091,.091,.007,material(0x473c32,.1,.7),[0,.101,0]);
  for(let i=0;i<5;i++)ball(this.cup,.020,0xb4e3ef,[Math.cos(i*2.4)*.055,.108,Math.sin(i*2.4)*.055]);
  cylinder(this.scene,.23,.23,.025,material(0x376d76,.4,.45),[.46,.0025,.55]);
  const coasterRim=new THREE.Mesh(new THREE.TorusGeometry(.23,.006,10,64),material(0x8ae6cf,.45,.2));coasterRim.rotation.x=Math.PI/2;coasterRim.position.set(.46,.015,.55);this.scene.add(coasterRim);
  this.label=figure.querySelector('[data-waypoint-label]');this.goalLabel=figure.querySelector('[data-goal-label]');
  this.checks=[...figure.querySelectorAll('[data-check]')];
  this.jointBars=[...figure.querySelectorAll('.joint-bars i')];
  this.nodeStrip=figure.querySelector('.planning-nodes');
  this.nodeStrip.innerHTML=this.nodes.map(()=>'<i></i>').join('');this.nodeStrip.style.gridTemplateColumns='repeat('+this.nodes.length+',1fr)';
  this.nodeDots=[...this.nodeStrip.children];this.update(0);this.measure();
 }
 update(delta){
  const t=this.time%this.duration,n=this.nodes.length;
  const phase=t<4?0:t<9?1:t<16?2:t<21?3:t<31?4:5;
  const revealed=phase===0?0:phase===1?Math.min(n,Math.floor((t-4)/4*n)+1):n;
  const checked=phase<2?0:phase===2?Math.min(n,Math.floor((t-9)/6*n)+1):n;
  const continuity=phase<3?0:phase===3?Math.min(n,Math.floor((t-16)/4*n)+1):n;
  const scan=phase===2?checked-1:phase===3?continuity-1:0;
  const frame=planningMotion.frames[Math.min(planningMotion.frames.length-1,Math.floor(Math.max(0,t-21)/.025))];
  const release=THREE.MathUtils.smoothstep(t,31,33);
  const retreat=planningMotion.retreat[Math.min(planningMotion.retreat.length-1,Math.floor(Math.max(0,t-33)/.025))];
  this.rig.left.pose(t>=33?retreat.q:frame.q,THREE.MathUtils.lerp(.0272,.041,release));
  this.cup.position.copy(t<31?this.rig.left.tcp.getWorldPosition(V()):this.points.at(-1));
  this.goalLabel.textContent=t>=38?'Placed · gripper clear':'Place on coaster';
  this.poseTrail.forEach(({arm,index})=>{arm.root.visible=phase===3||(phase>=4&&frame.progress<index);});
  this.ghost.root.visible=phase===2||phase===3;this.ghost.pose(this.nodes[Math.max(0,scan)].q,.0272);
  this.dots.forEach((d,i)=>{d.visible=i<revealed;d.material.color.setHex(i<checked?colors[1]:colors[0]);d.scale.setScalar(phase>=2&&i===scan?1.6:1);});
  this.edges.forEach((e,i)=>{e.visible=phase===0||i<revealed-1;e.material.color.setHex(phase>=4&&i<frame.progress?colors[1]:colors[0]);e.material.opacity=phase===0?.16:phase>=4&&i<frame.progress?.95:.5;});
  this.probe.visible=phase>=2;this.probe.position.copy(phase>=4?this.rig.left.tcp.getWorldPosition(V()):this.points[Math.max(0,scan)]);
  this.scanRing.visible=phase===2||phase===3;this.scanRing.position.copy(this.probe.position);this.scanRing.quaternion.copy(this.camera.quaternion);this.scanRing.scale.setScalar(1+.1*Math.sin(t*5));
  this.halos.forEach(h=>{h.visible=true;});this.goal.visible=t<31;
  this.nodeDots.forEach((d,i)=>{d.className=i<checked?'checked':i<revealed?'sampled':'';});
  this.figure.querySelector('[data-node-count]').textContent=String(revealed).padStart(2,'0')+' / '+n;
  this.figure.querySelector('[data-route-status]').textContent=['Place cup on coaster','Sampling the route','Solving each pose','Checking the joint chain','Moving to the coaster',t<33?'Cup supported · opening gripper':t<38?'Retracting the open hand':'Complete · cup stays on coaster'][phase];
  const statuses=[phase<2?'Pending':checked<n?checked+' / '+n:n+' / '+n+' solved',phase<2?'Pending':checked<n?'Checking':'Within limits',phase<3?'Pending':continuity<n?'Checking':'Continuous'];
  this.checks.forEach((e,i)=>{e.querySelector('b').textContent=statuses[i];e.classList.toggle('passed',i<2?checked===n:continuity===n);e.classList.toggle('checking',i<2?phase===2:phase===3);});
  const node=this.nodes[Math.max(0,phase>=4?Math.min(n-1,Math.round(frame.progress)):scan)];
  const degrees=node.q.map((v,i)=>Math.abs(v-this.nodes[Math.max(0,(phase>=4?Math.round(frame.progress):scan)-1)].q[i])*180/Math.PI);
  this.jointBars.forEach((bar,i)=>{bar.style.height=(phase>=3?Math.max(3,Math.min(100,degrees[i]/10*100)):3)+'%';});
  this.figure.querySelector('[data-joint-step]').textContent=phase<3?'—':(Math.max(...this.nodes.map(n=>n.jumpRad))*180/Math.PI).toFixed(1)+'° max';
  const maxError=Math.max(...this.nodes.slice(0,Math.max(1,checked)).map(n=>n.errorMm));
  this.figure.querySelector('[data-ik-error]').textContent=phase<2?'—':maxError<.01?'< 0.01 mm':maxError.toFixed(2)+' mm';
  this.figure.querySelector('[data-executed]').textContent=phase<4?'Waiting':t>=38?'Complete':Math.min(100,Math.round((t-21)/17*100))+'%';
  const titles=['Place the cup on the coaster','Turn a route into nearby poses','Find a joint solution for each point','Keep the configuration continuous','Lower the cup onto its support',t<33?'Release only after placement':t<38?'Open fingers. Retract the hand.':'Placed, released, and clear'];
  const desc=['Move the held cup to the outlined coaster and leave it standing there.','Lift, translate, lower. Insert samples at no more than 20 mm.','The translucent arm previews each pose while the real arm waits.','Check joint limits and changes between neighboring IK solutions.','The cup base reaches the coaster before the fingers open.','The cup remains on the coaster as the open hand moves away.'];
  this.story(phase,titles[phase],desc[phase]);this.controls.update(delta);
 }
 render(){
  if(!this.width||!this.height)return;
  const mobile=this.width<750,w=mobile?this.width:this.width*.71,h=mobile?this.height*.58:this.height;
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.width,this.height);this.renderer.clear();this.renderer.setScissorTest(true);this.renderer.setScissor(0,this.height-h,w,h);this.renderer.setViewport(0,this.height-h,w,h);this.renderer.render(this.scene,this.camera);this.renderer.setScissorTest(false);
  for(const [el,pos] of [[this.label,this.probe.position],[this.goalLabel,this.points.at(-1)]]){
   const p=projectToDOM(pos.clone().add(V(0,.12,0)),this.camera,w,h);el.style.left=p.x+'px';el.style.top=p.y+'px';el.hidden=!p.visible;
  }
  this.label.hidden=this.time%this.duration<9;this.label.textContent=this.time%this.duration<21?'IK preview':'Tool center';
 }
}

const scenes=[];
for(const figure of document.querySelectorAll('[data-scene]')) {
 try {scenes.push(figure.dataset.scene==='grasp'?new GraspIllustration(figure):figure.dataset.scene==='planning'?new PlanningIllustration(figure):new TriIllustration(figure));}
 catch(error){console.error(error);const label=figure.querySelector('.scene-loading');label.hidden=false;label.textContent='This illustration requires WebGL. Enable hardware acceleration and reload to view the 3D scene.';figure.querySelectorAll('button').forEach(b=>b.disabled=true);}
}
const visibility=new IntersectionObserver(entries=>{
 entries.forEach(e=>{const s=scenes.find(s=>s.figure===e.target);if(s)s.visible=e.isIntersecting;});
},{threshold:.04});
scenes.forEach(s=>visibility.observe(s.figure));
reduced.addEventListener('change',e=>scenes.forEach(s=>{s.paused=e.matches;s.sync();}));
let last=0;
function frame(now) {
 const delta=last?Math.min((now-last)/1000,.05):0;last=now;
 if(!document.hidden) for(const s of scenes) if(s.visible){
  if(!s.paused)s.time+=delta;
  s.update(delta);s.render();
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
