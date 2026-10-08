export interface LabState {
  closed: boolean;
  branchMask: number;
  electrons: number;
  basePairs: string[];
  layers: number;
}
export const initialLabState = (): LabState => ({ closed: false, branchMask: 7, electrons: 0, basePairs: Array(12).fill(""), layers: 0 });
export const template = "ATGCGA";
export const complement = (base: string) => ({ A: "T", T: "A", C: "G", G: "C" })[base] || "";
export const earthLayers = [
  { name: "Crust", depth: "0–35 km", inner: 6336, outer: 6371, color: 0x438454 },
  { name: "Lithosphere", depth: "0–100 km", inner: 6271, outer: 6371, color: 0x30b8b4 },
  { name: "Asthenosphere", depth: "100–350 km", inner: 6021, outer: 6271, color: 0xb965cc },
  { name: "Upper mantle", depth: "35–660 km", inner: 5711, outer: 6336, color: 0xf6c479 },
  { name: "Lower mantle", depth: "660–2,891 km", inner: 3480, outer: 5711, color: 0xd9752a },
  { name: "Outer core", depth: "2,891–5,150 km", inner: 1221, outer: 3480, color: 0xecc23f },
  { name: "Inner core", depth: "5,150–6,371 km", inner: 0, outer: 1221, color: 0xd84a4a },
];
const control = (label: string, min: number, max: number, unit = "", step = 1) => ({ label, min, max, unit, step });
export const controls = {
  inertia: [control("Net force", 0, 3, "N"), control("Initial velocity", 0, 2, "m/s")],
  "force-mass": [control("Net force", 0, 6, "N"), control("Cart mass", 1, 4, "kg")],
  launcher: [control("Thrust", 0, 6, "N"), control("Cart mass", 1, 4, "kg")],
  series: [control("Batteries (1.5 V each)", 1, 3), control("Series bulbs (6 ohm each)", 1, 3)],
  parallel: [control("Batteries (1.5 V each)", 1, 3), control("Bulb resistance", 3, 12, "ohm")],
  "home-circuit": [control("Wiring", 0, 1), control("Batteries (1.5 V each)", 1, 3)],
  "chemical-change": [control("Vinegar", 0, 3, "portions"), control("Baking soda", 0, 3, "portions")],
  bonding: [control("Bond model", 0, 1), control("Model rotation", 0, 3)],
  seismic: [control("Wave type", 0, 1), control("Material", 0, 1)],
  "earth-scale": [control("View", 0, 1), control("Selected layer", 0, 6)],
  replication: [control("Strands", 0, 1), control("Model rotation", 0, 3)],
  mutation: [control("Mutation", 0, 3), control("Base position", 1, 12)],
} as const;
export type ExperimentId = keyof typeof controls;
export function getObservationDefaults(id: string) {
  const defaults: Record<string, [number, number]> = { inertia: [0, 0], "force-mass": [2, 1], launcher: [2, 1], series: [1, 1], parallel: [1, 6], "home-circuit": [1, 1], "chemical-change": [0, 0], bonding: [0, 0], seismic: [0, 0], "earth-scale": [0, 0], replication: [1, 0], mutation: [0, 4] };
  const [controlA, controlB] = defaults[id] || [0, 0];
  return { controlA, controlB };
}
export function formatControlValue(id: string, which: "a" | "b", value: number, unit: string) {
  const labels: Record<string, string[]> = { "home-circuit:a": ["Series", "Parallel"], "bonding:a": ["NaCl (ionic)", "Water (covalent)"], "seismic:a": ["P-wave", "S-wave"], "seismic:b": ["Solid mantle", "Liquid outer core"], "earth-scale:a": ["True scale", "Labelled diagram"], "earth-scale:b": earthLayers.map(l => l.name), "replication:a": ["Paired template", "Separate and copy"], "mutation:a": ["Original", "Substitution (next base)", "Insert A", "Delete base"] };
  return labels[`${id}:${which}`]?.[value] || `${value}${unit ? ` ${unit}` : ""}`;
}
export function circuitState(id: string, a: number, b: number, lab: LabState) {
  const parallel = id === "parallel" || (id === "home-circuit" && a === 1);
  const count = id === "series" ? b : [1, 2, 4].filter(bit => lab.branchMask & bit).length;
  const voltage = 1.5 * (id === "home-circuit" ? b : a);
  const resistance = id === "parallel" ? b : 6;
  const complete = lab.closed && count > 0 && (parallel || id === "series" || count === 3);
  const requested = complete ? voltage / (parallel ? resistance / count : resistance * count) : 0;
  const tripped = id === "home-circuit" && requested > 1.5;
  const current = tripped ? 0 : requested;
  const branchCurrent = parallel ? current / Math.max(1, count) : current;
  return { parallel, count, voltage, resistance, current, branchCurrent, power: branchCurrent ** 2 * resistance, tripped };
}
// Standard genetic code, DNA coding-strand convention, fixed reading frame.
const aminoAcids = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
export function translate(dna: string) {
  const letters = "TCAG";
  const result: string[] = [];
  for (let i = 0; i + 2 < dna.length; i += 3) {
    const indexes = dna.slice(i, i + 3).split("").map(c => letters.indexOf(c));
    const aa = aminoAcids[indexes[0] * 16 + indexes[1] * 4 + indexes[2]];
    result.push(aa === "*" ? "STOP" : aa);
    if (aa === "*") break;
  }
  return result.join("–");
}
export const originalDna = "ATGGAATTTGGC";
export function mutationState(type: number, position: number) {
  const i = position - 1;
  const replacement = "ATGC"[("ATGC".indexOf(originalDna[i]) + 1) % 4];
  const dna = type === 1 ? originalDna.slice(0, i) + replacement + originalDna.slice(i + 1) : type === 2 ? originalDna.slice(0, i) + "A" + originalDna.slice(i) : type === 3 ? originalDna.slice(0, i) + originalDna.slice(i + 1) : originalDna;
  const protein = translate(dna);
  const effect = type === 0 ? "Original sequence" : type > 1 ? "Frameshift; downstream codons change" : protein === translate(originalDna) ? "Silent substitution; protein unchanged" : protein.includes("STOP") ? "Premature stop" : "Amino-acid substitution";
  return { dna, protein, effect };
}
export function getObservationModel(id: string, a: number, b: number, lab = initialLabState()) {
  const [controlA, controlB] = controls[id as ExperimentId];
  let values: [string, string][];
  if (["series", "parallel", "home-circuit"].includes(id)) {
    const c = circuitState(id, a, b, lab);
    values = [["Connection", c.parallel ? "Parallel" : "Series"], ["Supply", `${c.voltage} V`], ["Total current", `${c.current.toFixed(2)} A`], ["Power per lit bulb", `${c.power.toFixed(2)} W`], ["Circuit", c.tripped ? "Fuse open: exceeds 1.5 A" : !lab.closed ? "Switch open" : c.current ? "Closed" : "Incomplete"]];
  } else if (id === "chemical-change") values = [["Vinegar", `${a} portions`], ["Baking soda", `${b} portions`], ["Evidence", a && b ? "CO₂ bubbles: new substance formed" : "No reaction yet"], ["Reaction amount", `${Math.min(a, b)} (qualitative units)`]];
  else if (id === "bonding") values = [["Model", a ? "H₂O: covalent" : "NaCl: ionic"], ["Electrons", a ? `${lab.electrons}/2 shared pairs placed` : lab.electrons ? "1 electron transferred: Na⁺ and Cl⁻" : "Neutral Na and Cl"]];
  else if (id === "seismic") values = [["Wave", a ? "S: transverse" : "P: longitudinal"], ["Layer", b ? "Liquid outer core" : "Solid mantle"], ["Transmission", a && b ? "Blocked; no shear propagation" : "Transmitted"], ["Inference", a && b ? "Supports a liquid outer core" : "Compare with the other wave/material"]];
  else if (id === "earth-scale") { const l = earthLayers[b]; values = [["Layer", l.name], ["Depth below surface", l.depth], ["Thickness", `${l.outer - l.inner} km (representative)`], ["Assembly", `${lab.layers}/5 compositional layers`], ["Scale", a ? "Outer layers stretched so they are visible; not to scale" : "Radius 6,371 km; true relative scale"]]; }
  else if (id === "replication") { const correct = lab.basePairs.filter((base, i) => base === (i < 6 ? complement(template[i]) : template[i - 6])).length; values = [["Template", template], ["Complement", template.split("").map(complement).join("")], ["Matched bases", `${correct}/12 across two daughter molecules`], ["Result", correct === 12 ? "Two copies: each has one old and one new strand" : "Match A–T and C–G"]]; }
  else if (id === "mutation") { const m = mutationState(a, b); values = [["Original DNA", originalDna], ["New DNA", m.dna], ["Original protein", translate(originalDna)], ["New protein", m.protein], ["Possible effect", m.effect]]; }
  else values = [["Force", `${a} N`], [id === "inertia" ? "Initial velocity" : "Mass", id === "inertia" ? `${b} m/s` : `${b} kg`], ["Acceleration", `${(a / (id === "inertia" ? 1 : b)).toFixed(2)} m/s²`], ["Observation", id === "launcher" ? `Air: ${a} N backward; cart: ${a} N forward` : a ? "Velocity changes with time" : id === "inertia" && b ? "Constant velocity" : "Remains at rest"]];
  const readouts = values.map(([label, value]) => ({ label, value }));
  return { controlA, controlB, readouts, recordText: values.map(([l, v]) => `${l}: ${v}`).join("; ") };
}
