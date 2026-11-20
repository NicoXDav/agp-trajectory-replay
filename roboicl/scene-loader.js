// Prepare assets while the overview is being read; scenes create renderers only near the viewport.
const targets=document.querySelectorAll('#background, [data-scene]');
const observer=new IntersectionObserver(entries=>{
 if(!entries.some(entry=>entry.isIntersecting))return;
 observer.disconnect();
 import('./scenes.js?v=18').catch(error=>{
  console.error('MXI scene resources:',error);
  document.querySelectorAll('.scene-loading').forEach(el=>{el.hidden=false;el.textContent='The 3D assets could not load. Reload the page to retry.';});
 });
});
targets.forEach(target=>observer.observe(target));
