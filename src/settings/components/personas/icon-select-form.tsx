import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SearchInput } from "@renderer/components/input";
import { PersonaIcon } from "@renderer/icons/icons-registry.personas";
import { personasIconsRegistry } from "@renderer/icons/icons-registry.personas";
import { Button } from "@renderer/components/button";
import { EmptyMessage } from "@renderer/components/items-list";
import { useTranslation } from "react-i18next";

interface IconSelectFormProps {
  onSave: (icon: keyof typeof personasIconsRegistry) => void;
  defaultIcon?: keyof typeof personasIconsRegistry | null;
}

export function IconSelectForm({ onSave, defaultIcon }: IconSelectFormProps) {
  const { t } = useTranslation();

  const [icon, setIcon] = useState<keyof typeof personasIconsRegistry | null>(defaultIcon ?? null);
  const [search, setSearch] = useState<string>("");

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const onClear = () => {
    setSearch("");
  };

  const filteredIcons = Object.entries(personasIconsRegistry).filter(([key]) =>
    key.toLowerCase().includes(search.toLowerCase()),
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!icon) {
      return;
    }

    onSave(icon);
  };

  const isSelected = (name: string) => {
    return name === icon;
  };

  return (
    <form className="flex flex-col gap-5" id="icon-select-form" onSubmit={onSubmit}>
      <SearchInput value={search} onChange={onSearchChange} onClear={onClear} placeholder="Search..." />

      <div className="max-h-[200px] min-h-[200px] overflow-y-auto scrollbar-custom">
        <div className="flex flex-wrap gap-3 justify-center items-start h-fit">
          <AnimatePresence mode="popLayout">
            {filteredIcons.length > 0 ? (
              filteredIcons.map(([key, _]) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  layout
                >
                  <Button
                    variant={isSelected(key) ? "default" : "surface"}
                    size="icon"
                    className="p-0 rounded-xl cursor-pointer"
                    type="button"
                    onClick={() => setIcon(key)}
                  >
                    <PersonaIcon icon={key} />
                  </Button>
                </motion.div>
              ))
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <EmptyMessage>{t("NoIconsFound")}</EmptyMessage>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </form>
  );
}
