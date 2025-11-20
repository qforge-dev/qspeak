import React from "react";

import { useTransitionNavigate } from "@renderer/hooks/useNavigate";
import { useTranslation } from "react-i18next";
import { useInterfaceLanguage } from "@renderer/hooks/useInterfaceLanguage";
import { useIsomorphicLayoutEffect } from "usehooks-ts";
import { useRecordingWindowState } from "@renderer/hooks/useRecordingWindowState";
import { useAppState } from "@renderer/hooks/useAppState";
import { Button } from "@renderer/components/button";
import { Maximize2, Minus, Wifi, X } from "lucide-react";
import { cn } from "@renderer/utils/cn";
import { useInternetConnection } from "@renderer/hooks/useInternetConnection";
import { HistorySelect } from "./history-select";
import { NewChatButton } from "./new-chat-button";
import { LanguageSelect } from "./language-select";
import { ShiningLogo } from "./shining-logo";

export function Layout({ children }: { children: React.ReactNode }) {
  const { state: recordingWindowState } = useRecordingWindowState();
  const { closeRecordingWindow, toggleMinimized } = useAppState();
  const [online] = useInternetConnection();

  const { t } = useTranslation();

  useInterfaceLanguage();

  const displayHeader =
    !recordingWindowState?.minimized ||
    (typeof recordingWindowState?.state === "object" && recordingWindowState?.state.Open === "Persona");

  return (
    <div
      className={cn("overflow-hidden [--header-height:calc(36px)] [--footer-height:calc(89px)] ", {
        "bg-background rounded-3xl dark:!bg-background-surface-high border border-background-surface-highlight-high":
          displayHeader,
      })}
    >
      <div
        data-tauri-drag-region
        className={cn(
          "relative flex items-center gap-2 justify-between cursor-grab group h-[var(--header-height)] border-b bg-background dark:bg-background-surface-high dark:border-background-surface-highlight-high",
          {
            hidden: !displayHeader,
            "p-2": displayHeader,
          },
        )}
      >
        <div data-tauri-drag-region className={cn("flex items-center gap-2 p-1 group")}>
          <Button
            onClick={closeRecordingWindow}
            className="w-3 h-3 [&>svg]:size-2.5 p-0 pointer-events-auto border-transparent rounded-full opacity-40 dark:opacity-100 bg-background-surface-highlight-high group-hover:opacity-100 group-hover:bg-red-500 dark:group-hover:opacity-100 hover:bg-red-500 transition-all [&>svg]:opacity-0 hover:[&>svg]:opacity-100"
          >
            <X />
          </Button>

          <Button
            onClick={toggleMinimized}
            className="w-3 h-3 [&>svg]:size-2.5 p-0 pointer-events-auto border-transparent rounded-full opacity-40 dark:opacity-100 bg-background-surface-highlight-high group-hover:opacity-100 group-hover:bg-yellow-500 dark:group-hover:opacity-100 transition-all hover:bg-yellow-500 [&>svg]:opacity-0 hover:[&>svg]:opacity-100"
          >
            {!displayHeader ? <Maximize2 /> : <Minus />}
          </Button>

          <ShiningLogo data-tauri-drag-region className="absolute left-1/2 -translate-x-1/2" />
        </div>

        <div className="flex items-center gap-0.5">
          <NewChatButton />

          <HistorySelect />

          <LanguageSelect />

          <Button
            size="xxs"
            className={cn(
              "mb-1 [&>svg]:size-3.5 p-0 pointer-events-auto rounded-full !bg-transparent border-transparent",
              {
                "text-green-500": online,
                "text-red-400": !online,
              },
            )}
            title={online ? t("connected") : t("disconnected")}
          >
            <Wifi />
          </Button>
        </div>
      </div>

      <WindowChangeListener />

      {children}
    </div>
  );
}

function WindowChangeListener() {
  const { state: recordingWindowState } = useRecordingWindowState();
  const navigate = useTransitionNavigate();

  useIsomorphicLayoutEffect(() => {
    if (typeof recordingWindowState?.state !== "object" || recordingWindowState.state.Open === undefined) return;

    if (recordingWindowState.minimized && recordingWindowState.state.Open !== "Persona") {
      navigate("/minimized");
      return;
    }

    switch (recordingWindowState.state.Open) {
      case "Persona":
        navigate("/personas");
        break;
      case "Recording":
        navigate("/");
        break;
    }
  }, [JSON.stringify(recordingWindowState?.state), recordingWindowState?.minimized]);

  return null;
}
