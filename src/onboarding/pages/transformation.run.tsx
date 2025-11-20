import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import {
  OnboardingFooter,
  OnboardingH2,
  OnboardingHeader,
  OnboardingMain,
  OnboardingText,
  OnboardingWrapper,
  StepIndicator,
  OnboardingAnimated,
  OnboardingContent,
  OnboardingStepIcon,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";
import { useAppState } from "@renderer/hooks/useAppState";
import { cloneElement, useEffect, useMemo, useState } from "react";
import { useConversationState } from "@renderer/hooks/useConversationState";
import { HTMLMotionProps, motion } from "motion/react";
import { Maximize2, MessageSquare, Mic } from "lucide-react";
import { cn } from "@renderer/utils/cn";
import { ShortcutCombination, ShortcutKey } from "@renderer/components/shortcut";
import { Shortcut } from "@renderer/utils/shortcut";

export function TransformationRun() {
  const { t } = useTranslation();
  const { onBack, onNext } = useOnboardingNavigate();
  const { state: appState } = useAppState();
  const { state: conversationState } = useConversationState();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const bubbles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full bg-white/20 w-8 h-8"
        style={{
          left: `${20 + Math.random() * 60}%`,
          top: `${20 + Math.random() * 60}%`,
        }}
        animate={{
          scale: [0, 1, 0],
          opacity: [0, 0.5, 0],
        }}
        transition={{
          duration: 3 + Math.random() * 2,
          repeat: Number.POSITIVE_INFINITY,
          delay: Math.random() * 5,
        }}
      />
    ));
  }, []);

  const isDisabled = conversationState?.conversation.length === 0 || step !== 4;

  const getStepState = (index: number) => {
    if (step < index) return "disabled";
    if (step === index) return "active";
    return "inactive";
  };

  useEffect(() => {
    if (appState?.context.conversation_context.state === "Listening" && step === 1) {
      setStep(2);
    } else if (appState?.context.conversation_context.state === "Idle" && step === 3) {
      setStep(4);
    }
  }, [appState?.context.conversation_context.state, step]);

  useEffect(() => {
    if (step === 2 && !appState?.context.recording_window_context.minimized) {
      setStep(3);
    }
  }, [appState?.context.recording_window_context.minimized, step]);

  return (
    <OnboardingWrapper className="grid-rows-1 grid-cols-[1fr_1fr]">
      <OnboardingContent className="justify-center">
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("testConversation")}</OnboardingH2>

          <OnboardingText>
            {t("followTheseStepsToTest", { persona: appState?.context.active_persona?.name })}
          </OnboardingText>
        </OnboardingHeader>

        <OnboardingMain>
          <div className="flex flex-col gap-3 w-full">
            <Step state={getStepState(1)}>
              <StepNumber state={getStepState(1)}>{1}</StepNumber>
              <StepContent>
                <StepTitle>
                  <StepIcon>
                    <Mic />
                  </StepIcon>
                  {t("startRecording")}
                </StepTitle>
                <StepDescription>{t("pressTheKeyboardShortcutToBeginVoiceRecording")}</StepDescription>

                <StepShortcut
                  shortcuts={appState?.context.shortcuts.recording ?? []}
                  className="mt-1"
                  state={getStepState(1)}
                />
              </StepContent>
            </Step>

            <Step state={getStepState(2)}>
              <StepNumber state={getStepState(2)}>{2}</StepNumber>
              <StepContent>
                <StepTitle>
                  <StepIcon>
                    <Maximize2 />
                  </StepIcon>
                  {t("maximizeWindow")}
                </StepTitle>
                <StepDescription>{t("maximizeTheWindowToSeeTheConversation")}</StepDescription>

                <StepShortcut
                  shortcuts={appState?.context.shortcuts.toggle_minimized ?? []}
                  className="mt-1"
                  state={getStepState(2)}
                />
              </StepContent>
            </Step>

            <Step state={getStepState(3)}>
              <StepNumber state={getStepState(3)}>{3}</StepNumber>
              <StepContent>
                <StepTitle>
                  <StepIcon>
                    <MessageSquare />
                  </StepIcon>
                  {t("speakMessageAndStop")}
                </StepTitle>
                <StepDescription>
                  {t("speakMessageAndStopRecording", { persona: appState?.context.active_persona?.name })}
                </StepDescription>

                <StepShortcut
                  shortcuts={appState?.context.shortcuts.recording ?? []}
                  className="mt-1"
                  state={getStepState(3)}
                />
              </StepContent>
            </Step>
          </div>
        </OnboardingMain>

        <OnboardingFooter className="pt-4">
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t("back")}
          </Button>

          <StepIndicator currentStep={6} />

          <Button
            size="sm"
            onClick={() => onNext()}
            disabled={isDisabled}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white"
          >
            {t("continue")}
          </Button>
        </OnboardingFooter>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-r from-blue-600 to-cyan-600 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <OnboardingStepIcon>
              <MessageSquare />
            </OnboardingStepIcon>
          </div>
        </motion.div>

        <div className="absolute inset-2">{bubbles}</div>
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}

function Step({
  children,
  state,
  className,
  ...props
}: HTMLMotionProps<"div"> & { state?: "disabled" | "active" | "inactive" }) {
  return (
    <motion.article
      transition={{ delay: 0.1 }}
      className={cn(
        "w-full p-3 border bg-muted/50 border-gray-200 rounded-lg flex gap-2 transition-all",
        {
          "border-blue-500 bg-blue-500/10": state === "active",
          "!opacity-40": state === "disabled",
        },
        className,
      )}
      {...props}
    >
      {children}
    </motion.article>
  );
}

function StepNumber({
  children,
  state,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { state?: "disabled" | "active" | "inactive" }) {
  return (
    <div
      className={cn(
        "shrink-0 bg-blue-500/10 text-blue-600/70 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all",
        {
          "bg-neutral-500/10 text-foreground/50": state === "disabled",
          "bg-blue-500/50 text-white": state === "active",
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function StepContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1 text-left pt-[1px]", className)} {...props}>
      {children}
    </div>
  );
}

function StepTitle({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <h5 className={cn("text-sm font-medium flex items-center gap-1", className)} {...props}>
      {children}
    </h5>
  );
}

function StepDescription({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <p className={cn("text-xs text-foreground/60", className)} {...props}>
      {children}
    </p>
  );
}

function StepIcon({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  if (!children || Array.isArray(children)) {
    return null;
  }

  const cloned = cloneElement(children as React.ReactElement, {
    className: cn("size-3.5", className),
    ...props,
  });

  return cloned;
}

function StepShortcut({
  shortcuts,
  className,
  state,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { shortcuts: string[]; state?: "disabled" | "active" | "inactive" }) {
  return (
    <ShortcutCombination
      shortcuts={shortcuts}
      className={className}
      renderShortcut={(key) => (
        <ShortcutKey
          className={cn("text-xs transition-all", {
            "opacity-50": state === "disabled",
            "bg-blue-500/10 text-blue-600 border-blue-500/10": state === "active",
          })}
        >
          {Shortcut.keyToIcon(key)}
        </ShortcutKey>
      )}
      {...props}
    />
  );
}
