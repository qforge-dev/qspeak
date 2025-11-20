import { Channel, invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useEffect, useRef, useState } from "react";

const MAX_BUFFER_SIZE = 4096;

export function useStreamingAudio() {
  const [audioData, setAudioData] = useState<number[]>([]);
  const audioChannelRef = useRef<Channel<{ audio: any }> | null>(null);

  useEffect(() => {
    audioChannelRef.current = new Channel();

    invoke("listen_for_audio_data", {
      channel: audioChannelRef.current,
    }).then(() => {
      if (!audioChannelRef.current) return;

      audioChannelRef.current.onmessage = (event) => {
        if (Array.isArray(event)) {
          setAudioData((prev) => {
            const newBuffer = [...prev, ...event];
            const trimmedBuffer =
              newBuffer.length > MAX_BUFFER_SIZE ? newBuffer.slice(newBuffer.length - MAX_BUFFER_SIZE) : newBuffer;
            return trimmedBuffer;
          });
        }
      };
    });

    return () => {};
  }, []);

  return {
    audioData: audioData,
  };
}

const AudioDataContext = createContext<{ audioData: number[] } | null>(null);

export function AudioDataProvider({ children }: { children: React.ReactNode }) {
  const state = useStreamingAudio();
  return <AudioDataContext.Provider value={state}>{children}</AudioDataContext.Provider>;
}

export function useAudioDataContext() {
  const context = useContext(AudioDataContext);
  if (!context) {
    throw new Error("useAudioDataContext must be used within a AudioDataProvider");
  }
  return context;
}
