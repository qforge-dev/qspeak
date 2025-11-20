import { invoke } from "@tauri-apps/api/core";
import { useStateContext } from "./useNewState";

export interface PersonaExample {
  question: string;
  answer: string;
}

export interface PersonasContext {
  personas: Persona[];
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  voice_command: string;
  paste_on_finish: boolean;
  icon: string | null;
  record_output_audio: boolean;
  examples: PersonaExample[];
}

export interface PersonasStateMachine {
  context: PersonasContext;
}

export function usePersonas() {
  const { state } = useStateContext();

  const changePersona = (personaId: string | null) => {
    const persona = state?.personas_context.personas.find((persona) => persona.id === personaId) ?? null;
    return invokeEvent("ActionChangePersona", persona);
  };

  const addPersona = (persona: Omit<Persona, "id">) => {
    return invokeEvent("ActionAddPersona", persona);
  };

  const updatePersona = (persona: Persona) => {
    return invokeEvent("ActionUpdatePersona", persona);
  };

  const deletePersona = (personaId: string) => {
    return invokeEvent("ActionDeletePersona", personaId);
  };

  const duplicatePersona = (persona: Persona) => {
    return invokeEvent("ActionDuplicatePersona", persona);
  };

  return {
    state: state
      ? {
          context: state.personas_context,
        }
      : null,
    changePersona,
    addPersona,
    updatePersona,
    deletePersona,
    duplicatePersona,
  };
}

function invokeEvent(name: string, payload: any | null = null) {
  return invoke("event", {
    event: {
      name,
      payload,
    },
  });
}
