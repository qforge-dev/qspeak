import { invokeEvent, useAppState } from "./useAppState";
import { useEffect } from "react";
import i18n from "@renderer/i18n";

export function useInterfaceLanguage() {
  const { state } = useAppState();

  const onLanguageChange = (language: string) => {
    invokeEvent("ActionChangeInterfaceLanguage", language);
  };

  useEffect(() => {
    if (state?.context.interface_language) {
      i18n.changeLanguage(state.context.interface_language);
    }
  }, [state?.context.interface_language]);

  return {
    onLanguageChange,
    language: state?.context.interface_language ?? i18n.language ?? "en",
  };
}
