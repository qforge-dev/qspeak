import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import { useAppState } from "@renderer/hooks/useAppState";
import { languages } from "@shared/languages";
import { Check, Globe } from "lucide-react";
import {
  OnboardingFooter,
  OnboardingH2,
  OnboardingHeader,
  OnboardingMain,
  OnboardingStepIcon,
  OnboardingText,
  OnboardingWrapper,
  OnboardingAnimated,
  OnboardingContent,
  StepIndicator,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";
import { motion } from "motion/react";
import { RadioGroup } from "@renderer/components/radio-group";
import { cn } from "@renderer/utils/cn";

export function TranscriptionLanguage() {
  const { t } = useTranslation();
  const { onNext } = useOnboardingNavigate();
  const { state, updateLanguage } = useAppState();
  const onLanguageChange = (language: string) => {
    updateLanguage(language);
  };

  const isActive = (language: string) => {
    return state?.context.language === language;
  };

  return (
    <OnboardingWrapper className="grid-cols-[1fr_1fr] grid-rows-1">
      <OnboardingContent className="justify-center">
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("chooseLanguage")}</OnboardingH2>

          <OnboardingText>{t("selectLanguageForTranscription")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain>
          <RadioGroup className="grid grid-cols-2 gap-2 max-h-[34vh] overflow-y-auto w-full pl-0.5 pt-1 pr-2">
            {languages.map((language, index) => (
              <motion.button
                key={language.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                onClick={() => onLanguageChange(language.code)}
                className={cn("flex items-center justify-between gap-2 border w-full h-full p-4 rounded-lg text-base", {
                  "bg-blue-500/10 border-blue-500": isActive(language.code),
                  "cursor-pointer hover:bg-blue-500/5 transition-colors hover:border-blue-500/60": !isActive(
                    language.code,
                  ),
                })}
              >
                <div className="flex items-center gap-2">
                  <span>{language.flag}</span>
                  <span>{language.name}</span>
                </div>

                {isActive(language.code) ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  >
                    <Check className="h-4 w-4 text-blue-500" />
                  </motion.div>
                ) : null}
              </motion.button>
            ))}
          </RadioGroup>

          <div className="bg-gradient-to-t from-white to-transparent h-10 pointer-events-none absolute bottom-0 left-0 right-0" />
        </OnboardingMain>

        <OnboardingFooter className="pt-4">
          <div className="w-[36px]" />

          <StepIndicator currentStep={0} />

          <Button
            size="sm"
            onClick={() => onNext()}
            className="bg-gradient-to-br from-blue-400 to-purple-500 text-white hover:opacity-90"
          >
            {t("continue")}
          </Button>
        </OnboardingFooter>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-br from-blue-400 to-purple-500 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <OnboardingStepIcon>
              <Globe />
            </OnboardingStepIcon>
          </div>
        </motion.div>
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}
