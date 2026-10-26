import { useState } from "react";
import { complement, earthAssemblyOrder, earthLayers, template, type LabState } from "../lib/experiments";

export function ExperimentControls({ id, a, lab, onChange }: { id: string; a: number; lab: LabState; onChange: (next: LabState) => void }) {
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  if (["series", "parallel", "home-circuit"].includes(id)) return <div className="experiment-presets">
    <button aria-pressed={lab.closed} onClick={() => onChange({ ...lab, closed: !lab.closed })}>{lab.closed ? "Open switch" : "Close switch"}</button>
    {id !== "series" && [0, 1, 2].map(i => <button key={i} aria-pressed={Boolean(lab.branchMask & (1 << i))} onClick={() => onChange({ ...lab, branchMask: lab.branchMask ^ (1 << i) })}>{lab.branchMask & (1 << i) ? "Remove" : "Install"} bulb {i + 1}</button>)}
    {id === "home-circuit" && <p>Virtual low-voltage supply · 6 Ω bulbs · 1.5 A protective fuse. Reduce the load and reopen/close the switch to investigate safe configurations.</p>}
  </div>;
  if (id === "bonding") {
    const place = () => { onChange({ ...lab, electrons: Math.min(a ? 2 : 1, lab.electrons + 1) }); setMessage(a ? "Shared pair placed in an O–H bond." : "Electron transferred: Na⁺ and Cl⁻ formed."); };
    return <div className="bond-workbench">
      <p>{a ? "Move one electron pair into each O–H bond." : "Move sodium's outer electron to chlorine."} Drag to the target, or select the target button.</p>
      <button className="electron-token" draggable onDragStart={event => { event.dataTransfer.setData("text/plain", "electron"); }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }} onPointerUp={event => { if (dragging && document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-electron-target]")) place(); setDragging(false); }}>{a ? "Electron pair ••" : "Na electron •"}</button>
      <button data-electron-target onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.getData("text/plain") === "electron") place(); }} onClick={place} disabled={lab.electrons >= (a ? 2 : 1)}>{a ? `Place shared pair ${Math.min(2, lab.electrons + 1)} in O–H` : "Transfer to Cl"}</button>
      <button onClick={() => { onChange({ ...lab, electrons: 0 }); setMessage(""); }}>Reset electrons</button>
      <p role="status">{message}</p>
    </div>;
  }
  if (id === "replication") return <div className="dna-workbench">
    <p>Each daughter molecule keeps an original strand. Select the complementary base for each new strand.</p>
    {[0, 1].map(strand => <fieldset key={strand} disabled={!a}><legend>Daughter DNA {strand + 1} · old template → new strand</legend>
      {template.split("").map((base, i) => { const index = strand * 6 + i; const old = strand ? complement(base) : base; return <label className="base-choice" key={i}><strong>{old}</strong><span> → </span><select aria-label={`Daughter ${strand + 1}, base ${i + 1}, template ${old}`} value={lab.basePairs[index]} onChange={event => { const next = [...lab.basePairs]; next[index] = event.target.value; onChange({ ...lab, basePairs: next }); }}><option value="">?</option>{["A", "T", "C", "G"].map(b => <option key={b}>{b}</option>)}</select><small>{!lab.basePairs[index] ? "Choose" : lab.basePairs[index] === complement(old) ? "Matched" : "Try again"}</small></label>; })}
    </fieldset>)}
  </div>;
  if (id === "earth-scale") return <div className="earth-workbench">
    <p>Assemble from the center outward. Then select the lithosphere and asthenosphere overlays. Surface depths vary; the model uses representative values.</p>
    <div className="experiment-presets">{[...earthAssemblyOrder].reverse().map(index => <button key={index} disabled={lab.layers >= earthAssemblyOrder.length} onClick={() => { const expected = earthAssemblyOrder[lab.layers]; if (index === expected) { onChange({ ...lab, layers: lab.layers + 1 }); setMessage(`${earthLayers[index].name} placed at its scaled radius.`); } else setMessage("Build from the center outward. Use the depth labels to choose the next layer."); }}>Add {earthLayers[index].name}</button>)}<button onClick={() => { onChange({ ...lab, layers: 0 }); setMessage(""); }}>Clear assembly</button></div>
    <p role="status">{message}</p>
    <ul>{earthLayers.map(l => <li key={l.name}><strong>{l.name}</strong>: {l.depth} below surface{["Lithosphere", "Asthenosphere"].includes(l.name) ? " (mechanical region; overlaps compositional layers)" : ""}</li>)}</ul>
  </div>;
  return null;
}
