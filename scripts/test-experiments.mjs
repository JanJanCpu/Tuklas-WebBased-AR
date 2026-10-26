import assert from 'node:assert/strict';
import { modules, toPersistedModule } from '../backend/src/data/modules.ts';
import { controls, getObservationDefaults, getObservationModel, circuitState, initialLabState, mutationState, translate, complement, template, earthLayers, earthAssemblyOrder } from '../frontend/src/lib/experiments.ts';

assert.equal(modules.length, 12);
assert.deepEqual(earthAssemblyOrder.map(index => earthLayers[index].name), ['Inner core', 'Outer core', 'Lower mantle', 'Upper mantle', 'Crust'], 'Assembly includes all five layers from center to surface');
assert.ok(getObservationModel('earth-scale', 0, 0, { ...initialLabState(), layers: earthAssemblyOrder.length }).readouts.some(readout => readout.value === '5/5 compositional layers'));
assert.equal(new Set(modules.map(m => m.id)).size, 12);
assert.deepEqual([1, 2, 3, 4].map(q => modules.filter(m => m.quarterNumber === q).length), [6, 2, 2, 2]);
assert.equal(new Set(modules.map(m => m.groupId)).size, 5);
for (const experiment of modules) {
  assert.ok(controls[experiment.id]);
  const defaults = getObservationDefaults(experiment.id);
  const [a, b] = controls[experiment.id];
  assert.ok(defaults.controlA >= a.min && defaults.controlA <= a.max);
  assert.ok(defaults.controlB >= b.min && defaults.controlB <= b.max);
  for (let av = a.min; av <= a.max; av += a.step) for (let bv = b.min; bv <= b.max; bv += b.step) {
    const model = getObservationModel(experiment.id, av, bv);
    assert.ok(model.readouts.every(r => r.value && !/NaN|undefined|Infinity/.test(r.value)), `${experiment.id}: ${av}, ${bv}`);
  }
  assert.equal(experiment.predictions.length, 3);
  assert.equal('groupId' in toPersistedModule(experiment), false);
}
const closed = { ...initialLabState(), closed: true };
assert.equal(circuitState('series', 1, 1, initialLabState()).current, 0);
assert.ok(circuitState('series', 1, 3, closed).power < circuitState('series', 1, 1, closed).power);
assert.ok(circuitState('series', 3, 1, closed).current > circuitState('series', 1, 1, closed).current);
const all = circuitState('parallel', 2, 6, closed);
const removed = circuitState('parallel', 2, 6, { ...closed, branchMask: 3 });
assert.equal(all.power, removed.power);
assert.ok(all.current > removed.current);
assert.equal(circuitState('home-circuit', 0, 1, { ...closed, branchMask: 3 }).current, 0);
assert.equal(circuitState('home-circuit', 1, 3, closed).tripped, true);
assert.equal(circuitState('home-circuit', 1, 1, closed).tripped, false);
assert.match(getObservationModel('inertia', 0, 0).recordText, /Remains at rest/);
assert.match(getObservationModel('inertia', 0, 2).recordText, /Constant velocity/);
assert.match(getObservationModel('seismic', 1, 1).recordText, /Blocked/);
assert.match(getObservationModel('seismic', 0, 1).recordText, /Transmitted/);
assert.match(getObservationModel('chemical-change', 0, 2).recordText, /No reaction/);
assert.match(getObservationModel('chemical-change', 1, 1).recordText, /new substance/);
assert.equal(translate('ATGGAATTTGGC'), 'M–E–F–G');
assert.equal(translate('ATGTAAGGC'), 'M–STOP');
for (let position = 1; position <= 12; position++) {
  assert.equal(mutationState(1, position).dna.length, 12);
  assert.equal(mutationState(2, position).dna.length, 13);
  assert.equal(mutationState(3, position).dna.length, 11);
  assert.match(mutationState(2, position).effect, /Frameshift/);
}
const paired = [...template].map(complement).concat([...template]);
assert.match(getObservationModel('replication', 1, 0, { ...closed, basePairs: paired }).recordText, /12\/12/);
assert.equal(earthLayers[0].outer - earthLayers[0].inner, 35);
assert.equal(earthLayers[3].inner, earthLayers[4].outer);
assert.equal(earthLayers[4].inner, earthLayers[5].outer);
console.log('PASS: catalog, every control range, circuits, motion, waves, chemistry, DNA and Earth scale.');
