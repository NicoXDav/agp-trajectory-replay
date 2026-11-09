const root = document.querySelector('#context-loop');

if (root) {
  const load = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    load.disconnect();
    boot(root).catch(error => {
      console.error('Could not open the MXI grasp workbench', error);
      root.querySelector('[data-lab-loading]').textContent = 'The 3D workbench could not load. Reload to try again.';
    });
  }, {rootMargin:'300px 0px'});
  load.observe(root);
}

const WINDOWS = [
  [3.25,4.6,'Approach','Move above the part.','Approach completed · hand open.'],
  [6.1,7.45,'Align','Refine alignment and lower the wrist.','Grasp height reached.'],
  [8.95,10.3,'Lift','Raise the closed gripper.','Part lifted with the hand.'],
  [11.8,13.15,'Place','Lower onto the receiving stand.','Part supported · opening begins.'],
  [14.65,16,'Retract','Withdraw the open gripper.','Hand clear · part stays on stand.'],
];
const STAGES = [
  [0,'Read the reference','Sample the fixed demonstration','reference'],
  [1.65,'Observe the layout','Locate the selected part in the current scene','observation'],
  [3.25,'Send an approach','Move toward the observed target','action'],
  [4.6,'Observe and correct','Use the latest view to refine alignment','return'],
  [7.5,'Close the gripper','Aligned · close the fingers around the part','action'],
  [8.35,'Verify the lift','Feed the new observation back into history','feedback'],
  [10.6,'Place and release','Transfer, support, and release the part','action'],
  [15.1,'Keep the outcome','Part placed · hand clear','feedback'],
];

