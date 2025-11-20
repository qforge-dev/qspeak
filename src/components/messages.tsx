import React, { useCallback, useEffect, useState } from "react";
import { ChatCompletionToolCall } from "@renderer/hooks/useConversationState";
import { ChevronRight, FileTextIcon, ListIcon, Search, FolderPlus, Columns3, Code2, FolderSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@renderer/utils/cn";
import { Button } from "@renderer/components/button";
import { CopyIcon, CheckIcon } from "lucide-react";
import { useCopyToClipboard } from "usehooks-ts";
import { Markdown } from "@renderer/components/markdown";
import {
  ChatCompletionMessageImageContent,
  ChatCompletionMessageTextContent,
  ChatCompletionToolCallMessage,
  ChatCompletionToolCallResultMessage,
} from "@renderer/hooks/useConversationState";

export function AssistantTextMessage({
  message,
  createdAt,
}: {
  message: ChatCompletionMessageTextContent;
  createdAt: string | null;
}) {
  return (
    <TextMessageWrapper>
      <Markdown>{message.text}</Markdown>

      <TextMessageFooter>
        <MessageCreatedAt>{createdAt}</MessageCreatedAt>

        <MessageCopyButton message={message} />
      </TextMessageFooter>
    </TextMessageWrapper>
  );
}

export function UserTextMessage({
  message,
  createdAt,
}: {
  message: ChatCompletionMessageTextContent;
  createdAt: string | null;
}) {
  return (
    <TextMessageWrapper className="my-3" key={message.text}>
      <UserMessageText className="text-gray-500 dark:text-foreground/60">{message.text}</UserMessageText>

      <TextMessageFooter>
        <MessageCreatedAt>{createdAt}</MessageCreatedAt>

        <MessageCopyButton message={message} />
      </TextMessageFooter>
    </TextMessageWrapper>
  );
}

export function ToolCallsMessages({
  message,
  toolResponse,
}: {
  message: ChatCompletionToolCallMessage;
  toolResponse: (id: string) => React.ReactNode;
}) {
  return (
    <div className="my-0 mb-3">
      {message.tool_calls.map((toolCall) => (
        <ToolCallMessage key={toolCall.id} toolCall={toolCall} toolResponse={toolResponse} />
      ))}
    </div>
  );
}

export function ToolMessage({}: { message: ChatCompletionToolCallResultMessage }) {
  return null;
}

export function ImageMessage({ message }: { message: ChatCompletionMessageImageContent }) {
  const { t } = useTranslation("recorder");

  return (
    <img
      key={message.image_url.url}
      className="my-2 w-[150px] h-[60px] object-cover hover:scale-105 transition-all"
      src={message.image_url.url}
      alt={t("image")}
    />
  );
}

function TextMessageWrapper({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "group relative bg-transparent py-1 rounded-xl text-foreground w-fit min-w-[300px] max-w-[90%] transition-all duration-100",
        className,
      )}
      {...rest}
    />
  );
}

function TextMessageFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 mt-0.5 group-hover:visible", className)} {...rest} />;
}

function MessageCreatedAt({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("text-gray-500 dark:text-gray-400 text-xs font-light mt-0.5", className)} {...rest} />;
}

export function UserMessageText({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-foreground/80 whitespace-pre-wrap", className)} {...props} />;
}

export function ToolCallMessage({
  toolCall,
  toolResponse,
}: {
  toolCall: ChatCompletionToolCall;
  toolResponse: (id: string) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="rounded-xl text-sm bg-neutral-200/10 dark:bg-neutral-800/30 border border-primary/10 max-w-[90%]">
      <div
        className={cn(
          "py-2 px-3 cursor-pointer flex items-center gap-2 justify-between text-emerald-500 dark:text-emerald-400/80",
          {
            "border-b border-input": isOpen,
          },
        )}
        onClick={toggleOpen}
      >
        <div className="flex items-center gap-2">
          {resolveToolCallIcon(toolCall)}
          <span>{toolCall.function.name}</span>
        </div>

        <ChevronRight className={cn("size-4 text-neutral-500 dark:text-white", { "rotate-90": isOpen })} />
      </div>

      <div
        className={cn(
          "bg-neutral-300 dark:bg-black/30 w-full p-2 text-xs text-foreground dark:text-muted-foreground/90",
          {
            hidden: !isOpen,
          },
        )}
      >
        {toolResponse(toolCall.id)}
      </div>
    </div>
  );
}

export function resolveToolCallIcon(toolCall: ChatCompletionToolCall) {
  switch (toolCall.function.name) {
    case "read_graph":
      return <Columns3 className="size-3" />;
    case "add_observations":
      return <FolderPlus className="size-3" />;
    case "add_nodes":
      return <FileTextIcon className="size-3" />;
    case "search_nodes":
      return <FolderSearch className="size-3" />;
    case "add_tasks":
      return <ListIcon className="size-3" />;
    case "firecrawl_search":
      return <Search className="size-3" />;
    default:
      return <Code2 className="size-3" />;
  }
}

function MessageCopyButton({ message }: { message: ChatCompletionMessageTextContent }) {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const [_, copy] = useCopyToClipboard();

  const onCopy = useCallback(() => {
    copy(message.text);
    setIsCopied(true);
  }, [message.text, copy]);

  useEffect(() => {
    let timeout: number | undefined;
    if (isCopied) {
      //@ts-ignore
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
    <Button
      variant="ghost"
      size="icon"
      className="w-5 h-5 [&_svg]:size-3 text-foreground/80"
      onClick={onCopy}
      title={isCopied ? t("copied") : t("copy")}
    >
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
