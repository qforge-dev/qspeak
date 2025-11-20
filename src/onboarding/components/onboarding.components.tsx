import { Label } from "@radix-ui/react-label";
import { NoDraggableWrapper } from "@renderer/components/layout";
import { RadioGroupItem, RadioGroupItemProps } from "@renderer/components/radio-group";
import { cn } from "@renderer/utils/cn";
import { motion, HTMLMotionProps } from "motion/react";
import { cloneElement } from "react";

export function OnboardingWrapper({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-tauri-drag-region className={cn("grid grid-rows-1 grid-cols-2 h-screen draggable ", className)} {...rest}>
      {children}
    </div>
  );
}

export function OnboardingContent({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <NoDraggableWrapper data-tauri-drag-region className={cn("grow flex flex-col justify-center", className)} {...rest}>
      {children}
    </NoDraggableWrapper>
  );
}

export function OnboardingAnimated({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <NoDraggableWrapper data-tauri-drag-region className={cn("bg-yellow-500 grow shrink-0", className)} {...rest}>
      {children}
    </NoDraggableWrapper>
  );
}

export function OnboardingHeader({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <header
      data-tauri-drag-region
      className={cn("flex flex-col items-start justify-center text-start p-6 max-w-lg mx-auto pt-10 w-full", className)}
      {...rest}
    >
      {children}
    </header>
  );
}

export function OnboardingH1({ className, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={cn("text-xl md:text-2xl lg:text-5xl font-bold max-w-3xl mb-5 font-heading", className)} {...rest}>
      {children}
    </h1>
  );
}

export function OnboardingH2({ className, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-2xl font-bold max-w-3xl font-heading", className)} {...rest}>
      {children}
    </h2>
  );
}

export function OnboardingText({ className, children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm md:text-base text-muted-foreground", className)} {...rest}>
      {children}
    </p>
  );
}

export function OnboardingAnimatedText({ className, children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <h2 className={cn("text-xl font-bold text-yellow-100 glow", className)} {...rest}>
      {children}
    </h2>
  );
}

export function OnboardingFooterLogo({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <p
      className={cn("text-xs text-muted-foreground/60 absolute bottom-2 left-1/2 -translate-x-1/2 italic", className)}
      {...rest}
    >
      qSpeak
    </p>
  );
}

export function OnboardingMain({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <main
      className={cn("flex flex-col items-center text-center px-6 max-w-lg mx-auto w-full relative", className)}
      {...rest}
    >
      {children}
    </main>
  );
}

export function OnboardingFooter({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <footer
      data-tauri-drag-region
      className={cn("flex justify-between items-center gap-2 p-6 max-w-lg mx-auto w-full", className)}
      {...rest}
    >
      {children}
    </footer>
  );
}

export function OnboardingStepIcon({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  if (!children || Array.isArray(children)) throw new Error("OnboardingStepIcon must have a single child");

  const cloned = cloneElement(children as React.ReactElement, {
    className: cn("w-20 h-20 text-white", className),
    ...rest,
  });

  return <>{cloned}</>;
}

export function OnboardingModelRadioItem({ className, children, ...rest }: RadioGroupItemProps) {
  return (
    <Label className={cn("relative w-full block text-sm cursor-pointer")}>
      <RadioGroupItem className={cn("absolute left-3 top-3.5 peer")} {...rest} />
      <div
        className={cn(
          "peer-data-[state=checked]:bg-muted/30 border border-muted/80 w-full pl-9 pr-4 py-3 flex rounded-md peer-data-[state=checked]:checked flex flex-col items-start text-left",
          className,
        )}
      >
        {children}
      </div>
    </Label>
  );
}

export function OnboardingModelItem({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-muted/20 text-sm rounded-md border border-muted/80 text-sm w-full px-4 py-3 flex rounded-mdflex flex-col items-start text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function OnboardingRadioItemHeading({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4 className={cn("text-sm font-bold", className)} {...props}>
      {children}
    </h4>
  );
}

export function OnboardingRadioItemDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function StepIndicator({
  currentStep,
  totalSteps = 7,
  className,
  ...rest
}: { currentStep: number; totalSteps?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex justify-center gap-2", className)} {...rest}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <motion.div
          key={index}
          className={`w-2 h-2 rounded-full ${currentStep === index ? "bg-yellow-400" : "bg-gray-200"}`}
          animate={{
            scale: currentStep === index ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 0.5,
            repeat: currentStep === index ? Number.POSITIVE_INFINITY : 0,
            repeatType: "reverse",
          }}
        />
      ))}
    </div>
  );
}

export function SoundWaveAnimation({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("absolute bottom-4 left-0 right-0 flex justify-center items-end h-12", className)} {...rest}>
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1 mx-0.5 bg-white/50 rounded-t-full"
          animate={{ height: [5, 15 + Math.random() * 20, 5] }}
          transition={{
            duration: 1 + Math.random(),
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            delay: i * 0.05,
          }}
        />
      ))}
    </div>
  );
}

export function OnboardingAnimatedBackground({ className, children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={cn("absolute inset-0 opacity-[3%]", className)}
      animate={{
        backgroundPosition: ["0% 0%", "100% 100%"],
      }}
      transition={{
        duration: 100,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse",
      }}
      style={{
        backgroundImage: "url('/logo-white.png')",
        backgroundSize: "40px",
        backgroundRepeat: "repeat",
      }}
      {...rest}
    />
  );
}

export function OnboardingTip({ className, children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className={cn(
        "p-4 bg-blue-50/70 rounded-lg border border-blue-100 mb-1 mt-4 text-sm text-blue-500 text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
