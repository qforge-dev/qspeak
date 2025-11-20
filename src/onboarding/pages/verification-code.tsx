import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import { Verified, ArrowRight } from "lucide-react";
import {
  OnboardingStepIcon,
  OnboardingWrapper,
  OnboardingAnimated,
  OnboardingContent,
  OnboardingMain,
  OnboardingHeader,
  OnboardingText,
  OnboardingH2,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";
import { motion } from "motion/react";
import { Input } from "@renderer/components/input";
import { useLocation } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import { errorToast, successToast } from "@renderer/components/toasts";
import { useMemo, useEffect } from "react";
import { useAppState } from "@renderer/hooks/useAppState";

export function VerificationCode() {
  const { t } = useTranslation();
  const { onNext, onBack } = useOnboardingNavigate();
  const { state } = useAppState();
  const location = useLocation();

  const isDisabled =
    state?.context.account_context.login.step === "LoginVerify" &&
    state?.context.account_context.login.state === "Pending";

  const verifyCode = async ({ code, email }: { code: string; email: string }) => {
    return invokeEvent("ActionLoginVerify", {
      code: code,
      email: email,
    });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = location.state?.email;

    if (isDisabled) return;

    if (!email) {
      errorToast(t("emailNotFound"));

      return;
    }

    const formData = new FormData(e.target as HTMLFormElement);
    const code = formData.get("code");

    try {
      await verifyCode({ code: code as string, email: email as string });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (
      state?.context.account_context.login.state === "Success" &&
      state?.context.account_context.login.step === "LoginVerify"
    ) {
      successToast(t("verificationCodeSuccess"));
      onNext();
    }
  }, [state?.context.account_context.login.state]);

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
    <OnboardingWrapper>
      <OnboardingContent>
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("verificationCode")}</OnboardingH2>

          <OnboardingText>{t("enterVerificationCode", { email: location.state?.email })}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full"
            >
              <Input placeholder="Code" name="code" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full"
            >
              <Button
                type="submit"
                className=" bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:opacity-90 w-full border-transparent"
              >
                {t("verify_code")} <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </form>

          <div className="w-full flex justify-start mt-6">
            <Button onClick={onBack} variant="ghost" size="sm" type="button">
              {t("back")}
            </Button>
          </div>
        </OnboardingMain>
      </OnboardingContent>

      <OnboardingAnimated className=" bg-gradient-to-br from-purple-500 to-pink-500 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <OnboardingStepIcon>
              <Verified />
            </OnboardingStepIcon>
          </div>
        </motion.div>
        <div className="absolute inset-2 rounded-full flex items-center justify-center">{sparkles}</div>
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
