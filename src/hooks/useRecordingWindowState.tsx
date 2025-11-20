import { RecordingWindowContext, useStateContext } from "./useNewState";

export function useRecordingWindowState(): { state: RecordingWindowContext } {
  const { state } = useStateContext();

  return {
    state: state?.recording_window_context ?? { state: "Closed", minimized: false, theme: "Dark" },
  };
}

export function isPersonaOpen(state: RecordingWindowContext) {
  if (state.state === "Closed") {
    return false;
  }

  return state.state.Open === "Persona";
}

export function isRecordingOpen(state: RecordingWindowContext) {
  if (state.state === "Closed") {
    return false;
  }

  return state.state.Open === "Recording";
}
