import { flowState, CYCLE_DURATION, DEMO_WINDOWS } from './context-flow-state.mjs?v=14';

const root = document.querySelector('#context-loop');
if(root){
  const loader=new IntersectionObserver(([entry])=>{
    if(!entry.isIntersecting)return;
    loader.disconnect();
    boot(root).catch(error=>{
      console.error('MXI context diagram:',error);
      const status=root.querySelector('[data-lab-loading]');
      status.hidden=false;status.textContent='The interactive diagram could not load. Please reload.';
    });
  },{rootMargin:'300px 0px'});
  loader.observe(root);
}

async function boot(root){
  const [{GraspLabView},data]=await Promise.all([
    import('./grasp-lab-view.js?v=14'),
    fetch(new URL('../assets/arx-x5/grasp-lab.json?v=11',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Trajectories unavailable');return r.json();}),
  ]);
  const find=name=>root.querySelector(`[data-lab-${name}]`);
  const windows=[...root.querySelectorAll('[data-lab-window]')];
  const paths=Object.fromEntries([...root.querySelectorAll('[data-lab-path]')].map(p=>[p.dataset.labPath,p]));
  const workspace=root.querySelector('.lab-workspace');
  const tools=new Set(['wrist']);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const packet=find('photo-packet'),packetCanvas=packet.querySelector('canvas');
  const actionPacket=find('action-packet');
  const observation=find('observation-photo');
  const pending=document.createElement('canvas');pending.width=320;pending.height=200;
  const records=new Map();
  const ionTrace=find('ion-trace');
  const ions=Array.from({length:15},(_,i)=>{
    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('r',String(i===0?3.1:1.7));find('ions').append(circle);return circle;
  });
  let part='pin',layout=1,elapsed=0,last=0,raf=0,visible=false,ready=false;
  let previousStep=-1,received=null,manualWindow=false,referenceImages=[],referencePart=null;
  let lastReference=-1;
  const view=new GraspLabView(root,data,choosePart,()=>{if(ready)draw();});
  const copy=(source,destination)=>destination.getContext('2d').drawImage(source,0,0,destination.width,destination.height);

  function endpoints(){
    const bounds=workspace.getBoundingClientRect();
    const box=element=>{const r=element.getBoundingClientRect();return {x:r.x-bounds.x,y:r.y-bounds.y,w:r.width,h:r.height};};
    const ref=box(find('demo-source')),live=box(find('observation')),memory=box(root.querySelector('.lab-memory'));
    const agent=box(root.querySelector('.lab-agent-portrait')),scene=box(root.querySelector('.lab-stage'));
    const mobile=matchMedia('(max-width:700px)').matches;
    let actionMid,feedbackMid;
    if(mobile){
      const a={x:agent.x+agent.w/2,y:agent.y};
      paths.reference.setAttribute('d',`M${ref.x+ref.w/2} ${ref.y+ref.h} C${ref.x+ref.w/2} ${a.y-20} ${a.x} ${a.y-20} ${a.x} ${a.y}`);
      const side=10,ay=agent.y+agent.h/2;
      paths.observation.setAttribute('d',`M${live.x} ${live.y+live.h/2} H${side} V${ay} H${agent.x}`);
      const sx=scene.x+scene.w*.7,sy=scene.y;
      paths.action.setAttribute('d',`M${agent.x+agent.w} ${agent.y+agent.h} Q${sx} ${sy-30} ${sx} ${sy}`);
      paths.feedback.setAttribute('d',`M${scene.x+scene.w/2} ${scene.y+scene.h} V${live.y-14} H${live.x+live.w/2} V${live.y}`);
      actionMid={x:sx,y:sy-18};feedbackMid={x:scene.x+scene.w/2,y:scene.y+scene.h+18};
    }else{
      const ax=agent.x+agent.w*.16,ay=agent.y+agent.h*.6;
      paths.reference.setAttribute('d',`M${ref.x+ref.w} ${ref.y+ref.h*.5} C${ax-25} ${ref.y+ref.h*.5} ${ax-25} ${ay-24} ${ax} ${ay-24}`);
      paths.observation.setAttribute('d',`M${live.x+live.w} ${live.y+live.h*.5} C${ax-18} ${live.y+live.h*.5} ${ax-20} ${ay+22} ${ax} ${ay+22}`);
      const right=agent.x+agent.w*.88,ry=agent.y+agent.h*.55,sy=scene.y+scene.h*.35;
      paths.action.setAttribute('d',`M${right} ${ry} C${scene.x-16} ${ry} ${scene.x-16} ${sy} ${scene.x} ${sy}`);
      const fy=bounds.height-32,lx=live.x+live.w*.5,sx=scene.x+scene.w*.5;
      paths.feedback.setAttribute('d',`M${sx} ${scene.y+scene.h} V${fy-12} Q${sx} ${fy} ${sx-12} ${fy} H${lx+12} Q${lx} ${fy} ${lx} ${fy-12} V${memory.y+memory.h}`);
      actionMid={x:(right+scene.x)/2,y:Math.min(ry,sy)-20};feedbackMid={x:(sx+lx)/2,y:fy};
    }
    for(const [name,p] of [['action-label',actionMid],['feedback-label',feedbackMid]]){
      find(name).style.left=`${p.x}px`;find(name).style.top=`${p.y}px`;
    }
  }

  function displayWindow(index){
    const [,,label,action,receipt]=DEMO_WINDOWS[index];
    windows.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    copy(referenceImages[index][0],find('example-start'));copy(referenceImages[index][1],find('example-end'));
    find('window-action').textContent=action;
    find('window-receipt').textContent=`Execution receipt · ${receipt}`;
    find('example-start').setAttribute('aria-label',`${label}: starting observation`);
    find('example-end').setAttribute('aria-label',`${label}: resulting observation`);
  }

  function prepare(){
    if(referencePart!==part){
      view.arrange(part,0);
      referenceImages=DEMO_WINDOWS.map(([start,end])=>{
        const canvases=[start,end].map(()=>{const c=document.createElement('canvas');c.width=320;c.height=200;return c;});
        view.thumbnails([start,end],canvases);return canvases;
      });
      windows.forEach((button,i)=>copy(referenceImages[i][0],button.querySelector('canvas')));
      referencePart=part;
    }
    displayWindow(0);
    view.arrange(part,layout);
    records.clear();received=null;previousStep=-1;lastReference=-1;
    for(const name of ['observation-photo']){const c=find(name);c.getContext('2d').clearRect(0,0,c.width,c.height);}
    for(const name of ['anchor','latest']){
      const c=find(name).querySelector('canvas');c.getContext('2d').clearRect(0,0,c.width,c.height);find(name).setAttribute('data-empty','');
    }
    find('observation-label').textContent='Awaiting the first view';
    find('observation-state').textContent='Image + robot state';
    find('observation-receipt').textContent='Waiting for observation';
    root.querySelector('.lab-history-gap').textContent='';
    if(reduced.matches){
      elapsed=CYCLE_DURATION-1;
      for(const time of [0,4.6,8.35,10.6,16]){
        const c=document.createElement('canvas');c.width=320;c.height=200;view.capture(time,c);records.set(time,c);
      }
    }
  }

  function receive(state){
    if(state.observationTime===null||state.observationTime===received)return;
    const shot=records.get(state.observationTime);
    if(!shot)return;
    copy(shot,observation);received=state.observationTime;
    find('observation-label').textContent='Current view';
    const count=state.history.length;
    if(!reduced.matches)root.querySelector('.lab-memory').animate([{boxShadow:'0 0 0 1px #b4f6de, 0 0 24px #8bdfc950'},{boxShadow:'0 0 0 0 transparent'}],{duration:650});
    find('observation-state').textContent=['Hand open · target on stand','Approach completed · hand open','Fingers closed around target','Part lifted and transferred','Hand clear · part supported'][count];
    find('observation-receipt').textContent=count?`Execution receipt · chunk ${count} complete`:'Initial scene · no action yet';
    root.querySelector('.lab-history-gap').textContent=count>2?'···':count===2?'→':'';
    if(count){
      for(const [name,record] of [['anchor',state.history[0]],['latest',state.history.at(-1)]]){
        if(name==='anchor'&&count===1)continue;
        copy(records.get(record.end),find(name).querySelector('canvas'));
        find(name).removeAttribute('data-empty');
      }
    }
  }

  function draw(){
    if(!ready||!view.width)return;
    const state=flowState(elapsed);
    root.dataset.phase=state.kind;
    root.dataset.target=part;
    if(state.step!==previousStep){
      previousStep=state.step;
      find('agent-state').textContent=state.label;
      find('view-status').textContent=state.kind==='action'?state.label:state.kind==='feedback'?'Capture the new observation':state.kind==='complete'?'Placed · released · hand clear':'Await the next action';
      Object.entries(paths).forEach(([name,path])=>path.toggleAttribute('data-active',name===state.kind));
      if(state.kind==='feedback'){
        view.capture(state.robotTime,pending);
        const shot=document.createElement('canvas');shot.width=320;shot.height=200;copy(pending,shot);records.set(state.robotTime,shot);
      }
    }
    receive(state);
    if(state.kind==='reference'&&!manualWindow){
      const index=Math.min(4,Math.floor(state.progress*5));
      if(index!==lastReference){displayWindow(index);lastReference=index;}
    }
    view.render(state.robotTime,tools,false);
    const path=paths[state.kind];
    packet.style.opacity='0';actionPacket.style.opacity='0';find('ions').style.opacity='0';ionTrace.style.opacity='0';
    if(path&&!reduced.matches){
      const progress=state.kind==='reference'?(state.progress*5)%1:state.kind==='action'?Math.min(1,state.progress*5):state.progress;
      const length=path.getTotalLength();
      const point=path.getPointAtLength(length*progress);
      // A brief ion trail follows each actual transmission; nothing persists after arrival.
      const streaming=state.kind!=='action'||state.progress<.2;
      find('ions').style.opacity=streaming?'1':'0';
      ionTrace.setAttribute('d',path.getAttribute('d'));
      ionTrace.style.opacity=streaming?'.8':'0';
      ionTrace.setAttribute('stroke-dashoffset',String(.14-progress));
      ions.forEach((ion,i)=>{
        const distance=length*progress-i*7;
        const p=path.getPointAtLength(Math.max(0,distance));
        ion.setAttribute('cx',p.x);ion.setAttribute('cy',p.y);
        ion.setAttribute('opacity',distance<0?'0':String((1-i/16)*.85));
      });
      if(state.kind==='action'){
        actionPacket.style.opacity=state.progress<.2?'1':'0';
        actionPacket.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
      }else{
        const source=state.kind==='feedback'?pending:state.kind==='reference'?referenceImages[Math.min(4,Math.floor(state.progress*5))][0]:observation;
        copy(source,packetCanvas);
        packet.querySelector('span').textContent=state.kind==='reference'?'Demo window':state.kind==='feedback'?'New observation':'Live context';
        packet.style.opacity=String(Math.min(1,progress*8,(1-progress)*8));
        packet.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
      }
    }
  }

  function tick(now){
    const dt=Math.max(0,Math.min(.08,(now-last)/1000));last=now;
    const next=elapsed+dt;
    if(next>=CYCLE_DURATION){elapsed=next%CYCLE_DURATION;manualWindow=false;prepare();}else elapsed=next;
    draw();raf=requestAnimationFrame(tick);
  }
  function syncPlayback(){
    cancelAnimationFrame(raf);raf=0;
    const active=ready&&visible&&!document.hidden&&!reduced.matches;
    root.toggleAttribute('data-playing',active);
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
    layout=1-layout;find('layout').querySelector('b').textContent=layout?'B':'A';
    find('layout').setAttribute('aria-pressed',String(layout===0));choosePart(part);
  });
  for(const button of root.querySelectorAll('[data-lab-tool]'))button.addEventListener('click',()=>{
    const name=button.dataset.labTool;if(tools.has(name))tools.delete(name);else tools.add(name);
    button.setAttribute('aria-pressed',String(tools.has(name)));draw();
  });
  find('reset').addEventListener('click',()=>view.resetCamera());
  new ResizeObserver(()=>{endpoints();if(ready)draw();}).observe(workspace);
  const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;syncPlayback();},{threshold:0});
  visibility.observe(workspace);
  document.addEventListener('visibilitychange',syncPlayback);
  reduced.addEventListener('change',()=>{if(reduced.matches){elapsed=0;prepare();}syncPlayback();draw();});
  find('canvas').addEventListener('webglcontextlost',event=>{
    event.preventDefault();ready=false;syncPlayback();find('loading').hidden=false;find('loading').textContent='3D rendering was interrupted. Reload to restart.';
  });
  // Let the renderer's ResizeObserver establish its canvas before capturing photos.
  await new Promise(resolve=>requestAnimationFrame(resolve));
  ready=true;prepare();endpoints();draw();find('loading').hidden=true;syncPlayback();
}
