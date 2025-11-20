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
import { errorToast } from "@renderer/components/toasts";

export function AddNewTool() {
  const { state, addTool } = useAppState();
  const { t } = useTranslation();
  const navigate = useTransitionNavigate();

  const onSave = (data: MCPServerConfig) => {
    if (state?.context.mcp_context.server_configs.find((tool) => tool.key === data.key || tool.id === data.id)) {
      errorToast(t("ToolAlreadyExists"));
      return;
    }

    addTool(data);

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
          <HistoryHeading className="flex items-center gap-1">{t("AddNewTool")}</HistoryHeading>

          <CardDescription data-tauri-drag-region>{t("manageToolsDescription1")}</CardDescription>
        </div>
      </HistoryHeader>

      <RouteWrapper className="grow h-full">
        <ToolsForm onSave={onSave} onCancel={onCancel} />
      </RouteWrapper>
    </HistoryMain>
  );
}
