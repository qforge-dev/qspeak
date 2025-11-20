import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ItemListProps, ItemsList } from "@renderer/components/items-list";
import { ChatCompletionToolCallResultMessage, HistoryConversationMessage } from "@renderer/hooks/useConversationState";
import { cn } from "@renderer/utils/cn";
import { Sparkles, UserIcon, PlayIcon, PauseIcon, CopyIcon, CheckIcon } from "lucide-react";
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { CustomDate } from "@renderer/utils/custom-date";
import { Button } from "@renderer/components/button";
import { useCopyToClipboard } from "usehooks-ts";
import { PhotoProvider, PhotoView } from "react-photo-view";
import { Markdown } from "@renderer/components/markdown";
import { ToolCallMessage } from "@renderer/components/messages";
import { v4 as uuidv4 } from "uuid";
import "react-photo-view/dist/react-photo-view.css";

export function ConversationHistoryMessages({
  items,
  className,
  ...rest
}: Omit<ItemListProps<HistoryConversationMessage>, "renderItem">) {
  const isNotEmpty = (item: HistoryConversationMessage) => {
    if (item.role === "tool" || "tool_calls" in item) {
      return true;
    }

    return (
      item.content.some((content) => content.type === "text" && content.text.trim() !== "") ||
      item.content.some((content) => content.type === "image_url")
    );
  };

  const withIds = useMemo(() => {
    return [...items.map((item) => ({ ...item, id: uuidv4() })).filter((item) => item.role !== "system")]
      .filter(isNotEmpty)
      .reverse();
  }, [items]);

  const getToolCallContent = useCallback(
    (toolCallId: string) => {
      return (
        withIds.find((m) => m.role === "tool" && m.tool_call_id === toolCallId) as ChatCompletionToolCallResultMessage
      )?.content;
    },
    [withIds],
  );

  return (
    <ItemsList
      className={cn("flex flex-col-reverse gap-3 grow overflow-y-auto scrollbar-custom", className)}
      items={withIds}
      renderItem={(item) => {
        return <ConversationItem item={item} toolResponse={getToolCallContent} />;
      }}
      {...rest}
    />
  );
}

