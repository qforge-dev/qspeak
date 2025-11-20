import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppState } from "@renderer/hooks/useAppState";
import { useInternetConnection } from "@renderer/hooks/useInternetConnection";
import {
  ConversationModel,
  isConversationModel,
  TranscriptionModel,
  useModelsState,
} from "@renderer/hooks/useModelsState";
import {
  ModelsCard,
  ModelsCardContent,
  ModelsCardHeader,
  ModelsCardIcon,
  ModelsCardHeaderContent,
  ModelsCardDetailsWrapper,
  SettingsCard,
  SettingsCardContent,
  ModelsCardDetails,
} from "../components/cards";

import { Button } from "@renderer/components/button";
import { CardDescription } from "@renderer/components/card";
import {
  formatMemory,
  formatParameters,
  ModelDownloadButton,
  ModelRadioItemDescription,
  ModelRadioItemHeading,
  ScaleIndicator,
} from "@renderer/components/models-cards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@renderer/components/tabs";
import { Brain, CircleCheck, Cloud, Eye, HardDrive, Hash, MemoryStick, Zap, Plus, MoreVertical } from "lucide-react";
import { RouteWrapper } from "../components/layout";
import { HistoryHeader, HistoryHeading, HistoryMain } from "../components/history/history-layout";
import { SearchInput } from "@renderer/components/input";
import { EmptyMessage } from "@renderer/components/items-list";
import { ModelsFilters, ModelsFiltersWrapper } from "../components/models/models-filters";
import { Badge } from "@renderer/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@renderer/components/dropdown-menu";
import { BasicLink } from "@renderer/components/basic-link";
import { useTransitionNavigate } from "@renderer/hooks/useNavigate";
import { MODEL_TEMPLATES } from "@renderer/shared/model-templates";
import { QSPEAK_API_V1_URL } from "@renderer/shared/constants";

type TypeFilter = "all" | "local" | "cloud" | "downloaded";

