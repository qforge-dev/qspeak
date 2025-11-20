import { Shortcuts } from "@renderer/shared/communicator/state-machine.types";
import { invoke } from "@tauri-apps/api/core";
import { useStateContext, InterfaceTheme, MCPServerConfig } from "./useNewState";
import { useCallback, useMemo } from "react";

export function useAppState() {
  const { state } = useStateContext();

  const updateLanguage = (language: string) => {
    return invokeEvent("ActionChangeTranscriptionLanguage", language);
  };

  const updatePreferredLanguages = (preferredLanguages: string[]) => {
    return invokeEvent("ActionUpdatePreferredLanguages", preferredLanguages);
  };

  const switchToNextPreferredLanguage = () => {
    return invokeEvent("ActionSwitchToNextPreferredLanguage");
  };

  const updateInputDevice = (input_device: string) => {
    return invokeEvent("ActionChangeInputDevice", input_device);
  };

  const updateShortcuts = (shortcuts: Shortcuts) => {
    return invokeEvent("ShortcutUpdate", shortcuts);
  };

  const toggleRecording = () => {
    return invokeEvent("ActionRecording");
  };

  const togglePersonas = () => {
    return invokeEvent("ActionPersonaCycleNext");
  };

  const takeScreenshot = () => {
    return invokeEvent("ActionScreenshot");
  };

  const copyText = () => {
    return invokeEvent("ActionCopyText");
  };

  const closeRecordingWindow = () => {
    return invokeEvent("ActionCloseRecordingWindow");
  };

  const toggleMinimized = () => {
    return invokeEvent("ActionToggleRecordingWindowMinimized");
  };

  const updateTranscriptionModel = (transcription_model: string | null) => {
    return invokeEvent("ActionChangeTranscriptionModel", transcription_model);
  };

  const updateConversationModel = (conversation_model: string | null) => {
    return invokeEvent("ActionChangeConversationModel", conversation_model);
  };

  const updateTheme = (theme: InterfaceTheme) => {
    return invokeEvent("ActionChangeTheme", theme);
  };

  const updateOpenSettingsOnStart = (openSettingsOnStart: boolean) => {
    return invokeEvent("ActionChangeOpenSettingsOnStart", openSettingsOnStart);
  };

  const updateWebsocketServerSettings = (settings: { enabled: boolean; port: number; password: string }) => {
    const password = settings.password ?? "";
    return invokeEvent("ActionUpdateWebsocketServerSettings", {
      enabled: settings.enabled,
      port: settings.port,
      password: password.trim().length > 0 ? password : null,
    });
  };

  const closeSettingsWindow = () => {
    return invokeEvent("CloseSettings");
  };

  const minimizeSettingsWindow = () => {
    return invokeEvent("MinimizeSettings");
  };

  const clearHistory = () => {
    return invokeEvent("ActionClearHistory");
  };

  const deleteHistory = (id: string) => {
    return invokeEvent("ActionDeleteHistory", id);
  };

  const addTool = (tool: MCPServerConfig) => {
    return invokeEvent("ActionAddTool", tool);
  };

  const updateTool = (tool: MCPServerConfig) => {
    return invokeEvent("ActionUpdateTool", tool);
  };

  const deleteTool = (id: string) => {
    return invokeEvent("ActionDeleteTool", id);
  };

  const enableTool = (id: string) => {
    return invokeEvent("ActionEnableTool", id);
  };

  const disableTool = (id: string) => {
    return invokeEvent("ActionDisableTool", id);
  };

  const checkOnline = () => {
    return invoke("check_online");
  };

  const closeOnboardingWindow = () => {
    return invokeEvent("CloseOnboarding");
  };

  const getReleases = async () => {
    return invokeEvent("ActionGetReleases");
  };

  const sendTextMessage = (text: string) => {
    return invokeEvent("ActionTextMessage", text);
  };

  const loadHistoryConversation = (conversation_id: string) => {
    return invokeEvent("ActionLoadHistoryConversation", conversation_id);
  };

  const startNewConversation = () => {
    return invokeEvent("ActionStartNewConversation");
  };

  const addFile = (file: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const fileBuffer = event.target?.result as ArrayBuffer;

        const binaryArray = encodeFileWithMetadata(file, fileBuffer);

        invokeEvent("ActionAddFile", binaryArray).then(resolve).catch(reject);
      };

      reader.onerror = (error) => {
        reject(error);
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const hasConversationStarted = useMemo(() => {
    if (!state) return false;

    return state.conversation_context.conversation.length > 0;
  }, [state]);

  const getHistoryForPersona = useCallback(
    (personaName: string) => {
      if (!state) return [];

      const reversed = [...(state?.history_context?.history ?? [])].reverse();

      return reversed
        .filter((conversation) => conversation.persona_name === personaName)
        .filter((conversation) =>
          conversation.conversation.some(
            (message) => message.role === "user" && "content" in message && message.content.length > 0,
          ),
        );
    },
    [state],
  );

  return {
    state: state
      ? {
          context: state,
        }
      : null,
    hasConversationStarted,
    updateLanguage,
    updatePreferredLanguages,
    switchToNextPreferredLanguage,
    updateInputDevice,
    toggleRecording,
    togglePersonas,
    closeRecordingWindow,
    updateTranscriptionModel,
    updateShortcuts,
    takeScreenshot,
    copyText,
    updateConversationModel,
    toggleMinimized,
    updateTheme,
    updateOpenSettingsOnStart,
    updateWebsocketServerSettings,
    closeSettingsWindow,
    minimizeSettingsWindow,
    clearHistory,
    deleteHistory,
    addTool,
    updateTool,
    deleteTool,
    enableTool,
    disableTool,
    checkOnline,
    closeOnboardingWindow,
    getReleases,
    sendTextMessage,
    loadHistoryConversation,
    addFile,
    startNewConversation,
    getHistoryForPersona,
  };
}

export function invokeEvent(name: string, payload: any | null = null) {
  return invoke("event", {
    event: {
      name,
      payload,
    },
  });
}

function encodeFileWithMetadata(file: File, fileBuffer: ArrayBuffer) {
  const metadata = {
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
  };

  const metadataJSON = JSON.stringify(metadata);
  const metadataBytes = new TextEncoder().encode(metadataJSON);

  const metadataSize = metadataBytes.length;
  const chunk = new Uint8Array(fileBuffer);
  const totalSize = 4 + metadataSize + chunk.length;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  view.setUint32(0, metadataSize, false);

  new Uint8Array(buffer, 4, metadataSize).set(metadataBytes);

  new Uint8Array(buffer, 4 + metadataSize).set(chunk);

  return Array.from(new Uint8Array(buffer));
}
