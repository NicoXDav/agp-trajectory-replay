import { flowState, CYCLE_DURATION, DEMO_WINDOWS } from './context-flow-state.mjs?v=15';
const root=document.querySelector('#context-loop');
if(root){
  const loader=new IntersectionObserver(([entry])=>{
    if(!entry.isIntersecting)return;loader.disconnect();
    boot(root).catch(error=>{
      console.error('MXI context diagram:',error);
      const status=root.querySelector('[data-lab-loading]');status.hidden=false;
      status.textContent='The interactive diagram could not load. Please reload.';
    });
  },{rootMargin:'300px 0px'});loader.observe(root);
}

async function boot(root){
  const [{GraspLabView},data]=await Promise.all([
    import('./grasp-lab-view.js?v=15'),
    fetch(new URL('../assets/arx-x5/grasp-lab.json?v=11',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Trajectories unavailable');return r.json();}),
  ]);
  const find=name=>root.querySelector(`[data-lab-${name}]`);
  const windows=[...root.querySelectorAll('[data-lab-window]')];
  const paths=Object.fromEntries([...root.querySelectorAll('[data-lab-path]')].map(p=>[p.dataset.labPath,p]));
  const workspace=root.querySelector('.lab-workspace'),tools=new Set(['wrist']);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const records=new Map(),lengths={};
  let part='pin',layout=1,elapsed=0,last=0,raf=0,visible=false,ready=false;
  let received=null,manualWindow=false,referenceImages=[],referencePart=null,lastReference=-1;
  const view=new GraspLabView(root,data,choosePart,()=>{if(ready)draw();});
  const copy=(source,destination)=>destination.getContext('2d').drawImage(source,0,0,destination.width,destination.height);
  const colors={reference:'#a9d2ff',observation:'#9be6cf',context:'#b9e5dc',action:'#f0d3a7',feedback:'#92e1cb'};
  const streams=Object.fromEntries(Object.keys(paths).map(name=>{
    const group=document.createElementNS('http://www.w3.org/2000/svg','g');
    group.style.color=colors[name];find('streams').append(group);
    const stroke=document.createElementNS(group.namespaceURI,'path');stroke.setAttribute('pathLength','1');stroke.setAttribute('stroke',colors[name]);group.append(stroke);
    const dots=Array.from({length:12},(_,i)=>{
      const dot=document.createElementNS(group.namespaceURI,'circle');dot.setAttribute('r',i%6===0?'2.3':'1.2');dot.setAttribute('fill',colors[name]);group.append(dot);return dot;
    });return [name,{stroke,dots}];
  }));
  function endpoints(){
    const bounds=workspace.getBoundingClientRect();
    const box=e=>{const r=e.getBoundingClientRect();return {x:r.x-bounds.x,y:r.y-bounds.y,w:r.width,h:r.height};};
    const center=e=>{const b=box(e);return {x:b.x+b.w/2,y:b.y+b.h/2};};
    const ref=box(find('demo-source')),live=box(find('observation')),memory=box(root.querySelector('.lab-memory'));
    const shared=box(find('shared-source')),merge=center(find('merge-port'));
    const input=center(find('input-port')),output=center(find('output-port')),scene=box(root.querySelector('.lab-stage'));
    const mobile=matchMedia('(max-width:700px)').matches;
    const horizontal=(a,b)=>`M${a.x} ${a.y} C${(a.x+b.x)/2} ${a.y} ${(a.x+b.x)/2} ${b.y} ${b.x} ${b.y}`;
    let actionLabel,feedbackLabel;
    if(mobile){
      paths.reference.setAttribute('d',`M${ref.x+ref.w/2} ${ref.y+ref.h} C${ref.x+ref.w/2} ${shared.y-18} ${merge.x} ${shared.y-18} ${merge.x} ${merge.y}`);
      paths.observation.setAttribute('d',`M${live.x} ${live.y+live.h/2} H10 V${merge.y+12} Q10 ${merge.y} 22 ${merge.y} H${merge.x}`);
      const gutter=scene.x+scene.w+12,sx=scene.x+scene.w*.65;
      paths.action.setAttribute('d',`M${output.x} ${output.y} H${gutter-8} Q${gutter} ${output.y} ${gutter} ${output.y+8} V${scene.y-20} Q${gutter} ${scene.y-12} ${gutter-8} ${scene.y-12} H${sx+8} Q${sx} ${scene.y-12} ${sx} ${scene.y}`);
      paths.feedback.setAttribute('d',`M${scene.x+scene.w/2} ${scene.y+scene.h} V${memory.y-20} Q${scene.x+scene.w/2} ${memory.y-10} ${memory.x+memory.w/2} ${memory.y}`);
      actionLabel={x:scene.x+scene.w*.34,y:scene.y-14};feedbackLabel={x:scene.x+scene.w/2,y:scene.y+scene.h+23};
    }else{
      paths.reference.setAttribute('d',horizontal({x:ref.x+ref.w,y:ref.y+ref.h/2},merge));
      paths.observation.setAttribute('d',horizontal({x:live.x+live.w,y:live.y+live.h/2},merge));
      paths.action.setAttribute('d',horizontal(output,{x:scene.x,y:output.y}));
      const fy=bounds.height-30,sx=scene.x+scene.w*.5,lx=memory.x+memory.w*.5;
      paths.feedback.setAttribute('d',`M${sx} ${scene.y+scene.h} V${fy-14} Q${sx} ${fy} ${sx-14} ${fy} H${lx+14} Q${lx} ${fy} ${lx} ${fy-14} V${memory.y+memory.h}`);
      actionLabel={x:(output.x+scene.x)/2,y:output.y-18};feedbackLabel={x:(sx+lx)/2,y:fy};
    }
    paths.context.setAttribute('d',horizontal({x:shared.x+shared.w+4,y:shared.y+32},input));
    for(const [name,path] of Object.entries(paths)){
      lengths[name]=path.getTotalLength();streams[name].stroke.setAttribute('d',path.getAttribute('d'));
    }
    for(const [name,point] of [['action-label',actionLabel],['feedback-label',feedbackLabel]]){
      find(name).style.left=`${point.x}px`;find(name).style.top=`${point.y}px`;
    }
  }
  function displayWindow(index){
    const [,,label,action,receipt]=DEMO_WINDOWS[index];
    windows.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    copy(referenceImages[index][0],find('example-start'));copy(referenceImages[index][1],find('example-end'));
    find('window-action').textContent=action;find('window-receipt').textContent=`Receipt · ${receipt}`;
    find('example-start').setAttribute('aria-label',`${label}: starting observation`);
    find('example-end').setAttribute('aria-label',`${label}: resulting observation`);
  }
  function shot(time){
    if(!records.has(time)){
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;
      view.capture(time,canvas);records.set(time,canvas);
    }return records.get(time);
  }
  function prepare(){
    if(referencePart!==part){
      view.arrange(part,0);
      referenceImages=DEMO_WINDOWS.map(([start,end])=>{
        const canvases=[start,end].map(()=>{const c=document.createElement('canvas');c.width=320;c.height=200;return c;});
        view.thumbnails([start,end],canvases);return canvases;
      });
      windows.forEach((button,i)=>copy(referenceImages[i][0],button.querySelector('canvas')));referencePart=part;
    }
    displayWindow(0);copy(referenceImages[0][0],find('shared-demo'));
    view.arrange(part,layout);records.clear();received=null;lastReference=-1;
    copy(shot(0),find('live-start'));copy(shot(0),find('observation-photo'));copy(shot(0),find('shared-live'));
    const anchor=find('anchor'),c=anchor.querySelector('canvas');c.getContext('2d').clearRect(0,0,c.width,c.height);anchor.setAttribute('data-empty','');
    find('observation-label').textContent='Initial observation';find('observation-state').textContent='A new grasp begins.';
    find('observation-receipt').textContent='Images · robot state';root.querySelector('.lab-history-gap').textContent='';
    if(reduced.matches)elapsed=CYCLE_DURATION-.1;
  }
  function receive(state){
    if(state.observationTime===null||state.observationTime===received)return;
    const count=state.history.length,record=state.history.at(-1);
    copy(shot(record?.start??0),find('live-start'));copy(shot(state.observationTime),find('observation-photo'));
    received=state.observationTime;
    find('observation-label').textContent=count?'Latest execution segment':'Initial observation';
    find('observation-state').textContent=['Target on stand · hand open','Approach completed','Fingers closed · ready to lift','Part lifted','Placed, released, and clear'][count];
    find('observation-receipt').textContent=count?'Action + outcome + execution receipt':'Images · robot state';
    root.querySelector('.lab-history-gap').textContent=count>2?'···':count===2?'→':'';
    if(count>=2){copy(shot(state.history[0].end),find('anchor').querySelector('canvas'));find('anchor').removeAttribute('data-empty');}
    if(!reduced.matches)root.querySelector('.lab-latest-pair').animate([{filter:'drop-shadow(0 0 9px #9fe5c888)'},{filter:'drop-shadow(0 0 0 transparent)'}],{duration:550});
  }
  function photoPacket(name,pathName,progress,first,second){
    const packet=find(name),canvas=packet.querySelector('canvas'),ctx=canvas.getContext('2d');
    if(second){
      ctx.fillStyle='#152d3c';ctx.fillRect(0,0,480,150);
      ctx.drawImage(first,0,0,225,150);ctx.drawImage(second,255,0,225,150);
      ctx.strokeStyle='#b8e5d9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(233,75);ctx.lineTo(248,75);ctx.lineTo(242,69);ctx.moveTo(248,75);ctx.lineTo(242,81);ctx.stroke();
    }else copy(first,canvas);
    const point=paths[pathName].getPointAtLength(lengths[pathName]*progress);
    packet.style.opacity=String(Math.min(1,progress*10,(1-progress)*10));
    packet.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
  }
  function draw(){
    if(!ready||!view.width)return;
    const state=flowState(elapsed);root.dataset.target=part;
    root.dataset.phase=state.transfer?'feedback':'continuous';
    find('view-status').textContent=state.label;
    receive(state);
    if(state.referenceProgress<1){
      const index=Math.min(4,Math.floor(state.referenceProgress*5));
      if(index!==lastReference){if(!manualWindow)displayWindow(index);copy(referenceImages[index][0],find('shared-demo'));lastReference=index;}
    }
    // Capture completed records before restoring the continuously moving scene.
    if(state.transfer){shot(state.transfer.start);shot(state.transfer.end);}
    if(state.context)copy(shot(state.context.end),find('shared-live'));
    view.render(state.robotTime,tools,false);
    for(const name of ['demo-packet','feedback-packet','context-packet'])find(name).style.opacity='0';
    if(!reduced.matches){
      if(state.referenceProgress<1){
        const index=Math.min(4,Math.floor(state.referenceProgress*5));
        photoPacket('demo-packet','reference',(state.referenceProgress*5)%1,...referenceImages[index]);
      }
      if(state.transfer)photoPacket('feedback-packet','feedback',state.transfer.progress,shot(state.transfer.start),shot(state.transfer.end));
      if(state.context)photoPacket('context-packet','observation',state.context.progress,shot(state.context.end));
      for(const [name,stream] of Object.entries(streams)){
        const active=name==='feedback'?Boolean(state.transfer):name==='observation'?Boolean(state.context):name==='reference'?state.referenceProgress<1:true;
        paths[name].toggleAttribute('data-active',active);
        const speed=name==='feedback'?1.8:name==='context'?1.2:1.5;
        const pulse=(state.time/speed)%1;
        stream.stroke.setAttribute('stroke-dashoffset',String(.1-pulse));stream.stroke.setAttribute('opacity',active?'.65':'.19');
        stream.dots.forEach((dot,i)=>{
          const progress=((pulse+Math.floor(i/6)*.5-(i%6)*.016)%1+1)%1;
          const point=paths[name].getPointAtLength(lengths[name]*progress);
          dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);
          dot.setAttribute('opacity',String((1-(i%6)/6)*(active ? .9 : .32)));
        });
      }
    }
  }
  function tick(now){
    const dt=Math.max(0,Math.min(.08,(now-last)/1000));last=now;
    elapsed+=dt;if(elapsed>=CYCLE_DURATION){elapsed%=CYCLE_DURATION;manualWindow=false;prepare();}
    draw();raf=requestAnimationFrame(tick);
  }
  function syncPlayback(){
    cancelAnimationFrame(raf);raf=0;
    const active=ready&&visible&&!document.hidden&&!reduced.matches;root.toggleAttribute('data-playing',active);
    if(active){last=performance.now();raf=requestAnimationFrame(tick);}
  }
  function choosePart(id){
    part=id;elapsed=0;manualWindow=false;
    find('demo-title').textContent=data.objects.find(object=>object.id===id).name;
    find('view-label').textContent=`Current episode · ${data.objects.find(object=>object.id===id).name}`;
    if(ready){prepare();draw();syncPlayback();}
  }
  windows.forEach((button,index)=>button.addEventListener('click',()=>{manualWindow=true;displayWindow(index);draw();}));
  find('layout').addEventListener('click',()=>{
    layout=1-layout;find('layout').querySelector('b').textContent=layout?'B':'A';find('layout').setAttribute('aria-pressed',String(layout===0));choosePart(part);
  });
  for(const button of root.querySelectorAll('[data-lab-tool]'))button.addEventListener('click',()=>{
    const name=button.dataset.labTool;if(tools.has(name))tools.delete(name);else tools.add(name);
    button.setAttribute('aria-pressed',String(tools.has(name)));draw();
  });
  find('reset').addEventListener('click',()=>view.resetCamera());
  new ResizeObserver(()=>{endpoints();if(ready)draw();}).observe(workspace);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;syncPlayback();},{threshold:0}).observe(workspace);
  document.addEventListener('visibilitychange',syncPlayback);
  reduced.addEventListener('change',()=>{elapsed=0;prepare();syncPlayback();draw();});
  find('canvas').addEventListener('webglcontextlost',event=>{
    event.preventDefault();ready=false;syncPlayback();find('loading').hidden=false;find('loading').textContent='3D rendering was interrupted. Reload to restart.';
  });
  ready=true;prepare();endpoints();draw();find('loading').hidden=true;syncPlayback();
}
