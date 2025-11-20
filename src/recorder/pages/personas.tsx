import { useAppState } from "@renderer/hooks/useAppState";
import { PersonasSelect } from "../components/personas-select";
import { usePersonas } from "@renderer/hooks/usePersonas";
import { useRecordingWindowState } from "@renderer/hooks/useRecordingWindowState";

export function Personas() {
  const { state } = useAppState();
  const { state: personasState, changePersona } = usePersonas();
  const { state: recordingWindowState } = useRecordingWindowState();

  const onSelectPersona = (personaId: string | null) => {
    changePersona(personaId);
  };

  if (!recordingWindowState || !personasState || !state) return null;

  return (
    <PersonasSelect
      personas={{
        personas: personasState?.context.personas || [],
        currentPersonaId: state?.context.active_persona?.id || null,
      }}
      onSelectPersona={onSelectPersona}
    />
  );
}