function ConversationItem({
  item,
  toolResponse,
}: {
  item: HistoryConversationMessage & { id: string };
  toolResponse: (id: string) => string;
}) {
  if (item.role === "tool") {
    return null;
  }

  const renderContent = useCallback(() => {
    if ("tool_calls" in item) {
      return (
        <div className="my-0">
          {item.tool_calls.map((toolCall) => (
            <ToolCallMessage key={toolCall.id} toolCall={toolCall} toolResponse={toolResponse} />
          ))}
        </div>
      );
    }

    return item.content.map((content, index) => {
      if (content.type === "text") {
        return (
          <ConversationHistoryMessageContentWrapper key={index}>
            <ConversationHistoryMessageTextContent role={item.role}>
              {item.role === "user" ? content.text : <Markdown>{content.text}</Markdown>}
            </ConversationHistoryMessageTextContent>

            <ConversationHistoryFooter>
              <ConversationHistoryMessageTime>
                {CustomDate.format(item.created_at, "HH:mm a")}
              </ConversationHistoryMessageTime>

              <MessageCopyButton text={content.text} />

              {item.audio_file_path ? <ConversationHistoryAudioPlayer path={item.audio_file_path} /> : null}
            </ConversationHistoryFooter>
          </ConversationHistoryMessageContentWrapper>
        );
      }

      if (content.type === "image_url") {
        return (
          <ConversationHistoryMessageImageContent key={index}>
            <div className="w-[200px] h-[100px] mb-1 rounded-md overflow-hidden">
              <PhotoProvider>
                <PhotoView src={content.image_url.url}>
                  <img
                    src={content.image_url.url}
                    alt=""
                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-300"
                  />
                </PhotoView>
              </PhotoProvider>
            </div>

            <ConversationHistoryFooter>
              <ConversationHistoryMessageTime>
                {CustomDate.format(item.created_at, "HH:mm a")}
              </ConversationHistoryMessageTime>
            </ConversationHistoryFooter>
          </ConversationHistoryMessageImageContent>
        );
      }

      return null;
    });
  }, [item]);

  return (
    <ConversationHistoryMessage>
      <ConversationHistoryMessageAvatar role={item.role}>
        {item.role === "user" ? <UserIcon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </ConversationHistoryMessageAvatar>

      <div className="flex flex-col gap-3">{renderContent()}</div>
    </ConversationHistoryMessage>
  );
}

export function ConversationHistoryMessage({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex gap-3", className)} {...rest} />;
}

export function ConversationHistoryFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex gap-2 items-center", className)} {...rest} />;
}

export function ConversationHistoryMessageTime({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-xs text-muted-foreground lowercase", className)} {...rest} />;
}

export function ConversationHistoryMessageContentWrapper({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1", className)} {...rest} />;
}

export function ConversationHistoryMessageAvatar({
  className,
  role,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { role: HistoryConversationMessage["role"] }) {
  return (
    <div
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[#292E32]",
        {
          "bg-[#EEF0F2] dark:bg-background-surface-highest dark:text-foreground ": role === "user",
          "bg-[#F0EEEA] text-primary dark:bg-background-surface-highest": role === "assistant",
        },
        className,
      )}
      {...rest}
    />
  );
}

export function ConversationHistoryMessageTextContent({
  className,
  role,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { role: HistoryConversationMessage["role"] }) {
  return (
    <div
      className={cn(
        "flex-1 p-3 rounded-2xl text-sm text-foreground",
        {
          "bg-[#EEF0F2] italic dark:bg-background-surface dark:text-foreground": role === "user",
          "bg-[#F0EEEA] dark:bg-background-surface-high dark:text-foreground dark:hover:bg-background-surface-highest":
            role === "assistant",
        },
        className,
      )}
      {...rest}
    />
  );
}

export function ConversationHistoryMessageImageContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1", className)} {...rest} />;
}

export function ConversationHistoryAudioPlayer({
  className,
  path,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { path?: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const onPlay = () => {
    setIsPlaying(true);
  };

  const onPause = () => {
    setIsPlaying(false);
  };

  const onLoad = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    e.currentTarget.play();
  };

  const toggleAudio = () => {
    if (audioRef.current?.paused) {
      audioRef.current?.play();
    } else {
      audioRef.current?.pause();
    }
  };

  const fetchAudioFile = async () => {
    if (!path) return;

    const fileName = path.split("/")[path.split("/").length - 1];

    const binary = await readFile("audio/" + fileName, {
      baseDir: BaseDirectory.Cache,
    });

    return URL.createObjectURL(new Blob([binary]));
  };

  const fetchOrPlayAudioFile = async () => {
    if (!path) return;

    if (audioFile) {
      toggleAudio();
      return;
    }

    try {
      const url = await fetchAudioFile();

      if (!url) throw new Error("Failed to fetch audio file");

      setAudioFile(url);
    } catch {
      console.error("Failed to fetch audio file");
    }
  };

  return (
    <div className={cn("w-5 h-5", className)} {...rest}>
      <Button
        variant="ghost"
        size="icon"
        onClick={fetchOrPlayAudioFile}
        className="w-5 h-5 p-0 [&_svg]:size-3 text-muted-foreground"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </Button>

      {audioFile && (
        <audio
          controls
          ref={audioRef}
          onPlay={onPlay}
          onPause={onPause}
          onLoadedData={onLoad}
          className="hidden pointer-events-none opacity-0"
        >
          <source src={audioFile} type="audio/wav" />
        </audio>
      )}
    </div>
  );
}

function MessageCopyButton({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const [_, copy] = useCopyToClipboard();

  const onCopy = useCallback(() => {
    copy(text);
    setIsCopied(true);
  }, [text, copy]);

  useEffect(() => {
    let timeout: number | undefined;
    if (isCopied) {
      // @ts-ignore
      timeout = setTimeout(() => {
        setIsCopied(false);
      }, 1000);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isCopied]);

  return (
    <Button variant="ghost" size="icon" className="w-5 h-5 [&_svg]:size-3 p-0 text-muted-foreground" onClick={onCopy}>
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
