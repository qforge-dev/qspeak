import { useAppState } from "@renderer/hooks/useAppState";
import { cn } from "@renderer/utils/cn";
import { motion, HTMLMotionProps } from "motion/react";

export function ShiningLogo({ className, ...rest }: HTMLMotionProps<"div">) {
  const { hasConversationStarted } = useAppState();

  if (hasConversationStarted) return null;

  return (
    <motion.div
      data-tauri-drag-region
      className={cn("select-none text-sm text-foreground/50 dark:text-foreground/40 font-light", className)}
      style={{
        background:
          "linear-gradient(90deg, currentColor 0%, currentColor 40%, rgba(255,255,255,1) 50%, currentColor 60%, currentColor 100%)",
        backgroundSize: "300% 100%",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        backgroundPosition: "0% 0%",
      }}
      animate={{
        backgroundPosition: ["0% 0%", "100% 0%"],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        repeatDelay: 5,
        ease: "linear",
      }}
      {...rest}
    >
      qSpeak
    </motion.div>
  );
}
