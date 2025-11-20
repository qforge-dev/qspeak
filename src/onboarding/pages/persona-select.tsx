import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import { RadioGroup, RadioGroupItem } from "@renderer/components/radio-group";
import { Check, Wand2 } from "lucide-react";
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
  OnboardingTip,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";
import { usePersonas } from "@renderer/hooks/usePersonas";
import { useAppState } from "@renderer/hooks/useAppState";
import { motion } from "motion/react";
import { cn } from "@renderer/utils/cn";
import { useMemo } from "react";

export function PersonaSelect() {
  const { t } = useTranslation();
  const { onBack, onNext } = useOnboardingNavigate();
  const { state } = useAppState();
  const { state: personasState, changePersona } = usePersonas();
  const onPersonaChange = (id: string) => {
    changePersona(id);
  };

  const isDisabled = !state?.context.active_persona;

  const sparkles = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full bg-white/30"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
        }}
        animate={{
          y: [0, -20 - Math.random() * 30],
          opacity: [0, 0.7, 0],
          scale: [0, 1, 0.5],
        }}
        transition={{
          duration: 2 + Math.random() * 2,
          repeat: Number.POSITIVE_INFINITY,
          delay: Math.random() * 2,
        }}
      />
    ));
  }, []);
  return (
    <OnboardingWrapper className="grid-rows-1 grid-cols-[1fr_1fr]">
      <OnboardingContent className="justify-center">
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("personasSelection")}</OnboardingH2>

          <OnboardingText>{t("selectPersonaForConversation")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain className="min-h-[200px]">
          <RadioGroup
            className="flex flex-col gap-3 max-h-[34vh] grow overflow-y-auto w-full pl-0.5 pt-1 pr-2"
            value={state?.context.active_persona?.id || undefined}
            onValueChange={onPersonaChange}
          >
            {personasState?.context.personas.map((persona, index) => (
              <motion.label
                key={persona.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="relative"
              >
                <RadioGroupItem
                  value={persona.id}
                  className="peer opacity-0 pointer-events-none absolute top-0 left-0"
                />
                <div
                  className={cn(
                    "flex items-center gap-3 border w-full h-fit py-3 px-4 rounded-lg text-sm cursor-pointer peer-data-[state=checked]:bg-pink-500/5 peer-data-[state=checked]:border-pink-500/70",
                  )}
                >
                  <div
                    className={cn("flex items-center justify-center p-2 rounded-full", {
                      "bg-yellow-500/10": index % 4 === 0,
                      "bg-blue-500/10": index % 4 === 1,
                      "bg-green-500/10": index % 4 === 2,
                      "bg-purple-500/10": index % 4 === 3,
                    })}
                  >
                    {index % 4 === 0 ? "🌟" : index % 4 === 1 ? "🌈" : index % 4 === 2 ? "🌿" : "👻"}
                  </div>

                  <div className="flex flex-col gap-1 text-left max-w-[75%]">
                    <span>{persona.name}</span>
                    <span className="text-xs text-neutral-500 line-clamp-2">{persona.system_prompt}</span>
                  </div>

                  {state?.context.active_persona?.id === persona.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                      className="ml-auto"
                    >
                      <div className="bg-pink-400 text-white p-1 rounded-full">
                        <Check className="h-3 w-3" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.label>
            ))}
          </RadioGroup>

          <OnboardingTip>
            {t("tip")}: {t("personaTip")}
          </OnboardingTip>
        </OnboardingMain>

        <OnboardingFooter className="pt-4">
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t("back")}
          </Button>

          <StepIndicator currentStep={5} />

          <Button
            size="sm"
            onClick={() => onNext()}
            disabled={isDisabled}
            className="bg-gradient-to-r from-pink-500 to-rose-600 text-white hover:opacity-90 border-transparent"
          >
            {t("continue")}
          </Button>
        </OnboardingFooter>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-r from-pink-500 to-rose-600 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <OnboardingStepIcon>
              <Wand2 />
            </OnboardingStepIcon>
          </div>
        </motion.div>

        <div className="absolute inset-2 rounded-full flex items-center justify-center">{sparkles}</div>
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}
