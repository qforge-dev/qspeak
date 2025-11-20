import { HistoryConversation } from "@renderer/hooks/useConversationState";
import { createContext, useContext, useState } from "react";

type HistoryConversationContextType = {
  conversation: HistoryConversation | null;
  setConversation: (conversation: HistoryConversation | null) => void;
};

const HistoryConversationContext = createContext<HistoryConversationContextType | undefined>(undefined);

export function HistoryConversationProvider({ children }: { children: React.ReactNode }) {
  const [conversation, setConversation] = useState<HistoryConversation | null>(null);

  const onConversationChange = (conversation: HistoryConversation | null) => {
    setConversation(conversation);
  };

  return (
    <HistoryConversationContext.Provider value={{ conversation, setConversation: onConversationChange }}>
      {children}
    </HistoryConversationContext.Provider>
  );
}

export function useHistoryConversation() {
  const context = useContext(HistoryConversationContext);
  if (!context) {
    throw new Error("useHistoryConversation must be used within a HistoryConversationProvider");
  }
  return context;
}