export function Models() {
  const { t } = useTranslation();
  const { state, updateTranscriptionModel, updateConversationModel } = useAppState();
  const { state: modelsState, refetchConversationModels } = useModelsState();
  const [currentTab, setCurrentTab] = useState<string>("transcription");

  const onTabChange = (value: string) => {
    setCurrentTab(value);
  };

  useEffect(() => {
    if (!state || !modelsState) return;
    const modelsCount = modelsState?.transcription_models.length || 0;
    const activeModel = modelsState?.transcription_models.find(
      (model) => model.model === state?.context.transcription_model,
    );

    if (modelsCount === 0) {
      updateTranscriptionModel(null);
    }

    if (activeModel?.download_state.status !== "downloaded") {
      updateTranscriptionModel(
        modelsState?.transcription_models.find((model) => model.download_state.status === "downloaded")?.model || null,
      );
    }
  }, [modelsState]);

  useEffect(() => {
    if (!state || !modelsState) return;
    const modelsCount = modelsState.conversation_models.length || 0;
    const activeModel = modelsState.conversation_models.find(
      (model) => model.model === state.context.conversation_model,
    );

    if (modelsCount === 0) {
      updateConversationModel(null);
    }

    if (activeModel?.download_state.status !== "downloaded") {
      updateConversationModel(
        modelsState.conversation_models.find((model) => model.download_state.status === "downloaded")?.model || null,
      );
    }
  }, [modelsState]);

  // Refetch conversation models when the component mounts
  useEffect(() => {
    refetchConversationModels().catch((error) => {
      console.error("Failed to refetch conversation models:", error);
    });
  }, []); // Empty dependency array means this only runs on mount

  return (
    <Tabs defaultValue="transcription" onValueChange={onTabChange}>
      <HistoryMain>
        <HistoryHeader className="pt-6 pb-0 select-none cursor-grab" data-tauri-drag-region>
          <div className="flex items-center justify-between">
            <div>
              <HistoryHeading>{t("Models")}</HistoryHeading>
              <CardDescription className="mt-1 max-w-lg" data-tauri-drag-region>
                {t("manageModelsDescription1")}
              </CardDescription>
              <CardDescription className="max-w-lg" data-tauri-drag-region>
                {t("manageModelsDescription2")}
              </CardDescription>
            </div>

            {currentTab === "conversation" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus /> {t("AddNewModel")}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-[200px]" align="end">
                  <DropdownMenuItem asChild>
                    <BasicLink to="/models/add">{t("FromScratch")}</BasicLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("Templates")}</DropdownMenuLabel>
                  {MODEL_TEMPLATES.map((template) => (
                    <DropdownMenuItem key={template.label} asChild>
                      <BasicLink to="/models/add" state={{ template: { url: template.url } }}>
                        {template.label}
                      </BasicLink>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem asChild>
                    <BasicLink to="/models/add">Custom</BasicLink>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <TabsList className="w-fit mt-6">
            <TabsTrigger value="transcription">Transcription</TabsTrigger>
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
          </TabsList>
        </HistoryHeader>

        <TabsContent value="transcription" className="mt-0">
          <TranscriptionModelsTab />
        </TabsContent>
        <TabsContent value="conversation" className="mt-0">
          <ConversationModelsTab />
        </TabsContent>
      </HistoryMain>
    </Tabs>
  );
}

function TranscriptionModelsTab() {
  const { t } = useTranslation();
  const { state, updateTranscriptionModel } = useAppState();
  const { state: modelsState, deleteTranscriptionModel, downloadTranscriptionModel } = useModelsState();
  const [online] = useInternetConnection();
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

  const filteredModels = useMemo(() => {
    return modelsState?.transcription_models
      .filter((model) => {
        // Hide cloud models when offline
        if (!online && !model.is_local) return false;

        if (filter === "all") return true;
        if (filter === "local" && model.is_local) return true;
        if (filter === "cloud" && !model.is_local) return true;
        if (filter === "downloaded" && model.download_state.status === "downloaded" && model.is_local) return true;
        return false;
      })
      .filter((model) => {
        if (search === "") return true;
        return (
          model.name.toLowerCase().includes(search.toLowerCase()) ||
          model.model.toLowerCase().includes(search.toLowerCase())
        );
      });
  }, [filter, modelsState, search, online]);

  return (
    <RouteWrapper className="grow">
      <SettingsCard>
        <SettingsCardContent className="p-3">
          <CardDescription>{t("TranscriptionModelsTip")}</CardDescription>
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
            variant={filter === "cloud" ? "default" : "outline"}
            size="sm"
            className="[&_svg]:size-3.5"
            onClick={() => onFilterChange("cloud")}
          >
            <Cloud />
            {t("Cloud")}
          </Button>
          <Button
            variant={filter === "downloaded" ? "default" : "outline"}
            size="sm"
            className="[&_svg]:size-3.5"
            onClick={() => onFilterChange("downloaded")}
          >
            <CircleCheck />
            {t("Downloaded")}
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

      <div className="flex flex-col gap-2 overflow-y-auto max-h-[325px] pr-1 scrollbar-custom">
        {filteredModels.length > 0 ? (
          filteredModels.map((model) => (
            <ModelItem
              key={model.model}
              model={model}
              onClick={updateTranscriptionModel}
              onDelete={deleteTranscriptionModel}
              onDownload={downloadTranscriptionModel}
              onEdit={undefined}
              active={model.model === state?.context.transcription_model}
            />
          ))
        ) : (
          <EmptyMessage className="text-center">{t("TranscriptionModelsNotFound")}</EmptyMessage>
        )}
      </div>
    </RouteWrapper>
  );
}

function ConversationModelsTab() {
  const { t } = useTranslation();
  const { state, updateConversationModel } = useAppState();
  const {
    state: modelsState,
    deleteConversationModel,
    downloadConversationModel,
    deleteCustomConversationModel,
  } = useModelsState();
  const navigate = useTransitionNavigate();
  const [online] = useInternetConnection();
  const [filter, setFilter] = useState<TypeFilter | "vision">("all");
  const [search, setSearch] = useState<string>("");

  const onFilterChange = (value: string) => {
    setFilter(value as TypeFilter | "vision");
  };

  const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const onClear = () => {
    setSearch("");
  };

  const onEditModel = (modelId: string) => {
    navigate(`/models/edit/${modelId}`);
  };

  const filteredModels = useMemo(() => {
    return modelsState?.conversation_models
      .filter((model) => {
        // Hide API cloud models when offline (but keep custom models - user might have local endpoints)
        if (!online && !model.is_local) {
          const isCustomModel = model.config.openai.url !== QSPEAK_API_V1_URL;
          if (!isCustomModel) return false; // Hide API models when offline
        }

        if (filter === "all") return true;
        if (filter === "local" && model.is_local) return true;
        if (filter === "cloud" && !model.is_local) return true;
        if (filter === "downloaded" && model.download_state.status === "downloaded" && model.is_local) return true;
        if (filter === "vision" && model.vision) return true;
        return false;
      })
      .filter((model) => {
        if (search === "") return true;
        return (
          model.name.toLowerCase().includes(search.toLowerCase()) ||
          model.model.toLowerCase().includes(search.toLowerCase())
        );
      });
  }, [filter, modelsState, search, online]);

  return (
    <RouteWrapper className="grow">
      <SettingsCard>
        <SettingsCardContent className="p-3">
          <CardDescription>{t("ConversationModelsTip")}</CardDescription>
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
            variant={filter === "cloud" ? "default" : "outline"}
            size="sm"
            className="[&_svg]:size-3.5"
            onClick={() => onFilterChange("cloud")}
          >
            <Cloud />
            {t("Cloud")}
          </Button>
          <Button
            variant={filter === "downloaded" ? "default" : "outline"}
            size="sm"
            className="[&_svg]:size-3.5"
            onClick={() => onFilterChange("downloaded")}
          >
            <CircleCheck />
            {t("Downloaded")}
          </Button>
          <Button
            variant={filter === "vision" ? "default" : "outline"}
            size="sm"
            className="[&_svg]:size-3.5"
            onClick={() => onFilterChange("vision")}
          >
            <Eye />
            {t("Vision")}
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

      <div className="flex flex-col gap-2 overflow-y-auto max-h-[325px] pr-1 scrollbar-custom">
        {filteredModels.length > 0 ? (
          filteredModels.map((model) => (
            <ModelItem
              key={model.model}
              model={model}
              onClick={updateConversationModel}
              onDelete={deleteConversationModel}
              onDownload={downloadConversationModel}
              onDeleteCustom={deleteCustomConversationModel}
              onEdit={onEditModel}
              active={model.model === state?.context.conversation_model}
            />
          ))
        ) : (
          <EmptyMessage className="text-center">{t("ConversationModelsNotFound")}</EmptyMessage>
        )}
      </div>
    </RouteWrapper>
  );
}

function ModelItem({
  model,
  onClick,
  onDelete,
  onDownload,
  onDeleteCustom,
  onEdit,
  active,
}: {
  model: TranscriptionModel | ConversationModel;
  onClick: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
  onDeleteCustom?: (id: string) => void;
  onEdit?: (id: string) => void;
  active: boolean;
}) {
  const { t } = useTranslation();
  const isDownloaded = model.download_state.status === "downloaded";
  const isIdle = model.download_state.status === "idle";
  const isLocal = model.is_local;

  const onModelClick = () => {
    if (!isDownloaded) return;

    onClick(model.model);
  };

  const onDeleteClick = () => {
    if (!isDownloaded) return;

    onDelete(model.model);
  };

  // Check if this is a predefined model that should not be deletable
  const isPredefinedTranscriptionModel =
    !isConversationModel(model) &&
    ["use_openai", "use_mistral", "ggml-tiny.bin", "ggml-base.bin", "ggml-small.bin"].includes(model.model);

  const onDownloadClick = () => {
    if (!isIdle) return;

    onDownload(model.model);
  };

  const onDeleteCustomClick = () => {
    if (onDeleteCustom) {
      onDeleteCustom(model.model);
    }
  };

  // Check if this is a custom conversation model (user-added with custom URL)
  // Custom models use a different URL than the qSpeak API
  const isCustomConversationModel = isConversationModel(model) && model.config.openai.url !== QSPEAK_API_V1_URL;

  return (
    <ModelsCard onClick={onModelClick} isActive={active} isDownloaded={isDownloaded}>
      <ModelsCardHeader>
        <ModelsCardIcon isLocal={model.is_local}>{model.is_local ? <HardDrive /> : <Cloud />}</ModelsCardIcon>

        <ModelsCardHeaderContent>
          <div className="flex items-center gap-2">
            <ModelRadioItemHeading>{model.name}</ModelRadioItemHeading>
            {isConversationModel(model) && model.supports_vision ? (
              <Badge
                size="sm"
                className="bg-primary/10 text-primary [&_svg]:size-3 flex items-center gap-1 hover:bg-primary/20"
              >
                <Eye />
                Vision
              </Badge>
            ) : null}
          </div>

          <ModelRadioItemDescription>{model.model}</ModelRadioItemDescription>
        </ModelsCardHeaderContent>
      </ModelsCardHeader>

      <ModelsCardContent>
        <ModelsCardDetailsWrapper>
          {isLocal ? (
            <ModelsCardDetails>
              <HardDrive />
              <span>{formatMemory(model.size)}</span>
            </ModelsCardDetails>
          ) : null}

          {isLocal ? (
            <ModelsCardDetails>
              <MemoryStick />
              <span>{formatMemory(model.vram)}</span>
            </ModelsCardDetails>
          ) : null}

          {isLocal ? (
            <ModelsCardDetails>
              <Hash />
              <span>{formatParameters(model.parameters)}</span>
            </ModelsCardDetails>
          ) : null}
        </ModelsCardDetailsWrapper>

        {!isCustomConversationModel && (
          <ModelsCardDetailsWrapper>
            <ModelsCardDetails>
              <Zap />
              <span>{t("Speed")}</span>
              <ScaleIndicator value={Number((model as TranscriptionModel).speed)} />
            </ModelsCardDetails>
            <ModelsCardDetails>
              <Brain />
              <span>{t("Intelligence")}</span>
              <ScaleIndicator value={Number((model as TranscriptionModel).intelligence)} />
            </ModelsCardDetails>
          </ModelsCardDetailsWrapper>
        )}

        {/* TODO: remove when ready */}
        {isConversationModel(model) ? (
          isCustomConversationModel ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit && onEdit(model.model)}>{t("Edit")}</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDeleteCustomClick()}
                  className="text-destructive hover:text-destructive"
                >
                  {t("Delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="w-5.5" />
          )
        ) : model.is_local && isPredefinedTranscriptionModel ? (
          <ModelDownloadButton
            status={model.download_state.status}
            progress={model.download_state.status === "downloading" ? model.download_state.progress : undefined}
            onDownload={onDownloadClick}
            onRemove={onDeleteClick}
            model={model.model}
          />
        ) : (
          <div className="w-5.5" />
        )}
      </ModelsCardContent>
    </ModelsCard>
  );
}
