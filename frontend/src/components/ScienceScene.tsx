import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ViewMode } from "../types/domain";
import { createExperimentScene, type InteractionApi } from "./experimentScene";
import { controls, type LabState } from "../lib/experiments";
import { loadArToolkit } from "../lib/arjs";
import { createHandTracker, type HandSample, type HandTracker } from "../lib/handTracking";

interface ScienceSceneProps {
  moduleId: string;
  controlA: number;
  controlB: number;
  lab: LabState;
  trialPulse: number;
  onMarkerChange?: (detected: boolean) => void;
  viewMode: ViewMode;
  onArReady?: (ready: boolean) => void;
  onArStatus?: (status: string) => void;
  /** Called when the student changes a variable by touching the model instead of using the slider. */
  onControlChange?: (which: "a" | "b", value: number) => void;
  /** Called when the student changes lab state (electrons placed, layers added...) by touching the model. */
  onLabChange?: (patch: Partial<LabState>) => void;
}

const cameraParametersUrl = "/assets/camera_para.dat";
const tuklasMarkerUrl = "/assets/tuklas-marker.patt";
const HAND_INTERVAL_MS = 66;
const HAND_SEARCH_INTERVAL_MS = 250;

export function ScienceScene({ moduleId, controlA, controlB, lab, trialPulse, viewMode, onArReady, onArStatus, onMarkerChange, onControlChange, onLabChange }: ScienceSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef({ controlA, controlB, lab, trialPulse });
  valuesRef.current = { controlA, controlB, lab, trialPulse };
  const controlChangeRef = useRef(onControlChange);
  controlChangeRef.current = onControlChange;
  const labChangeRef = useRef(onLabChange);
  labChangeRef.current = onLabChange;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    if (viewMode === "fallback") { camera.position.set(0, 1.4, 9); camera.lookAt(0, 0.2, 0); }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    // A generated studio environment gives metal and glass something to reflect. No image asset needed.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    scene.environment = environment;
    scene.environmentIntensity = 0.85;

    const trackedRoot = new THREE.Group();
    scene.add(trackedRoot);

    const presentationRoot = new THREE.Group();
    if (viewMode === "ar") {
      presentationRoot.visible = false;
      scene.add(presentationRoot);
    } else {
      trackedRoot.add(presentationRoot);
    }

    // AR.js writes the marker matrix to trackedRoot every frame. Keep model
    // scale and placement on a child so tracking cannot overwrite them.
    const modelRoot = new THREE.Group();
    modelRoot.scale.setScalar(viewMode === "ar" ? 0.22 : 1);
    modelRoot.position.y = viewMode === "ar" ? 0.55 : 0;
    presentationRoot.add(modelRoot);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x24324d, 1.1));
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.4);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const billboardRoot = new THREE.Group();
    modelRoot.add(billboardRoot);
    const contentRoot = new THREE.Group();
    billboardRoot.add(contentRoot);
    const updateExperiment = createExperimentScene(contentRoot, moduleId);

    // Diagnostics: ?empty=1 hides the model (measures AR tracking alone); ?detect=2 analyzes the camera every 2nd frame.
    const urlParams = new URLSearchParams(window.location.search);
    const emptyScene = urlParams.has("empty");
    const detectFromUrl = Math.max(1, Number(urlParams.get("detect")) || 1);
    let detectEvery = detectFromUrl;
    let arFrame = 0;
    if (emptyScene) modelRoot.visible = false;

    // Quality levels, cheapest-to-hide first: 0 full, 1 analyze the camera every 2nd frame (the AR tracking is the main cost
    // on weak phones), 2 also lower resolution, 3 also simple shading. Steps down by itself on a struggling phone.
    const forcedQuality = new URLSearchParams(window.location.search).get("q");
    let quality = 0;
    let qFrames = 0;
    let qStart = performance.now();
    let qWindows = 0;
    let lowWindows = 0;
    const applyQuality = (level: number) => {
      if (level === quality) return;
      quality = level;
      detectEvery = Math.max(detectFromUrl, level >= 1 ? 2 : 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, level >= 2 ? 1 : 1.5));
      if (level >= 3) { scene.environment = null; ambientLight.intensity = 0.95; updateExperiment.setLite(); }
    };
    let storedQuality = 0;
    try { storedQuality = Number(localStorage.getItem("tuklas-quality-v2")) || 0; } catch { /* storage unavailable */ }
    applyQuality(Math.min(3, forcedQuality !== null ? Number(forcedQuality) || 0 : storedQuality));
    const watchFrameRate = (now: number) => {
      qFrames += 1;
      const elapsed = now - qStart;
      if (elapsed < 1000) return;
      const fps = qFrames * 1000 / elapsed;
      qFrames = 0; qStart = now;
      if (elapsed > 2500) return; // tab was hidden; not a real reading
      qWindows += 1;
      if (forcedQuality !== null || quality >= 3 || qWindows <= 3) return;
      lowWindows = fps < 19 ? lowWindows + 1 : 0;
      if (lowWindows < 3) return;
      lowWindows = 0; qWindows = 0;
      applyQuality(quality + 1);
      try { localStorage.setItem("tuklas-quality-v2", String(quality)); } catch { /* storage unavailable */ }
    };
    let elapsed = 0;
    let previousTime = performance.now();
    let previousInputs = "";
    let animationId = 0;
    let arSource: ArToolkitSource | null = null;
    let arContext: ArToolkitContext | null = null;
    let markerSetup: Promise<void> | null = null;
    let cancelled = false;
    let markerVisible = false;
    let hasStablePose = false;
    let missedFrames = 0;

    // Touch and mouse manipulation for scenes that expose grabbable parts (see Interaction in experimentScene).
    const interact = updateExperiment.interact;
    mount.style.pointerEvents = interact ? "auto" : "";
    mount.style.touchAction = interact ? "pan-y" : "";
    const inputCleanup: (() => void)[] = [];
    if (interact) {
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const plane = new THREE.Plane();
      const planeNormal = new THREE.Vector3();
      const planeOrigin = new THREE.Vector3();
      const hitPoint = new THREE.Vector3();
      const api: InteractionApi = {
        values: () => { const current = valuesRef.current; return { a: current.controlA, b: current.controlB, lab: current.lab }; },
        setControl: (which, value) => controlChangeRef.current?.(which, value),
        setLab: patch => labChangeRef.current?.(patch),
        restart: () => { elapsed = 0; },
      };
      let grab = "";
      let start = { x: 0, y: 0 };
      let moved = 0;
      const aim = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
        raycaster.setFromCamera(pointer, camera);
      };
      // Where the finger is on the experiment's own table plane, in the scene's local units.
      const tablePoint = () => {
        planeNormal.set(0, 0, 1).transformDirection(contentRoot.matrixWorld);
        planeOrigin.setFromMatrixPosition(contentRoot.matrixWorld);
        plane.setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);
        return raycaster.ray.intersectPlane(plane, hitPoint) ? contentRoot.worldToLocal(hitPoint.clone()) : null;
      };
      const shown = (object: THREE.Object3D) => { for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) return false; return true; };
      const nameOf = (object: THREE.Object3D) => {
        for (const [name, target] of Object.entries(interact.targets)) for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === target) return shown(target) ? name : "";
        return "";
      };
      const finish = (event: PointerEvent) => { grab = ""; if (mount.hasPointerCapture(event.pointerId)) mount.releasePointerCapture(event.pointerId); };
      const onDown = (event: PointerEvent) => {
        if (viewMode === "ar" && !presentationRoot.visible) return;
        aim(event);
        const name = raycaster.intersectObjects(Object.values(interact.targets), true).map(hit => nameOf(hit.object)).find(Boolean) ?? "";
        if (!name) return;
        grab = name; start = { x: event.clientX, y: event.clientY }; moved = 0;
        mount.setPointerCapture(event.pointerId);
        const point = tablePoint();
        if (point) interact.down?.(name, point, api);
      };
      const onMove = (event: PointerEvent) => {
        if (!grab) return;
        moved = Math.max(moved, Math.hypot(event.clientX - start.x, event.clientY - start.y));
        aim(event);
        const point = tablePoint();
        if (point) interact.move?.(grab, point, moved, api);
      };
      const onUp = (event: PointerEvent) => {
        if (!grab) return;
        aim(event);
        const point = tablePoint();
        if (point) interact.up?.(grab, point, moved, api); else interact.cancel?.();
        finish(event);
      };
      const onCancel = (event: PointerEvent) => { if (!grab) return; interact.cancel?.(); finish(event); };
      // Once a part is grabbed, stop the browser from turning the drag into a page scroll.
      const blockScroll = (event: TouchEvent) => { if (grab) event.preventDefault(); };
      mount.addEventListener("touchmove", blockScroll, { passive: false });
      mount.addEventListener("pointerdown", onDown);
      mount.addEventListener("pointermove", onMove);
      mount.addEventListener("pointerup", onUp);
      mount.addEventListener("pointercancel", onCancel);
      inputCleanup.push(() => {
        mount.removeEventListener("pointerdown", onDown); mount.removeEventListener("pointermove", onMove);
        mount.removeEventListener("pointerup", onUp); mount.removeEventListener("pointercancel", onCancel); mount.removeEventListener("touchmove", blockScroll);
      });
    }

    // Hand-tracking spike: enabled with ?hands=1, AR mode only.
    const handsEnabled = viewMode === "ar" && new URLSearchParams(window.location.search).has("hands");
    const fpsEnabled = viewMode === "ar" && new URLSearchParams(window.location.search).has("fps");
    let handTracker: HandTracker | null = null;
    let handVideo: HTMLVideoElement | null = null;
    let handHud: HTMLDivElement | null = null;
    let handDot: HTMLDivElement | null = null;
    let handText: HTMLDivElement | null = null;
    let handState = "loading hand model...";
    let lastDetectAt = 0;
    let statsAt = performance.now();
    let frames = 0;
    let detects = 0;
    let renderFps = 0;
    let detectFps = 0;
    let detectMs = 0;
    let handPresent = false;

    const showHandSample = (sample: HandSample | null) => {
      handPresent = sample !== null;
      if (!handDot) return;
      if (!sample) { handDot.style.display = "none"; handState = "no hand"; return; }
      handDot.style.display = "block";
      handDot.style.left = `${sample.x * 100}%`;
      handDot.style.top = `${sample.y * 100}%`;
      handDot.style.background = sample.pinching ? "#22c55e" : "#ffffff";
      handState = `${sample.pinching ? "GRAB" : "open"} (pinch ${sample.pinchRatio.toFixed(2)})`;
    };

    const tickHands = (now: number) => {
      frames += 1;
      // Keep detection to roughly a third of frame time; search for a hand less often than we track one.
      const interval = handPresent ? Math.max(HAND_INTERVAL_MS, detectMs * 2) : Math.max(HAND_SEARCH_INTERVAL_MS, detectMs * 3);
      if (handTracker && handVideo && handVideo.readyState >= 2 && now - lastDetectAt >= interval) {
        lastDetectAt = now;
        const sample = handTracker.detect(handVideo, now);
        if (sample !== undefined) {
          detects += 1;
          detectMs = detectMs * 0.8 + (performance.now() - now) * 0.2;
          showHandSample(sample);
        }
      }
      if (now - statsAt >= 1000) {
        renderFps = Math.round(frames * 1000 / (now - statsAt));
        detectFps = Math.round(detects * 1000 / (now - statsAt));
        frames = 0; detects = 0; statsAt = now;
        if (handText) handText.textContent = `render ${renderFps} fps | hands ${detectFps} fps | ${Math.round(detectMs)} ms ${handTracker?.delegate ?? ""} | ${handState} | q${quality} d${detectEvery}${emptyScene ? " empty" : ""} | b15`;
      }
    };

    function startHands(video: HTMLVideoElement) {
      handVideo = video;
      handHud = document.createElement("div");
      handHud.style.cssText = "position:absolute;inset:0;z-index:5;pointer-events:none;";
      handDot = document.createElement("div");
      handDot.style.cssText = "position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #0f4c9a;display:none;";
      handText = document.createElement("div");
      handText.style.cssText = "position:absolute;left:8px;top:8px;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.65);color:#fff;font:12px/1.3 monospace;";
      handText.textContent = handState;
      handHud.append(handDot, handText);
      mount!.appendChild(handHud);
      if (!handsEnabled) { handState = "fps only"; return; }
      const preferred = new URLSearchParams(window.location.search).get("hands")?.toLowerCase() === "cpu" ? "CPU" : "GPU";
      createHandTracker(preferred).then(tracker => {
        if (cancelled) { tracker.close(); return; }
        handTracker = tracker;
        handState = "no hand";
      }).catch(() => { handState = "hand model failed to load"; });
    }

    const render = () => {
      const now = performance.now();
      watchFrameRate(now);
      if (handsEnabled || fpsEnabled) tickHands(now);
      const current = valuesRef.current;
      const inputs = JSON.stringify(current);
      if (inputs !== previousInputs) { elapsed = 0; previousInputs = inputs; }
      if (viewMode === "fallback" || markerVisible) elapsed += Math.min(0.05, (now - previousTime) / 1000);
      previousTime = now;
      if (!emptyScene) updateExperiment(elapsed, current.controlA, current.controlB, current.lab);
      if (viewMode === "ar" && arSource?.ready && arContext) {
        arFrame += 1;
        const analyzed = arFrame % detectEvery === 0;
        if (analyzed) arContext.update(arSource.domElement);
        if (trackedRoot.visible) {
          missedFrames = 0;
          presentationRoot.visible = true;
          if (!hasStablePose) {
            presentationRoot.position.copy(trackedRoot.position);
            presentationRoot.quaternion.copy(trackedRoot.quaternion);
            presentationRoot.scale.copy(trackedRoot.scale);
            hasStablePose = true;
          } else {
            presentationRoot.position.lerp(trackedRoot.position, 0.32);
            presentationRoot.quaternion.slerp(trackedRoot.quaternion, 0.28);
            presentationRoot.scale.lerp(trackedRoot.scale, 0.32);
          }
        } else if (hasStablePose && analyzed) {
          missedFrames += 1;
          if (missedFrames > 6) {
            presentationRoot.visible = false;
            hasStablePose = false;
          }
        }
        if (trackedRoot.visible !== markerVisible) {
          markerVisible = trackedRoot.visible;
          onMarkerChange?.(markerVisible);
          onArStatus?.(markerVisible ? "Tuklas marker detected." : "Looking for the Tuklas marker...");
        }
      }
      if (viewMode === "ar") {
        // Face the learner while keeping the model anchored to the tracked marker.
        billboardRoot.quaternion.copy(presentationRoot.quaternion).invert().multiply(camera.quaternion);
      }
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };

    // 3D mode: measure what this experiment actually shows and frame it, instead of one fixed distance for all.
    const sceneBounds = new THREE.Box3();
    if (viewMode === "fallback") {
      const expand = (object: THREE.Object3D) => {
        if (!object.visible) return;
        const item = object as THREE.Mesh;
        if (item.geometry && (item.material as THREE.Material | undefined)?.opacity !== 0) {
          if (!item.geometry.boundingBox) item.geometry.computeBoundingBox();
          sceneBounds.union(item.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld));
        }
        object.children.forEach(expand);
      };
      const start = valuesRef.current;
      // Sample a few moments so moving parts (cart, bubbles, waves) stay inside the frame.
      // Include both ends of the first control (for example globe vs surface detail) so switching views stays in frame.
      const range = controls[moduleId as keyof typeof controls][0];
      new Set([start.controlA, range.min, range.max]).forEach(a => [0, 0.7, 1.4, 2.1].forEach(time => { updateExperiment(time, a, start.controlB, start.lab); scene.updateMatrixWorld(true); expand(contentRoot); }));
    }
    const frameScene = () => {
      if (sceneBounds.isEmpty()) return;
      const size = sceneBounds.getSize(new THREE.Vector3());
      const center = sceneBounds.getCenter(new THREE.Vector3());
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const distance = Math.max(size.y / 2 / tanHalf, size.x / 2 / (tanHalf * camera.aspect)) * 1.12 + size.z * 0.15;
      camera.position.set(center.x, center.y + distance * 0.12, center.z + distance);
      camera.lookAt(center);
    };

    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (viewMode === "ar" && arSource && arContext) {
        arSource.onResize(arContext, renderer, camera);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      } else if (viewMode === "fallback") {
        camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
        frameScene();
        camera.updateProjectionMatrix();
      }
    };

    window.addEventListener("resize", resize);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    if (viewMode === "ar") {
      trackedRoot.visible = false;
      onArReady?.(false);
      onMarkerChange?.(false);
      onArStatus?.("Loading AR marker tracking...");

      loadArToolkit()
        .then((THREEx) => {
          if (cancelled || !THREEx?.ArToolkitSource || !THREEx.ArToolkitContext || !THREEx.ArMarkerControls) return;

          const source = new THREEx.ArToolkitSource({
            sourceType: "webcam",
            sourceWidth: 640,
            sourceHeight: 480,
            displayWidth: mount.clientWidth,
            displayHeight: mount.clientHeight,
          });

          const context: ArToolkitContext = new THREEx.ArToolkitContext({
            cameraParametersUrl,
            detectionMode: "mono",
            patternRatio: 0.5,
            canvasWidth: 640,
            canvasHeight: 480,
          });
          arSource = source;
          arContext = context;

          source.init(
            () => {
              if (cancelled) { stopCamera(); return; }
              mount.prepend(source.domElement);
              source.domElement.classList.add("ar-source-video");
              const video = source.domElement as HTMLVideoElement;
              video.muted = true;
              video.playsInline = true;
              void video.play().catch(() => {
                if (!cancelled) onArStatus?.("Camera playback paused. Switch to 3D and reopen the camera.");
              });
              if (handsEnabled || fpsEnabled) startHands(video);
              context.init(() => {
                if (cancelled) { context.dispose?.(); return; }
                const controller = context.arController!;
                // AR.js registers the pattern asynchronously. Keep its controller
                // alive until registration finishes, even if the learner leaves.
                // Disposing earlier nulls patternMarkers under the pending callback.
                let finishMarkerSetup!: () => void;
                markerSetup = new Promise(resolve => { finishMarkerSetup = resolve; });
                const loadMarker = controller.loadMarker.bind(controller);
                controller.loadMarker = url => loadMarker(url).catch(() => -1).then(id => {
                  if (!cancelled) {
                    if (id < 0) {
                      onArReady?.(false);
                      onArStatus?.("Marker file failed to load. Prepare offline files again or use 3D mode.");
                    } else {
                      onArReady?.(true);
                      onArStatus?.("Looking for the Tuklas marker...");
                    }
                  }
                  // Let AR.js's promise continuation register this ID before disposal.
                  window.setTimeout(finishMarkerSetup, 0);
                  return id;
                });
                new THREEx.ArMarkerControls(context, trackedRoot, {
                  type: "pattern",
                  patternUrl: tuklasMarkerUrl,
                  changeMatrixMode: "modelViewMatrix",
                  minConfidence: 0.7,
                });

                camera.projectionMatrix.copy(context.getProjectionMatrix());
                resize();
              });
            },
            (error: { message?: string }) => {
              if (cancelled) return;
              onArReady?.(false);
              onArStatus?.(error.message || "Camera failed to start.");
            },
          );
        })
        .catch(() => {
          if (cancelled) return;
          onArReady?.(false);
          onArStatus?.("AR.js failed to load.");
        });
    }

    function stopCamera() {
      const video = arSource?.domElement as HTMLVideoElement | undefined;
      if (video?.srcObject instanceof MediaStream) video.srcObject.getTracks().forEach(track => track.stop());
      if (arSource?.ready) arSource.dispose?.();
      arSource?.domElement?.remove();
    }

    render();

    return () => {
      cancelled = true;
      onArReady?.(false);
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      onMarkerChange?.(false);
      inputCleanup.forEach(remove => remove());
      handTracker?.close();
      handHud?.remove();
      stopCamera();
      if (arContext?.arController) {
        const context = arContext;
        if (markerSetup) void markerSetup.then(() => context.dispose?.());
        else context.dispose?.();
      }
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose();
        const renderable = object as THREE.Mesh;
        if (renderable.geometry) geometries.add(renderable.geometry);
        if (renderable.material) (Array.isArray(renderable.material) ? renderable.material : [renderable.material]).forEach(mat => materials.add(mat));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(mat => { const map = (mat as THREE.MeshBasicMaterial).map; map?.dispose(); mat.dispose(); });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [moduleId, viewMode, onArReady, onArStatus, onMarkerChange]);

  return <div className="three-scene" ref={mountRef} aria-hidden="true" />;
}
