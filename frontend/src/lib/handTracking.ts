import type { HandLandmarker } from "@mediapipe/tasks-vision";

export interface HandSample {
  /** Pinch midpoint in normalized video coordinates (0..1). */
  x: number;
  y: number;
  /** Thumb-index distance relative to hand size; smaller means a tighter pinch. */
  pinchRatio: number;
  pinching: boolean;
}

export interface HandTracker {
  /** undefined = no new video frame, null = frame processed but no hand visible. */
  detect(video: HTMLVideoElement, timestampMs: number): HandSample | null | undefined;
  close(): void;
}

const PINCH_ON = 0.3;
const PINCH_OFF = 0.45;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export async function createHandTracker(): Promise<HandTracker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks("/mediapipe");
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate },
    runningMode: "VIDEO" as const,
    numHands: 1,
  });
  let landmarker: HandLandmarker;
  try {
    landmarker = await HandLandmarker.createFromOptions(vision, options("GPU"));
  } catch {
    landmarker = await HandLandmarker.createFromOptions(vision, options("CPU"));
  }

  let pinching = false;
  let lastVideoTime = -1;

  return {
    detect(video, timestampMs) {
      // MediaPipe rejects repeated timestamps and there is nothing new to see on a repeated frame.
      if (video.currentTime === lastVideoTime) return undefined;
      lastVideoTime = video.currentTime;
      const hand = landmarker.detectForVideo(video, timestampMs).landmarks[0];
      if (!hand) { pinching = false; return null; }
      const thumb = hand[4];
      const index = hand[8];
      const handSize = Math.max(dist(hand[0], hand[9]), 1e-4);
      const pinchRatio = dist(thumb, index) / handSize;
      pinching = pinching ? pinchRatio < PINCH_OFF : pinchRatio < PINCH_ON;
      return { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2, pinchRatio, pinching };
    },
    close() { landmarker.close(); },
  };
}
