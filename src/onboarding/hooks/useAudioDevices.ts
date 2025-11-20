import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type InputDevice = {
  name: string;
  label: string;
};

export function useInputDevices() {
  const [devices, setDevices] = useState<InputDevice[]>([]);

  useEffect(() => {
    const getAvailableMicrophones = async () => {
      try {
        const devices: string[] = await invoke("get_audio_devices");

        setDevices(devices.map((device) => ({ name: device, label: device })));
      } catch (err) {}
    };

    getAvailableMicrophones();
  }, []);

  return { devices };
}
