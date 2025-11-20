import { Button } from "@renderer/components/button";
import { invokeEvent, useAppState } from "@renderer/hooks/useAppState";
import { cn } from "@renderer/utils/cn";
import { Keyboard, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  OnboardingAnimated,
  OnboardingContent,
  OnboardingFooter,
  OnboardingH2,
  OnboardingHeader,
  OnboardingMain,
  OnboardingStepIcon,
  OnboardingText,
  OnboardingWrapper,
  StepIndicator,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";

export function Permissions() {
  const { t } = useTranslation();
  const { onBack, onNext } = useOnboardingNavigate();
  const { state } = useAppState();
  const [accessibilityPending, setAccessibilityPending] = useState(false);
  const accessibilityRef = useRef(false);
  const [_microphonePending, setMicrophonePending] = useState(false);
  const microphoneRef = useRef(false);

  const accessibilityGranted = useMemo(() => {
    return state?.context.permissions_context.accessibility ?? false;
  }, [state?.context.permissions_context.accessibility]);

  const microphoneGranted = useMemo(() => {
    return true;
  }, [state?.context.permissions_context.microphone]);

  useEffect(() => {
    invokeEvent("ActionCheckAccessibilityPermission");
    invokeEvent("ActionCheckMicrophonePermission");
  }, []);

  useEffect(() => {
    let timeout: number | null = null;

    if (timeout) {
      clearInterval(timeout);
    }

    if (!accessibilityGranted) {
      //  @ts-ignore
      timeout = setInterval(() => {
        checkAccessibilityPermission();
      }, 1000);
    }

    return () => {
      if (timeout) {
        clearInterval(timeout);
      }
    };
  }, [accessibilityGranted]);

  useEffect(() => {
    let timeout: number | null = null;

    if (timeout) {
      clearInterval(timeout);
    }

    if (!microphoneGranted) {
      //  @ts-ignore
      timeout = setInterval(() => {
        checkMicrophonePermission();
      }, 1000);
    }

    return () => {
      if (timeout) {
        clearInterval(timeout);
      }
    };
  }, [microphoneGranted]);

  const checkMicrophonePermission = async () => {
    invokeEvent("ActionCheckMicrophonePermission");
    console.log("checkMicrophonePermission");
    if (microphoneRef.current) {
      setMicrophonePending(false);
      return;
    }
  };

  // const requestMicrophonePermission = async () => {
  //   try {
  //     setMicrophonePending(true);

  //     await invokeEvent("ActionRequestMicrophonePermission");
  //     await new Promise((resolve) => setTimeout(resolve, 1000));

  //     await checkMicrophonePermission();
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

  const checkAccessibilityPermission = async () => {
    invokeEvent("ActionCheckAccessibilityPermission");
    console.log("checkAccessibilityPermission");
    if (accessibilityRef.current) {
      setAccessibilityPending(false);
      return;
    }
  };

  const requestAccessibilityPermission = async () => {
    try {
      setAccessibilityPending(true);

      await invokeEvent("ActionRequestAccessibilityPermission");

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <OnboardingWrapper className="grid-rows-1 grid-cols-[1fr_1fr]">
      <OnboardingContent className="justify-center">
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("appPermissions")}</OnboardingH2>

          <OnboardingText>{t("appPermissionsDescription")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain className="min-h-[200px]">
          <div className="flex flex-col gap-3">
            {/* <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "flex items-start gap-3 border w-full h-fit py-3 px-4 rounded-lg text-sm  peer-data-[state=checked]:bg-pink-500/5 peer-data-[state=checked]:border-pink-500/70",
              )}
            >
              <div className="flex items-center justify-center p-2 rounded-full bg-teal-100 text-teal-600">
                <Mic className="w-4 h-4" />
              </div>

              <div className="flex flex-col gap-1 text-left max-w-[80%]">
                <span className="text-sm font-semibold">{t("microphoneAccess")}</span>
                <span className="text-sm text-neutral-500">{t("microphoneAccessDescription")}</span>
                {microphoneGranted ? (
                  <div className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-md w-fit">
                    {t("granted")}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={microphonePending}
                    onClick={requestMicrophonePermission}
                    className="w-fit mt-1 text-xs h-8"
                  >
                    {t("grantAccess")}
                  </Button>
                )}
              </div>
            </motion.div> */}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                "flex items-start gap-3 border w-full h-fit py-3 px-4 rounded-lg text-sm  peer-data-[state=checked]:bg-pink-500/5 peer-data-[state=checked]:border-pink-500/70",
              )}
            >
              <div className="flex items-center justify-center p-2 rounded-full bg-purple-100 p-2 text-purple-600">
                <Keyboard className="w-4 h-4" />
              </div>

              <div className="flex flex-col gap-1 text-left max-w-[75%]">
                <span className="text-sm font-semibold">{t("keyboardMonitoring")}</span>
                <span className="text-sm text-neutral-500">{t("keyboardMonitoringDescription")}</span>
                {accessibilityGranted ? (
                  <div className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-md w-fit">
                    {t("granted")}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant={"outline"}
                    disabled={accessibilityPending}
                    onClick={requestAccessibilityPermission}
                    className={cn("w-fit mt-1 text-xs h-8")}
                  >
                    {t("grantAccess")}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </OnboardingMain>

        <OnboardingFooter className="pt-4">
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t("back")}
          </Button>

          <StepIndicator currentStep={2} />

          <Button
            size="sm"
            onClick={() => onNext()}
            disabled={!microphoneGranted || !accessibilityGranted}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:opacity-90 border-transparent"
          >
            {t("continue")}
          </Button>
        </OnboardingFooter>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-r from-teal-500 to-emerald-500 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 "
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-teal-400">
            <OnboardingStepIcon>
              <ShieldCheck />
            </OnboardingStepIcon>
          </div>
        </motion.div>
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}
