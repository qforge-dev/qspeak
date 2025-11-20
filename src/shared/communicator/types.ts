import { Context, OptionsState, PersonasState } from "@shared/types";
import { CommunicatorCall, CommunicatorCast, CommunicatorHandleCall, CommunicatorHandleCast } from "./base";
import { AppEvent, StateMachineState } from "./state-machine.types";
import { Operation } from "@shared/json-patch";
type Action = AppEvent;

type WindowCommunicatorCastAction = {
  action: { request: Action };
};

type WindowCommunicatorCallAction = {
  getOptions: { request: undefined; response: OptionsState };
  getPersonasState: { request: undefined; response: PersonasState };
};

type MainCommunicatorCastAction = {
  startRecording: { request: undefined; response: undefined };
  cancelRecording: { request: undefined; response: undefined };
  transcriptionDone: { request: string; response: undefined };
  chatChunk: { request: string; response: undefined };
  chatEnd: { request: undefined; response: undefined };
  windowClosed: { request: undefined; response: undefined };
  audioChunk: { request: number[]; response: undefined };
  openPersonas: { request: undefined; response: undefined };
  contextChanged: { request: Context[]; response: undefined };
  modelProgress: {
    request: { payload: { status: string } };
    response: undefined;
  };
  setPersonasState: { request: PersonasState; response: undefined };
  state: {
    request: StateMachineState;
    response: undefined;
  };
  stateDiff: {
    request: Operation[];
    response: undefined;
  };
};

type MainCommunicatorCallAction = {
  stopRecording: { request: undefined; response: Float32Array };
  screenshot: { request: undefined; response: string };
  getAudio: { request: undefined; response: Float32Array };
};

type WindowCommunicatorCast = CommunicatorCast<WindowCommunicatorCastAction>;
type WindowCommunicatorCall = CommunicatorCall<WindowCommunicatorCallAction>;
type WindowCommunicatorHandleCast = CommunicatorHandleCast<MainCommunicatorCastAction>;
type WindowCommunicatorHandleCall = CommunicatorHandleCall<MainCommunicatorCallAction>;

type MainCommunicatorCast = CommunicatorCast<MainCommunicatorCastAction>;
type MainCommunicatorCall = CommunicatorCall<MainCommunicatorCallAction>;
type MainCommunicatorHandleCast = CommunicatorHandleCast<WindowCommunicatorCastAction>;
type MainCommunicatorHandleCall = CommunicatorHandleCall<WindowCommunicatorCallAction>;

export type WindowCommunicator = {
  cast: WindowCommunicatorCast;
  handleCast: WindowCommunicatorHandleCast;
  call: WindowCommunicatorCall;
  handleCall: WindowCommunicatorHandleCall;
};

export type MainCommunicator = {
  cast: MainCommunicatorCast;
  handleCast: MainCommunicatorHandleCast;
  call: MainCommunicatorCall;
  handleCall: MainCommunicatorHandleCall;
};
