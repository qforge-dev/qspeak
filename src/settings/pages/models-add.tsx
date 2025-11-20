import { useTranslation } from "react-i18next";
import { HistoryHeading, HistoryHeader, HistoryMain } from "../components/history/history-layout";
import { CardDescription } from "@renderer/components/card";
import { Button } from "@renderer/components/button";
import { BasicLink } from "@renderer/components/basic-link";
import { ChevronLeft } from "lucide-react";
import { ModelsForm } from "../components/models/models-form";
import { RouteWrapper } from "../components/layout";
import { useTransitionNavigate } from "@renderer/hooks/useNavigate";
import { useModelsState } from "@renderer/hooks/useModelsState";
import { useLocation } from "react-router";

type ConversationModelFormData = {
  model: string;
  url: string;
  api_key?: string;
  supports_tools?: boolean;
  supports_vision?: boolean;
};

export function AddNewModel() {
  const { t } = useTranslation();
  const navigate = useTransitionNavigate();
  const { addConversationModel } = useModelsState();
  const { state: routeState } = useLocation();

  const onSave = async (data: ConversationModelFormData) => {
    try {
      await addConversationModel(data);
      navigate("/models");
    } catch (error) {
      console.error("Failed to save model:", error);
    }
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
          <HistoryHeading className="flex items-center gap-1">{t("AddNewModel")}</HistoryHeading>

          <CardDescription data-tauri-drag-region>{t("AddModelPageDescription")}</CardDescription>
        </div>
      </HistoryHeader>

      <RouteWrapper className="grow h-full">
        <ModelsForm onSave={onSave} onCancel={onCancel} defaultValues={routeState?.template} />
      </RouteWrapper>
    </HistoryMain>
  );
}
