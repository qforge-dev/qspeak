import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import {
  OnboardingAnimated,
  OnboardingAnimatedBackground,
  OnboardingContent,
  OnboardingFooter,
  OnboardingH2,
  OnboardingHeader,
  OnboardingText,
  OnboardingWrapper,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";
import { motion } from "motion/react";
import { InterfaceLanguageSelect } from "@renderer/components/interface-language-select";
import { useInterfaceLanguage } from "@renderer/hooks/useInterfaceLanguage";
import { ArrowRight } from "lucide-react";
export function Root() {
  const { t } = useTranslation();
  const { onNext } = useOnboardingNavigate();

  const { onLanguageChange, language } = useInterfaceLanguage();

  return (
    <OnboardingWrapper>
      <OnboardingContent>
        <OnboardingHeader className="text-center items-center">
          <OnboardingH2>{t("welcomeToQSpeak")}</OnboardingH2>

          <OnboardingText className="max-w-sm">{t("qSpeakDescription")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingFooter className="pt-4 justify-center max-w-sm">
          <Button
            onClick={() => onNext()}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 border-transparent"
          >
            {t("getStarted")} <ArrowRight className="w-4 h-4" />
          </Button>
        </OnboardingFooter>

        <div className="w-full flex justify-center">
          <InterfaceLanguageSelect value={language} onChange={onLanguageChange} />
        </div>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-br from-violet-500 to-amber-500 relative">
        <OnboardingAnimatedBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
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
