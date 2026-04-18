import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  FaceLandmarker,
  PoseLandmarker,
  type FaceLandmarkerResult,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type LiveMetrics = {
  eyeContact: number; // 0-100
  posture: number;
  smile: number;
  stability: number;
  faceDetected: boolean;
};

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

type Opts = { videoEl: HTMLVideoElement | null; running: boolean };

export function useBodyLanguage({ videoEl, running }: Opts) {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    eyeContact: 0, posture: 0, smile: 0, stability: 0, faceDetected: false,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aggRef = useRef({ eye: [] as number[], post: [] as number[], smile: [] as number[], stab: [] as number[] });

  const faceRef = useRef<FaceLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastNoseRef = useRef<{ x: number; y: number } | null>(null);
  const stabilityHistRef = useRef<number[]>([]);

  // Init models once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        const face = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
        const pose = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (cancelled) return;
        faceRef.current = face;
        poseRef.current = pose;
        setReady(true);
      } catch (e) {
        console.error("MediaPipe init failed", e);
        setError(e instanceof Error ? e.message : "Init failed");
      }
    })();
    return () => {
      cancelled = true;
      faceRef.current?.close();
      poseRef.current?.close();
    };
  }, []);

  // Detection loop
  useEffect(() => {
    if (!ready || !running || !videoEl) return;
    let lastTs = -1;

    const loop = () => {
      if (!videoEl || videoEl.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const ts = performance.now();
      if (ts === lastTs) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastTs = ts;

      try {
        const faceRes: FaceLandmarkerResult | undefined = faceRef.current?.detectForVideo(videoEl, ts);
        const poseRes: PoseLandmarkerResult | undefined = poseRef.current?.detectForVideo(videoEl, ts);

        let eye = 0, smile = 0, post = 0, stab = 0;
        let faceDetected = false;

        if (faceRes && faceRes.faceLandmarks?.length) {
          faceDetected = true;
          const lm = faceRes.faceLandmarks[0];
          // Nose tip ~ 1, between eyes ~ 168, chin ~ 152, left eye outer ~ 33, right eye outer ~ 263
          const nose = lm[1];
          const leftEye = lm[33];
          const rightEye = lm[263];
          const chin = lm[152];

          // Eye contact = head facing camera (nose centered between eyes horizontally + low yaw)
          const eyeMidX = (leftEye.x + rightEye.x) / 2;
          const eyeMidY = (leftEye.y + rightEye.y) / 2;
          const yawOffset = Math.abs(nose.x - eyeMidX); // smaller = facing camera
          const pitchOffset = Math.abs(nose.y - eyeMidY) - 0.04; // baseline offset
          const yawScore = Math.max(0, 1 - yawOffset * 25);
          const pitchScore = Math.max(0, 1 - Math.abs(pitchOffset) * 25);
          eye = Math.round(((yawScore * 0.7) + (pitchScore * 0.3)) * 100);

          // Smile via blendshapes if available
          const blends = faceRes.faceBlendshapes?.[0]?.categories;
          if (blends) {
            const smileL = blends.find((c) => c.categoryName === "mouthSmileLeft")?.score ?? 0;
            const smileR = blends.find((c) => c.categoryName === "mouthSmileRight")?.score ?? 0;
            smile = Math.round(Math.min(1, ((smileL + smileR) / 2) * 2.5) * 100);
          }

          // Stability: track nose movement
          if (lastNoseRef.current) {
            const dx = nose.x - lastNoseRef.current.x;
            const dy = nose.y - lastNoseRef.current.y;
            const movement = Math.sqrt(dx * dx + dy * dy);
            stabilityHistRef.current.push(movement);
            if (stabilityHistRef.current.length > 30) stabilityHistRef.current.shift();
            const avgMove = stabilityHistRef.current.reduce((a, b) => a + b, 0) / stabilityHistRef.current.length;
            stab = Math.round(Math.max(0, Math.min(1, 1 - avgMove * 80)) * 100);
          }
          lastNoseRef.current = { x: nose.x, y: nose.y };

          // Posture from face: vertical distance nose→chin proxy + face centered
          const faceCenterX = (leftEye.x + rightEye.x + nose.x + chin.x) / 4;
          const horizCentering = 1 - Math.min(1, Math.abs(faceCenterX - 0.5) * 3);
          let postureScore = horizCentering;

          // Augment posture with pose landmarks if available
          if (poseRes && poseRes.landmarks?.length) {
            const p = poseRes.landmarks[0];
            // 11 = left shoulder, 12 = right shoulder
            const ls = p[11], rs = p[12];
            if (ls && rs) {
              const shoulderTilt = Math.abs(ls.y - rs.y); // 0 = level
              const tiltScore = Math.max(0, 1 - shoulderTilt * 15);
              postureScore = postureScore * 0.4 + tiltScore * 0.6;
            }
          }
          post = Math.round(postureScore * 100);
        }

        // Smooth via short rolling avg
        const push = (arr: number[], v: number) => {
          arr.push(v);
          if (arr.length > 15) arr.shift();
          return arr.reduce((a, b) => a + b, 0) / arr.length;
        };
        const a = aggRef.current;
        const sEye = Math.round(push(a.eye, eye));
        const sPost = Math.round(push(a.post, post));
        const sSmile = Math.round(push(a.smile, smile));
        const sStab = Math.round(push(a.stab, stab));

        setMetrics({
          eyeContact: sEye,
          posture: sPost,
          smile: sSmile,
          stability: sStab,
          faceDetected,
        });
      } catch (e) {
        // ignore frame error
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, running, videoEl]);

  const reset = () => {
    aggRef.current = { eye: [], post: [], smile: [], stab: [] };
    stabilityHistRef.current = [];
    lastNoseRef.current = null;
    setMetrics({ eyeContact: 0, posture: 0, smile: 0, stability: 0, faceDetected: false });
  };

  return { metrics, ready, error, reset };
}
