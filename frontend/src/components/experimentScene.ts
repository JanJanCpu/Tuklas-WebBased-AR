import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { circuitState, complement, earthLayers, mutationState, originalDna, template, type LabState } from "../lib/experiments";

/** What a student can grab in a scene. The scene input handler in ScienceScene drives this. */
export interface Interaction {
  targets: Record<string, THREE.Object3D>;
  /** Written by the input handler while a grab is in progress. */
  drag: { target: string; x: number; value: number };
  /** Force arrow tip position (local x) to control A value. */
  arrowValue?: (localX: number) => number;
  /** "push": drag the cart forward to set initial velocity (B). "tap": tapping the cart cycles mass (B). */
  cartMode?: "push" | "tap";
  trackStart: number;
  trackEnd: number;
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
    return { item, get material() { return item.material as THREE.MeshStandardMaterial; }, place, hide };
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

  // A copper wire made of joined cylinders, so it has real thickness.
  const wire = (points: number[][], parent: THREE.Object3D) => {
    const group = new THREE.Group(); parent.add(group);
    const vectors = points.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0));
    const finish = { metalness: 0.85, roughness: 0.3 };
    vectors.forEach((point, i) => {
      mesh(new THREE.SphereGeometry(0.045, 10, 8), 0xc27c45, point.x, point.y, point.z, group, finish);
      if (i === 0) return;
      const from = vectors[i - 1];
      const length = from.distanceTo(point);
      if (length < 1e-4) return;
      const segment = mesh(new THREE.CylinderGeometry(0.045, 0.045, length, 10), 0xc27c45, (from.x + point.x) / 2, (from.y + point.y) / 2, (from.z + point.z) / 2, group, finish);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), point.clone().sub(from).normalize());
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
    [-0.28, 0.28].forEach(z => mesh(new THREE.BoxGeometry(0.77, 0.018, 0.05), 0xf4f7fa, 0, 0.145, z, cart, { roughness: 0.4 }));
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
    interact = { targets: cartMode ? { cart, arrow: arrowGrab } : { arrow: arrowGrab }, drag, cartMode, trackStart: -2, trackEnd: 2, arrowValue: localX => (localX - forward.group.position.x - 0.13 - 0.4) / 0.25 };
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
    mesh(new RoundedBoxGeometry(5.6, 3.5, 0.1, 3, 0.05), 0x1d3557, 0, 0.32, -0.2, root, { roughness: 0.8 });
    const wiring = new THREE.Group(); root.add(wiring);
    const bulbs = [0, 1, 2].map(i => sphere(0xf5d357, -1.5 + i * 1.5, 0.6, 0.27, root, { roughness: 0.15 }));
    const bulbGlows = bulbs.map(bulb => glow(0xffc84a, 1.9, bulb));
    bulbs.forEach(bulb => mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.16, 14), 0x9aa6b3, 0, -0.3, 0, bulb, { metalness: 0.9, roughness: 0.3 }));
    const bulbLabels = bulbs.map((_, i) => label(`Bulb ${i + 1}`, -1.5 + i * 1.5, 1.15, 1.25, root, 4));
    const batteries = [0, 1, 2].map(i => mesh(new THREE.BoxGeometry(0.42, 0.35, 0.2), 0x344a65, -0.52 + i * 0.52, -1.15, 0, root, { roughness: 0.35, metalness: 0.3 }));
    batteries.forEach(battery => mesh(new THREE.BoxGeometry(0.12, 0.06, 0.1), 0xd3dae2, 0, 0.2, 0, battery, { metalness: 0.9, roughness: 0.2 }));
    const batteryLabel = label("", 0, -1.62, 3);
    const switchLabel = label("", 0, 1.7, 4);
    const electrons = instanced(new THREE.SphereGeometry(0.065, 8, 6), 0x00a7e6, 24, root, { emissive: 0x00a7e6, emissiveIntensity: 1.4, roughness: 0.3 });
    const electronAt = new THREE.Vector3();
    let signature = "";
    let paths: THREE.Vector3[][] = [];
    updates.push((time, a, b, lab) => {
      const c = circuitState(id, a, b, lab);
      const next = `${c.parallel}:${c.count}:${lab.branchMask}:${b}`;
      if (next !== signature) {
        signature = next;
        wiring.traverse(object => { const item = object as THREE.Mesh; if (item.geometry) { item.geometry.dispose(); (item.material as THREE.Material).dispose(); } }); wiring.clear(); paths = [];
        if (c.parallel) {
          wire([[-2.2, -1.15], [-2.2, 0.8]], wiring); wire([[2.2, -1.15], [2.2, 0.8]], wiring);
          for (let i = 0; i < 3; i++) { const y = 0.8 - i * 0.65; bulbs[i].position.set(0.8, y, 0); bulbLabels[i].sprite.position.set(1.85, y + 0.2, 0.18); if (lab.branchMask & (1 << i)) { const points = [[0, -1.15], [-2.2, -1.15], [-2.2, y], [2.2, y], [2.2, -1.15], [0, -1.15]]; wire(points, wiring); paths.push(points.map(p => new THREE.Vector3(p[0], p[1], 0))); } }
        } else {
          const points = [[0, -1.15], [-2.2, -1.15], [-2.2, 0.6], [2.2, 0.6], [2.2, -1.15], [0, -1.15]]; wire(points, wiring); paths = [points.map(p => new THREE.Vector3(p[0], p[1], 0))];
          bulbs.forEach((bulb, i) => { bulb.position.set(-1.5 + i * 1.5, 0.6, 0); bulbLabels[i].sprite.position.set(-1.5 + i * 1.5, 1.05, 0.18); });
        }
      }
      batteries.forEach((battery, i) => { battery.visible = i < (id === "home-circuit" ? b : a); battery.material.color.setHex(c.tripped ? 0xd63242 : 0x344a65); });
      batteryLabel.set(`${c.voltage} V · ${c.current.toFixed(2)} A total`);
      switchLabel.set(c.tripped ? "Fuse OPEN (> 1.5 A)" : lab.closed ? "Switch CLOSED" : "Switch OPEN");
      bulbs.forEach((bulb, i) => {
        const installed = id === "series" ? i < b : Boolean(lab.branchMask & (1 << i));
        const brightness = c.current > 0 && installed ? Math.min(2, c.power / 1.7) : 0;
        bulb.visible = installed; bulbLabels[i].sprite.visible = installed;
        bulb.material.emissive.setHex(0xffb000); bulb.material.emissiveIntensity = brightness;
        bulb.material.color.setHex(c.current > 0 ? 0xffd657 : 0x617183);
        bulbGlows[i].material.opacity = Math.min(0.85, brightness * 0.45) * (0.92 + 0.08 * Math.sin(time * 9 + i));
      });
      for (let i = 0; i < 24; i++) { if (!(c.current > 0 && paths.length > 0)) { electrons.hide(i); continue; } const path = paths[i % paths.length]; const progress = ((time * c.branchCurrent * 0.45 + i / 24) % 1) * (path.length - 1); const segment = Math.floor(progress); electronAt.copy(path[segment]).lerp(path[segment + 1], progress - segment); electrons.place(i, electronAt.x, electronAt.y, electronAt.z, 1); }
    });
  } else if (id === "chemical-change") {
    mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.06, 32), 0xbfe3ef, 0, -0.8, 0, root, { opacity: 0.55, roughness: 0.05 });
    const jar = mesh(new THREE.CylinderGeometry(0.9, 0.8, 1.6, 32, 1, true), 0x9fd8ea, 0, 0, 0, root, { opacity: 0.2, roughness: 0.04, metalness: 0.1 });
    const rim = mesh(new THREE.TorusGeometry(0.9, 0.03, 8, 40), 0xd6eef7, 0, 0.8, 0, root, { opacity: 0.7, roughness: 0.1 }); rim.rotation.x = Math.PI / 2;
    void jar;
    const liquid = mesh(new THREE.CylinderGeometry(0.76, 0.7, 0.55, 32), 0x7cbacd, 0, -0.47, 0, root, { opacity: 0.9, roughness: 0.1 });
    const powder = mesh(new THREE.ConeGeometry(0.4, 0.3, 24), 0xfaf3db, 0, -0.5);
    const foam = instanced(new THREE.SphereGeometry(0.12, 10, 8), 0xf3fbfd, 12, root, { roughness: 0.4 });
    const bubbles = instanced(new THREE.SphereGeometry(0.065, 8, 6), 0xffffff, 25, root, { opacity: 0.8, roughness: 0.1 });
    label("Vinegar + baking soda", 0, -1.2, 4);
    const result = label("", 0, 1.65, 4.7);
    updates.push((time, a, b) => {
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
    const bond1 = line([[-1.15, 0], [1.15, 0]], 0x567890); const bond2 = line([[1.15, 0], [0, -1]], 0x567890);
    updates.push((time, a, b, lab) => {
      root.rotation.y = b * Math.PI / 8;
      sodium.material.color.setHex(a ? 0xe0e9f2 : 0xab86da); chlorine.material.color.setHex(a ? 0xea615b : 0x4caf71);
      first.set(a ? "H" : lab.electrons ? "Na⁺" : "Na"); second.set(a ? "O" : lab.electrons ? "Cl⁻" : "Cl"); hydrogen.visible = third.sprite.visible = Boolean(a);
      bond1.visible = a ? lab.electrons >= 1 : false; bond2.visible = Boolean(a && lab.electrons >= 2);
      const spin = time * 0.9;
      electrons.forEach((electron, i) => { electron.visible = a ? i < 4 : true; if (a) electron.position.set(1.15 + Math.cos(i * 0.25 + 0.7 + spin) * 0.78, Math.sin(i * 0.25 + 0.7 + spin) * 0.78, 0); else if (i === 7 && !lab.electrons) electron.position.set(-1.15, -0.68, 0); else electron.position.set(1.15 + Math.cos(i * Math.PI / 4 + spin) * 0.78, Math.sin(i * Math.PI / 4 + spin) * 0.78, 0); });
      shared.forEach((electron, i) => { electron.visible = Boolean(a && i < lab.electrons * 2); electron.position.set((i < 2 ? (i % 2) * 0.18 - 0.09 : 0.52 + (i % 2) * 0.16) + Math.sin(time * 4 + i) * 0.03, (i < 2 ? 0 : -0.5) + Math.cos(time * 4 + i) * 0.03, 0.12); });
    });
  } else if (id === "seismic") {
    const medium = mesh(new THREE.BoxGeometry(4.8, 1.5, 0.12), 0x6b5443, 0, 0, -0.2, root, { roughness: 0.7 });
    const front = mesh(new THREE.PlaneGeometry(0.45, 1.5), 0xffffff, 0, 0, -0.12, root, { opacity: 0.14, emissive: 0xffffff, emissiveIntensity: 0.3 });
    const particles = Array.from({ length: 36 }, (_, i) => sphere(0xffd454, -2.1 + (i % 12) * 0.38, -0.45 + Math.floor(i / 12) * 0.45, 0.06, root, { emissive: 0xffa000, emissiveIntensity: 0.5 }));
    const wave = label("", 0, 1.2, 4.5); label("Travel direction →", 0, -1.1, 3.5);
    updates.push((time, a, b) => {
      wave.set(a && b ? "S-wave blocked by liquid" : a ? "S-wave: transverse displacement" : "P-wave: compression and expansion");
      medium.material.color.setHex(b ? 0x2f6f9d : 0x6b5443);
      const blocked = Boolean(a && b);
      front.visible = !blocked; front.position.x = -2.4 + ((time * (a ? 0.45 : 0.75)) % 1) * 4.8;
      particles.forEach((particle, i) => {
        const x = -2.1 + (i % 12) * 0.38; const y = -0.45 + Math.floor(i / 12) * 0.45;
        const offset = blocked ? 0 : Math.sin(x * 4 - time * (a ? 4 : 7)) * 0.16;
        particle.position.set(x + (a ? 0 : offset), y + (a ? offset : 0), 0);
        const strength = Math.abs(offset) / 0.16;
        particle.scale.setScalar(1 + strength * 0.5); particle.material.color.setHSL(0.13 - strength * 0.11, 0.95, 0.55);
      });
    });
  } else if (id === "earth-scale") {
    const rings = earthLayers.map(l => mesh(new THREE.RingGeometry(l.inner / 6371 * 1.75, l.outer / 6371 * 1.75, 128), l.color));
    const outline = line(Array.from({ length: 129 }, (_, i) => [Math.cos(i / 128 * Math.PI * 2) * 1.76, Math.sin(i / 128 * Math.PI * 2) * 1.76]), 0x647a8c);
    const caption = label("", 0, 2.15, 5.4);
    const detail = new THREE.Group(); root.add(detail);
    const surface = [0, 35, 100, 350];
    for (let i = 0; i < 3; i++) { const top = 1.5 - surface[i] / 100; const bottom = 1.5 - surface[i + 1] / 100; mesh(new THREE.PlaneGeometry(2.3, top - bottom), earthLayers[i].color, -0.9, (top + bottom) / 2, 0, detail); label(`${surface[i]}–${surface[i + 1]} km`, 1.2, (top + bottom) / 2, 2.1, detail); }
    label("Crust / rigid mantle / asthenosphere", 0, -2.3, 5.2, detail);
    updates.push((time, a, b, lab) => { outline.visible = !a; detail.visible = Boolean(a); rings.forEach((ring, i) => { const order = [5, 4, 3, 0].indexOf(i); ring.visible = !a && (order >= 0 ? order < lab.layers : lab.layers === 4 && i === b); ring.position.z = i === 1 || i === 2 ? 0.05 : 0; ring.material.emissive.setHex(i === b ? 0x443322 : 0); ring.material.emissiveIntensity = i === b ? 0.7 + 0.5 * Math.sin(time * 3) : 1; }); caption.set(lab.layers === 0 && !a ? "Add layers from the center outward" : `${earthLayers[b].name}: ${earthLayers[b].depth}`); });
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
    item.material = new THREE.MeshLambertMaterial({ color: old.color, emissive: old.emissive, emissiveIntensity: old.emissiveIntensity, transparent: old.transparent, opacity: old.opacity, depthWrite: old.depthWrite, side: old.side });
    old.dispose();
  });
  return Object.assign(run, { setLite, interact });
}
