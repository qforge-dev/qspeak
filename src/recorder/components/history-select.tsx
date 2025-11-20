import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel } from "@renderer/components/select";
import { Clock } from "lucide-react";
import {
  ChatCompletionTextMessage,
  HistoryConversation,
  isTextMessageContent,
} from "@renderer/hooks/useConversationState";
import { useTranslation } from "react-i18next";
import { useAppState } from "@renderer/hooks/useAppState";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@renderer/components/tooltip";
import { Button } from "@renderer/components/button";
import * as SelectPrimitive from "@radix-ui/react-select";
import { motion, AnimatePresence } from "motion/react";

export function HistorySelect() {
  const { state, loadHistoryConversation, hasConversationStarted, getHistoryForPersona } = useAppState();
  const { t } = useTranslation();

  const history = useMemo(() => {
    if (!state) return [];

    const history = getHistoryForPersona(state.context.active_persona?.name ?? "Default");

    return history.slice(0, 4);
  }, [state?.context.active_persona?.name, getHistoryForPersona]);

  const onConversationClick = (conversation_id: string) => {
    loadHistoryConversation(conversation_id);
  };

  return (
    <Select onValueChange={onConversationClick} value={undefined}>
      <TooltipProvider>
        <Tooltip>
          <AnimatePresence>
            {hasConversationStarted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 5 }}
                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                }}
              >
                <SelectPrimitive.Trigger asChild>
                  <TooltipTrigger asChild>
                    <Button size="xxs" variant="ghost" className="text-foreground/50 ">
                      <Clock />
                    </Button>
                  </TooltipTrigger>
                </SelectPrimitive.Trigger>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <TooltipContent>{t("recentChats")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-xs text-muted-foreground/80 pl-2">{t("recentChats")}</SelectLabel>
          {history.map((conversation) => (
            <HistorySelectItem key={conversation.id} conversation={conversation} />
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function HistorySelectItem({ conversation }: { conversation: HistoryConversation }) {
  const firstUserMessage = conversation.conversation.find(
    (message) => message.role === "user",
  ) as ChatCompletionTextMessage;

  if (!firstUserMessage) return null;

  return (
    <SelectItem value={conversation.id} indicator={false} className="max-w-[230px] line-clamp-1 leading-[24px]">
      {conversation.title ??
        firstUserMessage.content.find((content) => isTextMessageContent(content))?.text ??
        "No messages"}
    </SelectItem>
  );
}
