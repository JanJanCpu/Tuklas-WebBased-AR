import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ViewMode } from "../types/domain";
import { createExperimentScene } from "./experimentScene";
import type { LabState } from "../lib/experiments";
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
}

const cameraParametersUrl = "/assets/camera_para.dat";
const tuklasMarkerUrl = "/assets/tuklas-marker.patt";
const HAND_INTERVAL_MS = 66;
const HAND_SEARCH_INTERVAL_MS = 250;

export function ScienceScene({ moduleId, controlA, controlB, lab, trialPulse, viewMode, onArReady, onArStatus, onMarkerChange }: ScienceSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef({ controlA, controlB, lab, trialPulse });
  valuesRef.current = { controlA, controlB, lab, trialPulse };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    if (viewMode === "fallback") { camera.position.set(0, 1.4, 9); camera.lookAt(0, 0.2, 0); }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

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

    const light = new THREE.HemisphereLight(0xffffff, 0x24324d, 2.5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));

    const billboardRoot = new THREE.Group();
    modelRoot.add(billboardRoot);
    const contentRoot = new THREE.Group();
    billboardRoot.add(contentRoot);
    const updateExperiment = createExperimentScene(contentRoot, moduleId);
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

    // Hand-tracking spike: enabled with ?hands=1, AR mode only.
    const handsEnabled = viewMode === "ar" && new URLSearchParams(window.location.search).has("hands");
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
        if (handText) handText.textContent = `render ${renderFps} fps | hands ${detectFps} fps | ${Math.round(detectMs)} ms ${handTracker?.delegate ?? ""} | ${handState}`;
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
      createHandTracker().then(tracker => {
        if (cancelled) { tracker.close(); return; }
        handTracker = tracker;
        handState = "no hand";
      }).catch(() => { handState = "hand model failed to load"; });
    }

    const render = () => {
      const now = performance.now();
      if (handsEnabled) tickHands(now);
      const current = valuesRef.current;
      const inputs = JSON.stringify(current);
      if (inputs !== previousInputs) { elapsed = 0; previousInputs = inputs; }
      if (viewMode === "fallback" || markerVisible) elapsed += Math.min(0.05, (now - previousTime) / 1000);
      previousTime = now;
      updateExperiment(elapsed, current.controlA, current.controlB, current.lab);
      if (viewMode === "ar" && arSource?.ready && arContext) {
        arContext.update(arSource.domElement);
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
        } else if (hasStablePose) {
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

    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (viewMode === "ar" && arSource && arContext) {
        arSource.onResize(arContext, renderer, camera);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      } else if (viewMode === "fallback") {
        camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
        camera.position.z = Math.max(9, 3.2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
        camera.lookAt(0, 0.2, 0);
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
              if (handsEnabled) startHands(video);
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
        const renderable = object as THREE.Mesh;
        if (renderable.geometry) geometries.add(renderable.geometry);
        if (renderable.material) (Array.isArray(renderable.material) ? renderable.material : [renderable.material]).forEach(mat => materials.add(mat));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(mat => { const map = (mat as THREE.MeshBasicMaterial).map; map?.dispose(); mat.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [moduleId, viewMode, onArReady, onArStatus, onMarkerChange]);

  return <div className="three-scene" ref={mountRef} aria-hidden="true" />;
}
