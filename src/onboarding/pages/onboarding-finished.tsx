import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import {
  OnboardingFooter,
  OnboardingHeader,
  OnboardingText,
  OnboardingWrapper,
  OnboardingAnimated,
  OnboardingContent,
  OnboardingMain,
  OnboardingH2,
} from "../components/onboarding.components";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import { useAppState } from "@renderer/hooks/useAppState";
export function OnboardingFinished() {
  const { t } = useTranslation();
  const { state } = useAppState();

  const closeOnboarding = () => {
    return invokeEvent("FinishOnboarding");
  };

  return (
    <OnboardingWrapper className="grid-rows-1 grid-cols-2">
      <OnboardingContent className="justify-center">
        <OnboardingHeader>
          <OnboardingH2 className="mb-2">{t("allSet")}</OnboardingH2>

          <OnboardingText>{t("configurationComplete")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain>
          <div className="grid grid-cols-1 gap-4 w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.2 }}
            >
              <div className="rounded-lg border border-border bg-background p-4 text-left">
                <h3 className="mb-2 font-medium">{t("createPersona")}</h3>
                <p className="text-sm text-muted-foreground">{t("createPersonaDescription")}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.3 }}
            >
              <div className="rounded-lg border border-border bg-background p-4 text-left">
                <h3 className="mb-2 font-medium">{t("configureShortcuts")}</h3>
                <p className="text-sm text-muted-foreground">{t("configureShortcutsDescription")}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.3 }}
            >
              <div className="rounded-lg border border-border bg-background p-4 text-left">
                <h3 className="mb-2 font-medium">{t("maximizeRecordingWindow")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("maximizeRecordingWindowDescription", {
                    shortcut: state?.context.shortcuts.toggle_minimized,
                  })}
                </p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.3 }}
          ></motion.div>
        </OnboardingMain>

        <OnboardingFooter className="pt-6 ">
          <Button
            variant="default"
            onClick={closeOnboarding}
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white w-full border-transparent"
          >
            {t("letsGo")}
          </Button>
        </OnboardingFooter>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-r from-violet-500 to-fuchsia-500 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <img src="/logo-white.png" alt="qSpeak Logo" className="w-20 h-20" />
          </div>

          <motion.div
            className="absolute -inset-4 rounded-full bg-white/30"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
          />

          <motion.div
            className="absolute -inset-8 rounded-full bg-white/20"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.05, 0.2] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, delay: 0.5 }}
          />
        </motion.div>
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}

function invokeEvent(name: string, payload: any | null = null) {
  return invoke("event", {
    event: {
      name,
      payload,
    },
  });
}
