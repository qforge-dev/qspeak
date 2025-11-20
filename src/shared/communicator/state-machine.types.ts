import { Conversation } from "@shared/conversation";
import { Persona } from "@shared/types";

// Define event types that can trigger state transitions
export type AppEvent =
  | { type: "ActionPersona" }
  | { type: "ActionRecording" }
  | { type: "ActionCloseRecordingWindow" }
  | { type: "ActionChangePersona"; personaId: string | null }
  | { type: "ActionAddPersona"; persona: Persona }
  | { type: "ActionUpdatePersona"; persona: Persona }
  | { type: "ActionDeletePersona"; id: string }
  | { type: "ActionGetState" }
  | { type: "TranscriptionComplete" }
  | { type: "ActionStop" }
  | { type: "AIResponseComplete" }
  | { type: "ActionOpenSettings" }
  | { type: "ActionCloseSettings" }
  | { type: "ActionShortcutUpdate"; shortcuts: Shortcuts }
  | { type: "Ready" }
  | { type: "ActionAudioReady"; audio: Float32Array }
  | { type: "ActionChangeTranscriptionModel"; model: string }
  | { type: "ActionChangeProviders"; providers: AppContext["providers"] }
  | { type: "ActionTranscribeRecording"; audio: Float32Array }
  | { type: "ActionTranscribeRecordingDone"; output: string }
  | {
      type: "ActionTranscriptionModelProgress";
      progress: { status: string; name: string };
    }
  | { type: "ActionTranscriptionModelReady" }
  | { type: "ActionRestoreState"; key: keyof AppContext; value: any }
  | { type: "ActionChangeTranscriptionLanguage"; language: string }
  | { type: "None" };

export interface Shortcuts {
  recording: string[];
  close: string[];
  personas: string[];
  screenshot: string[];
  copy_text: string[];
  toggle_minimized: string[];
  switch_language: string[];
}

export type PersonaScreenState = "idle" | "recording";

export type RecordingScreenState = "idle" | "recording" | "transcribing" | "responding";

export type MainWindowOffState = "idle" | "transcribing" | "responding";

export type MainWindowOnPersonaScreen = {
  personaScreen: PersonaScreenState;
};
export type MainWindowOnRecordingScreen = {
  recordingScreen: RecordingScreenState;
};

export type MainWindowOn = {
  open: "recording" | "persona";
};

export type MainWindowOff = "closed";

export type MainWindow = MainWindowOff | MainWindowOn;

export type AppStateValue = {
  ready: "true" | "false";
  mainWindow: MainWindow;
  settingsWindow: "open" | "closed";
  conversationProcess: "idle" | "recording" | "transcribing";
};

// Define context type if we need to track additional state
export interface AppContext {
  activePersona: string | null;
  shortcuts: Shortcuts;
  actionHandler: {
    recording: (() => void) | null;
    options: (() => void) | null;
    onboarding: (() => void) | null;
  };
  conversation: Conversation;
  personas: {
    availablePersonas: Persona[];
    activePersona: string | null;
  };
  models: {
    transcription: {
      availableModels: { name: string; model: string }[];
      activeModel: string;
      language: string;
    };
  };
  providers: {
    openai: {
      apiKey: string | null;
    };
    elevenlabs: {
      apiKey: string | null;
    };
  };
  transcriptionModel: null | ITrasncriptionModel;
}

export type StateMachineState = { value: AppStateValue; context: AppContext };

export const initialContext: AppContext = {
  activePersona: null,
  shortcuts: {
    recording: ["F6"],
    close: ["Esc"],
    personas: ["F5"],
    screenshot: ["Control", "Shift", "S"],
    copy_text: ["Control", "Shift", "C"],
    toggle_minimized: ["F11"],
    switch_language: ["Control", "Shift", "L"],
  },
  conversation: Conversation.createWithUniqueId(),
  personas: {
    availablePersonas: [],
    activePersona: null,
  },
  actionHandler: {
    recording: null,
    options: null,
    onboarding: null,
  },
  models: {
    transcription: {
      availableModels: [
        { name: "Whisper Base", model: "Xenova/whisper-base" },
        { name: "Whisper Tiny", model: "Xenova/whisper-tiny" },
      ],
      activeModel: "Xenova/whisper-tiny",
      language: "en",
    },
  },
  providers: {
    openai: {
      apiKey: null,
    },
    elevenlabs: {
      apiKey: null,
    },
  },
  transcriptionModel: {
    state: "idle",
    error: null,
    model: null,
    progress: {},
  } as any,
};

export const initialStateMachineState = (overrides?: Partial<StateMachineState>): StateMachineState => {
  return {
    value: {
      conversationProcess: "idle",
      mainWindow: "closed",
      ready: "false",
      settingsWindow: "closed",
    },
    context: initialContext,
    ...overrides,
  };
};

export function isWindowOn(window: MainWindowOff | MainWindowOn): window is MainWindowOn {
  return window !== "closed";
}

export function isWindowOff(window: MainWindowOff | MainWindowOn): window is MainWindowOff {
  return window === "closed";
}

export function isPersonaWindow(value: AppStateValue): boolean {
  return isWindowOn(value.mainWindow) && value.mainWindow.open === "persona";
}

export function isRecordingWindow(value: AppStateValue): boolean {
  return isWindowOn(value.mainWindow) && value.mainWindow.open === "recording";
}

export function recordingState(value: AppStateValue): RecordingScreenState {
  if (value.conversationProcess === "recording") {
    return "recording";
  }

  if (value.conversationProcess === "transcribing") {
    return "transcribing";
  }

  return "idle";
}

export interface ITrasncriptionModel {
  state: TranscriptionModelState;
  error: TranscriptionModelError;
  model: string | null;
  progress: { status: string; name: string } | null;

  init(model: string, sendEvent: (event: AppEvent) => void): ITrasncriptionModel;
  destroy(): Promise<void>;
  setIdleState(error?: TranscriptionModelError): ITrasncriptionModel;
  setLoadingState(): ITrasncriptionModel;
  setReadyState(): ITrasncriptionModel;
  setTranscribingState(): ITrasncriptionModel;
  setProgress(progress: { status: string; name: string }): ITrasncriptionModel;
  transcribe(audio: Float32Array): ITrasncriptionModel;
}

export type TranscriptionModelState = "idle" | "loading" | "ready" | "transcribing";
export type TranscriptionModelError = { message: string } | null;

export interface ITrayState {
  setIconState(state: "white" | "red" | "yellow" | "blue"): ITrayState;
  destroy(): void;
}
