export interface OptionsWindowState {
  isOpen: boolean;
}

export interface OptionsState {
  shortcuts: {
    record: string[];
    close: string[];
    personas: string[];
  };
  providers: {
    openai: {
      apiKey: string;
    };
    elevenlabs: {
      apiKey: string;
    };
  };
  models: {
    transcription: {
      model: string;
    };
  };
}

export interface PersonasState {
  personas: Persona[];
  currentPersonaId: string | null;
}

export interface Persona {
  id: string;
  name: string;
  system_prompt: string;
  description?: string;
  voice_command: string;
  paste_on_finish: boolean;
  record_output_audio: boolean;
}

export type ImageContext = { type: "image"; image: string };
export type TextContext = { type: "text"; text: string };
export type Context = ImageContext | TextContext;
