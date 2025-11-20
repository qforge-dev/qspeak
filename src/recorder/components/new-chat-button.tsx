import { Button } from "@renderer/components/button";
import { Edit } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@renderer/components/tooltip";
import { useAppState } from "@renderer/hooks/useAppState";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";

export function NewChatButton() {
  const { hasConversationStarted, startNewConversation } = useAppState();
  const { t } = useTranslation();

  return (
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
                delay: 0.1,
              }}
            >
              <TooltipTrigger asChild>
                <Button size="xxs" variant="ghost" className="text-foreground/40" onClick={startNewConversation}>
                  <Edit />
                </Button>
              </TooltipTrigger>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <TooltipContent>{t("startNewConversation")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
