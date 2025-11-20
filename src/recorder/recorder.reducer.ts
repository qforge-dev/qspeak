import { OptionsState, PersonasState } from "@renderer/shared/types";

export type UserMessage = {
  role: "user";
  content: string;
};

export type AssistantMessage = {
  role: "assistant";
  content: string;
};

export type Message = UserMessage | AssistantMessage;

export type Action =
  | ReturnType<typeof setOptions>
  | ReturnType<typeof startTranscript>
  | ReturnType<typeof finishTranscript>
  | ReturnType<typeof startTransformation>
  | ReturnType<typeof finishTransformation>
  | ReturnType<typeof setTransformationChunk>
  | ReturnType<typeof finishRecording>
  | ReturnType<typeof setAudioChunk>
  | ReturnType<typeof clear>
  | ReturnType<typeof setPersonas>;

export type RecordingStatus = "idle" | "recording" | "transcribing" | "finished" | "transforming";

export const initialState = {
  personas: null as PersonasState | null,
  options: {} as OptionsState,
  status: "idle" as RecordingStatus,
  messages: [] as Message[],
  transcript: "",
  transformation: "",
  audioStream: [] as Float32Array[],
};

export type RecordState = typeof initialState;

export function recorderReducer(state: RecordState, action: Action) {
  switch (action.type) {
    case "SET_OPTIONS":
      return { ...state, options: action.payload };
    case "START_TRANSCRIPT":
      return {
        ...state,
        transcript: "",
        transformation: "",
        status: "recording" as RecordingStatus,
      };
    case "FINISH_RECORDING":
      return { ...state, status: "transcribing" as RecordingStatus };
    case "FINISH_TRANSCRIPT":
      return {
        ...state,
        transcript: "",
        messages: [{ role: "user", content: action.payload } as UserMessage, ...state.messages],
        status: "idle" as RecordingStatus,
      };

    case "START_TRANSFORMATION":
      return {
        ...state,
        transformation: "",
        transcript: "",
        status: "generating" as RecordingStatus,
      };
    case "FINISH_TRANSFORMATION":
      return {
        ...state,
        status: "finished" as RecordingStatus,
        messages: [
          {
            role: "assistant",
            content: state.transformation,
          } as AssistantMessage,
          ...state.messages,
        ],
        transformation: "",
      };
    case "SET_TRANSFORMATION_CHUNK":
      return {
        ...state,
        transformation: state.transformation + action.payload,
        status: "generating" as RecordingStatus,
      };
    case "SET_AUDIO_CHUNK":
      return {
        ...state,
        audioStream: [...state.audioStream, ...action.payload],
      };
    case "SET_PERSONAS":
      return { ...state, personas: action.payload };
    case "CLEAR":
      return {
        ...initialState,
        options: state.options,
        personas: state.personas,
      };
    default:
      return state;
  }
}

export function setOptions(options: OptionsState) {
  return { type: "SET_OPTIONS", payload: options } as const;
}

export function startTranscript() {
  return { type: "START_TRANSCRIPT" } as const;
}

export function finishRecording() {
  return { type: "FINISH_RECORDING" } as const;
}

export function finishTranscript(transcript: string) {
  return { type: "FINISH_TRANSCRIPT", payload: transcript } as const;
}

export function startTransformation() {
  return { type: "START_TRANSFORMATION" } as const;
}

export function finishTransformation() {
  return { type: "FINISH_TRANSFORMATION" } as const;
}

export function setTransformationChunk(chunk: string) {
  return { type: "SET_TRANSFORMATION_CHUNK", payload: chunk } as const;
}

export function setAudioChunk(stream: Float32Array[]) {
  return { type: "SET_AUDIO_CHUNK", payload: stream } as const;
}

export function clear() {
  return { type: "CLEAR" } as const;
}

export function setPersonas(personas: PersonasState) {
  return { type: "SET_PERSONAS", payload: personas } as const;
}
