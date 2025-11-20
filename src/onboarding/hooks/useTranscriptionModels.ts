import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type TranscriptionModel = {
  name: string;
  model: string;
  provider: "openai" | "mistral" | "whisper_local";
  size: number;
  parameters: number;
  vram: number;
};

export function useTranscriptionModels() {
  const [models, setModels] = useState<TranscriptionModel[]>([]);

  useEffect(() => {
    const getTranscriptionModels = async () => {
      try {
        const models: TranscriptionModel[] = await invoke("get_transcription_models");

        setModels(models);
      } catch (err) {}
    };

    getTranscriptionModels();
  }, []);

  return { models };
}
