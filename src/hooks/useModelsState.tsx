import { invoke } from "@tauri-apps/api/core";
import { useStateContext } from "./useNewState";

export interface DownloadStateIdle {
  status: "idle";
}

export interface DownloadStateDownloading {
  status: "downloading";
  progress: number;
}

export interface DownloadStateDownloaded {
  status: "downloaded";
}

export interface DownloadStateError {
  status: "error";
  error: string;
}

export type DownloadState = DownloadStateIdle | DownloadStateDownloading | DownloadStateDownloaded | DownloadStateError;
export type DownloadStateStatus = DownloadState["status"];

export interface ModelsContext {
  transcription_models: TranscriptionModel[];
  conversation_models: ConversationModel[];
}

export interface TranscriptionModel {
  name: string;
  model: string;
  provider: "openai" | "mistral" | "whisper_local";
  size: number;
  parameters: number;
  vram: number;
  download_state: DownloadState;
  is_local: boolean;
  speed: number;
  intelligence: number;
}

export interface ConversationModel {
  name: string;
  model: string;
  config: {
    openai: {
      url: string;
      model: string;
      api_key?: string;
      supports_vision: boolean;
      supports_tools: boolean;
    };
  };
  repository: string;
  vision: VisionModel | null;
  supports_tools: boolean;
  supports_vision: boolean;
  size: number;
  parameters: number;
  vram: number;
  download_state: DownloadState;
  is_local: boolean;
  speed: number;
  intelligence: number;
}

export function isConversationModel(model: TranscriptionModel | ConversationModel): model is ConversationModel {
  return "vision" in model;
}

export interface VisionModel {
  name: string;
  repository: string;
  is_local: boolean;
}

export interface ModelsStateMachine {
  state: ModelsState;
  context: ModelsContext;
}

export type ModelsState = null;

export function useModelsState(): {
  state: ModelsContext;
  downloadTranscriptionModel: (modelId: string) => Promise<void>;
  deleteTranscriptionModel: (modelId: string) => Promise<void>;
  downloadConversationModel: (modelId: string) => Promise<void>;
  deleteConversationModel: (modelId: string) => Promise<void>;
  addConversationModel: (model: { model: string; url: string; api_key?: string }) => Promise<void>;
  updateConversationModel: (model: {
    original_model: string;
    model: string;
    url: string;
    api_key?: string;
    supports_tools: boolean;
    supports_vision: boolean;
  }) => Promise<void>;
  deleteCustomConversationModel: (modelId: string) => Promise<void>;
  refetchConversationModels: () => Promise<void>;
} {
  const { state } = useStateContext();

  const downloadTranscriptionModel = (modelId: string) => {
    return invokeEvent<void>("ActionDownloadTranscriptionModel", modelId);
  };

  const deleteTranscriptionModel = (modelId: string) => {
    return invokeEvent<void>("ActionDeleteTranscriptionModel", modelId);
  };

  const downloadConversationModel = (modelId: string) => {
    return invokeEvent<void>("ActionDownloadConversationModel", modelId);
  };

  const deleteConversationModel = (modelId: string) => {
    return invokeEvent<void>("ActionDeleteConversationModel", modelId);
  };

  const addConversationModel = (model: { model: string; url: string; api_key?: string }) => {
    return invokeEvent<void>("ActionAddConversationModel", model);
  };

  const updateConversationModel = (model: {
    original_model: string;
    model: string;
    url: string;
    api_key?: string;
    supports_tools: boolean;
    supports_vision: boolean;
  }) => {
    return invokeEvent<void>("ActionUpdateConversationModel", model);
  };

  const deleteCustomConversationModel = (modelId: string) => {
    return invokeEvent<void>("ActionDeleteCustomConversationModel", modelId);
  };

  const refetchConversationModels = () => {
    return invokeEvent<void>("ActionRefetchConversationModels");
  };

  return {
    state: state?.models_context ?? {
      transcription_models: [],
      conversation_models: [],
    },
    downloadTranscriptionModel,
    deleteTranscriptionModel,
    downloadConversationModel,
    deleteConversationModel,
    addConversationModel,
    updateConversationModel,
    deleteCustomConversationModel,
    refetchConversationModels,
  };
}

function invokeEvent<T = unknown>(name: string, payload: any | null = null): Promise<T> {
  return invoke("event", {
    event: {
      name,
      payload,
    },
  });
}
