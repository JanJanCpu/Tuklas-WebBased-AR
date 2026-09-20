import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { circuitState, complement, controls, earthLayers, mutationState, originalDna, template, type LabState } from "../lib/experiments";

/** What a scene lets the student change from inside the model. ScienceScene supplies the pointer position and this API. */
export interface InteractionApi {
  values(): { a: number; b: number; lab: LabState };
  setControl(which: "a" | "b", value: number): void;
  setLab(patch: Partial<LabState>): void;
  /** Restart the trial clock so the model runs again from the start. */
  restart(): void;
}
export interface Interaction {
  /** Grabbable roots. A target only counts while it is visible. */
  targets: Record<string, THREE.Object3D>;
  /** Positions are in the scene's own units on its table plane. `moved` is how far the pointer travelled in screen pixels. */
  down?(name: string, point: THREE.Vector3, api: InteractionApi): void;
  move?(name: string, point: THREE.Vector3, moved: number, api: InteractionApi): void;
  up?(name: string, point: THREE.Vector3, moved: number, api: InteractionApi): void;
  cancel?(): void;
}

interface Finish { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number; opacity?: number }

/** All experiment content fits the same six-unit presentation area in AR and 3D. */
export function createExperimentScene(root: THREE.Group, id: string) {
  const updates: ((time: number, a: number, b: number, lab: LabState) => void)[] = [];
  // Every lit mesh, so the whole scene can switch to cheaper shading on weak phones.
  const registry: THREE.Mesh[] = [];
  let interact: Interaction | undefined;
  const mesh = (geometry: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, parent: THREE.Object3D = root, finish: Finish = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: finish.roughness ?? 0.5, metalness: finish.metalness ?? 0.05, side: THREE.DoubleSide });
    if (finish.emissive !== undefined) { material.emissive.setHex(finish.emissive); material.emissiveIntensity = finish.emissiveIntensity ?? 1; }
    if (finish.opacity !== undefined) { material.transparent = true; material.opacity = finish.opacity; material.depthWrite = false; }
    const item = new THREE.Mesh(geometry, material);
    registry.push(item);
    item.position.set(x, y, z); parent.add(item); return item;
  };
  const sphere = (color: number, x: number, y: number, r = 0.13, parent: THREE.Object3D = root, finish: Finish = {}) => mesh(new THREE.SphereGeometry(r, 20, 12), color, x, y, 0, parent, finish);
  // Many identical small objects drawn as one batch. Separate meshes cost one draw call each, which is what limited budget phones.
  const instanced = (geometry: THREE.BufferGeometry, color: number, count: number, parent: THREE.Object3D = root, finish: Finish = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: finish.roughness ?? 0.4, metalness: finish.metalness ?? 0.05 });
    if (finish.emissive !== undefined) { material.emissive.setHex(finish.emissive); material.emissiveIntensity = finish.emissiveIntensity ?? 1; }
    if (finish.opacity !== undefined) { material.transparent = true; material.opacity = finish.opacity; material.depthWrite = false; }
    const item = new THREE.InstancedMesh(geometry, material, count);
    item.frustumCulled = false; parent.add(item); registry.push(item);
    const dummy = new THREE.Object3D();
    const place = (index: number, x: number, y: number, z: number, scaleX: number, scaleY = scaleX, scaleZ = scaleX) => {
      dummy.position.set(x, y, z); dummy.scale.set(scaleX, scaleY, scaleZ); dummy.updateMatrix();
      item.setMatrixAt(index, dummy.matrix); item.instanceMatrix.needsUpdate = true;
    };
    const hide = (index: number) => place(index, 0, 0, 0, 0);
    const tint = (index: number, color: THREE.Color) => { item.setColorAt(index, color); if (item.instanceColor) item.instanceColor.needsUpdate = true; };
    return { item, get material() { return item.material as THREE.MeshStandardMaterial; }, place, hide, tint };
  };
  const line = (points: number[][], color = 0x486480, parent: THREE.Object3D = root) => {
    const item = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0))), new THREE.LineBasicMaterial({ color })); parent.add(item); return item;
  };
  const label = (text: string, x: number, y: number, width = 1.5, parent: THREE.Object3D = root, aspect = 8) => {
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 768 / aspect;
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false }));
    sprite.position.set(x, y, 0.18); sprite.scale.set(width, width / aspect, 1); sprite.renderOrder = 10; parent.add(sprite);
    let previous = "";
    const set = (next: string) => { if (next === previous) return; previous = next; const ctx = canvas.getContext("2d")!; ctx.clearRect(0, 0, 768, canvas.height); ctx.fillStyle = "rgba(247,251,255,0.96)"; ctx.fillRect(0, 0, 768, canvas.height); ctx.font = `bold ${canvas.height * 0.7}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#172c45"; ctx.fillText(next, 384, canvas.height / 2, 740); texture.needsUpdate = true; };
    set(text); return { sprite, set };
  };

  // Soft additive glow, used for lit bulbs and highlights.
  const glowCanvas = document.createElement("canvas"); glowCanvas.width = glowCanvas.height = 64;
  const glowCtx = glowCanvas.getContext("2d")!;
  const gradient = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)"); gradient.addColorStop(0.35, "rgba(255,255,255,0.45)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
  glowCtx.fillStyle = gradient; glowCtx.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const glow = (color: number, size: number, parent: THREE.Object3D = root) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    sprite.scale.setScalar(size); sprite.material.opacity = 0; parent.add(sprite); return sprite;
  };

  // Solid arrow (WebGL lines are always one pixel wide, which read as hairlines on a phone).
  const arrow = (color: number, parent: THREE.Object3D = root) => {
    const group = new THREE.Group(); parent.add(group);
    const finish = { emissive: color, emissiveIntensity: 0.7, roughness: 0.35 };
    const shaft = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 12), color, 0, 0, 0, group, finish); shaft.rotation.z = Math.PI / 2;
    const head = mesh(new THREE.ConeGeometry(0.12, 0.26, 16), color, 0, 0, 0, group, finish); head.rotation.z = -Math.PI / 2;
    const set = (length: number) => { shaft.scale.y = length; shaft.position.x = length / 2; head.position.x = length + 0.13; };
    return { group, set };
  };

  // A copper wire made of joined cylinders, so it has real thickness. `gaps` cut the wire where a bulb or battery holder sits.
  const wire = (points: number[][], parent: THREE.Object3D, gaps: { y: number; x0: number; x1: number }[] = []) => {
    const group = new THREE.Group(); parent.add(group);
    const vectors = points.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0));
    const finish = { metalness: 0.85, roughness: 0.3 };
    const up = new THREE.Vector3(0, 1, 0);
    const between = (from: THREE.Vector3, to: THREE.Vector3) => {
      const length = from.distanceTo(to);
      if (length < 1e-4) return;
      const segment = mesh(new THREE.CylinderGeometry(0.045, 0.045, length, 10), 0xc27c45, (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, group, finish);
      segment.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
    };
    vectors.forEach((point, i) => {
      if (!gaps.some(gap => Math.abs(point.y - gap.y) < 0.01 && point.x > gap.x0 && point.x < gap.x1)) mesh(new THREE.SphereGeometry(0.045, 10, 8), 0xc27c45, point.x, point.y, point.z, group, finish);
      if (i === 0) return;
      const from = vectors[i - 1];
      if (Math.abs(from.y - point.y) > 0.01) { between(from, point); return; }
      let pieces: [number, number][] = [[Math.min(from.x, point.x), Math.max(from.x, point.x)]];
      gaps.filter(gap => Math.abs(gap.y - point.y) < 0.01).forEach(gap => {
        pieces = pieces.flatMap(([lo, hi]) => {
          const kept: [number, number][] = [];
          if (gap.x0 > lo) kept.push([lo, Math.min(hi, gap.x0)]);
          if (gap.x1 < hi) kept.push([Math.max(lo, gap.x1), hi]);
          return kept.filter(([a, b]) => b - a > 1e-3);
        });
      });
      pieces.forEach(([lo, hi]) => between(new THREE.Vector3(lo, point.y, point.z), new THREE.Vector3(hi, point.y, point.z)));
    });
    return group;
  };

  if (["inertia", "force-mass", "launcher"].includes(id)) {
    // Track with rails and distance ticks so motion is easy to read.
    mesh(new RoundedBoxGeometry(5.4, 0.1, 0.9, 3, 0.03), 0x8fa3b8, 0, -0.4, 0, root, { roughness: 0.3, metalness: 0.55 });
    [-0.4, 0.4].forEach(z => mesh(new THREE.BoxGeometry(5.4, 0.035, 0.05), 0xd6dee7, 0, -0.335, z, root, { metalness: 0.9, roughness: 0.2 }));
    for (let i = 0; i <= 8; i++) mesh(new THREE.BoxGeometry(0.022, 0.006, i % 2 ? 0.28 : 0.5), i % 2 ? 0x3a4f66 : 0x1f2f43, -2 + i * 0.5, -0.347, 0);

    const cart = new THREE.Group(); root.add(cart);
    // A classic wagon: open tray with side walls, axles under a chassis bar, and a pull handle at the front.
    const paint = { roughness: 0.3, metalness: 0.25 };
    mesh(new RoundedBoxGeometry(0.75, 0.05, 0.6, 2, 0.02), 0xc42f3c, 0, -0.03, 0, cart, paint);
    [-0.28, 0.28].forEach(z => mesh(new RoundedBoxGeometry(0.75, 0.17, 0.04, 2, 0.015), 0xdb3744, 0, 0.055, z, cart, paint));
    [-0.355, 0.355].forEach(x => mesh(new RoundedBoxGeometry(0.04, 0.17, 0.6, 2, 0.015), 0xdb3744, x, 0.055, 0, cart, paint));
    mesh(new THREE.BoxGeometry(0.7, 0.03, 0.1), 0x2a3444, 0, -0.085, 0, cart, { metalness: 0.6, roughness: 0.4 });
    [-0.24, 0.24].forEach(x => { const axle = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 10), 0x8b97a5, x, -0.23, 0, cart, { metalness: 0.9, roughness: 0.3 }); axle.rotation.x = Math.PI / 2; });
    const rod = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.505, 10), 0x1c2635, 0.57, 0.08, 0, cart, { metalness: 0.5, roughness: 0.4 }); rod.rotation.z = Math.atan2(0.28, 0.42) - Math.PI / 2;
    const grip = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12), 0x1c2635, 0.78, 0.22, 0, cart, { roughness: 0.6 }); grip.rotation.x = Math.PI / 2;
    const wheels: THREE.Group[] = [];
    [-0.24, 0.24].forEach(x => [-0.35, 0.35].forEach(z => {
      const wheel = new THREE.Group(); wheel.position.set(x, -0.23, z); cart.add(wheel); wheels.push(wheel);
      const tire = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 22), 0x1c2635, 0, 0, 0, wheel, { roughness: 0.85 }); tire.rotation.x = Math.PI / 2;
      const hub = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.112, 14), 0xc4ced8, 0, 0, 0, wheel, { metalness: 0.9, roughness: 0.25 }); hub.rotation.x = Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.1, 0.028, 0.116), 0x2a3b52, 0.035, 0, 0, wheel);
    }));
    const blocks = [0, 1, 2, 3].map(i => mesh(new RoundedBoxGeometry(0.42, 0.11, 0.35, 2, 0.02), 0x6b86a6, 0, 0.06 + i * 0.12, 0, cart, { metalness: 0.75, roughness: 0.3 }));
    const forward = arrow(0x16853f); forward.group.position.set(-0.4, 1.25, 0);
    const backward = arrow(0x2988d5); backward.group.position.set(0.4, 1.85, 0); backward.group.rotation.z = Math.PI; backward.group.visible = id === "launcher";
    const balloon = sphere(0x45b9c5, 0, 0.5, 0.35, cart, { roughness: 0.2, metalness: 0.1 }); balloon.scale.x = 1.5; balloon.visible = id === "launcher";
    const air = instanced(new THREE.SphereGeometry(0.05, 8, 6), 0xffffff, 10, cart, { opacity: 0.5, roughness: 0.2 });
    const streaks = instanced(new THREE.BoxGeometry(0.6, 0.018, 0.018), 0xffffff, 6, cart, { opacity: 0.4 });
    label(id === "launcher" ? "Air backward / cart forward" : "Frictionless track; wraps at edge", 0, -0.85, 4.5);
    const forceLabel = label("", 0, 2.25, 3.6);
    // Generous invisible grab area around the force arrow so a fingertip can hit it.
    const arrowGrab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 0.7), new THREE.MeshBasicMaterial()); arrowGrab.visible = false; arrowGrab.position.set(1.3, 0, 0); forward.group.add(arrowGrab);
    const cartMode = id === "inertia" ? "push" : id === "force-mass" ? "tap" : undefined;
    label(id === "inertia" ? "Drag cart = push · drag arrow = force" : id === "force-mass" ? "Drag arrow = force · tap cart = mass" : "Drag the arrow to set thrust", 0, -1.45, 4.6, root, 11);
    const drag = { target: "", x: 0, value: 0 };
    const ranges = controls[id as keyof typeof controls];
    const snap = (which: 0 | 1, raw: number) => { const range = ranges[which]; return Math.min(range.max, Math.max(range.min, Math.round(raw / range.step) * range.step)); };
    const setArrow = (point: THREE.Vector3, api: InteractionApi) => { drag.target = "arrow"; const value = snap(0, (point.x - forward.group.position.x - 0.13 - 0.4) / 0.25); if (value !== api.values().a) api.setControl("a", value); };
    interact = {
      targets: cartMode ? { cart, arrow: forward.group } : { arrow: forward.group },
      down: (name, point, api) => { if (name === "arrow") setArrow(point, api); },
      move: (name, point, moved, api) => {
        if (name === "arrow") setArrow(point, api);
        else if (name === "cart" && cartMode === "push" && moved >= 8) { const x = Math.min(2, Math.max(-2, point.x)); drag.target = "cart"; drag.x = x; drag.value = snap(1, (x + 2) / 4 * ranges[1].max); }
      },
      up: (name, _point, moved, api) => {
        if (name === "cart" && cartMode === "push" && moved >= 8) { api.setControl("b", drag.value); api.restart(); }
        else if (name === "cart" && cartMode === "tap" && moved < 8) { const next = api.values().b + ranges[1].step; api.setControl("b", next > ranges[1].max ? ranges[1].min : next); }
        else if (name === "arrow") api.restart();
        drag.target = "";
      },
      cancel: () => { drag.target = ""; },
    };
    updates.push((time, a, b) => {
      const acceleration = a / (id === "inertia" ? 1 : b);
      const initialVelocity = id === "inertia" ? b : 0;
      const distance = initialVelocity * time + 0.5 * acceleration * time * time;
      const velocity = initialVelocity + acceleration * time;
      cart.position.x = drag.target === "cart" ? drag.x : -2 + distance % 4;
      cart.rotation.z = Math.min(0.07, acceleration * 0.012);
      wheels.forEach(wheel => { wheel.rotation.z = -distance / 0.13; });
      blocks.forEach((block, i) => { block.visible = id === "force-mass" && i < b; });
      // At zero force the arrow shows as a faint ghost, so there is something to grab and drag.
      forward.group.visible = true; backward.group.visible = id === "launcher" && a > 0;
      forward.group.children.slice(0, 2).forEach(part => { const material = (part as THREE.Mesh).material as THREE.MeshStandardMaterial; material.transparent = a === 0; material.opacity = a === 0 ? 0.3 : 1; material.depthWrite = a !== 0; });
      forward.set(0.4 + a * 0.25); backward.set(0.4 + a * 0.25);
      streaks.material.opacity = Math.min(0.5, velocity * 0.16);
      for (let i = 0; i < 6; i++) { if (velocity <= 0.25) streaks.hide(i); else streaks.place(i, -0.55 - ((time * 2.4 + i / 6) % 1) * 0.7, 0.12 - (i % 3) * 0.13, (i < 3 ? -1 : 1) * 0.36, Math.min(1.6, 0.4 + velocity * 0.25), 1, 1); }
      if (id === "launcher") {
        balloon.scale.set(1.5 - 0.6 * ((time * 0.5) % 1) * (a > 0 ? 1 : 0), 1, 1);
        for (let i = 0; i < 10; i++) { if (a <= 0) { air.hide(i); continue; } const age = (time * (0.8 + a * 0.15) + i / 10) % 1; air.place(i, -0.6 - age * 1.3, 0.5 + Math.sin(i * 2.1) * 0.12 * age, 0, (0.6 + age * 1.6) * (1 - 0.6 * age)); }
      }
      forceLabel.set(drag.target === "cart" ? `Push: v₀ = ${drag.value} m/s` : drag.target === "arrow" ? `Force = ${a} N` : id === "launcher" ? `Equal forces: ${a} N each` : `a = ${acceleration.toFixed(2)} m/s²`);
    });
  } else if (["series", "parallel", "home-circuit"].includes(id)) {
    mesh(new RoundedBoxGeometry(5.6, 3.7, 0.1, 3, 0.05), 0x1d3557, 0, 0.4, -0.2, root, { roughness: 0.8 });
    const wiring = new THREE.Group(); root.add(wiring);
    const ROW = 0.15;                    // height of the top wire in the series layout
    const LIFT = 0.64;                   // how far the glass sits above the terminals
    const PARALLEL_SCALE = 0.68;         // bulbs are drawn smaller when three sit above each other
    const units = [0, 1, 2].map(i => { const unit = new THREE.Group(); unit.position.set(-1.5 + i * 1.5, ROW, 0); root.add(unit); return unit; });
    const bodies = units.map(unit => { const body = new THREE.Group(); unit.add(body); return body; });
    const glass = bodies.map(body => sphere(0xf5d357, 0, LIFT, 0.27, body, { roughness: 0.15 }));
    const bulbGlows = glass.map(bulb => glow(0xffc84a, 1.9, bulb));
    // Each bulb screws into a round white lamp holder (base with screw holes, raised collar, brass thread) with a terminal on each side.
    units.forEach((unit, unitIndex) => {
      const brass = { metalness: 0.85, roughness: 0.3 };
      const white = { roughness: 0.45 };
      mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.07, 32), 0xf3f3ef, 0, -0.02, 0, unit, white);
      [-0.3, 0.3].forEach(x => mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10), 0x59636e, x, 0.02, 0.13, unit, brass));
      mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.2, 28), 0xf3f3ef, 0, 0.115, 0, unit, white);
      const ring = mesh(new THREE.TorusGeometry(0.225, 0.028, 8, 28), 0xb08d3c, 0, 0.216, 0, unit, brass); ring.rotation.x = Math.PI / 2;
      const holderScrew = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), 0xb08d3c, 0, 0.11, 0.3, unit, brass); holderScrew.rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.2, 20), 0xb08d3c, 0, 0.29, 0, bodies[unitIndex], brass);
      [0.25, 0.3, 0.35].forEach(y => { const thread = mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 20), 0x8a6e2c, 0, y, 0, bodies[unitIndex], brass); thread.rotation.x = Math.PI / 2; });
      [-0.5, 0.5].forEach(x => {
        mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), 0xc7ced6, x * 0.92, -0.02, 0, unit, brass);
        const nut = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 12), 0xd9b34a, x, 0, 0, unit, brass); nut.rotation.x = Math.PI / 2;
        const screw = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), 0x59636e, x, 0, 0.09, unit, brass); screw.rotation.x = Math.PI / 2;
      });
    });
    const bulbLabels = units.map((_, i) => label(`Bulb ${i + 1}`, -1.5 + i * 1.5, ROW + 1.1, 1.25, root, 4));
    // Battery holder: a tray with a contact strip and metal end plates. The wires meet the plates, not the cells.
    mesh(new RoundedBoxGeometry(2.0, 0.16, 0.36, 2, 0.04), 0x2b3442, 0, -1.3, 0, root, { roughness: 0.6 });
    mesh(new THREE.BoxGeometry(1.9, 0.02, 0.14), 0xc27c45, 0, -1.215, 0, root, { metalness: 0.8, roughness: 0.3 });
    [-1.0, 1.0].forEach(x => {
      mesh(new THREE.BoxGeometry(0.07, 0.34, 0.3), 0xc7ced6, x, -1.15, 0, root, { metalness: 0.85, roughness: 0.3 });
      const nut = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 12), 0xd9b34a, x, -1.15, 0.17, root, { metalness: 0.85, roughness: 0.3 }); nut.rotation.x = Math.PI / 2;
    });
    // Cells lie end to end (positive nub on the right), filling the slots from the left.
    const batteries = [0, 1, 2].map(i => { const cell = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.52, 18), 0x344a65, -0.6 + i * 0.6, -1.13, 0, root, { roughness: 0.35, metalness: 0.3 }); cell.rotation.z = -Math.PI / 2; return cell; });
    batteries.forEach(cell => {
      mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 18), 0xe8b92e, 0, -0.12, 0, cell, { metalness: 0.7, roughness: 0.3 });
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 10), 0xd3dae2, 0, 0.29, 0, cell, { metalness: 0.9, roughness: 0.2 });
    });
    // Switch on the bottom wire: a hinged lever that closes the gap between two terminals.
    const SW0 = 1.35; const SW1 = 1.85; const SW_Y = -1.15;
    const brassFinish = { metalness: 0.85, roughness: 0.3 };
    mesh(new RoundedBoxGeometry(0.7, 0.1, 0.32, 2, 0.03), 0x2b3442, 1.6, -1.28, 0, root, { roughness: 0.6 });
    [SW0, SW1].forEach(x => { const nut = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 12), 0xd9b34a, x, SW_Y, 0, root, brassFinish); nut.rotation.x = Math.PI / 2; });
    const lever = new THREE.Group(); lever.position.set(SW0, SW_Y, 0.1); root.add(lever);
    mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), 0xd3dae2, 0.25, 0, 0, lever, brassFinish);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), 0x1c2635, 0.5, 0.06, 0, lever, { roughness: 0.5 });
    const switchGrab = new THREE.Group(); switchGrab.position.set(1.6, -1.05, 0); root.add(switchGrab);
    const switchHit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.5), new THREE.MeshBasicMaterial()); switchHit.visible = false; switchGrab.add(switchHit);
    // Ghosts mark empty slots: tap or drag one to put the part back.
    const cellHomes = [0, 1, 2].map(i => new THREE.Vector3(-0.6 + i * 0.6, -1.13, 0));
    const ghostCells = [0, 1, 2].map(i => { const ghost = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.52, 18), 0x59d6ff, cellHomes[i].x, cellHomes[i].y, 0, root, { opacity: 0.3, emissive: 0x59d6ff, emissiveIntensity: 0.5 }); ghost.rotation.z = -Math.PI / 2; return ghost; });
    const ghostBulbs = [0, 1, 2].map(() => {
      const ghost = new THREE.Group(); root.add(ghost);
      mesh(new THREE.SphereGeometry(0.27, 16, 12), 0xffe9a8, 0, LIFT, 0, ghost, { opacity: 0.3, emissive: 0xffd657, emissiveIntensity: 0.4 });
      mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.2, 14), 0xb08d3c, 0, 0.29, 0, ghost, { opacity: 0.35 });
      return ghost;
    });
    label("Tap or drag the lever · drag a cell or bulb out · tap its ghost to add it back", 0, -2.05, 5.4, root, 14);
    const held = { name: "", x: 0, y: 0, dx: 0, dy: 0, angle: 0 };
    let leverAngle = 0.95;
    const bodyHome = new THREE.Vector3(0, 0, 0);
    const batteryKey = id === "home-circuit" ? "b" : "a";
    const outsideHolder = (point: THREE.Vector3) => Math.abs(point.x) > 1.25 || point.y > -0.8 || point.y < -1.6;
    const indexOf = (name: string, prefix: string) => Number(name.slice(prefix.length));
    const installBulb = (i: number, api: InteractionApi) => {
      if (id === "series") { const { b } = api.values(); if (b < 3) api.setControl("b", b + 1); }
      else api.setLab({ branchMask: api.values().lab.branchMask | (1 << i) });
    };
    const removeBulb = (i: number, api: InteractionApi) => {
      if (id === "series") { const { b } = api.values(); if (b > 1) api.setControl("b", b - 1); }
      else api.setLab({ branchMask: api.values().lab.branchMask & ~(1 << i) });
    };
    interact = {
      targets: {
        switch: switchGrab,
        ...Object.fromEntries(batteries.map((cell, i) => [`cell${i}`, cell])),
        ...Object.fromEntries(ghostCells.map((ghost, i) => [`ghostCell${i}`, ghost])),
        ...Object.fromEntries(bodies.map((body, i) => [`bulb${i}`, body])),
        ...Object.fromEntries(ghostBulbs.map((ghost, i) => [`ghostBulb${i}`, ghost])),
      },
      down: (name, point) => {
        held.name = name; held.x = point.x; held.y = point.y;
        if (name === "switch") held.angle = leverAngle;
        else if (name.startsWith("ghostCell")) { const ghost = ghostCells[indexOf(name, "ghostCell")]; held.dx = ghost.position.x - point.x; held.dy = ghost.position.y - point.y; }
        else if (name.startsWith("cell")) { const cell = batteries[indexOf(name, "cell")]; held.dx = cell.position.x - point.x; held.dy = cell.position.y - point.y; }
        else if (name.startsWith("ghostBulb")) { const ghost = ghostBulbs[indexOf(name, "ghostBulb")]; held.dx = ghost.position.x - point.x; held.dy = ghost.position.y - point.y; }
        else if (name.startsWith("bulb")) { const i = indexOf(name, "bulb"); const size = units[i].scale.x; held.dx = bodies[i].position.x - (point.x - units[i].position.x) / size; held.dy = bodies[i].position.y - (point.y - units[i].position.y) / size; }
      },
      move: (name, point) => {
        held.x = point.x; held.y = point.y;
        // The lever follows the finger around its hinge.
        if (name === "switch") held.angle = Math.max(0, Math.min(0.95, Math.atan2(point.y - SW_Y, point.x - SW0)));
      },
      up: (name, point, moved, api) => {
        const { a, b, lab } = api.values();
        const count = id === "home-circuit" ? b : a;
        if (name === "switch") api.setLab({ closed: moved < 8 ? !lab.closed : held.angle < 0.45 });
        else if (name.startsWith("ghostCell")) { if ((moved < 8 || !outsideHolder(point)) && count < 3) api.setControl(batteryKey, count + 1); }
        else if (name.startsWith("cell")) { if (moved >= 8 && outsideHolder(point) && count > 1) api.setControl(batteryKey, count - 1); }
        else if (name.startsWith("ghostBulb")) { const i = indexOf(name, "ghostBulb"); if (moved < 8 || Math.hypot(point.x - units[i].position.x, point.y - units[i].position.y - LIFT * units[i].scale.x) < 0.9) installBulb(i, api); }
        else if (name.startsWith("bulb")) { const i = indexOf(name, "bulb"); if (moved >= 8 && Math.hypot(bodies[i].position.x, bodies[i].position.y) > 0.9) removeBulb(i, api); }
        held.name = "";
      },
      cancel: () => { held.name = ""; },
    };
    const batteryLabel = label("", 0, -1.62, 3);
    const switchLabel = label("", 0, 1.85, 4);
    const electrons = instanced(new THREE.SphereGeometry(0.065, 8, 6), 0x00a7e6, 24, root, { emissive: 0x00a7e6, emissiveIntensity: 1.4, roughness: 0.3 });
    const electronAt = new THREE.Vector3();
    let signature = "";
    let paths: THREE.Vector3[][] = [];
    updates.push((time, a, b, lab) => {
      const c = circuitState(id, a, b, lab);
      const next = `${c.parallel}:${c.count}:${lab.branchMask}:${b}`;
      const installedBulb = (i: number) => id === "series" ? i < b : Boolean(lab.branchMask & (1 << i));
      if (next !== signature) {
        signature = next;
        wiring.traverse(object => { const item = object as THREE.Mesh; if (item.geometry) { item.geometry.dispose(); (item.material as THREE.Material).dispose(); } }); wiring.clear(); paths = [];
        if (c.parallel) {
          wire([[-2.2, -1.15], [-2.2, 1.0]], wiring); wire([[2.2, -1.15], [2.2, 1.0]], wiring);
          const half = 0.5 * PARALLEL_SCALE;
          for (let i = 0; i < 3; i++) { const y = 1.0 - i * 0.75; units[i].position.set(0.8, y, 0); units[i].scale.setScalar(PARALLEL_SCALE); bulbLabels[i].sprite.position.set(1.85, y + 0.2, 0.18); if (lab.branchMask & (1 << i)) { const points = [[0, -1.15], [-2.2, -1.15], [-2.2, y], [2.2, y], [2.2, -1.15], [0, -1.15]]; wire(points, wiring, [{ y: -1.15, x0: -1.0, x1: 1.0 }, { y: -1.15, x0: SW0, x1: SW1 }, { y, x0: 0.8 - half, x1: 0.8 + half }]); paths.push(points.map(p => new THREE.Vector3(p[0], p[1], 0))); } }
        } else {
          const points = [[0, -1.15], [-2.2, -1.15], [-2.2, ROW], [2.2, ROW], [2.2, -1.15], [0, -1.15]]; wire(points, wiring, [{ y: -1.15, x0: -1.0, x1: 1.0 }, { y: -1.15, x0: SW0, x1: SW1 }, ...[0, 1, 2].filter(installedBulb).map(i => ({ y: ROW, x0: -1.5 + i * 1.5 - 0.5, x1: -1.5 + i * 1.5 + 0.5 }))]); paths = [points.map(p => new THREE.Vector3(p[0], p[1], 0))];
          units.forEach((unit, i) => { unit.position.set(-1.5 + i * 1.5, ROW, 0); unit.scale.setScalar(1); bulbLabels[i].sprite.position.set(-1.5 + i * 1.5, ROW + 1.1, 0.18); });
        }
      }
      batteries.forEach((battery, i) => { battery.visible = i < (id === "home-circuit" ? b : a); battery.material.color.setHex(c.tripped ? 0xd63242 : 0x344a65); });
      batteryLabel.set(`${c.voltage} V · ${c.current.toFixed(2)} A total`);
      switchLabel.set(c.tripped ? "Fuse OPEN (> 1.5 A)" : lab.closed ? "Switch CLOSED" : "Switch OPEN");
      units.forEach((unit, i) => {
        const installed = installedBulb(i);
        const brightness = c.current > 0 && installed ? Math.min(2, c.power / 1.7) : 0;
        const bulb = glass[i];
        unit.visible = installed; bulbLabels[i].sprite.visible = installed;
        bulb.material.emissive.setHex(0xffb000); bulb.material.emissiveIntensity = brightness;
        bulb.material.color.setHex(c.current > 0 ? 0xffd657 : 0x617183);
        bulbGlows[i].material.opacity = Math.min(0.85, brightness * 0.45) * (0.92 + 0.08 * Math.sin(time * 9 + i));
      });
      // Touch-driven parts: the lever, cells and bulbs follow the finger; ghosts mark empty slots.
      const count = id === "home-circuit" ? b : a;
      if (held.name === "switch") leverAngle = held.angle; else leverAngle += ((lab.closed ? 0 : 0.95) - leverAngle) * 0.3;
      lever.rotation.z = leverAngle;
      batteries.forEach((cell, i) => { if (held.name === `cell${i}`) cell.position.set(held.x + held.dx, held.y + held.dy, 0.25); else cell.position.lerp(cellHomes[i], 0.3); });
      ghostCells.forEach((ghost, i) => { ghost.visible = i === count && count < 3; if (held.name === `ghostCell${i}`) ghost.position.set(held.x + held.dx, held.y + held.dy, 0.25); else ghost.position.lerp(cellHomes[i], 0.3); });
      bodies.forEach((body, i) => { if (held.name === `bulb${i}`) body.position.set((held.x - units[i].position.x) / units[i].scale.x + held.dx, (held.y - units[i].position.y) / units[i].scale.x + held.dy, 0.3); else body.position.lerp(bodyHome, 0.3); });
      ghostBulbs.forEach((ghost, i) => {
        ghost.visible = id === "series" ? i === b && b < 3 : !installedBulb(i);
        if (held.name === `ghostBulb${i}`) { ghost.position.set(held.x + held.dx, held.y + held.dy, 0.3); ghost.scale.setScalar(units[i].scale.x); }
        else { ghost.position.lerp(units[i].position, 0.3); ghost.scale.copy(units[i].scale); }
      });
      for (let i = 0; i < 24; i++) { if (!(c.current > 0 && paths.length > 0)) { electrons.hide(i); continue; } const path = paths[i % paths.length]; const progress = ((time * c.branchCurrent * 0.45 + i / 24) % 1) * (path.length - 1); const segment = Math.floor(progress); electronAt.copy(path[segment]).lerp(path[segment + 1], progress - segment); electrons.place(i, electronAt.x, electronAt.y, electronAt.z, 1); }
    });
  } else if (id === "chemical-change") {
    mesh(new RoundedBoxGeometry(4.2, 0.14, 1.2, 2, 0.04), 0x9b7548, 0, -0.9, 0, root, { roughness: 0.7 });
    mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.06, 32), 0xbfe3ef, 0, -0.8, 0, root, { opacity: 0.55, roughness: 0.05 });
    [-0.5, -0.2, 0.1, 0.4].forEach(y => mesh(new THREE.BoxGeometry(0.3, 0.014, 0.02), 0x35566b, 0, y, 0.88));
    // Vinegar bottle on the left, baking soda jar on the right.
    const bottle = new THREE.Group(); bottle.position.set(-1.6, -0.83, 0); root.add(bottle);
    mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 20), 0xc9863b, 0, 0.45, 0, bottle, { opacity: 0.88, roughness: 0.15 });
    mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.3, 14), 0xc9863b, 0, 1.05, 0, bottle, { opacity: 0.88, roughness: 0.15 });
    mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.1, 14), 0xf4f7fa, 0, 1.25, 0, bottle, { roughness: 0.4 });
    mesh(new THREE.BoxGeometry(0.36, 0.34, 0.02), 0xf4f7fa, 0, 0.42, 0.285, bottle, { roughness: 0.5 });
    const jarSoda = new THREE.Group(); jarSoda.position.set(1.6, -0.83, 0); root.add(jarSoda);
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 22), 0xf2f2ee, 0, 0.3, 0, jarSoda, { roughness: 0.35 });
    mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.1, 22), 0x2f6fb0, 0, 0.65, 0, jarSoda, { roughness: 0.4 });
    mesh(new THREE.BoxGeometry(0.4, 0.22, 0.02), 0x2f6fb0, 0, 0.3, 0.305, jarSoda, { roughness: 0.5 });
    const jar = mesh(new THREE.CylinderGeometry(0.9, 0.8, 1.6, 32, 1, true), 0x9fd8ea, 0, 0, 0, root, { opacity: 0.2, roughness: 0.04, metalness: 0.1 });
    const rim = mesh(new THREE.TorusGeometry(0.9, 0.03, 8, 40), 0xd6eef7, 0, 0.8, 0, root, { opacity: 0.7, roughness: 0.1 }); rim.rotation.x = Math.PI / 2;
    void jar;
    const liquid = mesh(new THREE.CylinderGeometry(0.76, 0.7, 0.55, 32), 0x7cbacd, 0, -0.47, 0, root, { opacity: 0.9, roughness: 0.1 });
    const powder = mesh(new THREE.ConeGeometry(0.4, 0.3, 24), 0xfaf3db, 0, -0.5);
    const foam = instanced(new THREE.SphereGeometry(0.12, 10, 8), 0xf3fbfd, 12, root, { roughness: 0.4 });
    const bubbles = instanced(new THREE.SphereGeometry(0.065, 8, 6), 0xffffff, 25, root, { opacity: 0.8, roughness: 0.1 });
    label("Vinegar + baking soda", 0, -1.2, 4);
    label("Drag the bottle or the jar over the beaker", 0, -1.75, 4.6, root, 11);
    const result = label("", 0, 1.65, 4.7);
    const bottleHome = new THREE.Vector3(-1.6, -0.83, 0); const jarHome = new THREE.Vector3(1.6, -0.83, 0);
    const held = { name: "", dx: 0, dy: 0, over: false };
    const overBeaker = (point: THREE.Vector3) => Math.abs(point.x) < 1.15 && point.y > -0.5;
    const holding = (name: string) => name === "bottle" ? bottle : jarSoda;
    interact = {
      targets: { bottle, jar: jarSoda },
      down: (name, point) => { const item = holding(name); held.name = name; held.dx = item.position.x - point.x; held.dy = item.position.y - point.y; held.over = false; },
      move: (name, point) => { held.over = overBeaker(point); holding(name).position.set(point.x + held.dx, Math.max(-0.83, point.y + held.dy), 0); },
      up: (name, point, moved, api) => {
        if (moved < 8 || overBeaker(point)) {
          const { a, b } = api.values();
          if (name === "bottle" && a < 3) api.setControl("a", a + 1);
          if (name === "jar" && b < 3) api.setControl("b", b + 1);
          api.restart();
        }
        held.name = ""; held.over = false;
      },
      cancel: () => { held.name = ""; held.over = false; },
    };
    updates.push((time, a, b) => {
      // Containers follow the finger, tip toward the beaker when over it, and slide back home when let go.
      if (held.name !== "bottle") bottle.position.lerp(bottleHome, 0.25);
      if (held.name !== "jar") jarSoda.position.lerp(jarHome, 0.25);
      bottle.rotation.z += ((held.name === "bottle" && held.over ? -0.9 : 0) - bottle.rotation.z) * 0.25;
      jarSoda.rotation.z += ((held.name === "jar" && held.over ? 0.9 : 0) - jarSoda.rotation.z) * 0.25;
      const reaction = a > 0 && b > 0 ? Math.min(a, b) / 3 : 0;
      liquid.visible = a > 0; powder.visible = b > 0 && !reaction;
      liquid.scale.y = 1 + reaction * 0.5; liquid.position.y = -0.47 + reaction * 0.07;
      liquid.material.color.setHex(reaction ? 0xcfeaf1 : 0x7cbacd);
      result.set(a && b ? "New substance: CO₂ gas ↑" : "Add both ingredients to react");
      for (let i = 0; i < 12; i++) foam.place(i, Math.cos(i * 2.4) * (0.15 + (i % 4) * 0.13), -0.17 + reaction * 0.18, Math.sin(i * 2.4) * (0.15 + (i % 4) * 0.13), reaction * (0.7 + 0.3 * Math.sin(time * 5 + i)));
      for (let i = 0; i < 25; i++) {
        if (!(a > 0 && b > 0 && i < Math.min(a, b) * 8)) { bubbles.hide(i); continue; }
        const age = ((time * 0.6 + i * 0.11) % 1.65) / 1.65;
        bubbles.place(i, Math.sin(i * 2.4) * 0.55 + Math.sin(time * 3 + i) * 0.05, -0.3 + age * 1.65, Math.cos(i * 2.4) * 0.3, (0.6 + age * 0.9) * (age > 0.86 ? Math.max(0, 1 - (age - 0.86) / 0.14) : 1));
      }
    });
  } else if (id === "bonding") {
    const sodium = sphere(0xab86da, -1.15, 0, 0.48, root, { roughness: 0.3, metalness: 0.15 }); const chlorine = sphere(0x4caf71, 1.15, 0, 0.6, root, { roughness: 0.3, metalness: 0.15 }); const hydrogen = sphere(0xe0e9f2, 0, -1, 0.25, root, { roughness: 0.3 });
    const first = label("Na", -1.15, 0.95, 0.9, root, 2); const second = label("Cl", 1.15, 0.95, 0.9, root, 2); const third = label("H", 0, -1.5, 0.6, root, 2);
    const electrons = Array.from({ length: 8 }, () => sphere(0xffca28, 0, 0, 0.07, root, { emissive: 0xffa000, emissiveIntensity: 0.9 }));
    const shared = Array.from({ length: 4 }, () => sphere(0xffca28, 0, 0, 0.07, root, { emissive: 0xffa000, emissiveIntensity: 0.9 }));
    // Draggable electron tokens: sodium's outer electron (ionic) or an electron pair (covalent).
    const grabArea = (parent: THREE.Object3D, radius: number) => { const area = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), new THREE.MeshBasicMaterial()); area.visible = false; parent.add(area); };
    grabArea(electrons[7], 0.35);
    const pairHome = new THREE.Vector3(0, 0.95, 0.12);
    const pairToken = new THREE.Group(); pairToken.position.copy(pairHome); root.add(pairToken);
    [-0.09, 0.09].forEach(x => sphere(0xffca28, x, 0, 0.09, pairToken, { emissive: 0xffa000, emissiveIntensity: 1.1 }));
    grabArea(pairToken, 0.32);
    const bondHint = label("", 0, -1.9, 4.8, root, 11);
    const held = { name: "", x: 0, y: 0 };
    interact = {
      targets: { electron: electrons[7], pair: pairToken },
      down: (name, point) => { held.name = name; held.x = point.x; held.y = point.y; },
      move: (_name, point) => { held.x = point.x; held.y = point.y; },
      up: (name, point, moved, api) => {
        const { a, lab } = api.values();
        const tap = moved < 8;
        if (name === "electron" && !a && lab.electrons === 0 && (tap || Math.hypot(point.x - 1.15, point.y) < 1.1)) api.setLab({ electrons: 1 });
        else if (name === "pair" && a && lab.electrons < 2 && (tap || Math.hypot(point.x, point.y) < 0.7 || Math.hypot(point.x - 0.575, point.y + 0.5) < 0.7)) api.setLab({ electrons: lab.electrons + 1 });
        held.name = "";
      },
      cancel: () => { held.name = ""; },
    };
    const shellCl = mesh(new THREE.TorusGeometry(0.78, 0.012, 6, 64), 0x9fb4c9, 1.15, 0, 0, root, { opacity: 0.55 });
    const shellNa = mesh(new THREE.TorusGeometry(0.68, 0.012, 6, 64), 0x9fb4c9, -1.15, 0, 0, root, { opacity: 0.55 });
    const bond1 = line([[-1.15, 0], [1.15, 0]], 0x567890); const bond2 = line([[1.15, 0], [0, -1]], 0x567890);
    updates.push((time, a, b, lab) => {
      root.rotation.y = b * Math.PI / 8;
      shellNa.visible = !a && !lab.electrons;
      pairToken.visible = Boolean(a) && lab.electrons < 2;
      if (held.name === "pair") pairToken.position.set(held.x, held.y, 0.12); else pairToken.position.lerp(pairHome, 0.25);
      bondHint.set(a ? (lab.electrons < 2 ? "Drag the electron pair onto an O–H bond" : "Both bonds formed") : lab.electrons ? "Electron transferred: Na⁺ and Cl⁻" : "Drag sodium's outer electron to chlorine");
      sodium.material.color.setHex(a ? 0xe0e9f2 : 0xab86da); chlorine.material.color.setHex(a ? 0xea615b : 0x4caf71);
      first.set(a ? "H" : lab.electrons ? "Na⁺" : "Na"); second.set(a ? "O" : lab.electrons ? "Cl⁻" : "Cl"); hydrogen.visible = third.sprite.visible = Boolean(a);
      bond1.visible = a ? lab.electrons >= 1 : false; bond2.visible = Boolean(a && lab.electrons >= 2);
      const spin = time * 0.9;
      electrons.forEach((electron, i) => { electron.visible = a ? i < 4 : true; if (a) electron.position.set(1.15 + Math.cos(i * 0.25 + 0.7 + spin) * 0.78, Math.sin(i * 0.25 + 0.7 + spin) * 0.78, 0); else if (i === 7 && !lab.electrons) electron.position.set(-1.15, -0.68, 0); else electron.position.set(1.15 + Math.cos(i * Math.PI / 4 + spin) * 0.78, Math.sin(i * Math.PI / 4 + spin) * 0.78, 0); });
      if (held.name === "electron") electrons[7].position.set(held.x, held.y, 0.1);
      shared.forEach((electron, i) => { electron.visible = Boolean(a && i < lab.electrons * 2); electron.position.set((i < 2 ? (i % 2) * 0.18 - 0.09 : 0.52 + (i % 2) * 0.16) + Math.sin(time * 4 + i) * 0.03, (i < 2 ? 0 : -0.5) + Math.cos(time * 4 + i) * 0.03, 0.12); });
    });
  } else if (id === "seismic") {
    // Each hammer strike sends a pulse through the rock. P-pulses are fast and push-pull, S-pulses are slower and sideways,
    // and a station on the rock records when the pulse arrives (the delay grows with distance).
    const X0 = -2.4;
    const medium = mesh(new THREE.BoxGeometry(4.8, 1.5, 0.12), 0x6b5443, 0, 0, -0.2, root, { roughness: 0.7 });
    const fronts = [0, 1].map(() => mesh(new THREE.PlaneGeometry(0.16, 1.5), 0xffffff, 0, 0, -0.12, root, { opacity: 0.22, emissive: 0xffffff, emissiveIntensity: 0.4 }));
    const COLS = 24; const TRACE = 100; const tone = new THREE.Color();
    const particles = instanced(new THREE.SphereGeometry(0.055, 8, 6), 0xffffff, COLS * 3, root, { emissive: 0xffa000, emissiveIntensity: 0.35 });
    // Thin rows joining the particles, so you can see the rock itself stretch and shear.
    const rows = [0, 1, 2].map(() => {
      const geometry = new THREE.BufferGeometry(); const attribute = new THREE.BufferAttribute(new Float32Array(COLS * 3), 3); geometry.setAttribute("position", attribute);
      root.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.5 }))); return attribute;
    });
    const sparks = instanced(new THREE.SphereGeometry(0.04, 6, 5), 0xffd27a, 10, root, { emissive: 0xffa000, emissiveIntensity: 1.2 });
    const wave = label("", 0, 1.55, 4.5);
    const hammer = new THREE.Group(); hammer.position.set(-2.55, 0.85, 0); root.add(hammer);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), 0x8a6a4a, 0, -0.35, 0, hammer);
    mesh(new THREE.BoxGeometry(0.3, 0.22, 0.22), 0x59636e, 0, -0.72, 0, hammer, { metalness: 0.8, roughness: 0.3 });
    const hammerGrab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.4, 0.6), new THREE.MeshBasicMaterial()); hammerGrab.visible = false; hammerGrab.position.set(0, -0.45, 0); hammer.add(hammerGrab);
    const station = new THREE.Group(); root.add(station);
    const marker = mesh(new THREE.ConeGeometry(0.2, 0.4, 3), 0xff8a3d, 0, 0, 0, station, { emissive: 0xff6a00, emissiveIntensity: 0.5 }); marker.rotation.z = Math.PI;
    const stationGrab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.5), new THREE.MeshBasicMaterial()); stationGrab.visible = false; station.add(stationGrab);
    mesh(new RoundedBoxGeometry(4.8, 0.8, 0.08, 2, 0.03), 0x0f1c2e, 0, -1.8, -0.1, root, { roughness: 0.8 });
    const readout = label("", 0, -2.38, 4.2, root, 11);
    label("Drag the station · pull the hammer back · tap the rock or the wave label", 0, -2.85, 5.4, root, 14);
    label("Travel direction →", 0, -1.1, 3.5);
    const traceValues = new Float32Array(TRACE * 3);
    for (let j = 0; j < TRACE; j++) { traceValues[j * 3] = -2.25 + j * (4.5 / (TRACE - 1)); traceValues[j * 3 + 2] = -0.02; }
    const traceAttribute = new THREE.BufferAttribute(traceValues, 3);
    const traceGeometry = new THREE.BufferGeometry(); traceGeometry.setAttribute("position", traceAttribute);
    root.add(new THREE.Line(traceGeometry, new THREE.LineBasicMaterial({ color: 0x5cff9d })));
    line([[-2.3, -1.8, -0.04], [2.3, -1.8, -0.04]], 0x2c4a63);

    const strikes: { t: number; amp: number; swingStart?: number; pull?: number; windStart?: number; windFrom?: number }[] = [];
    let lastTime = -1; let stationX = 1.9; let autoOn = true; let period = 2.2;
    // When the next automatic strike lands (null when auto strike is off). The hammer winds up, swings and recoils around each one.
    let nextStrike: number | null = 1.6;
    const autoLabel = label("Auto strike: ON", -1.6, 2.02, 2.4, root, 7);
    const held = { name: "", angle: 0 };
    const grabStart = new THREE.Vector3(); let grabBase = 0;
    interact = {
      targets: { hammer, station, rock: medium, waves: wave.sprite, auto: autoLabel.sprite },
      // Start from wherever the hammer is right now, so grabbing it mid wind-up does not snap it.
      down: (name, point) => { held.name = name === "hammer" || name === "station" ? name : ""; grabBase = hammer.rotation.z; held.angle = grabBase; grabStart.copy(point); },
      move: (name, point) => {
        // Pulling left, or down and left, from wherever you grabbed it winds the hammer back.
        if (name === "hammer") held.angle = Math.max(-1.25, Math.min(0, grabBase - 1.25 * ((grabStart.x - point.x) + 0.5 * (grabStart.y - point.y)) / 0.9));
        else if (name === "station") stationX = Math.max(-1.7, Math.min(2.1, point.x));
      },
      up: (name, _point, moved, api) => {
        if (name === "hammer") {
          let hitAt: number;
          if (moved >= 8) {
            // Released after pulling back: swing from exactly where the finger left it.
            const pull = Math.max(0.3, Math.abs(held.angle)); hitAt = lastTime + 0.16;
            strikes.push({ t: hitAt, amp: 0.5 + 0.8 * Math.min(1, pull / 1.2), swingStart: lastTime, pull });
          } else {
            // A tap: wind up quickly from the current pose, then swing.
            hitAt = lastTime + 0.4;
            strikes.push({ t: hitAt, amp: 0.9, windStart: lastTime, windFrom: hammer.rotation.z, swingStart: lastTime + 0.18, pull: 0.6 });
          }
          if (strikes.length > 4) strikes.shift();
          nextStrike = autoOn ? hitAt + period : null;
        }
        else if (name === "rock" && moved < 8) api.setControl("b", 1 - api.values().b);
        else if (name === "waves" && moved < 8) api.setControl("a", 1 - api.values().a);
        else if (name === "auto" && moved < 8) { autoOn = !autoOn; nextStrike = autoOn ? lastTime + 1.2 : null; }
        held.name = "";
      },
      cancel: () => { held.name = ""; },
    };
    updates.push((time, a, b) => {
      period = a ? 3.6 : 2.2;
      autoLabel.set(autoOn ? "Auto strike: ON" : "Auto strike: OFF");
      if (time < lastTime - 0.01) { strikes.length = 0; nextStrike = autoOn ? 1.6 : null; }
      lastTime = time;
      if (nextStrike !== null && time >= nextStrike) { strikes.push({ t: nextStrike, amp: 1, swingStart: nextStrike - 0.3, pull: 0.9 }); if (strikes.length > 4) strikes.shift(); nextStrike = autoOn ? nextStrike + period : null; }
      const blocked = Boolean(a && b);
      const K = 5; const speed = a ? 1.0 : 1.75; const freq = K * speed;
      const field = (x: number, t: number) => strikes.reduce((sum, hit) => {
        const age = t - hit.t; if (age < 0) return sum;
        const envelope = Math.exp(-(((x - X0 - speed * age) / 0.9) ** 2));
        const damp = blocked ? Math.exp(-(x - X0) * 2.2) : 1;
        return sum + hit.amp * envelope * damp * Math.sin(K * (x - X0) - freq * age);
      }, 0) * 0.18;

      wave.set(blocked ? "S-wave blocked by liquid" : a ? "S-wave: transverse displacement" : "P-wave: compression and expansion");
      medium.material.color.setHex(b ? 0x2f6f9d : 0x6b5443);
      for (let i = 0; i < COLS * 3; i++) {
        const c = i % COLS; const r = Math.floor(i / COLS);
        const x = -2.07 + c * 0.18; const y = -0.45 + r * 0.45;
        const offset = field(x, time);
        const ox = x + (a ? 0 : offset); const oy = y + (a ? offset : 0);
        const strength = Math.min(1.4, Math.abs(offset) / 0.18);
        particles.place(i, ox, oy, 0, 1 + strength * 0.5);
        particles.tint(i, tone.setHSL(0.13 - Math.min(1, strength) * 0.11, 0.95, 0.55));
        rows[r].setXYZ(c, ox, oy, -0.02);
      }
      rows.forEach(attribute => { attribute.needsUpdate = true; });
      fronts.forEach((front, k) => { const hit = strikes[strikes.length - 1 - k]; const x = hit ? X0 + speed * (time - hit.t) : 99; front.visible = Boolean(hit) && x > X0 && x < 2.4 && !(blocked && x > X0 + 0.7); front.position.x = x; });
      // Sparks fly out where the hammer lands.
      const recent = strikes[strikes.length - 1]; const spark = recent ? time - recent.t : -1;
      for (let i = 0; i < 10; i++) { if (spark < 0 || spark > 0.5) { sparks.hide(i); continue; } const ang = (i / 10) * Math.PI - Math.PI / 2; sparks.place(i, X0 + 0.05 + Math.cos(ang) * spark * 0.9, Math.sin(ang) * spark * 1.1, 0.12, 1 - spark / 0.5); }
      // Hammer: follows the finger while held, swings after release, and otherwise winds up just before each automatic strike.
      // Each strike: slow wind-up, an accelerating swing that lands exactly on the strike time, then a small recoil off the rock.
      let angle = 0;
      for (const hit of strikes) {
        if (hit.windStart !== undefined && hit.windFrom !== undefined && hit.swingStart !== undefined && hit.pull !== undefined && time >= hit.windStart && time < hit.swingStart) {
          const u = (time - hit.windStart) / (hit.swingStart - hit.windStart);
          angle = Math.min(angle, hit.windFrom + (-hit.pull - hit.windFrom) * (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2));
        }
        if (hit.swingStart !== undefined && hit.pull !== undefined && time >= hit.swingStart && time <= hit.t) angle = Math.min(angle, -hit.pull * (1 - ((time - hit.swingStart) / (hit.t - hit.swingStart)) ** 2));
        const since = time - hit.t;
        if (since > 0 && since < 0.3) { const v = since / 0.3; angle = Math.min(angle, -0.22 * Math.sin(Math.PI * v) * (1 - v)); }
      }
      if (nextStrike !== null) {
        const windStart = nextStrike - 1.1; const swingStart = nextStrike - 0.3;
        if (time >= windStart && time < swingStart) { const u = (time - windStart) / (swingStart - windStart); angle = Math.min(angle, -0.9 * (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2)); }
        else if (time >= swingStart && time <= nextStrike) angle = Math.min(angle, -0.9 * (1 - ((time - swingStart) / 0.3) ** 2));
      }
      hammer.rotation.z = held.name === "hammer" ? held.angle : angle;
      station.position.set(stationX, 0.98, 0.1);
      const arrival = (stationX - X0) / speed;
      readout.set(held.name === "hammer" ? `Pull back, then let go · power ${Math.round(Math.abs(held.angle) / 1.25 * 100)}%` : blocked ? "No S-wave reaches the station" : `Station ${(stationX - X0).toFixed(1)} away · pulse arrives after ${arrival.toFixed(1)} s`);
      for (let j = 0; j < TRACE; j++) traceValues[j * 3 + 1] = -1.8 + Math.max(-0.36, Math.min(0.36, field(stationX, time - (TRACE - 1 - j) * 0.04) * 1.7));
      traceAttribute.needsUpdate = true;
    });
  } else if (id === "earth-scale") {
    // A globe with a quarter cut away, so every layer shows on the two flat cut faces (radii to scale).
    const R = 1.75;
    const scale = R / 6371;
    const cut = Math.PI / 2;
    const phiStart = Math.PI / 2 + cut / 2; const phiLength = Math.PI * 2 - cut;
    const globe = new THREE.Group(); globe.rotation.x = 0.32; root.add(globe);

    // Surface: painted oceans and continents (generated, no image asset).
    const earthCanvas = document.createElement("canvas"); earthCanvas.width = 1024; earthCanvas.height = 512;
    const paint = earthCanvas.getContext("2d")!;
    paint.fillStyle = "#1d5fa6"; paint.fillRect(0, 0, 1024, 512);
    let seed = 11; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 24; k++) {
      const cx = random() * 1024; const cy = 90 + random() * 330; const size = 30 + random() * 70;
      paint.fillStyle = random() > 0.35 ? "#4f9a4b" : "#8a7d43"; paint.beginPath();
      for (let i = 0; i <= 14; i++) { const angle = i / 14 * Math.PI * 2; const radius = size * (0.6 + random() * 0.7); const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle) * radius * 0.7; if (i) paint.lineTo(x, y); else paint.moveTo(x, y); }
      paint.closePath(); paint.fill();
    }
    paint.fillStyle = "#eef4f8"; paint.fillRect(0, 0, 1024, 26); paint.fillRect(0, 486, 1024, 26);
    const surface = new THREE.CanvasTexture(earthCanvas); surface.colorSpace = THREE.SRGBColorSpace;

    // Solid shells for each compositional layer, built from the center outward.
    const buildOrder = [5, 4, 3, 0];
    const shells = earthLayers.map((layer, index) => {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(layer.outer * scale, 56, 40, phiStart, phiLength), new THREE.MeshStandardMaterial({ color: index === 0 ? 0xffffff : layer.color, map: index === 0 ? surface : null, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide }));
      registry.push(shell); globe.add(shell); return shell;
    });
    // Flat cut faces: a half ring per layer on each of the two cut planes.
    const cutAngles = [Math.PI / 2 - cut / 2, Math.PI / 2 + cut / 2];
    const faces = earthLayers.map((layer, index) => cutAngles.map(angle => {
      const face = mesh(new THREE.RingGeometry(layer.inner * scale, layer.outer * scale, 56, 1, -Math.PI / 2, Math.PI), layer.color, 0, 0, 0, globe, { roughness: 0.55, emissive: index >= 4 ? layer.color : undefined, emissiveIntensity: 0.22 });
      face.rotation.y = Math.PI + angle;
      if (index === 1 || index === 2) { face.material.polygonOffset = true; face.material.polygonOffsetFactor = -2; face.material.polygonOffsetUnits = -2; }
      return face;
    }));
    const ghost = mesh(new THREE.SphereGeometry(R, 32, 22, phiStart, phiLength), 0x4a78a8, 0, 0, 0, globe, { opacity: 0.55, roughness: 0.4 }); ghost.material.wireframe = true;
    const air = mesh(new THREE.SphereGeometry(R * 1.06, 40, 28), 0x6fb7ff, 0, 0, 0, globe, { opacity: 0.22, emissive: 0x3d8bff, emissiveIntensity: 0.5 }); air.material.side = THREE.BackSide;
    const caption = label("", 0, 2.3, 5.4);
    // The four layers waiting to be built, center first. Drag one onto the globe, or tap it.
    const chipHomes = buildOrder.map((_, order) => new THREE.Vector3(-2.25 + order * 1.5, -2.3, 0.2));
    const chips = buildOrder.map((layerIndex, order) => {
      const chip = new THREE.Group(); chip.position.copy(chipHomes[order]); root.add(chip);
      mesh(new THREE.SphereGeometry(0.3, 20, 14), earthLayers[layerIndex].color, 0, 0, 0, chip, { roughness: 0.4 });
      label(earthLayers[layerIndex].name, 0, -0.55, 1.4, chip, 4);
      return chip;
    });
    const feedback = { text: "", until: 0 };
    const heldChip = { index: -1, x: 0, y: 0 };
    let sceneTime = 0;
    const tryPlace = (order: number, api: InteractionApi) => {
      const { lab } = api.values();
      if (buildOrder[lab.layers] === buildOrder[order]) { api.setLab({ layers: lab.layers + 1 }); feedback.text = `${earthLayers[buildOrder[order]].name} placed at its scaled radius`; }
      else feedback.text = "Build from the center outward";
      feedback.until = sceneTime + 2.2;
    };

    // Surface-detail view: a 3D slab of the top 350 km with rock textures, depth tags, and brackets for the two ways of naming layers.
    const detail = new THREE.Group(); detail.rotation.x = 0.28; root.add(detail);
    const rock = (baseColor: string, accent: string, kind: "grain" | "flow", seedStart: number) => {
      const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 128;
      const g = canvas.getContext("2d")!; g.fillStyle = baseColor; g.fillRect(0, 0, 256, 128);
      let seedValue = seedStart; const rnd = () => (seedValue = (seedValue * 16807 + 11) % 2147483647) / 2147483647;
      g.fillStyle = accent; g.strokeStyle = accent;
      if (kind === "grain") for (let k = 0; k < 150; k++) { g.globalAlpha = 0.22 + rnd() * 0.35; g.fillRect(rnd() * 256, rnd() * 128, 3 + rnd() * 9, 2 + rnd() * 5); }
      else for (let row = 0; row < 12; row++) { g.globalAlpha = 0.3; g.lineWidth = 6; g.beginPath(); const y0 = row * 11 + 4; for (let x = 0; x <= 256; x += 8) { const y = y0 + Math.sin(x / 256 * Math.PI * 4 + row) * 6; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
      g.globalAlpha = 1;
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; return texture;
    };
    const H = 3.0 / 350; const SLAB_W = 2.0; const SLAB_D = 1.0; const surfaceY = 1.35;
    const spans = [[0, 35], [35, 100], [100, 350]];
    const textures = [rock("#4a8a58", "#24512f", "grain", 3), rock("#35b0aa", "#d5fff8", "grain", 7), rock("#b060c4", "#ffd6ff", "flow", 9)];
    const blocks = spans.map(([from, to], i) => {
      const block = mesh(new THREE.BoxGeometry(SLAB_W, (to - from) * H, SLAB_D), 0xffffff, 0, surfaceY - (from + (to - from) / 2) * H, 0, detail, { roughness: 0.85 });
      block.material.map = textures[i]; return block;
    });
    // Ground on top: grass, a mountain with a snow cap, and a few trees.
    mesh(new THREE.BoxGeometry(SLAB_W, 0.05, SLAB_D), 0x5fae4e, 0, surfaceY + 0.025, 0, detail, { roughness: 0.8 });
    mesh(new THREE.ConeGeometry(0.34, 0.55, 6), 0x8b8f96, 0.45, surfaceY + 0.33, -0.1, detail, { roughness: 0.9 });
    mesh(new THREE.ConeGeometry(0.13, 0.17, 6), 0xf4f7fa, 0.45, surfaceY + 0.52, -0.1, detail, { roughness: 0.6 });
    [[-0.6, 0.15], [-0.35, -0.2], [-0.75, -0.25], [-0.2, 0.25]].forEach(([x, z]) => mesh(new THREE.ConeGeometry(0.1, 0.26, 7), 0x2f7d3c, x, surfaceY + 0.18, z, detail, { roughness: 0.8 }));
    // Brackets: on the left what the rock is made of, on the right how it behaves.
    const bracket = (from: number, to: number, x: number, text: string, side: 1 | -1) => {
      const top = surfaceY - from * H; const bottom = surfaceY - to * H;
      const finish = { metalness: 0.5, roughness: 0.4 };
      mesh(new THREE.BoxGeometry(0.05, top - bottom, 0.05), 0xdde6ef, x, (top + bottom) / 2, 0.5, detail, finish);
      [top, bottom].forEach(y => mesh(new THREE.BoxGeometry(0.2, 0.04, 0.05), 0xdde6ef, x - side * 0.08, y, 0.5, detail, finish));
      label(text, x + side * 0.85, (top + bottom) / 2, 1.5, detail, 4);
    };
    bracket(0, 35, -1.3, "Crust", -1); bracket(35, 432, -1.3, "Mantle to 2,891 km", -1);
    bracket(0, 100, 1.3, "Lithosphere", 1); bracket(100, 350, 1.3, "Asthenosphere", 1);
    [35, 100, 350].forEach(depth => { const tag = label(`${depth} km`, 0.62, surfaceY - depth * H, 0.85, detail, 4); tag.sprite.position.z = 0.55; });
    // Below the asthenosphere the mantle carries on: fade the slab out into orange mantle instead of ending in a hard edge.
    const fadeCanvas = document.createElement("canvas"); fadeCanvas.width = 4; fadeCanvas.height = 64;
    const fadeCtx = fadeCanvas.getContext("2d")!; const fadeGradient = fadeCtx.createLinearGradient(0, 0, 0, 64);
    fadeGradient.addColorStop(0, "rgba(229,139,53,1)"); fadeGradient.addColorStop(1, "rgba(229,139,53,0)");
    fadeCtx.fillStyle = fadeGradient; fadeCtx.fillRect(0, 0, 4, 64);
    const fadeTexture = new THREE.CanvasTexture(fadeCanvas); fadeTexture.colorSpace = THREE.SRGBColorSpace;
    const mantleFade = mesh(new THREE.BoxGeometry(SLAB_W, 0.7, SLAB_D), 0xffffff, 0, surfaceY - 3.0 - 0.35, 0, detail, { roughness: 0.8 });
    mantleFade.material.map = fadeTexture; mantleFade.material.transparent = true; mantleFade.material.depthWrite = false;
    label("Left: what it is made of · Right: how it behaves", 0, -2.68, 5.2, detail, 12);
    label("Tap a layer to select it", 0, -3.05, 3.2, detail, 10);
    // A small copy of the same globe (shared geometry and materials) shows where the magnified slab comes from.
    const mini = new THREE.Group(); mini.scale.setScalar(0.2); mini.position.set(2.4, 1.6, 0.3); mini.rotation.x = 0.32; root.add(mini);
    globe.children.forEach(child => mini.add(child.clone()));
    mini.children.forEach((child, k) => {
      if (k < 6) child.visible = buildOrder.includes(k);
      else if (k < 18) child.visible = buildOrder.includes(Math.floor((k - 6) / 2));
      else child.visible = k !== 18;
      if ((child as THREE.Mesh).isMesh) registry.push(child as THREE.Mesh);
    });
    mesh(new THREE.SphereGeometry(0.16, 10, 8), 0xff4d4d, 0, R, 0, mini, { emissive: 0xff2222, emissiveIntensity: 0.9 });
    const zoomLine = line([[2.36, 1.9, 0.3], [1.1, 1.5, 0.3]], 0xff4d4d);
    const zoomLabel = label("Zoomed in here", 2.4, 1.18, 1.4, root, 5);
    interact = {
      targets: { crust: blocks[0], upper: blocks[1], soft: blocks[2], chip0: chips[0], chip1: chips[1], chip2: chips[2], chip3: chips[3] },
      down: (name, point) => { if (name.startsWith("chip")) { heldChip.index = Number(name.slice(4)); heldChip.x = point.x; heldChip.y = point.y; } },
      move: (name, point) => { if (name.startsWith("chip")) { heldChip.x = point.x; heldChip.y = point.y; } },
      up: (name, point, moved, api) => {
        if (name.startsWith("chip")) { if (moved < 8 || Math.hypot(point.x, point.y) < 2.0) tryPlace(Number(name.slice(4)), api); heldChip.index = -1; }
        else if (moved < 8) api.setControl("b", name === "crust" ? 0 : name === "upper" ? 1 : 2);
      },
      cancel: () => { heldChip.index = -1; },
    };
    updates.push((time, a, b, lab) => {
      globe.visible = !a; detail.visible = Boolean(a);
      textures[2].offset.x = (time * 0.05) % 1;
      mini.visible = Boolean(a); zoomLine.visible = Boolean(a); zoomLabel.sprite.visible = Boolean(a); mini.rotation.y = Math.sin(time * 0.45) * 0.28;
      sceneTime = time;
      chips.forEach((chip, order) => {
        chip.visible = !a && order >= lab.layers;
        if (heldChip.index === order) chip.position.set(heldChip.x, heldChip.y, 0.3); else chip.position.lerp(chipHomes[order], 0.25);
        chip.scale.setScalar(order === lab.layers ? 1 + 0.08 * Math.sin(time * 4) : 0.9);
      });
      blocks.forEach((block, i) => { const on = b === 0 ? i === 0 : b === 1 ? i <= 1 : b === 2 ? i === 2 : false; block.material.emissive.setHex(on ? [0x4a8a58, 0x35b0aa, 0xb060c4][i] : 0); block.material.emissiveIntensity = on ? 0.45 + 0.25 * Math.sin(time * 3) : 0; });
      globe.rotation.y = Math.sin(time * 0.45) * 0.28;
      const complete = lab.layers === 4;
      air.visible = complete; ghost.visible = !complete;
      earthLayers.forEach((_, i) => {
        const order = buildOrder.indexOf(i);
        const built = order >= 0 && order < lab.layers;
        shells[i].visible = built;
        const overlay = i === 1 || i === 2;
        const selected = i === b;
        faces[i].forEach(face => {
          face.visible = overlay ? complete && selected : built;
          face.material.emissive.setHex(selected ? 0x554422 : i >= 4 ? earthLayers[i].color : 0);
          face.material.emissiveIntensity = selected ? 0.7 + 0.5 * Math.sin(time * 3) : 0.22;
        });
      });
      caption.set(!a && time < feedback.until ? feedback.text : lab.layers === 0 && !a ? "Drag the Inner core onto the globe to start" : lab.layers < 4 && !a ? "Now add the next layer, working outward" : `${earthLayers[b].name}: ${earthLayers[b].depth}`);
    });
  } else if (id === "replication" || id === "mutation") {
    const colors: Record<string, number> = { A: 0x3ea870, T: 0xd76164, C: 0x408bd0, G: 0xd8b238, "": 0x9caaba };
    const count = id === "replication" ? 24 : 25;
    const bases = Array.from({ length: count }, () => sphere(0x9caaba, 0, 0, 0.14, root, { roughness: 0.3, metalness: 0.1 }));
    const labels = bases.map(() => label("?", 0, 0, 0.28, root, 1));
    const bonds = id === "replication" ? Array.from({ length: 12 }, () => line([[0, 0], [0, 0]], 0x617e93)) : [];
    const captions = [label("", 0, 1.9, 5), label("", 0, -1.8, 5)];
    updates.push((time, a, b, lab) => {
      if (id === "replication") {
        root.rotation.y = b * Math.PI / 12;
        captions[0].set(a ? "Daughter 1: old + new" : "Original DNA: paired templates"); captions[1].set(a ? "Daughter 2: old + new" : "Separate the strands to copy");
        bases.forEach((base, i) => { const row = Math.floor(i / 6); const col = i % 6; const old = row === 0 || row === 2; const value = row === 0 ? template[col] : row === 2 ? complement(template[col]) : lab.basePairs[(row === 1 ? 0 : 6) + col]; const correct = old || value === (row === 1 ? complement(template[col]) : template[col]); base.visible = labels[i].sprite.visible = Boolean(a) || old; base.position.set(-1.75 + col * 0.7, (a ? 1.1 - row * 0.7 : row === 0 ? 0.4 : -0.4) + Math.sin(time * 2 + col) * 0.03, 0); base.material.color.setHex(!value ? colors[""] : correct ? colors[value] : 0xe64b38); labels[i].set(value || "?"); labels[i].sprite.position.set(base.position.x, base.position.y, 0.22); });
        bonds.forEach((bond, i) => { const col = i % 6; const first = i < 6 ? col : col + 12; const second = a ? first + 6 : col + 12; const value = lab.basePairs[i]; bond.visible = a ? value === (i < 6 ? complement(template[col]) : template[col]) : i < 6; bond.geometry.setFromPoints([bases[first].position, bases[second].position]); });
      } else {
        const mutation = mutationState(a, b); captions[0].set("Original coding DNA (5′ → 3′)"); captions[1].set("Edited coding DNA · groups of 3 = codons");
        bases.forEach((base, i) => { const original = i < 12; const col = original ? i : i - 12; const value = original ? originalDna[col] : mutation.dna[col]; base.visible = labels[i].sprite.visible = Boolean(value); base.position.set(-2.5 + col * 0.4 + Math.floor(col / 3) * 0.08, (original ? 0.7 : -0.7) + Math.sin(time * 2 + col) * 0.03, 0); base.scale.setScalar(col === b - 1 && !original && a ? 1.3 : 1); base.material.color.setHex(colors[value] || 0x9caaba); labels[i].set(value || ""); labels[i].sprite.position.set(base.position.x, base.position.y, 0.22); });
      }
    });
  } else throw new Error(`Unknown experiment: ${id}`);
  const run = (time: number, a: number, b: number, lab: LabState) => updates.forEach(update => update(time, a, b, lab));
  // Lambert shading skips the reflections and specular math that weak GPUs struggle with.
  const setLite = () => registry.forEach(item => {
    const old = item.material as THREE.MeshStandardMaterial;
    if (!old.isMeshStandardMaterial) return;
    item.material = new THREE.MeshLambertMaterial({ color: old.color, map: old.map, emissive: old.emissive, emissiveIntensity: old.emissiveIntensity, transparent: old.transparent, opacity: old.opacity, depthWrite: old.depthWrite, side: old.side });
    old.dispose();
  });
  return Object.assign(run, { setLite, interact });
}
