import { Badge } from "@renderer/components/badge";
import { ItemListProps, ItemsList } from "@renderer/components/items-list";
import { HistoryConversation, isTextMessageContent } from "@renderer/hooks/useConversationState";
import { cn } from "@renderer/utils/cn";
import { CustomDate } from "@renderer/utils/custom-date";

export function ConversationHistoryList({ items, className, ...rest }: ItemListProps<HistoryConversation>) {
  return <ItemsList items={items} className={cn("flex flex-col divide-y", className)} {...rest} />;
}

export function ConversationHistoryItem({
  className,
  isActive,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { isActive: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 w-full p-3 hover:bg-background-surface transition min-h-[64px] cursor-pointer border-l-3 border-transparent",
        { "bg-background-surface border-primary": isActive, "border-transparent": !isActive },
        className,
      )}
      {...rest}
    />
  );
}

export function ConversationHistoryItemPersona({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Badge
      size="sm"
      className={cn("text-[10px] flex gap-1 items-center [&_svg]:size-3 px-1.5 line-clamp-1", className)}
      variant="surface"
      {...rest}
    />
  );
}

export function ConversationHistoryItemTime({
  className,
  conversation,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { conversation: HistoryConversation }) {
  return (
    <div className={cn("text-xs text-muted-foreground flex gap-1 ]", className)} {...rest}>
      <span>{CustomDate.format(conversation.created_at, "dd MMM")}</span>

      <span className="lowercase text-foreground">{CustomDate.format(conversation.created_at, "hh:mm a")}</span>
    </div>
  );
}

export function ConversationHistoryItemHeading({
  className,
  conversation,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { conversation: HistoryConversation }) {
  const firstTextMessage = conversation.conversation.find(
    (message) =>
      message.role === "user" && "content" in message && message.content.some((content) => content.type === "text"),
  );

  const content =
    firstTextMessage &&
    firstTextMessage.role !== "tool" &&
    "content" in firstTextMessage &&
    isTextMessageContent(firstTextMessage.content[0])
      ? (firstTextMessage.content[0].text ?? "No messages")
      : "No messages";

  return (
    <h4
      className={cn(
        "text-sm font-medium line-clamp-1 w-full text-foreground",
        {
          "italic text-xs text-muted-foreground": content.toLowerCase() === "no messages",
        },
        className,
      )}
      title={conversation.title ?? content}
      {...rest}
    >
      {conversation.title ?? content}
    </h4>
  );
}
