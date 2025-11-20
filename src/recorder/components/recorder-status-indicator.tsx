import { RecordingStatus } from "../recorder.reducer";
import { motion, AnimatePresence, HTMLMotionProps } from "motion/react";
import { cn } from "@renderer/utils/cn";
import { ShiningText } from "./shining-text";
import { AnimatedDots } from "./animated-dots";

export function RecorderStatusIndicator({ status, model }: { status: RecordingStatus; model?: string | null }) {
  if (status === "idle") return null;

  return (
    <MessageStatusWrapper>
      {/* <MessagePersonaIcon>
          <PersonaIcon icon={persona.icon} />
        </MessagePersonaIcon> */}

      <AnimatePresence mode="wait">
        {status === "recording" ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 3, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -3, filter: "blur(2px)" }}
            transition={{ duration: 0.2 }}
          >
            <RecordingStatusText />
          </motion.div>
        ) : null}

        {status === "transcribing" ? (
          <motion.div
            key="transcribing"
            initial={{ opacity: 0, y: 3, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -3, filter: "blur(2px)" }}
            transition={{ duration: 0.2 }}
          >
            <TranscribingStatusText />
          </motion.div>
        ) : null}

        {status === "transforming" ? (
          <motion.div
            key="transforming"
            initial={{ opacity: 0, y: 3, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -3, filter: "blur(2px)" }}
            transition={{ duration: 0.2 }}
          >
            <TransformingStatusText model={model} />
          </motion.div>
        ) : null}

        {status === "finished" ? (
          <motion.div
            key="finished"
            initial={{ opacity: 0, y: 3, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -3, filter: "blur(2px)" }}
            transition={{ duration: 0.2 }}
          >
            <FinishedStatusText />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MessageStatusWrapper>
  );
}

function RecordingStatusText() {
  return (
    <MessageStatusText>
      Listening
      <AnimatedDots />
    </MessageStatusText>
  );
}

function TransformingStatusText({ model }: { model?: string | null }) {
  if (!model)
    return (
      <MessageStatusText>
        Generating
        <AnimatedDots />
      </MessageStatusText>
    );

  return (
    <MessageStatusText>
      Using {model}
      <AnimatedDots />
    </MessageStatusText>
  );
}

function TranscribingStatusText() {
  return (
    <MessageStatusText>
      Hmm
      <AnimatedDots />
    </MessageStatusText>
  );
}

function FinishedStatusText() {
  return <MessageStatusText>Done</MessageStatusText>;
}

function MessageStatusWrapper({ children, className, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      {...rest}
      initial={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -3, filter: "blur(2px)" }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

function MessageStatusText({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <span className={cn("text-xs text-secondary dark:text-primary", className)} {...rest}>
      <ShiningText>{children}</ShiningText>
    </span>
  );
}
