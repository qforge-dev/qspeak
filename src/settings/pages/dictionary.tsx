import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/button";
import { Input, SearchInput } from "@renderer/components/input";
import { CardDescription } from "@renderer/components/card";
import { SettingsCardTitle } from "../components/cards";
import { RouteWrapper } from "../components/layout";
import { Trash2 } from "lucide-react";
import { invokeEvent, useAppState } from "@renderer/hooks/useAppState";
import { HistoryHeading, HistoryHeader, HistoryMain } from "../components/history/history-layout";

export function DictionaryPage() {
  const { state } = useAppState();
  const { t } = useTranslation();
  const [newItem, setNewItem] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const handleAddItem = () => {
    if (newItem.trim() !== "") {
      invokeEvent("ActionAddDictionaryItem", newItem.trim());
      setNewItem("");
    }
  };

  const handleDeleteItem = (term: string) => {
    invokeEvent("ActionDeleteDictionaryItem", term);
  };

  const onClear = () => {
    setSearchTerm("");
  };

  const filteredItems =
    state?.context.conversation_context.dictionary.filter((item) =>
      item.toLowerCase().includes(searchTerm.toLowerCase()),
    ) ?? [];

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-2 user-select-none cursor-grab" data-tauri-drag-region>
        <div className="flex justify-between items-center">
          <div>
            <HistoryHeading>{t("Custom Dictionary")}</HistoryHeading>

            <CardDescription className="mt-1 max-w-lg">
              {t("qSpeak uses your dictionary to better understand your voice.")}
            </CardDescription>
            <CardDescription className="mt-1 max-w-lg">
              {t("You can manually add words that qSpeak may not recognize easily like names or slang.")}
            </CardDescription>
          </div>

          <div className="flex flex-col items-end">
            <CardDescription className="text-xs font-semibold">Added Words</CardDescription>
            <span className="text-xl font-semibold text-primary">
              {state?.context.conversation_context.dictionary.length}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full mt-6">
          <SettingsCardTitle className="w-fit whitespace-nowrap">{t("Add New Terms")}</SettingsCardTitle>
          <div className="flex items-center space-x-2 grow justify-start">
            <Input
              type="text"
              placeholder={t("Term...")}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              size="sm"
              variant="secondary"
              className="w-[40%]"
            />
            <Button onClick={handleAddItem} size="sm" className="w-[70px]">
              {t("+ Add")}
            </Button>
          </div>
        </div>
      </HistoryHeader>

      <RouteWrapper className="grow">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between items-center mb-4">
            <div>
              <SettingsCardTitle>{t("Dictionary Terms")}</SettingsCardTitle>
              <CardDescription>
                {filteredItems.length} {t("terms")}
              </CardDescription>
            </div>

            <SearchInput
              placeholder={t("Search terms...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              wrapperClassName="max-w-[250px] w-full"
              size="sm"
              onClear={onClear}
            />
          </div>
          <div className="max-h-[calc(100vh-300px)]">
            {filteredItems.length > 0 ? (
              <div className="">
                <div className="flex items-center justify-between text-xs text-muted-foreground py-2 pr-1">
                  <span className="flex-1">{t("Terms")}</span>
                  <span className="w-20 text-right">{t("Actions")}</span>
                </div>

                <ul className="flex flex-col gap-2 overflow-y-auto max-h-[325px] pr-1 scrollbar-custom">
                  {filteredItems.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="flex items-center justify-between bg-background-surface rounded-xl px-3 py-2 hover:bg-background-surface-high p-2"
                    >
                      <span className="flex-1 truncate text-sm" title={item}>
                        {item}
                      </span>
                      <div className="flex space-x-1 w-20 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item)} className="h-7 w-7">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">
                {t("No terms added yet, or no terms match your search.")}
              </p>
            )}
          </div>
        </div>
      </RouteWrapper>
    </HistoryMain>
  );
}
