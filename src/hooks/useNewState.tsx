import { Shortcuts } from "@renderer/shared/communicator/state-machine.types";
import { Channel, invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Persona, PersonasContext } from "./usePersonas";
import { ModelsContext } from "./useModelsState";
import { ConversationContext, HistoryConversation } from "./useConversationState";
import { Operation } from "fast-json-patch";
import { JsonPatch } from "@renderer/shared/json-patch";

export interface AppStateContext {
  shortcuts: Shortcuts;
  default_shortcuts: Shortcuts;
  language: string;
  interface_language: string;
  preferred_languages: string[];
  input_device: string | null;
  transcription_model: string | null;
  conversation_model: string | null;
  active_persona: Persona | null;
  recording_window_context: RecordingWindowContext;
  models_context: ModelsContext;
  settings_window_context: SettingsWindowContext;
  personas_context: PersonasContext;
  default_personas_context: PersonasContext;
  conversation_context: ConversationContext;
  history_context: HistoryContext;
  account_context: AccountContext;
  errors: AppError[];
  update_context: UpdateContext;
  permissions_context: PermissionsContext;
  challenge_context: ChallengeContext;
  mcp_context: MCPContext;
  websocket_server_context: WebsocketServerContext;
  releases_context: ReleasesContext;
}

export interface Release {
  id: string;
  version: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReleasesContext {
  releases: Release[];
}

type LocalTool = { Local: { command: string; env_vars: Record<string, string> } };
type ExternalTool = { External: { url: string } };

export type MCPServerKind = LocalTool | ExternalTool;

export function isLocalTool(tool?: MCPServerKind): tool is LocalTool {
  if (!tool) return false;
  return "Local" in tool && tool.Local !== null;
}

export function isExternalTool(tool?: MCPServerKind): tool is ExternalTool {
  if (!tool) return false;
  return "External" in tool && tool.External !== null;
}

export type MCPServerState = "Disabled" | "Starting" | "Enabled" | "Stopping" | "Error";

export interface MCPServerConfig {
  id: string;
  name: string;
  key: string;
  description: string;
  kind: MCPServerKind;
  enabled: boolean;
  state: MCPServerState;
}

export interface MCPContext {
  server_configs: MCPServerConfig[];
}

export interface ChallengeContext {
  challenges: Challenge[];
}

export type ChallengeStatus = "Available" | "InProgress" | "Completed";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  status: ChallengeStatus;
  requirements: ChallengeRequirement[];
  completed_at: string;
}

export interface ChallengeRequirement {
  event: string;
  condition: ChallengeCondition;
  current_progress: number;
  completed_at: string;
}

export type ChallengeCondition =
  | "Occurred"
  | {
      type: "ProgressGoal";
      target: number;
    };

export function isProgressGoalCondition(condition: ChallengeCondition): condition is {
  type: "ProgressGoal";
  target: number;
} {
  return (
    typeof condition === "object" && condition !== null && "type" in condition && condition.type === "ProgressGoal"
  );
}

export interface PermissionsContext {
  accessibility: boolean;
  microphone: boolean;
}

export type UpdateState =
  | "Idle"
  | "CheckingForUpdates"
  | "UpdateAvailable"
  | "NoUpdateAvailable"
  | {
      DownloadingUpdate: number;
    }
  | "UpdateDownloaded"
  | {
      Error: string;
    };

export interface UpdateContext {
  state: UpdateState;
}

export interface AppError {
  id: string;
  message: string;
  timestamp: string;
}

export interface HistoryContext {
  history: HistoryConversation[];
}

export interface AccountContext {
  account: Account;
  login: LoginState;
}

export interface Account {
  email: string;
  token: string;
}

export type LoginStep = "Login" | "LoginVerify";
export type LoginStateType = "Idle" | "Pending" | "Error" | "Success";
export interface LoginState {
  step: LoginStep;
  state: LoginStateType;
}

export type InterfaceTheme = "Light" | "Dark";

export interface RecordingWindowContext {
  state: RecordingWindowState;
  minimized: boolean;
  theme: InterfaceTheme;
}

export type SettingsWindowState = "Closed" | "Open";

export interface SettingsWindowContext {
  state: SettingsWindowState;
  open_settings_on_start: boolean;
}

export interface WebsocketServerContext {
  enabled: boolean;
  port: number;
  password: string | null;
}

export type RecordingWindowState =
  | {
      Open: RecordingWindowView;
    }
  | "Closed";

export type RecordingWindowView = "Recording" | "Persona";

type AppStateChannelMessage =
  | {
      FullState: AppStateContext;
    }
  | {
      Patch: Operation[];
    };

function useNewState() {
  const [state, setState] = useState<AppStateContext | null>(null);
  const stateChannelRef = useRef<Channel<AppStateChannelMessage> | null>(null);

  useEffect(() => {
    stateChannelRef.current = new Channel<AppStateChannelMessage>();

    invoke("subscribe_to_new_app_state", {
      channel: stateChannelRef.current,
    }).then(() => {
      if (!stateChannelRef.current) return;

      stateChannelRef.current.onmessage = (event) => {
        if ("Patch" in event) {
          setState((prev) => {
            if (!prev) return null;
            return JsonPatch.apply(prev, event.Patch);
          });
        } else {
          setState(event.FullState);
        }
      };
    });

    return () => {
      if (stateChannelRef.current) {
        // stateChannelRef.current.close();
      }
    };
  }, []);

  return {
    state,
  };
}

const StateContext = createContext<{ state: AppStateContext | null } | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
  const state = useNewState();
  return <StateContext.Provider value={state}>{children}</StateContext.Provider>;
}

export function useStateContext() {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error("useStateContext must be used within a StateProvider");
  }
  return context;
}
