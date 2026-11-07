const themeButton = document.querySelector('.theme-toggle');
function updateTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  themeButton.setAttribute('aria-pressed', String(dark));
  document.querySelector('meta[name="theme-color"]').content = dark ? '#000000' : '#ffffff';
}
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('mxi-theme', theme); } catch {}
  updateTheme();
});
updateTheme();


const fmt = n => Number(n.toFixed(1)).toString();
const studies = [
  {name:'Stack Bowls', r:[100,100], q:[100,50], n:'2 paired layouts'},
  {name:'Pack Objects', r:[30,25], q:[50,12.5], n:'2 paired layouts'},
  {name:'Insert Tubes', r:[160/3,80/3], q:[160/3,20], n:'3 initial paired layouts'}
].map(d => {
  const roboDrop=d.r[0]-d.r[1], q0Drop=d.q[0]-d.q[1];
  const saved=fmt(q0Drop-roboDrop);
  return {...d, headline:'+'+saved, label:'points less decline than Q0',
    advantage:saved+'-point smaller drop',
    detail:'RoboICL drops '+fmt(roboDrop)+' points; Q0 drops '+fmt(q0Drop)+'.'};
});
document.getElementById('ablation-chart').innerHTML = studies.map(d => {
  const x = n => 25 + n * 2.68;
  const rows = [['RoboICL',d.r,'var(--accent)'],['Q0',d.q,'var(--muted)']].map(([name,v,c],i) => {
    const y = 88 + i*92;
    return '<text x="25" y="'+(y-26)+'" class="'+(i?'task-model':'task-model ours-text')+'">'+name+'</text>'+
      '<text x="293" y="'+(y-26)+'" text-anchor="end" class="task-score">'+fmt(v[0])+' → '+fmt(v[1])+'</text>'+
      '<line x1="25" x2="293" y1="'+y+'" y2="'+y+'" stroke="var(--line)" stroke-width="2"/>'+
      '<line x1="'+x(v[0])+'" x2="'+x(v[1])+'" y1="'+y+'" y2="'+y+'" stroke="'+c+'" stroke-width="'+(i?3:5)+'"/>'+
      '<circle cx="'+x(v[0])+'" cy="'+y+'" r="7" fill="var(--panel)" stroke="'+c+'" stroke-width="2"/>'+
      '<circle cx="'+x(v[1])+'" cy="'+y+'" r="4" fill="'+c+'"/>'+
      '<text x="25" y="'+(y+27)+'" class="task-delta" fill="'+c+'">'+(v[0]===v[1]?'No drop':fmt(v[0]-v[1])+'-point drop')+'</text>';
  }).join('');
  return '<div class="task-card"><h3>'+d.name+'</h3><span class="task-sample">'+d.n+'</span>'+
    '<div class="task-highlight"><strong>'+d.headline+'</strong><span>'+d.label+'</span></div>'+
    '<svg viewBox="0 0 320 235" role="img" aria-label="'+d.name+': RoboICL '+fmt(d.r[0])+' to '+fmt(d.r[1])+', Q0 '+fmt(d.q[0])+' to '+fmt(d.q[1])+'. Higher progress score is better.">'+
    [0,50,100].map(n=>'<text x="'+x(n)+'" y="20" text-anchor="middle" class="task-tick">'+n+'</text>').join('')+rows+'</svg>'+
    '<div class="task-takeaway"><strong>'+d.advantage+'</strong><p>'+d.detail+'</p></div></div>';
}).join('');
