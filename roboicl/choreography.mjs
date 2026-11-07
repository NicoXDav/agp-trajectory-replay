export const GRASP_DURATION = 22;
export const GRASP_STAGES = [0, 4.4, 7, 9, 11];
export const TRI_STAGES = [0, 4, 8, 11.5];
export const smooth = x => {x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
const keys = [
 [0,-.58,.82,.20,-.22,.43,.15],
 [1.4,-.3,.87,-.30,.16,.43,.15],
 [2.8,.38,.78,-.12,.28,.43,.15],
 [4.4,.18,.84,.30,-.10,.43,.15],
 [7,0,.82,0,0,.43,.15],
 [9,0,.15,0,0,.43,.15],
 [11,0,.15,0,0,.226,.15],
 [13.4,0,.9,0,0,.226,.9],
 [15.5,0,.9,0,0,.226,.9],
 [17.8,0,.15,0,0,.226,.15],
 [19,0,.15,0,0,.43,.15],
 [20,0,.82,0,0,.43,.15],
 [22,-.58,.82,.20,-.22,.43,.15]
];
export function sampleGrasp(time) {
 const t=((time%GRASP_DURATION)+GRASP_DURATION)%GRASP_DURATION;
 const i=keys.findIndex((k,index)=>index<keys.length-1&&t>=k[0]&&t<keys[index+1][0]);
 const a=keys[Math.max(i,0)],b=keys[Math.max(i,0)+1],u=smooth((t-a[0])/(b[0]-a[0]));
 const v=a.slice(1).map((x,j)=>x+(b[j+1]-x)*u);
 const stage=t<4.4?0:t<7?1:t<9?2:t<11?3:4;
 return {t,x:v[0],y:v[1],z:v[2],yaw:v[3],opening:v[4],objectY:v[5],stage,resetting:t>=15.5};
}
