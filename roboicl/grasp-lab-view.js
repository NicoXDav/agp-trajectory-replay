import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createArm, motion } from './arx.js?v=21';
import { triangulateRays } from './ray-geometry.mjs';

const vector = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const matte = (color, metalness = .25, roughness = .42) => new THREE.MeshStandardMaterial({color, metalness, roughness});
const marker = color => new THREE.MeshBasicMaterial({color});

function mesh(parent, geometry, material, position = [0, 0, 0]) {
  const part = new THREE.Mesh(geometry, material);
  part.position.fromArray(position);
  part.castShadow = material.isMeshStandardMaterial;
  part.receiveShadow = part.castShadow;
  parent.add(part);
  return part;
}

function box(parent, size, material, position, bevel = .014) {
  return mesh(parent, new RoundedBoxGeometry(...size, 2, bevel), material, position);
}

function ring(parent, radius, color) {
  const object = mesh(parent, new THREE.TorusGeometry(radius, .003, 8, 48), marker(color));
  object.rotation.x = -Math.PI / 2;
  return object;
}

function cylinder(parent, r1, r2, length, material, z) {
  const object = mesh(parent, new THREE.CylinderGeometry(r1, r2, length, 32), material, [0, 0, z]);
  object.rotation.x = Math.PI / 2;
}

function buildPart(scene, spec) {
  const group = new THREE.Group();
  scene.add(group);
  const bright = matte(0xa8c2d2, .77, .23);
  const gunmetal = matte(0x354e63, .75, .29);
  if (spec.id === 'pin') {
    cylinder(group, .049, .049, .252, bright, 0);
    cylinder(group, .042, .049, .039, bright, .1455);
    cylinder(group, .049, .042, .039, bright, -.1455);
    for (const z of [-.112, .112]) cylinder(group, .049, .049, .014, gunmetal, z);
  } else if (spec.id === 'usb') {
    box(group, [.134,.054,.202], matte(0xc87d38,.53,.33), [0,0,-.029], .008);
    box(group, [.09,.038,.06], bright, [0,0,.1], .004);
    box(group, [.073,.006,.09], matte(0x293c4c,.52,.29), [0,.023,-.037], .003);
    box(group, [.032,.002,.009], marker(0xe6bf82), [0,.026,-.063], .001);
  } else {
    const shape = new THREE.Shape();
    for (let i=0; i<6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      shape[i ? 'lineTo' : 'moveTo'](.067*Math.cos(a), .067*Math.sin(a));
    }
    shape.closePath();
    const bore = new THREE.Path();
    bore.absarc(0, 0, .033, 0, 2*Math.PI, true);
    shape.holes.push(bore);
    const geometry = new THREE.ExtrudeGeometry(shape, {depth:.21, bevelEnabled:false, curveSegments:24});
    geometry.translate(0,0,-.105);
    mesh(group, geometry, matte(0x7398b8,.75,.25));
    for (const z of [-.103,.103]) mesh(group,new THREE.TorusGeometry(.034,.002,8,32),bright,[0,0,z]);
  }
  return group;
}

export function frameAt(data, sequence, time) {
  const position = THREE.MathUtils.clamp(time * data.rate, 0, sequence.frames.length - 1);
  const start = Math.floor(position), end = Math.min(start + 1, sequence.frames.length - 1);
  return sequence.frames[start].map((value, i) => THREE.MathUtils.lerp(value, sequence.frames[end][i], position - start));
}

