// Presentation timing. Joint trajectories remain unchanged; feedback holds the scene.
export const DEMO_WINDOWS = [
  [0,1.35,'Open hand','Prepare above the part.','Hand open; ready to approach.'],
  [3.65,5,'Approach','Move toward the target.','Approach completed.'],
  [7.3,8.65,'Grasp','Close and begin the lift.','Fingers closed; lift begins.'],
  [10.95,12.3,'Place','Lower onto the receiving stand.','Placement height reached.'],
  [14.65,16,'Withdraw','Retract the open hand.','Hand clear; part remains supported.'],
];
const steps = [
  {kind:'reference',duration:3,from:0,to:0,label:'Read the demonstration'},
  {kind:'feedback',duration:1.35,from:0,to:0,label:'Receive the current view'},
];
const chunks = [[0,4.6,'Approach the target'],[4.6,8.35,'Align and close'],[8.35,10.6,'Lift and transfer'],[10.6,16,'Place and release']];
for (const [from,to,label] of chunks) {
  steps.push({kind:'observation',duration:1.15,from,to:from,label:'Use reference + live context'});
  steps.push({kind:'action',duration:(to-from)/1.1,from,to,label});
  steps.push({kind:'feedback',duration:1.35,from:to,to,label:'Observe the actual result'});
}
steps.push({kind:'complete',duration:2.2,from:16,to:16,label:'Keep the experience'});
export const CYCLE_DURATION = steps.reduce((sum,step)=>sum+step.duration,0);

export function flowState(elapsed) {
  let remaining = ((elapsed % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  let observationTime = null;
  const history = [];
  for (let i=0; i<steps.length; i++) {
    const step = steps[i];
    if (remaining < step.duration || i === steps.length-1) {
      const progress = Math.min(1,remaining / step.duration);
      return {...step,step:i,progress,observationTime,history,
        robotTime:step.from+(step.to-step.from)*progress};
    }
    if(step.kind==='feedback') {
      if(step.to>0) history.push({start:observationTime,end:step.to});
      observationTime=step.to;
    }
    remaining-=step.duration;
  }
}
