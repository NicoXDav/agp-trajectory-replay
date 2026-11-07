const contents = document.querySelector('.contents');
const contentsToggle = document.querySelector('.contents-toggle');
const links = [...contents.querySelectorAll('a[href^="#"]')];
contentsToggle.addEventListener('click', () => {
  const open = contents.classList.toggle('open');
  contentsToggle.setAttribute('aria-expanded', String(open));
  contentsToggle.querySelector('span').textContent = open ? '−' : '＋';
});
links.forEach(link => link.addEventListener('click', () => {
  contents.classList.remove('open');
  contentsToggle.setAttribute('aria-expanded', 'false');
  contentsToggle.querySelector('span').textContent = '＋';
}));
const targets = links.map(link => document.querySelector(link.hash));
let pending = false;
function highlightSection() {
  const threshold = Math.min(200, innerHeight * .25);
  let current = 0;
  targets.forEach((target, index) => {
    if (target.getBoundingClientRect().top <= threshold) current = index;
  });
  links.forEach((link, index) => {
    link.classList.toggle('active', index === current);
    if (index === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  pending = false;
}
addEventListener('scroll', () => {
  if (!pending) { pending = true; requestAnimationFrame(highlightSection); }
}, {passive:true});
addEventListener('resize', highlightSection);
highlightSection();

const reel = document.getElementById('showcase-video');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (reduceMotion.matches) { reel.autoplay = false; reel.pause(); }
// Pause off-screen playback without overriding a visitor's explicit pause.
let resumeOnReturn = false;
const reelObserver = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) {
    resumeOnReturn = !reel.paused;
    reel.pause();
  } else if (resumeOnReturn && !reduceMotion.matches) {
    resumeOnReturn = false;
    reel.play().catch(() => {});
  }
}, {threshold:.1});
reelObserver.observe(reel);
