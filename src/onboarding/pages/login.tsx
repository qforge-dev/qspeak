import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import { LogIn, ArrowRight } from "lucide-react";
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
import { invokeEvent } from "@renderer/hooks/useAppState";
import { useEffect, useMemo, useRef } from "react";
import { useAppState } from "@renderer/hooks/useAppState";
import { successToast } from "@renderer/components/toasts";

export function Login() {
  const emailRef = useRef<string | null>(null);
  const { t } = useTranslation();
  const { onNext } = useOnboardingNavigate();
  const { state } = useAppState();
  const isDisabled =
    state?.context.account_context.login.step === "Login" && state?.context.account_context.login.state === "Pending";

  const login = async (email: string) => {
    invokeEvent("ActionLogin", email);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isDisabled) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email");

    try {
      await login(email as string);

      emailRef.current = email as string;
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (
      state?.context.account_context.login.state === "Success" &&
      state?.context.account_context.login.step === "Login" &&
      emailRef.current
    ) {
      successToast(t("codeSent"));

      onNext({
        state: {
          email: emailRef.current as string,
        },
      });
    }
  }, [state?.context.account_context.login.state]);

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

  return (
    <OnboardingWrapper>
      <OnboardingContent>
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("login")}</OnboardingH2>

          <OnboardingText>{t("enterEmailToLogin")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain>
          <form onSubmit={onSubmit} className="flex flex-col w-full gap-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full"
            >
              <Input placeholder="Email address" name="email" type="email" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full"
            >
              <Button
                type="submit"
                disabled={isDisabled}
                className="bg-gradient-to-br from-blue-500 to-violet-500 text-white hover:opacity-90 w-full"
              >
                {t("send_verification_code")} <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </form>
        </OnboardingMain>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-br from-blue-500 to-violet-500 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <OnboardingStepIcon>
              <LogIn />
            </OnboardingStepIcon>
          </div>
        </motion.div>
        {bubbles}
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}