async function boot(root) {
  const [{GraspLabView},data] = await Promise.all([
    import('./grasp-lab-view.js?v=11'),
    fetch(new URL('../assets/arx-x5/grasp-lab.json?v=11',import.meta.url)).then(response => {
      if (!response.ok) throw new Error('Grasp trajectories unavailable');
      return response.json();
    }),
  ]);
  const find = name => root.querySelector(`[data-lab-${name}]`);
  const parts = [...root.querySelectorAll('[data-lab-part]')];
  const windows = [...root.querySelectorAll('[data-lab-window]')];
  const toolButtons = [...root.querySelectorAll('[data-lab-tool]')];
  const paths = Object.fromEntries([...root.querySelectorAll('[data-lab-path]')].map(path=>[path.dataset.labPath,path]));
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const tools = new Set(['wrist']);
  const slider = find('time'), play = find('play');
  let part = 'pin', layout = 0, liveTime = 0, demoTime = 0, demo = null;
  let playing = false, visible = false, tickId = 0, lastTick = 0;
  let shownStage = -1, thumbnailsFor = '';
  const view = new GraspLabView(root,data,choosePart,()=>{if(view.width)draw();});
  const thumbCanvases = windows.map(button=>button.querySelector('canvas'));
  const lengths = Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,path.getTotalLength()]));

  function clock(value) { return `00:${String(Math.floor(value+.0001)).padStart(2,'0')}`; }

  function readouts(time) {
    const index = STAGES.findLastIndex(([start])=>time>=start);
    const [start,agent,caption,flow] = STAGES[index];
    if (shownStage!==index) {
      shownStage=index;root.dataset.stage=index;
      find('agent-state').textContent=agent;
      find('view-status').textContent=caption;
      Object.entries(paths).forEach(([name,path])=>path.toggleAttribute('data-active',name===flow));
      find('flow-trail').setAttribute('d',paths[flow].getAttribute('d'));
    }
    const pulse=((time-start)/1.15)%1;
    const p=paths[flow].getPointAtLength(lengths[flow]*pulse);
    find('flow-packet').setAttribute('transform',`translate(${p.x} ${p.y})`);
    find('flow-trail').setAttribute('stroke-dashoffset',.25-pulse);
    find('anchor').disabled=liveTime<4.6;
    find('latest').disabled=liveTime<6.2;
    const memory=liveTime>=15.1?'Latest · released and clear':liveTime>=9.9?'Latest · part lifted':liveTime>=6.2?'Latest · alignment corrected':liveTime>=4.6?'Anchor · approach complete':'Executed results will appear here.';
    if(find('memory-note').textContent!==memory)find('memory-note').textContent=memory;
  }

  function draw() {
    if (!view.width) return;
    if (thumbnailsFor!==part) {
      view.arrange(part,0);view.thumbnails(WINDOWS.map(([start])=>start),thumbCanvases);
      view.arrange(part,demo===null?layout:0);thumbnailsFor=part;
    }
    const time = demo===null?liveTime:demoTime;
    readouts(demo===null?time:0);
    view.render(time,tools,demo!==null);
    slider.value=time;
    find('clock').textContent=`${clock(time)} / ${clock(data.duration)}`;
    if(demo!==null){
      const [start,end,title,action,receipt]=WINDOWS[demo];
      find('view-status').textContent=`Reference · ${title}`;
      const description=`${clock(start)}–${clock(end)} · ${title}`;
      if(find('window-note').textContent!==description){
        find('window-note').textContent=description;find('window-action').textContent=action;find('window-receipt').textContent=receipt;
      }
      find('demo-start').setAttribute('aria-pressed',String(time<=start+.02));
      find('demo-end').setAttribute('aria-pressed',String(time>=end-.02));
    }
  }

  function setPlaying(value) {
    playing=value;play.textContent=playing?'Pause':'Play';
    root.toggleAttribute('data-playing',playing&&demo===null);
    cancelAnimationFrame(tickId);
    if(playing&&visible){lastTick=performance.now();tickId=requestAnimationFrame(tick);}
  }

  function tick(now) {
    const dt=Math.min(.08,(now-lastTick)/1000);lastTick=now;
    if(demo===null)liveTime=Math.min(data.duration,liveTime+dt);
    else demoTime=Math.min(WINDOWS[demo][1],demoTime+dt);
    draw();
    const end=demo===null?liveTime>=data.duration:demoTime>=WINDOWS[demo][1];
    if(end)setPlaying(false);else if(playing&&visible)tickId=requestAnimationFrame(tick);
  }

  function selectView() {
    view.arrange(part,demo===null?layout:0);
    root.dataset.view=demo===null?'live':'demo';
    find('inspector').hidden=demo===null;
    find('view-label').textContent=demo===null?'Current episode':'Fixed demonstration';
    find('demo-note').textContent=layout===0?'One example, sampled across time.':'Same reference · the live layout has changed.';
    windows.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===demo)));
    slider.min=demo===null?0:WINDOWS[demo][0];slider.max=demo===null?data.duration:WINDOWS[demo][1];
    shownStage=-1;
    draw();
  }

  function choosePart(id) {
    setPlaying(false);part=id;demo=null;liveTime=0;
    parts.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.labPart===id)));
    find('demo-title').textContent=data.objects.find(object=>object.id===id).name;
    selectView();
  }

  parts.forEach(button=>button.addEventListener('click',()=>choosePart(button.dataset.labPart)));
  find('layout').addEventListener('click',()=>{
    layout=1-layout;find('layout').querySelector('b').textContent=layout?'B':'A';
    find('layout').setAttribute('aria-pressed',String(layout===1));choosePart(part);
  });
  windows.forEach((button,index)=>{
    button.style.setProperty('--window',index);
    button.addEventListener('click',()=>{
      setPlaying(false);demo=index;demoTime=WINDOWS[index][0];selectView();
    });
  });
  find('demo-start').addEventListener('click',()=>{setPlaying(false);demoTime=WINDOWS[demo][0];draw();});
  find('demo-end').addEventListener('click',()=>{setPlaying(false);demoTime=WINDOWS[demo][1];draw();});
  find('return').addEventListener('click',()=>{setPlaying(false);demo=null;selectView();});
  toolButtons.forEach(button=>button.addEventListener('click',()=>{
    const name=button.dataset.labTool;
    if(tools.has(name))tools.delete(name);else tools.add(name);
    button.setAttribute('aria-pressed',String(tools.has(name)));draw();
  }));
  find('reset').addEventListener('click',()=>view.resetCamera());
  slider.addEventListener('input',()=>{setPlaying(false);if(demo===null)liveTime=Number(slider.value);else demoTime=Number(slider.value);draw();});
  play.addEventListener('click',()=>{
    if(playing){setPlaying(false);return;}
    if(demo===null&&liveTime>=data.duration)liveTime=0;
    if(demo!==null&&demoTime>=WINDOWS[demo][1])demoTime=WINDOWS[demo][0];
    setPlaying(true);draw();
  });
  find('next').addEventListener('click',()=>{
    setPlaying(false);
    if(demo!==null)demoTime=WINDOWS[demo][1];
    else liveTime=(STAGES.find(([start])=>start>liveTime+.02)||[data.duration])[0];
    draw();
  });
  for(const [name,time] of [['anchor',4.6],['latest',null]])find(name).addEventListener('click',()=>{
    setPlaying(false);demo=null;
    liveTime=time??(liveTime>=15.1?15.1:liveTime>=9.9?9.9:6.2);
    selectView();
  });
  const observer = new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;
    if(!visible)setPlaying(false);
  },{threshold:0});
  observer.observe(root.querySelector('.lab-workspace'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
  motionPreference.addEventListener('change',()=>{if(motionPreference.matches)setPlaying(false);});
  find('canvas').addEventListener('webglcontextlost',event=>{
    event.preventDefault();setPlaying(false);find('loading').hidden=false;
    find('loading').textContent='3D rendering was interrupted. Reload to restart.';
  });
  choosePart(part);
  find('loading').hidden=true;
}
