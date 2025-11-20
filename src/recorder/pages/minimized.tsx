import { Button } from "@renderer/components/button";
import { useAppState } from "@renderer/hooks/useAppState";
import { useConversationContext } from "@renderer/hooks/useConversationState";
import { usePersonas } from "@renderer/hooks/usePersonas";
import { useRecordingWindowState } from "@renderer/hooks/useRecordingWindowState";
import { Minimize2, Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@renderer/utils/cn";
import { Maximize2 } from "lucide-react";
import { useAudioDataContext } from "@renderer/hooks/useStreamingAudio";
import { useEffect, useRef, useState } from "react";
import { RecordingStatus } from "../recorder.reducer";
import { InterfaceTheme } from "@renderer/hooks/useNewState";

export function Minimized() {
  const { state, toggleRecording, toggleMinimized } = useAppState();
  const { state: personasState } = usePersonas();
  const { state: recordingWindowState } = useRecordingWindowState();
  const { recordingStatus } = useConversationContext();
  const prevRecordingStatusRef = useRef<RecordingStatus | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    let timeout: number | null = null;

    if (
      prevRecordingStatusRef.current !== "idle" &&
      recordingStatus === "idle" &&
      prevRecordingStatusRef.current !== null
    ) {
      if (timeout) {
        clearTimeout(timeout);
      }
      setIsFinished(true);
      //@ts-ignore
      timeout = setTimeout(() => {
        setIsFinished(false);
      }, 1000);
    }

    prevRecordingStatusRef.current = recordingStatus;

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [recordingStatus]);

  if (!recordingWindowState || !personasState || !state) return null;

  return (
    <div
      data-tauri-drag
      className={cn("flex flex-col h-screen w-full items-center justify-start group overflow-hidden user-select-none")}
    >
      <div
        className={cn(
          "bg-background cursor-grab user-select-none border dark:border-neutral-500 group-hover:dark:border-neutral-700 rounded-2xl h-[10px] group-hover:h-[25px] w-[55px] group-hover:w-[110px] transition-all duration-200",
          {
            "bg-background-surface-high w-[110px] h-[25px] border-neutral-400 dark:border-neutral-700":
              recordingStatus !== "idle",
            "border-neutral-300 dark:border-neutral-500": recordingStatus === "idle" && !isFinished,
            "border-green-500 bg-background-surface-highlight": isFinished && recordingStatus === "idle",
          },
        )}
        data-tauri-drag-region
      >
        <div
          data-tauri-drag-region
          className={cn(
            "px-1 flex gap-2 items-center justify-between h-full w-full invisible group-hover:visible pointer-events-auto opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200",
            {
              "opacity-100 pointer-events-auto visible": recordingStatus !== "idle",
            },
          )}
        >
          <Button
            onClick={toggleMinimized}
            className={cn(
              "w-4 h-4 [&>svg]:size-2.5 p-0 pointer-events-auto rounded-full bg-secondary border-none hover:bg-tertiary hover:dark:text-gray-500 text-foreground",
            )}
          >
            {recordingWindowState?.minimized ? <Maximize2 /> : <Minimize2 />}
          </Button>

          <MinimizedVisualizer
            state={recordingStatus === "recording" ? "active" : "inactive"}
            theme={state.context.recording_window_context.theme}
          />

          <Button
            variant="secondary"
            disabled={recordingStatus === "transforming" || recordingStatus === "transcribing"}
            className={cn(
              "w-4 h-4 [&>svg]:size-2.5 p-0 pointer-events-auto bg-primary hover:bg-tertiary hover:dark:text-gray-500 rounded-full text-foreground",
              {
                "opacity-50": recordingStatus === "transforming" || recordingStatus === "transcribing",
                "hover:opacity-90": recordingStatus === "idle" || recordingStatus === "recording",
              },
            )}
            onClick={toggleRecording}
          >
            {recordingStatus === "idle" ? (
              <Play />
            ) : recordingStatus === "transforming" || recordingStatus === "transcribing" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Pause />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MinimizedVisualizerProps {
  state: "active" | "inactive" | "hidden";
  theme: InterfaceTheme;
}

// A simplified version of the Visualizer component for minimized view
export function MinimizedVisualizer({ state, theme }: MinimizedVisualizerProps) {
  const { audioData } = useAudioDataContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const prevBarHeightsRef = useRef<number[]>([]);

  // Simplified configuration
  const SMOOTHING_FACTOR = 0.15;
  const NOISE_THRESHOLD = 0;
  const BAR_COUNT = 12; // Fewer bars for minimized view
  const MIN_BAR_HEIGHT = 0.5; // Very small minimum height
  const BAR_WIDTH = 2; // Thinner bars
  const BAR_GAP = 2; // Smaller gap
  const MAX_HEIGHT_FACTOR = 0.75; // This will make bars much smaller (only 25% of full height)

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasCtx = canvas.getContext("2d")!;

    // Make sure canvas size matches its display size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Function to draw idle state (small dots)
    const drawIdle = () => {
      if (state === "inactive") {
        animationFrameRef.current = requestAnimationFrame(drawIdle);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const dotWidth = 1;
        const totalWidth = canvas.width;
        const dotGap = (totalWidth - BAR_COUNT * dotWidth) / (BAR_COUNT - 1);

        canvasCtx.fillStyle = theme === "Light" ? "rgba(0, 0, 0, 0.3)" : "#f1f500";

        for (let i = 0; i < BAR_COUNT; i++) {
          const x = i * (dotWidth + dotGap);
          const y = canvas.height / 2;

          canvasCtx.beginPath();
          canvasCtx.arc(x + dotWidth / 2, y, 1, 0, 2 * Math.PI);
          canvasCtx.fill();
        }
      }
    };

    // Function to draw recording state with bars
    const drawRecording = () => {
      if (state === "active") {
        animationFrameRef.current = requestAnimationFrame(drawRecording);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Initialize previous heights array if needed
        if (prevBarHeightsRef.current.length !== BAR_COUNT) {
          prevBarHeightsRef.current = Array(BAR_COUNT).fill(MIN_BAR_HEIGHT);
        }

        const totalWidth = canvas.width;
        const availableSpace = totalWidth - BAR_COUNT * BAR_WIDTH;
        const barGap = Math.max(BAR_GAP, availableSpace / (BAR_COUNT - 1));

        // Check if we have any audio data
        const hasAudioSignal =
          audioData && audioData.length > 0 && audioData.some((value) => Math.abs(value) > NOISE_THRESHOLD);

        canvasCtx.fillStyle = theme === "Light" ? "black" : "#f1f500"; // Pure white bars

        for (let i = 0; i < BAR_COUNT; i++) {
          // Calculate target height - always start with minimum
          let targetHeight = MIN_BAR_HEIGHT;

          if (hasAudioSignal) {
            // Get audio sample for this bar
            const sampleStep = Math.max(1, Math.floor(audioData.length / BAR_COUNT));
            const startIdx = i * sampleStep;
            const endIdx = Math.min(startIdx + sampleStep, audioData.length);

            let value = 0;
            if (startIdx < audioData.length) {
              let sum = 0;
              let count = 0;
              for (let j = startIdx; j < endIdx; j++) {
                sum += Math.abs(audioData[j]);
                count++;
              }
              value = count > 0 ? sum / count : 0;
            }

            // Normalize to 0-1 range
            const normalizedValue = Math.min(1, Math.max(0, value / 255));

            // Apply exponential scaling to make even loud sounds smaller
            const scaledValue = Math.pow(normalizedValue, 3); // Cube the value for stronger reduction

            // Scale height with the smaller max height factor
            targetHeight = Math.max(MIN_BAR_HEIGHT, scaledValue * canvas.height * MAX_HEIGHT_FACTOR);
          }

          // Apply smoothing
          let currentHeight = prevBarHeightsRef.current[i] || MIN_BAR_HEIGHT;

          // Faster decay for smoother fall
          const smoothFactor = targetHeight < currentHeight ? SMOOTHING_FACTOR * 1.5 : SMOOTHING_FACTOR;
          currentHeight = currentHeight + (targetHeight - currentHeight) * smoothFactor;

          prevBarHeightsRef.current[i] = currentHeight;

          // Draw the bar
          const x = i * (BAR_WIDTH + barGap);
          const y = (canvas.height - currentHeight) / 2;
          canvasCtx.fillRect(x, y, BAR_WIDTH, currentHeight);
        }
      }
    };

    // Start the appropriate animation loop
    if (state === "active") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      drawRecording();
    } else if (state === "inactive") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      drawIdle();
    }

    // Clean up on unmount
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state, audioData, theme]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none bg-transparent user-select-none h-4 w-1/2", {
        hidden: state === "hidden",
      })}
      style={{
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        userSelect: "none",
        pointerEvents: "none",
        touchAction: "none",
      }}
    />
  );
}
