import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import {
  OnboardingFooter,
  OnboardingH2,
  OnboardingHeader,
  OnboardingMain,
  OnboardingStepIcon,
  OnboardingText,
  OnboardingWrapper,
  StepIndicator,
  OnboardingAnimated,
  OnboardingContent,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";
import { useAppState } from "@renderer/hooks/useAppState";
import { useConversationState } from "@renderer/hooks/useConversationState";
import { Mic } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@renderer/utils/cn";
import { Textarea } from "@renderer/components/textarea";
import { ShortcutCombination, ShortcutKey } from "@renderer/components/shortcut";
import { Shortcut } from "@renderer/utils/shortcut";

export function TranscriptionRun() {
  const { t } = useTranslation();
  const { onBack, onNext } = useOnboardingNavigate();
  const { state: conversationState } = useConversationState();
  const { state: appState } = useAppState();

  const isRecording = conversationState?.state === "Listening";
  const isDisabled = !conversationState?.transcription_text;

  return (
    <OnboardingWrapper className="grid-rows-1 grid-cols-[1fr_1fr]">
      <OnboardingContent className="justify-center">
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("testTranscription")}</OnboardingH2>

          <OnboardingText>{t("ensureVoiceTranscribedCorrectly")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full p-6 border border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col justify-center mb-6"
          >
            <StepParagraph>1. Click inside the text area</StepParagraph>
            <StepParagraph>
              2. {t("press")}
              <ShortcutCombination
                shortcuts={appState?.context.shortcuts.recording ?? []}
                renderShortcut={(key) => (
                  <ShortcutKey className="bg-green-500/20 text-green-700 border-green-500/30 text-xs p-0.5">
                    {Shortcut.keyToIcon(key)}
                  </ShortcutKey>
                )}
              />
              {t("toStartRecording")}
            </StepParagraph>
            <StepParagraph>3. {t("saySomething")}</StepParagraph>
            <StepParagraph className="mb-3">
              4. {t("press")}
              <ShortcutCombination
                shortcuts={appState?.context.shortcuts.recording ?? []}
                renderShortcut={(key) => (
                  <ShortcutKey className="bg-green-500/20 text-green-700 border-green-500/30 text-xs p-0.5">
                    {Shortcut.keyToIcon(key)}
                  </ShortcutKey>
                )}
              />
              {t("toStopRecording")}
            </StepParagraph>

            <Textarea className="w-full h-full resize-none mb-2 mt-1" placeholder={t("cursorHere")} />

            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-neutral-500 max-w-sm italic"
            >
              <p>{t("trySayingSomething")}</p>
            </motion.div>
          </motion.div>
        </OnboardingMain>

        <OnboardingFooter className="pt-4">
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t("back")}
          </Button>

          <StepIndicator currentStep={4} />

          <Button
            size="sm"
            onClick={() => onNext()}
            disabled={isDisabled}
            className="bg-gradient-to-r from-green-500 to-teal-600 text-white hover:opacity-90 border-transparent"
          >
            {t("continue")}
          </Button>
        </OnboardingFooter>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-r from-green-500 to-teal-600 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
        >
          {isRecording && (
            <>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-red-500/60 animate-ping" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-red-500/30 animate-ping" />
            </>
          )}

          <div
            className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center rounded-full p-2 w-20 h-20",
              {
                "bg-green-500": !isRecording,
                "bg-red-500": isRecording,
              },
            )}
          >
            <OnboardingStepIcon className="w-8 h-8">
              <Mic />
            </OnboardingStepIcon>
          </div>

          <div className="absolute -bottom-2 left-0 right-0 flex justify-center items-end h-12 ">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-1 mx-0.5 bg-white/50 rounded-t-full"
                animate={{
                  height: isRecording ? [5, 15 + Math.random() * 20, 5] : [5, 8, 5],
                }}
                transition={{
                  duration: isRecording ? 0.5 + Math.random() * 0.5 : 2,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "reverse",
                  delay: i * 0.05,
                }}
              />
            ))}
          </div>
        </motion.div>
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}

function StepParagraph({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div className={cn("text-neutral-500 mb-1 flex gap-2 text-sm items-center", className)} {...props}>
      {children}
    </div>
  );
}
