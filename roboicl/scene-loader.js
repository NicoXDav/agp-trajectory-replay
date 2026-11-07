// Begin downloading the 3D engine only near the geometry section.
const target=document.querySelector('[data-scene]');
if(target){
 const observer=new IntersectionObserver(entries=>{
  if(!entries.some(e=>e.isIntersecting))return;
  observer.disconnect();
  import('./scenes.js?v=6').catch(()=>{
   document.querySelectorAll('.scene-loading').forEach(el=>{el.textContent='The interactive model could not load. Reload the page to retry.';});
  });
 },{rootMargin:'800px 0px'});
 observer.observe(target);
}
