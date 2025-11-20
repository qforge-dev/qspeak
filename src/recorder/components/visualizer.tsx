import { useAudioDataContext } from "@renderer/hooks/useStreamingAudio";
import { cn } from "@renderer/utils/cn";
import { useEffect, useRef } from "react";

interface VisualizerProps {
  state: "active" | "inactive" | "hidden";
  size?: "sm";
  className?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ state, size, className }) => {
  const { audioData } = useAudioDataContext();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Store previous bar heights for smooth transitions
  const prevBarHeightsRef = useRef<number[]>([]);

  // Animation smoothing factor (0-1): lower = smoother but slower transitions
  const SMOOTHING_FACTOR = 0.1;

  // Significantly increased noise threshold to filter out more background noise
  const NOISE_THRESHOLD = 0;

  // Much higher exponent for scaling - makes quiet sounds almost invisible
  const AMPLITUDE_EXPONENT = 6.0;

  // Maximum height factor - reduces the overall height even for loud sounds
  const MAX_HEIGHT_FACTOR = 0.8;

  // Minimum height for bars to prevent flickering
  const MIN_BAR_HEIGHT = 3;

  // Extract theme colors once so we can reuse them in all drawing functions
  const rootStyles = getComputedStyle(document.documentElement);
  const tealHSL = `hsl(${rootStyles.getPropertyValue("--teal").trim()})`;
  const violetHSL = `hsl(${rootStyles.getPropertyValue("--violet").trim()})`;

  // Detect theme (dark mode if root element has class 'dark')
  const isDarkMode = document.documentElement.classList.contains("dark");

  // Helper to apply color stops based on theme (invert in light mode)
  const applyColorStops = (gradient: CanvasGradient) => {
    if (isDarkMode) {
      gradient.addColorStop(0, tealHSL);
      gradient.addColorStop(0.5, violetHSL);
      gradient.addColorStop(1, tealHSL);
    } else {
      // Light mode: inverted order
      gradient.addColorStop(0, violetHSL);
      gradient.addColorStop(0.5, tealHSL);
      gradient.addColorStop(1, violetHSL);
    }
  };

  // Helper function to draw rounded rectangle
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  };

  // Render the visualization based on audio data and recording state
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

    // Function to draw idle state with circles
    const drawIdle = () => {
      if (state === "inactive") {
        animationFrameRef.current = requestAnimationFrame(drawIdle);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const dotCount = size === "sm" ? 18 : 32; // Reduced dot count to match fewer bars
        const dotWidth = 8; // Wider dots to match bar width
        const totalWidth = canvas.width;
        const availableSpace = totalWidth - dotCount * dotWidth;
        const dotGap = availableSpace / (dotCount - 1);

        // Draw dots centered vertically
        const centerY = canvas.height / 2;

        // Vertical gradient using CSS variables --teal and --violet for idle state circles
        const idleGradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
        applyColorStops(idleGradient);

        canvasCtx.fillStyle = idleGradient;

        for (let i = 0; i < dotCount; i++) {
          const x = i * (dotWidth + dotGap);
          const y = centerY; // Position at center

          const radius = 3;

          canvasCtx.beginPath();
          canvasCtx.arc(x + dotWidth / 2, y, radius, 0, 2 * Math.PI);
          canvasCtx.fill();
        }
      }
    };

    // Function to draw recording state with rounded bars
    const drawRecording = () => {
      if (state === "active") {
        animationFrameRef.current = requestAnimationFrame(drawRecording);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Bar configuration - fewer but wider bars
        const barCount = size === "sm" ? 18 : 32; // Reduced from 48
        const barWidth = size === "sm" ? 6 : 8; // Increased from 3
        const barRadius = size === "sm" ? 2 : 4; // Radius for rounded corners
        const totalWidth = canvas.width;
        const availableSpace = totalWidth - barCount * barWidth;
        const barGap = availableSpace / (barCount - 1);

        // Baseline (center) for symmetrical growth
        const centerY = canvas.height / 2;

        // Initialize previous heights array if needed
        if (prevBarHeightsRef.current.length !== barCount) {
          prevBarHeightsRef.current = Array(barCount).fill(MIN_BAR_HEIGHT);
        }

        // Check if we have any meaningful audio data above the noise threshold
        const hasAudioSignal =
          audioData && audioData.length > 0 && audioData.some((value) => Math.abs(value) > NOISE_THRESHOLD);

        // If we don't have meaningful audio data, show minimal bars
        if (!hasAudioSignal) {
          const minHeight = MIN_BAR_HEIGHT;

          // Vertical gradient using --teal and --violet when no meaningful audio
          const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
          applyColorStops(gradient);

          canvasCtx.fillStyle = gradient;

          for (let i = 0; i < barCount; i++) {
            // Smoothly transition to minimum height
            let currentHeight = prevBarHeightsRef.current[i];
            const targetHeight = minHeight;

            // Apply smoothing
            currentHeight = currentHeight + (targetHeight - currentHeight) * SMOOTHING_FACTOR;
            prevBarHeightsRef.current[i] = currentHeight;

            const x = i * (barWidth + barGap);
            const y = centerY - currentHeight / 2; // Center the bar

            drawRoundedRect(canvasCtx, x, y, barWidth, currentHeight, barRadius);
          }

          return;
        }

        // Sample the audio data to draw bars
        const sampleStep = Math.max(1, Math.floor(audioData.length / barCount));

        for (let i = 0; i < barCount; i++) {
          // Sample the audio data - take one value or average multiple values
          let value = 0;
          const startIdx = i * sampleStep;
          const endIdx = Math.min(startIdx + sampleStep, audioData.length);

          if (startIdx < audioData.length) {
            // Take average of samples in this range
            let sum = 0;
            let count = 0;
            for (let j = startIdx; j < endIdx; j++) {
              // Only consider values above the noise threshold
              if (Math.abs(audioData[j]) > NOISE_THRESHOLD) {
                sum += Math.abs(audioData[j]);
                count++;
              }
            }
            // If we found any values above threshold, use their average
            value = count > 0 ? sum / count : 0;
          }

          // Normalize to 0-1 range (audio values are typically 0-255)
          const normalizedValue = Math.min(1, Math.max(0, value / 255));

          // Apply aggressive exponential scaling to reduce sensitivity for quiet sounds
          // This will make quiet sounds almost invisible, while only very loud sounds reach high
          const scaledValue = Math.pow(normalizedValue, AMPLITUDE_EXPONENT);

          // Calculate height with a consistent minimum height to prevent flickering
          const targetHeight = Math.max(MIN_BAR_HEIGHT, scaledValue * canvas.height * MAX_HEIGHT_FACTOR);

          // Get the previous height and apply smoothing
          let currentHeight = prevBarHeightsRef.current[i];
          currentHeight = currentHeight + (targetHeight - currentHeight) * SMOOTHING_FACTOR;

          // Store the new height for next frame
          prevBarHeightsRef.current[i] = currentHeight;

          const x = i * (barWidth + barGap);
          const y = centerY - currentHeight / 2; // Center the bar

          // Vertical gradient across the whole canvas based on --teal and --violet
          const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
          applyColorStops(gradient);

          canvasCtx.fillStyle = gradient;

          drawRoundedRect(canvasCtx, x, y, barWidth, currentHeight, barRadius);
        }
      }
    };

    // Start the appropriate animation loop
    if (state === "active") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      drawRecording();
    } else {
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
  }, [state, audioData, size]);

  return (
    <canvas
      data-tauri-drag-region
      ref={canvasRef}
      className={cn(
        "mx-auto bg-transparent select-none",
        {
          "h-[30px] max-w-[160px] w-[35%]": size === "sm",
          "h-[100px] max-w-[450px] w-[75%]": size !== "sm",
          hidden: state === "hidden",
        },
        className,
      )}
    />
  );
};
