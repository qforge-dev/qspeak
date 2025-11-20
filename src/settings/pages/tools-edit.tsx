import { useTranslation } from "react-i18next";
import { useAppState } from "@renderer/hooks/useAppState";
import { HistoryHeading, HistoryHeader, HistoryMain } from "../components/history/history-layout";
import { CardDescription } from "@renderer/components/card";
import { Button } from "@renderer/components/button";
import { BasicLink } from "@renderer/components/basic-link";
import { ChevronLeft } from "lucide-react";
import { ToolsForm } from "../components/tools/tools-form";
import { RouteWrapper } from "../components/layout";
import { MCPServerConfig } from "@renderer/hooks/useNewState";
import { useTransitionNavigate } from "@renderer/hooks/useNavigate";
import { useParams } from "react-router";

export function EditTool() {
  const { state, updateTool } = useAppState();
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useTransitionNavigate();

  if (!id) {
    navigate("/tools");
    return null;
  }

  const tool = state?.context.mcp_context.server_configs.find((tool) => tool.id === id);

  if (!tool) {
    navigate("/tools");
    return null;
  }

  const onSave = (data: MCPServerConfig) => {
    updateTool({ ...data, id: tool.id });

    navigate("/tools");
  };

  const onCancel = () => {
    navigate("/tools");
  };

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-0 select-none cursor-grab flex items-start gap-1" data-tauri-drag-region>
        <Button size="sm" asChild variant="ghost">
          <BasicLink to="/tools">
            <ChevronLeft />
          </BasicLink>
        </Button>

        <div>
          <HistoryHeading className="flex items-center gap-1">{t("EditTool")}</HistoryHeading>

          <CardDescription data-tauri-drag-region>{t("manageToolsDescription1")}</CardDescription>
        </div>
      </HistoryHeader>

      <RouteWrapper className="grow h-full">
        <ToolsForm onSave={onSave} onCancel={onCancel} defaultValues={tool} />
      </RouteWrapper>
    </HistoryMain>
  );
}
