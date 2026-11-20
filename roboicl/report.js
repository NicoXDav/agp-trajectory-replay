const image = document.querySelector('#current-wrist');
const frameButtons = [...document.querySelectorAll('[data-frame]')];
const caption = document.querySelector('#wrist-caption');
const poses = document.querySelector('#wrist-poses');
let current = 'approach';
let frames;
function showPoses() {
  if (!frames) return;
  poses.replaceChildren(...['expert', current].map(key => {
    const frame = frames[key];
    const block = document.createElement('pre');
    const matrix = frame.pose.map(row => row.map(v => v.toFixed(4).padStart(8)).join(' ')).join('\n');
    block.textContent = (key === 'expert' ? 'Expert' : 'Current') + ' · ' + frame.side + ' wrist · step ' + frame.step + '\n' + matrix;
    return block;
  }));
}
const study = document.querySelector('.observation-study');
const cueButtons = [...study.querySelectorAll('button[data-wrist-cue]')];
const cueCopy = {
  center: ['Projected grasp center', 'The red cross gives both grasps the same nominal reference. Compare the pen’s position relative to it.'],
  pads: ['Inner finger-pad edges', 'The cyan guides show the inner pad edges. Their spacing changes with gripper opening; the live views use measured finger joints.'],
  target: ['Purple pen · reader outline', 'The outline identifies the purple pen in each recorded view. Its position changes relative to the robot’s grasp references.']
};
function showAnnotations() {
  if (!frames) return;
  for (const [slot,key] of [['expert','expert'],['current',current]]) {
    const frame = frames[key], [u,v] = frame.uv;
    const edges = frame.padEdges.map(edge => 'M'+edge[0].join(' ')+' L'+edge[1].join(' ')).join(' ');
    const target = frame.readerTargetOutline.map(p=>p.join(',')).join(' ');
    study.querySelector('[data-wrist-annotation="'+slot+'"]').innerHTML =
      '<g data-cue="center"><circle class="center-halo" cx="'+u+'" cy="'+v+'" r="26"/><circle class="center-ring" cx="'+u+'" cy="'+v+'" r="21"/></g>'+
      '<g data-cue="pads"><path class="pad-halo" d="'+edges+'"/><path class="pad-emphasis" d="'+edges+'"/></g>'+
      '<g data-cue="target"><polygon points="'+target+'"/></g>';
  }
}
cueButtons.forEach(button=>button.addEventListener('click',()=>{
  const cue=button.dataset.wristCue;
  study.dataset.wristCue=cue;
  cueButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  study.querySelectorAll('.wrist-feature-label').forEach(label=>label.textContent=cueCopy[cue][0]);
  study.querySelector('[data-wrist-cue-note]').textContent=cueCopy[cue][1];
}));
frameButtons.forEach(button => button.addEventListener('click', () => {
  current = button.dataset.frame;
  const held = current === 'hold';
  image.src = '../assets/observations/' + current + '.webp';
  image.alt = held ? 'Purple pen between the left finger pads at step 266' : 'Purple pen to the right of the left grasp center at step 87';
  document.querySelector('#live-camera').textContent = 'Left wrist · step ' + (held ? 266 : 87);
  caption.textContent = held ? 'At step 266, the pen is between the left finger pads. The projected grasp center provides the same reference for comparing this view with the expert’s right-hand grasp.' : 'The expert’s right hand holds the pen. At step 87 in the current episode, the pen lies to the right of the left hand’s projected grasp center.';
  frameButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  showPoses();showAnnotations();
}));
Promise.all([
  fetch('../assets/observations/frames.json').then(r=>r.json()),
  fetch('../assets/observations/wrist-highlights.json').then(r=>r.json())
]).then(([data,highlights])=>{
  frames=Object.fromEntries(Object.entries(data).map(([key,frame])=>[key,{...frame,...highlights[key]}]));
  showPoses();showAnnotations();
}).catch(()=>{poses.textContent='Pose data could not be loaded.';});
const detailButton = document.querySelector('#crop-mode');
detailButton.addEventListener('click', () => {
  const enabled = document.querySelector('.observation-pair').toggleAttribute('data-detail');
  detailButton.setAttribute('aria-pressed', String(enabled));
});