export class GraspLabView {
  constructor(root, data, selectPart, redraw) {
    this.data = data;
    this.root = root;
    this.stage = root.querySelector('.lab-stage');
    this.canvas = root.querySelector('[data-lab-canvas]');
    this.target = root.querySelector('[data-lab-target]');
    this.wrist = root.querySelector('[data-lab-wrist]');
    this.wristContext = root.querySelector('[data-lab-wrist-canvas]').getContext('2d');
    this.toolResult = root.querySelector('[data-lab-tool-result]');
    this.renderer = new THREE.WebGLRenderer({canvas:this.canvas, antialias:true, powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14212e);
    this.scene.fog = new THREE.Fog(0x14212e, 7, 13);
    const generator = new THREE.PMREMGenerator(this.renderer), room = new RoomEnvironment();
    this.scene.environment = generator.fromScene(room, .04).texture;
    this.scene.environmentIntensity = .77;
    generator.dispose(); room.dispose();
    this.scene.add(new THREE.HemisphereLight(0xcbdff5, 0x2f343a, 1.65));
    const light = new THREE.DirectionalLight(0xffe7ce, 3.15);
    light.position.set(-2.5, 5, 3);light.castShadow=true;light.shadow.mapSize.set(1024,1024);
    Object.assign(light.shadow.camera,{left:-2.6,right:2.6,bottom:-2.2,top:2.2,near:.1,far:12});
    light.shadow.bias=-.00015;light.shadow.normalBias=.012;this.scene.add(light);
    const rim = new THREE.DirectionalLight(0x92c9ff, 2.8);
    rim.position.set(3, 3, -4); this.scene.add(rim);

    const steel=matte(0x364b5d,.55,.37), deck=matte(0x516471,.46,.45);
    box(this.scene,[3.38,.13,2.46],deck,[0,-.065,.05],.027);
    box(this.scene,[3.47,.10,2.53],steel,[0,-.151,.05],.04);
    for (const x of [-1.45,1.45]) for (const z of [-.88,.97]) box(this.scene,[.12,.87,.12],steel,[x,-.62,z]);
    box(this.scene,[2.91,.008,.018],marker(0x66abbb),[0,-.133,1.32],.002);
    const ground = mesh(this.scene,new THREE.PlaneGeometry(30,30),matte(0x21303e,.05,.8),[0,-1.05,0]);
    ground.rotation.x=-Math.PI/2;ground.castShadow=false;
    const grid = new THREE.GridHelper(2.4,24,0x8799a7,0x78909e);
    grid.position.set(0,.001,.05);grid.material.transparent=true;grid.material.opacity=.21;this.scene.add(grid);
    const rails=matte(0x2d4659,.66,.34);
    for(const x of [-1.55,1.55]) box(this.scene,[.049,1.66,.049],rails,[x,.83,-1.02],.006);
    box(this.scene,[3.14,.052,.06],rails,[0,1.67,-1.02],.007);
    this.cameras = [-.83,.87].map(x => {
      const camera = new THREE.PerspectiveCamera(64,1,.02,9);
      const mount=new THREE.Group();mount.position.set(x,1.62,-.97);mount.lookAt(0,.14,.55);this.scene.add(mount);
      box(mount,[.19,.08,.075],steel,[0,0,0],.012);
      box(mount,[.11,.040,.005],marker(x<0?0x8ac9fb:0x95e7cd),[0,0,.04],.005);
      camera.position.copy(mount.localToWorld(vector(0,0,.046)));camera.lookAt(0,.14,.55);camera.updateMatrixWorld();
      return camera;
    });

    this.arm=createArm(this.scene,motion.leftBase,0xa0f1db);
    this.idle=createArm(this.scene,data.rightBase,0x9ac9f8);this.idle.pose(motion.idle,.041);
    this.ghost=createArm(this.scene,motion.leftBase,0x9ac9f8);
    const ghostMaterial = new THREE.MeshBasicMaterial({color:0x7bd4f6,transparent:true,opacity:.23,depthWrite:false});
    this.ghost.root.traverse(object=>{if(object.isMesh){object.material=ghostMaterial;object.castShadow=false;object.receiveShadow=false;}});
    this.ghost.root.visible=false;

    this.parts = data.objects.map(spec => ({
      ...spec, object:buildPart(this.scene,spec),
      stand:box(this.scene,[.045,data.support,.107],rails,[0,data.support/2,0],.006),
      halo:ring(this.scene,.103,0xb1f3dd),
    }));
    this.destination=box(this.scene,[.045,data.support,.107],rails,[0,data.support/2,0],.006);
    this.destinationRing=ring(this.scene,.114,0xe7bd84);
    this.route=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0x7adbf4,dashSize:.025,gapSize:.016,transparent:true,opacity:.85}));
    this.scene.add(this.route);
    this.nodes=Array.from({length:5},()=>mesh(this.scene,new THREE.SphereGeometry(.012,12,8),marker(0xa6eaff)));
    this.rays=[0x8bc5ff,0x9cebc8].map(color=>{
      const geometry = new THREE.BufferGeometry().setFromPoints([vector(),vector()]);
      const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.88,depthTest:false}));
      line.frustumCulled=false;line.renderOrder=6;this.scene.add(line);return line;
    });
    this.intersection=mesh(this.scene,new THREE.SphereGeometry(.018,16,10),new THREE.MeshBasicMaterial({color:0xbaffda,depthTest:false}));
    this.intersection.renderOrder=7;

    // Presentation overlays belong to the spectator view, not the robot's cameras.
    for (const overlay of [this.route,this.intersection,...this.nodes,...this.rays,this.destinationRing,...this.parts.map(part=>part.halo)]) overlay.layers.set(1);
    this.ghost.root.traverse(object=>object.layers.set(1));
    this.camera=new THREE.PerspectiveCamera(36,1,.01,22);
    this.camera.layers.enable(1);
    this.wristCamera=new THREE.PerspectiveCamera(72,232/160,.008,12);
    this.controls=new OrbitControls(this.camera,this.canvas);
    this.controls.enablePan=false;this.controls.minDistance=2.8;this.controls.maxDistance=7;this.controls.minPolarAngle=.38;this.controls.maxPolarAngle=1.36;
    this.resetCamera();
    this.controls.addEventListener('change',redraw);
    this.resize = new ResizeObserver(() => {
      this.width=this.stage.clientWidth;this.height=this.stage.clientHeight;
      this.renderer.setSize(this.width,this.height,false);
      this.camera.aspect=this.width/Math.max(1,this.height);
      this.camera.fov=this.width<450?46:36;
      this.camera.updateProjectionMatrix();redraw();
    });
    this.resize.observe(this.stage);

    let start;
    this.canvas.addEventListener('pointerdown',event=>{ start=[event.clientX,event.clientY]; });
    this.canvas.addEventListener('pointerup',event=>{
      if(!start||Math.hypot(event.clientX-start[0],event.clientY-start[1])>6)return;
      const rect=this.canvas.getBoundingClientRect();
      const ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height),this.camera);
      const candidates=this.parts.map(part=>{
        const point=ray.ray.intersectBox(new THREE.Box3().setFromCenterAndSize(part.object.position,vector(...part.size).addScalar(.05)),vector());
        return {id:part.id,distance:point?point.distanceTo(ray.ray.origin):Infinity};
      }).sort((a,b)=>a.distance-b.distance);
      if(Number.isFinite(candidates[0].distance))selectPart(candidates[0].id);
    });
    this.canvas.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(event.key))return;
      event.preventDefault();
      const orbit=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
      if(event.key==='ArrowLeft')orbit.theta-=.12;if(event.key==='ArrowRight')orbit.theta+=.12;
      if(event.key==='ArrowUp')orbit.phi-=.1;if(event.key==='ArrowDown')orbit.phi+=.1;
      if(event.key==='+')orbit.radius-=.24;if(event.key==='-')orbit.radius+=.24;
      orbit.phi=THREE.MathUtils.clamp(orbit.phi,.38,1.36);orbit.radius=THREE.MathUtils.clamp(orbit.radius,2.8,7);
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(orbit));this.controls.update();
    });
  }

  resetCamera() {
    this.camera.position.set(1.8,2.64,4.42);
    this.controls.target.set(0,.54,.09);this.controls.update();
  }

  arrange(id, layout) {
    this.sequence=this.data.layouts[layout][id];
    for(const part of this.parts){
      part.object.position.fromArray(this.data.layouts[layout][part.id].pick);
      part.stand.position.x=part.object.position.x;part.stand.position.z=part.object.position.z;
      part.halo.position.set(part.stand.position.x,.008,part.stand.position.z);part.halo.visible=part.id===id;
    }
    const place=vector(...this.sequence.place);
    this.destination.position.set(place.x,this.data.support/2,place.z);this.destinationRing.position.set(place.x,.007,place.z);
    const points=Array.from({length:45},(_,i)=>vector(...frameAt(this.data,this.sequence,3.25+(7.5-3.25)*i/44).slice(7,10)));
    this.route.geometry.dispose();this.route.geometry=new THREE.BufferGeometry().setFromPoints(points);this.route.computeLineDistances();
    this.nodes.forEach((node,i)=>node.position.copy(points[i*11]));
    this.active=this.parts.find(part=>part.id===id);
    const target=vector(...this.sequence.pick);
    const directions=this.cameras.map(camera=>target.clone().project(camera).unproject(camera).sub(camera.position).toArray());
    const estimate=triangulateRays(this.cameras.map(camera=>camera.position.toArray()),directions);
    this.intersection.position.fromArray(estimate);
    this.rays.forEach((line,i)=>{
      const a=line.geometry.attributes.position;
      a.setXYZ(0,...this.cameras[i].position);a.setXYZ(1,...estimate);a.needsUpdate=true;
    });
  }

  thumbnails(times, canvases) {
    const camera = new THREE.PerspectiveCamera(37,64/40,.01,20);
    const target = vector(...this.sequence.pick);
    camera.position.copy(target).add(vector(.68,.82,1.08));camera.lookAt(target.clone().add(vector(0,.16,0)));
    this.rays.forEach(ray=>{ray.visible=false;});this.intersection.visible=false;
    this.route.visible=false;this.ghost.root.visible=false;this.nodes.forEach(node=>{node.visible=false;});
    const dpr=this.renderer.getPixelRatio();
    times.forEach((time,i)=>{
      const frame=frameAt(this.data,this.sequence,time);
      this.arm.pose(frame.slice(0,6),frame[6]);this.active.object.position.fromArray(frame.slice(10,13));
      this.renderer.setViewport(0,0,64,40);this.renderer.render(this.scene,camera);
      canvases[i].getContext('2d').drawImage(this.canvas,0,this.canvas.height-40*dpr,64*dpr,40*dpr,0,0,64,40);
    });
  }

  render(time, tools, reference) {
    if(!this.width||!this.height)return;
    const frame=frameAt(this.data,this.sequence,time);
    this.arm.pose(frame.slice(0,6),frame[6]);this.active.object.position.fromArray(frame.slice(10,13));
    const rays=tools.has('tri')&&!reference&&time<8.35;
    this.rays.forEach(ray=>{ray.visible=rays;});this.intersection.visible=rays;
    const route=tools.has('plan')&&!reference&&time<8.35;
    this.route.visible=route;this.nodes.forEach(node=>{node.visible=route;});
    this.ghost.root.visible=route&&time<3.25;
    if(this.ghost.root.visible){const q=frameAt(this.data,this.sequence,3.7+3.8*THREE.MathUtils.clamp((time-1.15)/2.1,0,1));this.ghost.pose(q.slice(0,6),q[6]);}
    const result=route&&time<3.25?'IK preview · route sampled':rays?'Two calibrated rays · target localized':'';
    this.toolResult.hidden=!result;this.toolResult.textContent=result;

    const wrist=tools.has('wrist')&&!reference&&time>=2.1&&time<9.9;
    this.wrist.hidden=!wrist;
    if(wrist)this.renderWrist();
    this.renderer.setViewport(0,0,this.width,this.height);this.renderer.render(this.scene,this.camera);
    const label=this.active.object.position.clone().add(vector(0,.14,0)).project(this.camera);
    this.target.hidden=Math.abs(label.x)>.91||Math.abs(label.y)>.84||label.z>1;
    this.target.textContent=this.active.name;
    this.target.style.left=`${(label.x/2+.5)*100}%`;this.target.style.top=`${(.5-label.y/2)*100}%`;
  }

  renderWrist() {
    this.arm.cameraPose(this.wristCamera);
    const {renderer,wristCamera}=this;
    const w=232,h=160,dpr=renderer.getPixelRatio();
    renderer.setViewport(0,0,w,h);renderer.render(this.scene,wristCamera);
    this.wristContext.drawImage(renderer.domElement,0,renderer.domElement.height-h*dpr,w*dpr,h*dpr,0,0,w,h);
    const imagePoint=point=>{const p=point.clone().project(wristCamera);return [w*(p.x*.5+.5),h*(.5-p.y*.5)];};
    const [x,y]=imagePoint(this.arm.tcp.getWorldPosition(vector()));
    const [tx,ty]=imagePoint(this.active.object.position);
    const visible=tx>0&&ty>0&&tx<w&&ty<h;
    const offset=Math.hypot(x-tx,y-ty);
    this.wrist.querySelector('[data-lab-reticle]').setAttribute('d',`M${x-11} ${y}h22M${x} ${y-11}v22`);
    const target=this.wrist.querySelector('[data-lab-target-dot]');target.setAttribute('cx',tx);target.setAttribute('cy',ty);target.style.visibility=visible?'visible':'hidden';
    const line=this.wrist.querySelector('[data-lab-offset-line]');
    for(const [key,value] of Object.entries({x1:x,y1:y,x2:tx,y2:ty}))line.setAttribute(key,value);
    line.style.visibility=visible&&offset>4?'visible':'hidden';
    this.wrist.querySelector('[data-lab-wrist-readout]').textContent=visible?(offset<4?'Aligned in view':`Offset · ${Math.round(offset)} px`):'Target outside view';
  }
}
