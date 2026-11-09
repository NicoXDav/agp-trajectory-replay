import test from 'node:test';
import assert from 'node:assert/strict';
import { flowState, CYCLE_DURATION } from '../roboicl/context-flow-state.mjs';

test('photos travel independently while the robot keeps advancing',()=>{
  let seen=false;
  for(let t=1;t<CYCLE_DURATION-.1;t+=.02){
    const a=flowState(t),b=flowState(t+.01);
    if(a.transfer && a.robotTime<15){
      seen=true;
      assert.ok(b.robotTime>a.robotTime,'photo transport must not pause the robot');
    }
  }
  assert.ok(seen,'execution clips return during the motion');
});
test('memory contains completed, delivered segments only',()=>{
  let seen=false;
  for(let t=0;t<CYCLE_DURATION;t+=.02){
    const s=flowState(t);
    for(const r of s.history){seen=true;assert.ok(r.end<=s.robotTime);assert.ok(r.end<=s.observationTime);}
    if(s.transfer && s.transfer.end>0)assert.ok(s.observationTime<s.transfer.end);
  }
  assert.ok(seen);
});
test('the entire grasp remains continuous, ends at the original pose, and clears on the next cycle',()=>{
  let previous=flowState(0);
  for(let t=.01;t<CYCLE_DURATION-.01;t+=.01){
    const s=flowState(t);assert.ok(s.robotTime>=previous.robotTime);assert.ok(s.robotTime-previous.robotTime<.07);previous=s;
  }
  assert.equal(previous.robotTime,16);assert.equal(previous.history.length,4);
  const reset=flowState(CYCLE_DURATION+.1);assert.deepEqual(reset.history,[]);assert.equal(reset.observationTime,null);
});
