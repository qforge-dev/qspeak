import { useCallback, useMemo } from "react";
import { RecorderPreviousConversations } from "../components/recorder.components";
import { useAppState } from "@renderer/hooks/useAppState";
import { useRecordingWindowState } from "@renderer/hooks/useRecordingWindowState";
import { ChatCompletionToolCallResultMessage, useConversationContext } from "@renderer/hooks/useConversationState";
import {
  AssistantTextMessage,
  ImageMessage,
  ToolCallsMessages,
  ToolMessage,
  UserTextMessage,
} from "@renderer/components/messages";

export function Root() {
  const { state } = useAppState();
  const { state: conversationState } = useConversationContext();
  const { state: recordingWindowState } = useRecordingWindowState();

  const hasUserMessage = conversationState?.context.conversation.some((message) => message.role === "user");

  const messages = useMemo(() => {
    return [
      ...(conversationState?.context.conversation || []).filter((message) => message.role !== "system"),
    ].reverse();
  }, [conversationState]);

  if (!conversationState || !state || !recordingWindowState) return null;

  const getToolCallContent = useCallback(
    (toolCallId: string) => {
      return (
        messages.find((m) => m.role === "tool" && m.tool_call_id === toolCallId) as ChatCompletionToolCallResultMessage
      )?.content;
    },
    [messages],
  );
  return (
    <>
      {hasUserMessage ? null : <RecorderPreviousConversations />}

      {messages.map((message) => {
        if ("tool_calls" in message) return <ToolCallsMessages message={message} toolResponse={getToolCallContent} />;

        if (message.role === "tool") return <ToolMessage message={message} />;

        return message.content.map((messageMessage) => {
          if (messageMessage.type === "image_url") return <ImageMessage message={messageMessage} />;

          const createdAt = new Date(message.created_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return message.role === "user" ? (
            <UserTextMessage message={messageMessage} createdAt={createdAt} />
          ) : (
            <AssistantTextMessage message={messageMessage} createdAt={createdAt} />
          );
        });
      })}
    </>
  );
}
