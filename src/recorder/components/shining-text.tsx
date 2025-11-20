import { cn } from "@renderer/utils/cn";
import { motion, HTMLMotionProps } from "motion/react";

interface ShiningTextProps extends HTMLMotionProps<"span"> {
  children: React.ReactNode;
}

export function ShiningText({ children, className, ...rest }: ShiningTextProps) {
  return (
    <motion.span
      className={cn("inline-block", className)}
      style={{
        background:
          "linear-gradient(90deg, currentColor 0%, currentColor 30%, rgba(255,255,255,0.9) 40%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.9) 60%, currentColor 70%, currentColor 100%)",
        backgroundSize: "200% 100%",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        backgroundPosition: "0% 0%",
      }}
      animate={{
        backgroundPosition: ["0% 0%", "100% 0%"],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        repeatDelay: 1,
        ease: "linear",
      }}
      {...rest}
    >
      {children}
    </motion.span>
  );
}
