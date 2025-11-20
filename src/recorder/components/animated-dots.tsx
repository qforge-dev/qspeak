import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface AnimatedDotsProps {
  className?: string;
}

export function AnimatedDots({ className }: AnimatedDotsProps) {
  const [visibleDots, setVisibleDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleDots((prev) => {
        if (prev === 3) {
          return 0;
        }
        return prev + 1;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className={className}>
      {visibleDots >= 1 ? (
        <motion.span key="first-dot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}>
          .
        </motion.span>
      ) : null}

      {visibleDots >= 2 ? (
        <motion.span key="second-dot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}>
          .
        </motion.span>
      ) : null}

      {visibleDots >= 3 ? (
        <motion.span key="third-dot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}>
          .
        </motion.span>
      ) : null}
    </span>
  );
}
