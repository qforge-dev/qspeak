import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchInput } from "@renderer/components/input";
import {
  ConversationSidebarBody,
  ConversationSidebarFooter,
  ConversationSidebarHeader,
  ConversationsSidebar,
} from "../components/history/conversations-sidebar";
import { HistoryHeader, HistoryHeading, HistoryMain, HistoryWrapper } from "../components/history/history-layout";
import { ConversationHistoryMessages } from "../components/history/conversation-messages";
import {
  ConversationHistoryItemHeading,
  ConversationHistoryItemTime,
  ConversationHistoryItem,
  ConversationHistoryList,
  ConversationHistoryItemPersona,
} from "../components/history/conversation-history-list";
import {
  HistoryConversationProvider,
  useHistoryConversation,
} from "../components/history/history-conversation-provider";
import { useStateContext } from "@renderer/hooks/useNewState";
import { isTextMessageContent } from "@renderer/hooks/useConversationState";
import { EmptyMessage } from "@renderer/components/items-list";
import { Button } from "@renderer/components/button";
import { Trash, TrashIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@renderer/components/alert-dialog";
import { CardDescription } from "@renderer/components/card";
import { useAppState } from "@renderer/hooks/useAppState";
import { Carousel, CarouselContent, CarouselItem } from "@renderer/components/carousel";
import { cn } from "@renderer/utils/cn";

export function History() {
  return (
    <HistoryConversationProvider>
      <ConversationHistory />
    </HistoryConversationProvider>
  );
}

function ConversationHistory() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [personaFilter, setPersonaFilter] = useState<string | null>(null);
  const { conversation, setConversation } = useHistoryConversation();
  const { state } = useStateContext();
  const { clearHistory, deleteHistory } = useAppState();

  const history = useMemo(() => [...(state?.history_context?.history ?? [])].reverse(), [state?.history_context]);

  useEffect(() => {
    if (!conversation?.id && history && history.length > 0) {
      setConversation(history[0]);
    }
  }, [history?.length, conversation?.id]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const onClear = () => {
    setSearch("");
  };

  const filteredHistory = useMemo(() => {
    if (!search && !personaFilter) return history;

    return history?.filter(
      (item) =>
        item.conversation.some(
          (message) =>
            message.role === "tool" ||
            "tool_calls" in message ||
            message.content.some(
              (content) =>
                (isTextMessageContent(content) && content.text.toLowerCase().includes(search.toLowerCase())) ||
                content.type === "image_url",
            ),
        ) && (personaFilter ? item.persona_name === personaFilter : true),
    );
  }, [history, search, personaFilter]);

  const changeCurrentConversation = () => {
    if (history && history.length > 0) {
      setConversation(history[0]);
    } else {
      setConversation(null);
    }
  };

  const onAll = () => {
    setPersonaFilter(null);
  };

  const onPersonaFilter = (name: string) => {
    setPersonaFilter(name);
  };

  const onClearHistory = () => {
    clearHistory();
    setConversation(null);
  };

  return (
    <HistoryWrapper>
      <ConversationsSidebar>
        <ConversationSidebarHeader>
          <div className="px-3">
            <SearchInput
              size="sm"
              placeholder={t("SearchConversations")}
              value={search}
              onChange={onChange}
              onClear={onClear}
            />
          </div>

          <Carousel className="mt-2 pl-3 user-select-none" opts={{ dragFree: true }}>
            <CarouselContent className="-ml-1">
              <CarouselItem className="basis-1/5 pl-1">
                <Button fullWidth size="xs" variant={personaFilter === null ? "default" : "outline"} onClick={onAll}>
                  {t("All")}
                </Button>
              </CarouselItem>

              {state?.personas_context.personas.map((persona) => (
                <CarouselItem
                  key={persona.id}
                  className={cn("pl-1", {
                    "basis-1/4": persona.name.length < 6,
                    "basis-1/3": persona.name.length >= 6,
                    "basis-1/2": persona.name.length >= 14,
                  })}
                >
                  <Button
                    fullWidth
                    size="xs"
                    className="whitespace-nowrap truncate line-clamp-1 user-select-none"
                    variant={personaFilter === persona.name ? "default" : "outline"}
                    onClick={() => onPersonaFilter(persona.name)}
                  >
                    {persona.name}
                  </Button>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </ConversationSidebarHeader>

        <ConversationSidebarBody>
          <ConversationHistoryList
            emptyText={
              <EmptyMessage className="block p-3 text-muted-foreground italic text-center">
                {t("NoConversationsFound")}
              </EmptyMessage>
            }
            items={filteredHistory ?? []}
            renderItem={(item) => {
              const isActive = conversation?.id === item.id;
              const onClick = () => setConversation(item);
              const onDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                deleteHistory(item.id);
                changeCurrentConversation();
              };

              return (
                <ConversationHistoryItem isActive={isActive} onClick={onClick} className="group">
                  <div className="flex gap-2 items-center justify-between">
                    <ConversationHistoryItemHeading conversation={item} />

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0 h-5 w-5 shrink-0 text-muted-foreground [&_svg]:size-3"
                        >
                          <TrashIcon />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("AreYouAbsolutelySure")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("DeleteConversationWarning")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={onDelete}>{t("Continue")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="flex gap-2 items-center justify-between">
                    <ConversationHistoryItemTime conversation={item} />
                    <ConversationHistoryItemPersona>
                      {item.persona_name ?? t("NoPersona")}
                    </ConversationHistoryItemPersona>

                    {/* <div className="bg-primary/20 text-primary rounded-lg px-1 py-0.5 text-xs font-semibold">123</div> */}
                  </div>
                </ConversationHistoryItem>
              );
            }}
          />
        </ConversationSidebarBody>

        <ConversationSidebarFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="rounded-lg text-sm [&_svg]:size-3 text-xs text-muted-foreground"
              >
                <Trash className="size-4" />
                {t("ClearHistory")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("AreYouAbsolutelySure")}</AlertDialogTitle>
                <AlertDialogDescription>{t("ClearHistoryWarning")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onClearHistory}>{t("Clear")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </ConversationSidebarFooter>
      </ConversationsSidebar>

      <HistoryMain className="bg-white dark:bg-background">
        <HistoryHeader className="pb-2 flex items-center justify-between">
          <div>
            <HistoryHeading>{t("History")}</HistoryHeading>
            <CardDescription>{t("browseConversations")}</CardDescription>
          </div>

          {conversation ? (
            <div className="flex flex-col items-end">
              <CardDescription className="text-xs font-semibold">{t("Messages")}</CardDescription>
              <span className="text-xl font-semibold text-primary">{conversation?.conversation.length}</span>
            </div>
          ) : null}
        </HistoryHeader>

        {conversation?.conversation.length ? (
          <ConversationHistoryMessages className="p-4 mt-3 mb-4" items={conversation?.conversation ?? []} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <EmptyMessage className="block p-3 text-muted-foreground italic text-center">
              {t("NoMessagesFound")}
            </EmptyMessage>
          </div>
        )}
      </HistoryMain>
    </HistoryWrapper>
  );
}
