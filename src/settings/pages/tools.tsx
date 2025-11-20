import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/button";
import { EmptyMessage } from "@renderer/components/items-list";
import { SearchInput } from "@renderer/components/input";
import { Switch } from "@renderer/components/switch";
import { CardDescription } from "@renderer/components/card";
import { SettingsCard, SettingsCardContent } from "../components/cards";
import { CircleCheck, Cloud, HardDrive, MoreVertical, Plus, TriangleAlert } from "lucide-react";
import { useAppState } from "@renderer/hooks/useAppState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@renderer/components/alert-dialog";
import { isLocalTool, MCPServerConfig } from "@renderer/hooks/useNewState";
import { HistoryHeading, HistoryHeader } from "../components/history/history-layout";
import { HistoryMain } from "../components/history/history-layout";
import { BasicLink } from "@renderer/components/basic-link";
import { RouteWrapper } from "../components/layout";
import { ModelsFilters, ModelsFiltersWrapper } from "../components/models/models-filters";
import { cn } from "@renderer/utils/cn";
import {
  ToolCard,
  ToolCardContent,
  ToolCardDescription,
  ToolCardDetail,
  ToolCardHeader,
  ToolCardDetails,
  ToolCardHeaderContent,
  ToolCardIcon,
  ToolCardTitle,
  ToolCardTransitionState,
} from "../components/tools/tools-list";
import { useTransitionNavigate } from "@renderer/hooks/useNavigate";

type TypeFilter = "all" | "local" | "external" | "enabled";

