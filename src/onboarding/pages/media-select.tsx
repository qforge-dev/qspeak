import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import {
  OnboardingHeader,
  OnboardingWrapper,
  OnboardingH2,
  OnboardingMain,
  OnboardingText,
  OnboardingFooter,
  OnboardingContent,
  StepIndicator,
  OnboardingAnimated,
  OnboardingStepIcon,
  OnboardingTip,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";
import { useAppState } from "@renderer/hooks/useAppState";
import { useInputDevices } from "@renderer/onboarding/hooks/useAudioDevices";
import { motion } from "motion/react";
import { Mic } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@renderer/components/radio-group";

export function MediaSelect() {
  const { t } = useTranslation();
  const { onBack, onNext } = useOnboardingNavigate();
  const { state, updateInputDevice } = useAppState();

  const { devices } = useInputDevices();

  const onMicrophoneChange = (value: string) => {
    updateInputDevice(value);
  };

  const isDisabled = !state?.context.input_device;

  return (
    <OnboardingWrapper className="grid-rows-1 grid-cols-[1fr_1fr]">
      <OnboardingContent className="justify-center">
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("selectMicrophone")}</OnboardingH2>

          <OnboardingText>{t("chooseMicrophoneForVoiceInput")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain className="min-h-[210px]">
          <RadioGroup
            className="flex flex-col gap-3 max-h-[20vh] grow overflow-y-auto w-full pl-0.5 pt-1 pr-2 "
            onValueChange={onMicrophoneChange}
            value={state?.context.input_device ?? undefined}
          >
            {devices.map((device, index) => (
              <motion.label
                key={device.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="relative"
              >
                <RadioGroupItem
                  value={device.name}
                  className="peer absolute top-1/2 left-3 -translate-y-1/2 text-yellow-500 border-yellow-500"
                />
                <div className="flex items-center gap-2 border w-full h-fit py-3 pr-3 pl-9 rounded-lg text-sm cursor-pointer peer-data-[state=checked]:bg-yellow-500/10 peer-data-[state=checked]:border-yellow-500">
                  <span>{device.label}</span>
                </div>
              </motion.label>
            ))}
          </RadioGroup>

          <OnboardingTip>
            {t("tip")}: {t("microphoneTip")}
          </OnboardingTip>
        </OnboardingMain>

        <OnboardingFooter className="pt-4">
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t("back")}
          </Button>

          <StepIndicator currentStep={1} />

          <Button size="sm" onClick={() => onNext()} disabled={isDisabled}>
            {t("continue")}
          </Button>
        </OnboardingFooter>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-r from-yellow-400 to-orange-500 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <OnboardingStepIcon>
              <Mic />
            </OnboardingStepIcon>
          </div>

          <motion.div
            className="absolute -inset-4 rounded-full bg-white/40"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
          />

          <motion.div
            className="absolute -inset-8 rounded-full bg-white/30"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.05, 0.2] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, delay: 0.5 }}
          />
        </motion.div>
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}
