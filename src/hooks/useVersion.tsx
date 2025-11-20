import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

export function useVersion() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then((version) => {
      setVersion(version);
    });
  }, []);

  return version;
}
