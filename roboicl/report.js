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
frameButtons.forEach(button => button.addEventListener('click', () => {
  current = button.dataset.frame;
  const held = current === 'hold';
  image.src = '../assets/observations/' + current + '.webp';
  image.alt = held ? 'Purple pen between the left pads at step 266' : 'Purple pen to the right of the left grasp center at step 87';
  document.querySelector('#live-camera').textContent = 'Left wrist · step ' + (held ? 266 : 87);
  caption.textContent = held ? 'At step 266 the left pads flank the purple pen. Compare its position against the red cross in both hands.' : 'The expert holds the pen between the right pads. At step 87 the pen is still to the right of the other hand’s cross.';
  frameButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  showPoses();
}));
fetch('../assets/observations/frames.json').then(r => r.json()).then(data => { frames = data; showPoses(); }).catch(() => { poses.textContent = 'Pose data could not be loaded.'; });
const detailButton = document.querySelector('#crop-mode');
detailButton.addEventListener('click', () => {
  const enabled = document.querySelector('.observation-pair').toggleAttribute('data-detail');
  detailButton.setAttribute('aria-pressed', String(enabled));
});
