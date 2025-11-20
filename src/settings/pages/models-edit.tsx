import { BasicLink } from "@renderer/components/basic-link";
import { Button } from "@renderer/components/button";
import { CardDescription } from "@renderer/components/card";
import { useModelsState } from "@renderer/hooks/useModelsState";
import { useTransitionNavigate } from "@renderer/hooks/useNavigate";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { HistoryHeader, HistoryHeading, HistoryMain } from "../components/history/history-layout";
import { RouteWrapper } from "../components/layout";
import { ModelsForm } from "../components/models/models-form";

export function EditModel() {
  const { t } = useTranslation();
  const { state, updateConversationModel } = useModelsState();
  const { id } = useParams();
  const navigate = useTransitionNavigate();

  if (!id) {
    navigate("/models");
    return null;
  }

  const model = state?.conversation_models.find((model) => model.model === id);

  if (!model) {
    navigate("/models");
    return null;
  }

  // Only allow editing custom models
  const isPredefinedConversationModel = ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini"].includes(
    model.model,
  );
  if (model.is_local || isPredefinedConversationModel) {
    navigate("/models");
    return null;
  }

  const onSave = (updatedModel: {
    model: string;
    url: string;
    api_key?: string;
    supports_tools?: boolean;
    supports_vision?: boolean;
  }) => {
    updateConversationModel({
      original_model: model.model, // Original model ID from URL params
      model: updatedModel.model, // New model identifier
      url: updatedModel.url,
      api_key: updatedModel.api_key,
      supports_tools: updatedModel.supports_tools || false,
      supports_vision: updatedModel.supports_vision || false,
    });

    navigate("/models");
  };

  const onCancel = () => {
    navigate("/models");
  };

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-0 select-none cursor-grab flex items-start gap-1" data-tauri-drag-region>
        <Button size="sm" asChild variant="ghost">
          <BasicLink to="/models">
            <ChevronLeft />
          </BasicLink>
        </Button>

        <div>
          <HistoryHeading className="flex items-center gap-1">{t("EditModel")}</HistoryHeading>

          <CardDescription data-tauri-drag-region>{t("manageModelsDescription1")}</CardDescription>
        </div>
      </HistoryHeader>

      <RouteWrapper className="grow h-full">
        <ModelsForm
          onSave={onSave}
          onCancel={onCancel}
          defaultValues={{
            model: model.model,
            url: model.config.openai.url,
            api_key: model.config.openai.api_key,
            supports_tools: model.supports_tools,
            supports_vision: model.supports_vision,
          }}
        />
      </RouteWrapper>
    </HistoryMain>
  );
}
