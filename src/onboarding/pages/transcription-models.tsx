import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import { useAppState } from "@renderer/hooks/useAppState";
import { useInternetConnection } from "@renderer/hooks/useInternetConnection";
import { TranscriptionModel, useModelsState } from "@renderer/hooks/useModelsState";
import {
  OnboardingFooter,
  OnboardingH2,
  OnboardingHeader,
  OnboardingMain,
  OnboardingText,
  OnboardingWrapper,
  StepIndicator,
  OnboardingAnimated,
  OnboardingStepIcon,
  OnboardingContent,
  SoundWaveAnimation,
} from "../components/onboarding.components";
import { useOnboardingNavigate } from "../hooks/useOnboardingNavigate";
import { cn } from "@renderer/utils/cn";
import { useEffect, useMemo } from "react";
import {
  formatMemory,
  formatParameters,
  ModelDownloadButton,
  ModelDownloadWrapper,
  ModelInfo,
  ModelInfoItem,
  ModelItem,
  ModelRadioItemHeading,
  ModelSizeInfo,
  ScaleIndicator,
} from "@renderer/components/models-cards";
import { motion } from "motion/react";
import { Headphones, Cloud } from "lucide-react";

export function TranscriptionModels() {
  const { t } = useTranslation();
  const { state, updateTranscriptionModel } = useAppState();
  const { state: modelsState, deleteTranscriptionModel, downloadTranscriptionModel } = useModelsState();
  const [online] = useInternetConnection();

  // Filter out cloud models when offline
  const availableModels = useMemo(() => {
    if (!modelsState?.transcription_models) return [];

    return modelsState.transcription_models.filter((model) => {
      // Hide cloud models when offline
      if (!online && !model.is_local) return false;
      return true;
    });
  }, [modelsState?.transcription_models, online]);

  useEffect(() => {
    if (!state || !modelsState) return;
    const modelsCount = availableModels.length || 0;
    const activeModel = availableModels.find((model) => model.model === state?.context.transcription_model);

    if (modelsCount === 0) {
      updateTranscriptionModel(null);
    }

    if (activeModel?.download_state.status !== "downloaded") {
      updateTranscriptionModel(
        availableModels.find((model) => model.download_state.status === "downloaded")?.model || null,
      );
    }
  }, [availableModels]);

  const { onBack, onNext } = useOnboardingNavigate();

  const isDisabled = !state?.context.transcription_model;

  function handleModelClick(model: TranscriptionModel) {
    if (model.download_state.status !== "downloaded") return;

    updateTranscriptionModel(model.model);
  }

  if (!availableModels.length) return null;

  return (
    <OnboardingWrapper className="grid-rows-1 grid-cols-[1fr_1fr]">
      <OnboardingContent className="justify-center">
        <OnboardingHeader className="items-start">
          <OnboardingH2>{t("transcriptionModel")}</OnboardingH2>

          <OnboardingText>{t("selectModelForSpeechToText")}</OnboardingText>
        </OnboardingHeader>

        <OnboardingMain>
          <div className="max-h-[40vh] overflow-y-auto w-full pl-0.5 pt-1 pr-2 flex flex-col gap-3">
            {availableModels.map((model, index) => (
              <motion.div
                key={model.model}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <ModelItem
                  className={cn("flex-row gap-2 justify-between", {
                    "bg-purple-500/10 border-purple-500": state?.context.transcription_model === model.model,
                    "cursor-pointer": model.download_state.status === "downloaded",
                  })}
                  key={model.model}
                  onClick={() => handleModelClick(model)}
                >
                  <div className="flex flex-col gap-1">
                    <ModelRadioItemHeading>{model.name}</ModelRadioItemHeading>

                    <ModelInfo className="flex flex-row gap-4 mt-2">
                      <div className="flex flex-col gap-1.5">
                        <div className="whitespace-nowrap flex items-center gap-1">
                          <span className="italic text-muted-foreground">{t("Speed")}:</span>
                        </div>
                        <ScaleIndicator value={Number(model.speed)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="whitespace-nowrap flex items-center gap-1">
                          <span className="italic text-muted-foreground">{t("Intelligence")}:</span>
                        </div>
                        <ScaleIndicator value={Number(model.intelligence)} />
                      </div>
                    </ModelInfo>

                    {model.is_local && (
                      <div className="flex flex-col text-xs mt-2 gap-1.5">
                        <ModelInfoItem label={t("VRAM")} value={`${model.vram} MB`} />
                        <ModelInfoItem label={t("Parameters")} value={formatParameters(model.parameters)} />
                      </div>
                    )}
                  </div>

                  <ModelDownloadWrapper>
                    {!model.is_local ? (
                      <div className="p-0.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full w-5.5 h-5.5 text-xs [&_svg]:size-3"
                          disabled
                        >
                          <Cloud />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <ModelDownloadButton
                          status={model.download_state.status}
                          progress={
                            model.download_state.status === "downloading" ? model.download_state.progress : undefined
                          }
                          onDownload={() => downloadTranscriptionModel(model.model)}
                          onRemove={() => deleteTranscriptionModel(model.model)}
                          model={model.model}
                        />
                        {model.is_local && <ModelSizeInfo>{formatMemory(model.size)}</ModelSizeInfo>}
                      </>
                    )}
                  </ModelDownloadWrapper>
                </ModelItem>
              </motion.div>
            ))}
          </div>

          <div className="bg-gradient-to-t from-white to-transparent h-14 pointer-events-none absolute bottom-0 left-0 right-0" />
        </OnboardingMain>

        <OnboardingFooter className="pt-4">
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t("back")}
          </Button>

          <StepIndicator currentStep={3} />

          <Button
            size="sm"
            onClick={() => onNext()}
            disabled={isDisabled}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:opacity-90"
          >
            {t("continue")}
          </Button>
        </OnboardingFooter>
      </OnboardingContent>

      <OnboardingAnimated className="bg-gradient-to-r from-purple-500 to-indigo-600 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-[230px]"
        >
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <OnboardingStepIcon>
              <Headphones />
            </OnboardingStepIcon>
          </div>

          <SoundWaveAnimation />
        </motion.div>
      </OnboardingAnimated>
    </OnboardingWrapper>
  );
}
