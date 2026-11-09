import test from 'node:test';
import assert from 'node:assert/strict';
import { flowState, CYCLE_DURATION } from '../roboicl/context-flow-state.mjs';

test('an observation cannot enter memory before the robot reaches it and feedback arrives', () => {
  let feedbackSeen = false, resultSeen = false;
  for (let t = 0; t < CYCLE_DURATION; t += .025) {
    const s = flowState(t);
    if (s.kind === 'feedback' && s.robotTime > 0) {
      feedbackSeen = true;
      assert.ok(s.observationTime < s.robotTime);
    }
    for (const record of s.history) {
      resultSeen = true;
      assert.ok(record.end <= s.observationTime);
      assert.ok(record.end <= s.robotTime);
    }
  }
  assert.ok(feedbackSeen, 'show photos returning from execution');
  assert.ok(resultSeen, 'retain completed action records');
});

test('robot holds still while photos return and context is read; actions advance continuously', () => {
  let previous = flowState(0), moved = false;
  for (let t = .01; t < CYCLE_DURATION - .01; t += .01) {
    const s = flowState(t);
    assert.ok(s.robotTime >= previous.robotTime - 1e-9);
    if (s.step === previous.step && s.kind !== 'action') assert.equal(s.robotTime, previous.robotTime);
    if (s.robotTime > previous.robotTime) moved = true;
    assert.ok(s.robotTime - previous.robotTime < .02);
    previous = s;
  }
  assert.ok(moved);
  assert.equal(previous.robotTime, 16);
});

test('a fresh cycle clears live memory instead of reusing future observations', () => {
  const fresh = flowState(CYCLE_DURATION + .1);
  assert.equal(fresh.robotTime, 0);
  assert.deepEqual(fresh.history, []);
  assert.equal(fresh.observationTime, null);
});
