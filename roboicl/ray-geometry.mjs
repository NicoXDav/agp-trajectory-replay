// Least-squares point nearest calibrated viewing rays, in one metric frame.
export function triangulateRays(origins, directions) {
 if(origins.length<2||origins.length!==directions.length)throw Error('At least two paired rays are required');
 const A=Array.from({length:3},()=>[0,0,0,0]);
 origins.forEach((o,k)=>{
  const norm=Math.hypot(...directions[k]);if(norm<1e-12)throw Error('Empty ray direction');
  const d=directions[k].map(x=>x/norm);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){const m=(i===j?1:0)-d[i]*d[j];A[i][j]+=m;A[i][3]+=m*o[j];}
 });
 for(let i=0;i<3;i++){
  let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;
  if(Math.abs(A[pivot][i])<1e-10)throw Error('Parallel rays do not determine a stable depth');
  [A[i],A[pivot]]=[A[pivot],A[i]];const scale=A[i][i];for(let c=i;c<4;c++)A[i][c]/=scale;
  for(let r=0;r<3;r++)if(r!==i){const m=A[r][i];for(let c=i;c<4;c++)A[r][c]-=m*A[i][c];}
 }
 return A.map(row=>row[3]);
}

// Presentation experiment: independent Gaussian pixel noise in pinhole cameras
// aimed at a known landmark. No sensor depth is used by the ray solver.
export function simulatePixelSpread(origins, target, pixelSigma=1.5, focalPixels=600) {
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const bases=origins.map(o=>{
  const d=unit(target.map((v,i)=>v-o[i]));
  const x=unit(cross(d,Math.abs(d[1])>.95?[1,0,0]:[0,1,0]));
  return {d,x,y:cross(x,d)};
 });
 let seed=479;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
 const normal=()=>Math.sqrt(-2*Math.log(rand()))*Math.cos(2*Math.PI*rand());
 const samples=[];
 for(let n=0;n<128;n++){
  // Always draw three pairs so two- and three-view runs share the first two inputs.
  const noise=Array.from({length:3},()=>[normal(),normal()]);
  const dirs=bases.map((b,i)=>b.d.map((v,j)=>v+pixelSigma/focalPixels*(noise[i][0]*b.x[j]+noise[i][1]*b.y[j])));
  samples.push(triangulateRays(origins,dirs));
 }
 const mean=target.map((_,i)=>samples.reduce((s,p)=>s+p[i],0)/samples.length);
 const offsets=samples.map(p=>p.map((v,i)=>v-mean[i]));
 const rms=Math.sqrt(offsets.reduce((s,d)=>s+dot(d,d),0)/samples.length);
 return {mean,offsets,rms};
}
