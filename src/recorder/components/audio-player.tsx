import { forwardRef, useEffect, useRef, useImperativeHandle, useState } from "react";
import { FooterButton } from "./recorder.components";
import { Volume2, VolumeOff } from "lucide-react";
import { cn } from "@renderer/utils/cn";

interface AudioPlayerProps {
  audioStream: Float32Array[];
  sampleRate?: number;
}

export const AudioPlayer = forwardRef<{ stop: () => void }, AudioPlayerProps>(function AudioPlayer(
  { audioStream, sampleRate = 44100 },
  ref,
) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastChunkIndexRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const processingChunkRef = useRef<boolean>(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useImperativeHandle(ref, () => ({
    stop: () => {
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = new AudioContext();
      }
      isPlayingRef.current = false;
      audioQueueRef.current = [];
      processingChunkRef.current = false;
    },
  }));

  useEffect(() => {
    audioContextRef.current = new AudioContext();
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playNextChunk = async () => {
    if (!audioContextRef.current || processingChunkRef.current) return;
    if (!audioQueueRef.current.length) {
      isPlayingRef.current = false;
      return;
    }

    processingChunkRef.current = true;
    const chunk = audioQueueRef.current[0];
    audioQueueRef.current = audioQueueRef.current.slice(1);

    const audioBuffer = audioContextRef.current.createBuffer(1, chunk.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(chunk);

    const source = audioContextRef.current.createBufferSource();
    currentSourceRef.current = source;
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.playbackRate.value = isMuted ? 0 : 1;

    source.onended = () => {
      processingChunkRef.current = false;
      currentSourceRef.current = null;
      playNextChunk();
    };

    source.start();
    isPlayingRef.current = true;
  };

  useEffect(() => {
    if (!audioContextRef.current) return;
    if (audioStream.length <= lastChunkIndexRef.current) return;

    // Add new chunks to queue
    for (let i = lastChunkIndexRef.current; i < audioStream.length; i++) {
      audioQueueRef.current.push(audioStream[i]);
    }
    lastChunkIndexRef.current = audioStream.length;

    // Start playing if not already playing
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [audioStream, sampleRate]);

  const toggleMute = () => {
    if (currentSourceRef.current) {
      currentSourceRef.current.playbackRate.value = isMuted ? 1 : 0;
    }
    setIsMuted(!isMuted);
  };

  return (
    <FooterButton
      className={cn("absolute z-[49] top-2 right-2 w-6 h-6 p-0 flex justify-center items-center opacity-50")}
      onClick={toggleMute}
    >
      {!isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeOff className="w-3.5 h-3.5" />}
    </FooterButton>
  );
});
