// Presentation timing; original joint trajectories and contact states are preserved.
export const DEMO_WINDOWS = [
  [0,1.35,'Open hand','Prepare above the part.','Hand open; ready to approach.'],
  [3.65,5,'Approach','Move toward the target.','Approach completed.'],
  [7.3,8.65,'Grasp','Close and begin the lift.','Fingers closed; lift begins.'],
  [10.95,12.3,'Place','Lower onto the receiving stand.','Placement height reached.'],
  [14.65,16,'Withdraw','Retract the open hand.','Hand clear; part remains supported.'],
];
// Camera records return asynchronously in the illustration. They never stop motion.
const pace = [[0,0],[.55,3.25],[12.4,15.1],[13.1,16]];
export const CYCLE_DURATION = 15.25;
const sourceTimes = [0,4.6,8.35,10.6,16];
function interpolate(value, points) {
  for(let i=1;i<points.length;i++){
    const [a,x]=points[i-1],[b,y]=points[i];
    if(value<=b)return x+(y-x)*Math.max(0,(value-a)/(b-a));
  }
  return points.at(-1)[1];
}
const delivered = sourceTimes.map((end,index)=>({
  id:index,start:sourceTimes[Math.max(0,index-1)],end,
  at:index===0?.35:interpolate(end,pace.map(([a,b])=>[b,a])),
}));
export function flowState(elapsed) {
  const time=((elapsed%CYCLE_DURATION)+CYCLE_DURATION)%CYCLE_DURATION;
  const robotTime=interpolate(time,pace);
  const arrived=delivered.filter(record=>time>=record.at+.95);
  const transfer=delivered.find(record=>time>=record.at&&time<record.at+.95);
  const context=delivered.find(record=>time>=record.at+1.05&&time<record.at+1.8);
  const label=robotTime<4.6?'Approach':robotTime<8.35?'Align & grasp':robotTime<10.6?'Lift':robotTime<13.8?'Place & release':'Retract';
  return {time,robotTime,label,history:arrived.filter(record=>record.id>0),
    observationTime:arrived.at(-1)?.end??null,
    referenceProgress:Math.min(1,time/3),
    transfer:transfer?{...transfer,progress:(time-transfer.at)/.95}:null,
    context:context?{...context,progress:(time-context.at-1.05)/.75}:null,
  };
}
