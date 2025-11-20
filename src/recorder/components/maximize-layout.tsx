import { Camera, Copy } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  FooterButton,
  RecorderBody,
  RecorderFooter,
  RecorderFooterSection,
  RecorderWrapper,
  RecorderInputForm,
  FileUploadButton,
} from "./recorder.components";

import { invokeEvent, useAppState } from "@renderer/hooks/useAppState";
import { useConversationContext } from "@renderer/hooks/useConversationState";
import { useErrorToasts } from "@renderer/hooks/useErrorToasts";
import { useStateContext } from "@renderer/hooks/useNewState";
import { isPersonaOpen, useRecordingWindowState } from "@renderer/hooks/useRecordingWindowState";
import { cn } from "@renderer/utils/cn";
import { getShortcut } from "@renderer/utils/shortcut";
import { Outlet } from "react-router";
import { PersonaFooterButton } from "./personas-select";
import { RecorderStatusIndicator } from "./recorder-status-indicator";
import { AnimatePresence } from "motion/react";

export function MaximizeLayout() {
  const { t } = useTranslation();
  const { takeScreenshot, copyText, addFile, state: appState, hasConversationStarted } = useAppState();
  const { state } = useStateContext();
  const { recordingStatus } = useConversationContext();
  const { state: recordingWindowState } = useRecordingWindowState();

  const containerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  // const lastResizeTimeRef = useRef<number>(0);

  useErrorToasts(appState?.context.errors, (err) => invokeEvent("ActionRemoveError", err.id));

  // useIsomorphicLayoutEffect(() => {
  //   if (!containerRef.current || !footerRef.current || !isRecordingOpen(recordingWindowState)) {
  //     return;
  //   }
  //   const now = Date.now();
  //   if (now - lastResizeTimeRef.current < 200) {
  //     return;
  //   }

  //   lastResizeTimeRef.current = now;

  //   getCurrentWindow()
  //     .setSize(
  //       new LogicalSize(
  //         500,
  //         Math.max(Math.min(containerRef.current.clientHeight + footerRef.current.clientHeight + 50, 500), 200),
  //       ),
  //     )
  //     .catch((error) => {
  //       console.error("Error resizing window:", error);
  //     });
  // }, [state?.conversation_context.transcription_text, JSON.stringify(state?.conversation_context.conversation)]);

  if (!state?.conversation_context || !state || !recordingWindowState) return null;

  return (
    <RecorderWrapper>
      <RecorderBody
        key={hasConversationStarted ? "started" : "initial"}
        className={cn({ "flex-col overflow-visible": isPersonaOpen(recordingWindowState) })}
        ref={containerRef}
      >
        <Outlet />
      </RecorderBody>

      <RecorderFooter status={recordingStatus} ref={footerRef}>
        <RecorderFooterSection className="border-y border-y-background-surface-high dark:border-y-background-surface-high py-0.5 h-9">
          <div className="flex items-center gap-2">
            <PersonaFooterButton status={recordingStatus} />

            <AnimatePresence mode="wait">
              {recordingStatus !== "idle" ? (
                <RecorderStatusIndicator
                  key="status-indicator"
                  status={recordingStatus}
                  model={appState?.context.conversation_model}
                />
              ) : null}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1">
            <FileUploadButton onChange={addFile} />

            {state.active_persona && (
              <FooterButton
                onClick={takeScreenshot}
                className="w-fit [&>svg]:size-4 [&>svg]:text-violet"
                disabled={state.conversation_context.screenshot_state === "Screenshotting"}
                tooltip={
                  <>
                    <span className="text-muted-foreground/70">{t("takeScreenshot")}: </span>
                    {getShortcut(state.shortcuts.screenshot).getKeysIcons()}
                  </>
                }
              >
                <Camera />
              </FooterButton>
            )}
            {state.active_persona && (
              <FooterButton
                onClick={copyText}
                className="w-fit [&>svg]:size-4 [&>svg]:text-yellow"
                disabled={state.conversation_context.copy_text_state === "Copying"}
                tooltip={
                  <>
                    <span className="text-muted-foreground/70">{t("copyText")}: </span>
                    {getShortcut(state.shortcuts.copy_text).getKeysIcons()}
                  </>
                }
              >
                <Copy />
              </FooterButton>
            )}
          </div>
        </RecorderFooterSection>

        <RecorderFooterSection className="pl-1 py-0 gap-2 grow">
          <RecorderInputForm />
        </RecorderFooterSection>
      </RecorderFooter>
    </RecorderWrapper>
  );
}
