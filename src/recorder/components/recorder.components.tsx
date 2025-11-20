import { Button, ButtonProps } from "@renderer/components/button";
import { cn } from "@renderer/utils/cn";
import { forwardRef, useMemo, useState } from "react";
import { RecordingStatus } from "../recorder.reducer";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@renderer/components/tooltip";
import {
  HistoryConversation,
  ChatCompletionTextMessage,
  useConversationContext,
  isTextMessageContent,
} from "@renderer/hooks/useConversationState";
import { useAppState } from "@renderer/hooks/useAppState";
import { getShortcut } from "@renderer/utils/shortcut";
import { ArrowUp, CircleStop, MessageSquareText, Mic, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Visualizer } from "./visualizer";
import { errorToast } from "@renderer/components/toasts";
import { HTMLMotionProps, motion } from "motion/react";

export const RecorderWrapper = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative min-h-[300px] bg-transparent rounded-b-2xl flex flex-col", className)}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

RecorderWrapper.displayName = "RecorderWrapper";

export const RecorderBody = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...rest }, ref) => {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        ref={ref}
        className={cn(
          "relative w-full mx-auto grow px-3 py-2 h-[calc(100vh_-_var(--header-height)_-_var(--footer-height)_-_2px)] no-drag",
          "flex flex-col-reverse overflow-y-auto grow scroll-smooth [overflow-anchor:auto]",
          "scrollbar-custom",
          className,
        )}
        {...rest}
      >
        {children}
      </motion.div>
    );
  },
);

