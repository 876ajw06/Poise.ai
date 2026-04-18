import { useEffect, useRef, useState } from "react";

// Minimal browser SpeechRecognition wrapper.
// Works in Chromium-based browsers; gracefully no-ops elsewhere.
export function useSpeechTranscript(active: boolean) {
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);
  const finalRef = useRef("");

  useEffect(() => {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      setTranscript((finalRef.current + interim).trim());
    };
    r.onerror = () => {};
    recRef.current = r;
  }, []);

  useEffect(() => {
    if (!recRef.current || !supported) return;
    if (active) {
      try { recRef.current.start(); } catch {}
    } else {
      try { recRef.current.stop(); } catch {}
    }
  }, [active, supported]);

  const reset = () => {
    finalRef.current = "";
    setTranscript("");
  };

  return { transcript, supported, reset };
}