export function ToolsPage() {
  const { state, enableTool, disableTool, deleteTool } = useAppState();
  const { t } = useTranslation();
  const navigate = useTransitionNavigate();

  const toogleTool = (id: string, checked: boolean) => {
    if (checked) {
      enableTool(id);
    } else {
      disableTool(id);
    }
  };

  const removeBodyPointerEvents = () => {
    if (!!document) {
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 200);
    }
  };

  const handleDeleteTool = (id: string) => {
    deleteTool(id);

    removeBodyPointerEvents();
  };

  const onEditTool = (tool: MCPServerConfig) => {
    navigate(`/tools/edit/${tool.id}`);
  };

  const [filter, setFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState<string>("");

  const onFilterChange = (value: string) => {
    setFilter(value as TypeFilter);
  };

  const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const onClear = () => {
    setSearch("");
  };

  const filteredTools = useMemo(() => {
    return (state?.context.mcp_context.server_configs || [])
      .filter((tool) => {
        if (filter === "all") return true;
        if (filter === "local" && "Local" in tool.kind) return true;
        if (filter === "external" && "External" in tool.kind) return true;
        if (filter === "enabled" && tool.enabled) return true;
        return false;
      })
      .filter((tool) => {
        if (search === "") return true;
        return (
          tool.name.toLowerCase().includes(search.toLowerCase()) ||
          tool.key.toLowerCase().includes(search.toLowerCase())
        );
      });
  }, [state?.context.mcp_context.server_configs, filter, search]);

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-0 select-none cursor-grab" data-tauri-drag-region>
        <div className="flex items-center justify-between">
          <div>
            <HistoryHeading>{t("Tools")}</HistoryHeading>
            <CardDescription className="mt-1 max-w-lg" data-tauri-drag-region>
              {t("manageToolsDescription1")}
            </CardDescription>
            <CardDescription className="max-w-lg" data-tauri-drag-region>
              {t("manageToolsDescription2")}
            </CardDescription>
          </div>

          <Button size="sm" asChild>
            <BasicLink to="/tools/add">
              <Plus /> {t("AddNewTool")}
            </BasicLink>
          </Button>
        </div>
      </HistoryHeader>

      <RouteWrapper>
        <SettingsCard>
          <SettingsCardContent className="p-3">
            <CardDescription>{t("ToolsTip")}</CardDescription>
          </SettingsCardContent>
        </SettingsCard>

        <ModelsFiltersWrapper>
          <ModelsFilters>
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => onFilterChange("all")}>
              {t("All")}
            </Button>
            <Button
              variant={filter === "local" ? "default" : "outline"}
              size="sm"
              className="[&_svg]:size-3.5"
              onClick={() => onFilterChange("local")}
            >
              <HardDrive />
              {t("Local")}
            </Button>
            <Button
              variant={filter === "external" ? "default" : "outline"}
              size="sm"
              className="[&_svg]:size-3.5"
              onClick={() => onFilterChange("external")}
            >
              <Cloud />
              {t("External")}
            </Button>
            <Button
              variant={filter === "enabled" ? "default" : "outline"}
              size="sm"
              className="[&_svg]:size-3.5"
              onClick={() => onFilterChange("enabled")}
            >
              <CircleCheck />
              {t("Enabled")}
            </Button>
          </ModelsFilters>

          <SearchInput
            size="sm"
            wrapperClassName="max-w-[200px]"
            placeholder={t("Search...")}
            value={search}
            onChange={onSearchChange}
            onClear={onClear}
          />
        </ModelsFiltersWrapper>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[385px] pr-1 scrollbar-custom">
          {filteredTools.length > 0 ? (
            filteredTools.map((tool) => {
              const isTransitioning = tool.state === "Starting" || tool.state === "Stopping";
              return (
                <ToolCard key={tool.id} isActive={tool.enabled}>
                  <ToolCardHeader>
                    <ToolCardIcon isLocal={isLocalTool(tool.kind)}>
                      {isLocalTool(tool.kind) ? <HardDrive /> : <Cloud />}
                    </ToolCardIcon>

                    <ToolCardHeaderContent>
                      <div className="flex items-center gap-2">
                        <ToolCardTitle>{tool.name}</ToolCardTitle>
                        <ToolCardTransitionState state={tool.state} title={tool.state}>
                          {tool.state === "Error" ? (
                            <TriangleAlert />
                          ) : (
                            <>
                              <div className="relative bg-blue-500 rounded-full w-1.5 h-1.5">
                                <div className="absolute top-0 left-0 w-full h-full rounded-full bg-blue-500 animate-ping" />
                              </div>
                              {t(tool.state)}...
                            </>
                          )}
                        </ToolCardTransitionState>
                      </div>

                      <ToolCardDescription className={cn({ italic: !tool.description })}>
                        {tool.description || t("ToolNoDescriptionAvailable")}
                      </ToolCardDescription>
                      <ToolCardDetails>
                        <ToolCardDetail title={tool.key}>{t("ToolKeyDetail", { key: tool.key })}</ToolCardDetail>
                        {isLocalTool(tool.kind) ? (
                          <ToolCardDetail title={tool.kind.Local.command}>
                            {t("ToolCommandDetail", { command: tool.kind.Local.command })}
                          </ToolCardDetail>
                        ) : (
                          <ToolCardDetail title={tool.kind.External.url}>
                            {t("ToolUrlDetail", { url: tool.kind.External.url })}
                          </ToolCardDetail>
                        )}
                      </ToolCardDetails>
                    </ToolCardHeaderContent>
                  </ToolCardHeader>

                  <ToolCardContent>
                    <Switch
                      checked={tool.enabled}
                      onCheckedChange={(checked) => toogleTool(tool.id, checked)}
                      disabled={isTransitioning}
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isTransitioning}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditTool(tool)} disabled={isTransitioning}>
                          {t("Edit")}
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isTransitioning}>
                              {t("Delete")}
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("AreYouAbsolutelySure")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("DeleteToolWarning")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => removeBodyPointerEvents()}>
                                {t("Cancel")}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTool(tool.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("Delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ToolCardContent>
                </ToolCard>
              );
            })
          ) : (
            <EmptyMessage className="text-center block">{t("NoToolsConfigured")}</EmptyMessage>
          )}
        </div>
      </RouteWrapper>
    </HistoryMain>
  );
}