export const RecorderFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { status: RecordingStatus }
>(({ className, children, status, ...rest }, ref) => {
  return (
    <div
      ref={ref}
      data-tauri-drag-region
      className={cn(
        "select-none cursor-grab h-[var(--footer-height)] flex flex-col bg-background-surface dark:bg-background",
        { "opacity-70": status === "transforming" || status === "transcribing" },
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export const RecorderFooterSection = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        data-tauri-drag-region
        className={cn("flex justify-between items-center px-2 py-1", className)}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

export function FooterButtons({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex gap-3 no-drag select-none", className)} data-tauri-drag-region {...rest}>
      {children}
    </div>
  );
}

export function FooterButton({
  className,
  children,
  disabled,
  tooltip,
  ...rest
}: ButtonProps & { tooltip?: React.ReactNode }) {
  const button = (
    <Button
      variant="ghost"
      size="lg"
      type="button"
      disabled={disabled}
      className={cn("w-full no-drag text-muted-foregroundc text-xs px-2 h-8", className)}
      {...rest}
    >
      {children}
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent className="text-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

export function FooterButtonShortcut({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-accent/50 text-foreground text-xs rounded-sm px-2 py-1", className)} {...props} />;
}

export function RecordStatus({
  className,
  children,
  status,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { status: RecordingStatus }) {
  return (
    <div
      className={cn(
        "w-1.5 h-1.5 relative rounded-full after:content-[''] after:absolute after:inset-0 after:rounded-full",
        {
          "bg-red-400 after:animate-ping after:bg-red-400": status === "recording",
          "bg-blue-500 after:animate-ping after:bg-blue-500": status === "transcribing" || status === "transforming",
          "bg-green-500 shadow-xl inset-shadow-green-500": status === "finished" || status === "idle",
        },
        className,
      )}
      {...rest}
    />
  );
}

export function RecorderInput({
  className,
  status,
  ...props
}: Omit<React.HTMLAttributes<HTMLInputElement>, "onSubmit"> & {
  status: RecordingStatus;
  value: string;
}) {
  return (
    <input
      autoFocus
      name="text-message"
      readOnly={status !== "idle"}
      className={cn(
        "w-full no-drag text-sm px-2 h-10 bg-transparent !border-none !outline-none !ring-0 !shadow-none dark:placeholder:text-muted-foreground/40 caret-primary",

        className,
      )}
      placeholder="Ask me anything..."
      {...props}
    />
  );
}

export function RecorderInputForm() {
  const { recordingStatus } = useConversationContext();
  const { toggleRecording, state, sendTextMessage } = useAppState();
  const { t } = useTranslation();

  const [inputValue, setInputValue] = useState("");

  const isInputEmpty = inputValue.trim() === "";

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isInputEmpty) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const text = formData.get("text-message") as string;

    sendTextMessage(text.trim());

    setInputValue("");
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  if (!state) return null;

  return (
    <form onSubmit={onSubmit} className="h-full w-full flex items-center gap-2">
      {recordingStatus === "recording" ? (
        <Visualizer state={recordingStatus === "recording" ? "active" : "inactive"} size="sm" className="ml-2" />
      ) : (
        <RecorderInput status={recordingStatus} value={inputValue} onChange={onInputChange} />
      )}

      {isInputEmpty ? (
        <FooterButton
          variant="default"
          type="button"
          onClick={toggleRecording}
          disabled={recordingStatus === "transforming" || recordingStatus === "transcribing"}
          className="w-8 h-8 [&>svg]:size-4 text-white dark:text-foreground"
          tooltip={
            <>
              {recordingStatus === "recording" ? t("stop") : t("record")}:{" "}
              {getShortcut(state?.context.shortcuts.recording).getKeysIcons()}
            </>
          }
        >
          {recordingStatus === "recording" ? <CircleStop /> : <Mic />}
        </FooterButton>
      ) : (
        <FooterButton type="submit" className="w-8 [&>svg]:size-3.5" variant="outline">
          <ArrowUp />
        </FooterButton>
      )}
    </form>
  );
}

export function RecorderPreviousConversations({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const { state, loadHistoryConversation, getHistoryForPersona } = useAppState();
  const { t } = useTranslation();

  const history = useMemo(() => {
    if (!state) return [];

    const history = getHistoryForPersona(state.context.active_persona?.name ?? "");

    return history.slice(0, 4);
  }, [state?.context.active_persona?.name, getHistoryForPersona]);

  const onConversationClick = (conversation_id: string) => {
    loadHistoryConversation(conversation_id);
  };

  if (history.length === 0) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="text-sm text-foreground text-center max-w-sm mx-auto mb-4"
      >
        {t("startNewConversationByTalkingOrWriting")}
      </motion.p>
    );
  }

  return (
    <div className="w-full h-full flex items-start mt-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn("flex flex-col gap-1 mb-2 pl-1", className)}
      >
        <p className="text-sm text-foreground mb-1">{t("recentConversations")}</p>
        <div className="flex flex-col gap-1.5">
          {history.map((conversation, index) => (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.2,
                ease: "easeOut",
                delay: index * 0.05,
              }}
            >
              <RecorderPreviousConversationItem
                conversation={conversation}
                onClick={() => onConversationClick(conversation.id)}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function RecorderPreviousConversationItem({
  className,
  conversation,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { conversation: HistoryConversation }) {
  const firstUserMessage = conversation.conversation.find(
    (message) => message.role === "user",
  ) as ChatCompletionTextMessage;

  if (!firstUserMessage) return null;

  return (
    <div
      className={cn("flex gap-2 items-center text-muted-foreground/80 hover:text-foreground cursor-pointer", className)}
      {...rest}
    >
      <MessageSquareText className="size-3.5 mt-0.5 shrink-0" />
      <div className="text-sm line-clamp-1">
        {conversation.title ??
          firstUserMessage.content.find((content) => isTextMessageContent(content))?.text ??
          "No messages"}
      </div>
    </div>
  );
}

// TODO: Handle other file types
export function FileUploadButton({ onChange }: { onChange: (file: File) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <input
        type="file"
        multiple={false}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.type.startsWith("image/")) {
              onChange(file);
              e.target.value = "";
            } else {
              errorToast(t("fileUploadError"));
              e.target.value = "";
            }
          }
        }}
        className="hidden"
        id="file-upload"
        name="file-upload"
      />

      <FooterButton asChild>
        <label htmlFor="file-upload">
          <Upload className="size-4 text-blue-500" />
        </label>
      </FooterButton>
    </>
  );
}
