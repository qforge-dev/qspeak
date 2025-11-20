import { RecordingStatus } from "@renderer/recorder/recorder.reducer";
import { createContext, useContext, useMemo } from "react";
import { useAppState } from "./useAppState";

export type ConversationState = "Idle" | "Listening" | "Transcribing" | "Transforming" | "Error";

export type CopyTextState = "Idle" | "Copying";
export type ScreenshotState = "Idle" | "Screenshotting";

export type ChatCompletionMessageImageContent = { type: "image_url"; image_url: { url: string } };

export type ChatCompletionMessageTextContent = { type: "text"; text: string };

export type ChatCompletionMessageContent = ChatCompletionMessageImageContent | ChatCompletionMessageTextContent;

export type ChatCompletionMessageRole = "user" | "assistant" | "system";

export type ChatCompletionMessage =
  | ChatCompletionTextMessage
  | ChatCompletionToolCallMessage
  | ChatCompletionToolCallResultMessage;

export interface ChatCompletionTextMessage {
  role: ChatCompletionMessageRole;
  content: ChatCompletionMessageContent[];
  created_at: string;
}

export interface ChatCompletionToolCallMessage {
  role: ChatCompletionMessageRole;
  tool_calls: ChatCompletionToolCall[];
  created_at: string;
}

export interface ChatCompletionToolCall {
  id: string;
  function: ChatCompletionToolCallFunction;
}

export interface ChatCompletionToolCallFunction {
  client_name: string;
  name: string;
  arguments: string;
}

export interface ChatCompletionToolCallResultMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
  created_at: string;
}

export type HistoryConversationMessage = ChatCompletionMessage & {
  audio_file_path: string | null;
};

export interface HistoryConversation {
  id: string;
  conversation: HistoryConversationMessage[];
  created_at: string;
  model_name: string;
  persona_name: string;
  title: string | null;
}

export interface ConversationContext {
  dictionary: string[];
  replacements: [string, string][];
  transcription_text: string;
  audio_file_path: string | null;
  conversation: ChatCompletionMessage[];
  state: ConversationState;
  copy_text_state: CopyTextState;
  screenshot_state: ScreenshotState;
}

export interface ConversationStateMachine {
  state: ConversationState;
  context: ConversationContext;
}

export function useConversationState() {
  const { state } = useAppState();

  const recordingStatus: RecordingStatus = useMemo(() => {
    if (state?.context.conversation_context.state === "Listening") {
      return "recording";
    }

    if (state?.context.conversation_context.state === "Transcribing") {
      return "transcribing";
    }

    if (state?.context.conversation_context.state === "Transforming") {
      return "transforming";
    }

    return "idle";
  }, [state]);

  return {
    state: state ? state.context.conversation_context : null,
    recordingStatus,
  };
}

const ConversationStateContext = createContext<{
  state: ConversationStateMachine | null;
  recordingStatus: RecordingStatus;
} | null>(null);

export function ConversationStateProvider({ children }: { children: React.ReactNode }) {
  const { state, recordingStatus } = useConversationState();

  return (
    <ConversationStateContext.Provider
      value={{
        recordingStatus,
        state: state
          ? {
              context: state,
              state: state.state,
            }
          : null,
      }}
    >
      {children}
    </ConversationStateContext.Provider>
  );
}

export function useConversationContext() {
  const context = useContext(ConversationStateContext);
  if (!context) {
    throw new Error("useConversationContext must be used within a ConversationStateProvider");
  }
  return context;
}

export function isTextMessageContent(
  message: ChatCompletionMessageContent,
): message is ChatCompletionMessageTextContent {
  return message.type === "text";
}
