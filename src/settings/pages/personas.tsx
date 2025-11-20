import { Button } from "@renderer/components/button";
import { useAppState } from "@renderer/hooks/useAppState";
import { Persona, usePersonas } from "@renderer/hooks/usePersonas";
import { cn } from "@renderer/utils/cn";
import { ClipboardPaste, MoreVertical, Plus, Speech } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";

import { HistoryHeader, HistoryHeading, HistoryMain } from "../components/history/history-layout";
import { SearchInput } from "@renderer/components/input";
import { EmptyMessage } from "@renderer/components/items-list";

import { CardDescription } from "@renderer/components/card";
import { SettingsCard, SettingsCardContent } from "../components/cards";
import { BasicLink } from "@renderer/components/basic-link";
import { RouteWrapper } from "../components/layout";
import { ModelsFilters, ModelsFiltersWrapper } from "../components/models/models-filters";
import {
  PersonaCard,
  PersonaCardContent,
  PersonaCardDescription,
  PersonaCardDetail,
  PersonaCardDetails,
  PersonaCardHeader,
  PersonaCardHeaderContent,
  PersonaCardIcon,
  PersonaCardTitle,
} from "../components/personas/personas-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@renderer/components/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogDescription,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@renderer/components/alert-dialog";
import { useTransitionNavigate } from "@renderer/hooks/useNavigate";
import { PersonaIcon } from "@renderer/icons/icons-registry.personas";

type TypeFilter = "all" | "voice_command" | "paste_on_finish";

export function Personas() {
  const { state } = useAppState();
  const { state: personasState, changePersona, deletePersona, duplicatePersona } = usePersonas();
  const navigate = useTransitionNavigate();

  const { t } = useTranslation();

  const [filter, setFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState<string>("");

  const onFilterChange = (value: string) => {
    setFilter(value as TypeFilter);
  };

  const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const onClear = () => {
    setSearch("");
  };

  const onEditPersona = (persona: Persona) => {
    navigate(`/personas/edit/${persona.id}`);
  };

  const handleDeletePersona = (id: string) => {
    deletePersona(id);

    removeBodyPointerEvents();
  };

  const onDuplicatePersona = (persona: Persona) => {
    duplicatePersona(persona);
  };

  const removeBodyPointerEvents = () => {
    if (!!document) {
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 200);
    }
  };

  const filteredPersonas = useMemo(() => {
    return (personasState?.context.personas ?? [])
      .filter((persona) => {
        if (filter === "all") return true;
        if (filter === "voice_command" && persona.voice_command.length > 0) return true;
        if (filter === "paste_on_finish" && persona.paste_on_finish) return true;

        return false;
      })
      .filter((persona) => {
        if (search === "") return true;
        return (
          persona.name.toLowerCase().includes(search.toLowerCase()) ||
          persona.description?.toLowerCase().includes(search.toLowerCase())
        );
      });
  }, [personasState?.context.personas, search, filter]);

  const isSelected = (id: string) => {
    return state?.context.active_persona?.id === id;
  };

  const onChangePersona = (id: string) => {
    return () => {
      changePersona(id);
    };
  };

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-0 select-none cursor-grab" data-tauri-drag-region>
        <div className="flex items-center justify-between">
          <div>
            <HistoryHeading>{t("Personas")}</HistoryHeading>
            <CardDescription className="mt-1 max-w-lg" data-tauri-drag-region>
              {t("ManagePersonasDescription1")}
            </CardDescription>
            <CardDescription className="max-w-lg" data-tauri-drag-region>
              {t("ManagePersonasDescription2")}
            </CardDescription>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus /> {t("AddNewPersona")}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-[200px]" align="end">
              <DropdownMenuItem asChild>
                <BasicLink to="/personas/add">{t("FromScratch")}</BasicLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("Templates")}</DropdownMenuLabel>

              {state?.context.default_personas_context.personas.map((persona) => {
                return (
                  <DropdownMenuItem key={persona.id} className="[&>svg]:size-3.5" asChild>
                    <BasicLink to="/personas/add" state={{ persona }}>
                      <PersonaIcon icon={persona.icon} />
                      {persona.name}
                    </BasicLink>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </HistoryHeader>

      <RouteWrapper>
        <SettingsCard>
          <SettingsCardContent className="p-3">
            <CardDescription>{t("PersonasTip")}</CardDescription>
          </SettingsCardContent>
        </SettingsCard>

        <ModelsFiltersWrapper>
          <ModelsFilters>
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => onFilterChange("all")}>
              {t("All")}
            </Button>
            <Button
              variant={filter === "voice_command" ? "default" : "outline"}
              size="sm"
              className="[&_svg]:size-3.5"
              onClick={() => onFilterChange("voice_command")}
            >
              <Speech />
              {t("VoiceCommand")}
            </Button>
            <Button
              variant={filter === "paste_on_finish" ? "default" : "outline"}
              size="sm"
              className="[&_svg]:size-3.5"
              onClick={() => onFilterChange("paste_on_finish")}
            >
              <ClipboardPaste />
              {t("PasteOnFinish")}
            </Button>
          </ModelsFilters>

          <SearchInput
            size="sm"
            wrapperClassName="max-w-[200px]"
            placeholder={t("Search...")}
            value={search}
            onChange={onSearchChange}
            onClear={onClear}
          />
        </ModelsFiltersWrapper>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[405px] pr-1 scrollbar-custom overflow-x-hidden">
          <AnimatePresence mode="popLayout">
            {filteredPersonas.length > 0 ? (
              filteredPersonas.map((persona) => {
                return (
                  <motion.div
                    key={persona.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    layout
                  >
                    <PersonaCard onClick={onChangePersona(persona.id)} isActive={isSelected(persona.id)}>
                      <PersonaCardHeader>
                        <PersonaCardIcon>
                          <PersonaIcon icon={persona.icon} className="size-4" />
                        </PersonaCardIcon>

                        <PersonaCardHeaderContent>
                          <div className="flex items-center gap-2">
                            <PersonaCardTitle>{persona.name}</PersonaCardTitle>

                            {persona.paste_on_finish ? (
                              <ClipboardPaste className="size-3 text-secondary mb-0.5" />
                            ) : null}
                          </div>

                          <PersonaCardDescription className={cn("line-clamp-2", { italic: !persona.description })}>
                            {persona.description || persona.system_prompt || t("PersonaNoDescriptionAvailable")}
                          </PersonaCardDescription>

                          {/* <PersonaCardDescription className={cn("line-clamp-2", { italic: !persona.description })}>
                            {persona.system_prompt || persona.system_prompt || t("PersonaNoDescriptionAvailable")}
                          </PersonaCardDescription> */}

                          <PersonaCardDetails>
                            {persona.voice_command ? (
                              <PersonaCardDetail
                                title={persona.voice_command}
                                className="italic flex gap-1 items-center "
                              >
                                <Speech />
                                {persona.voice_command}
                              </PersonaCardDetail>
                            ) : null}
                          </PersonaCardDetails>
                        </PersonaCardHeaderContent>
                      </PersonaCardHeader>

                      <PersonaCardContent>
                        {/* <Switch checked={isSelected(persona.id)} onCheckedChange={onChangePersona(persona.id)} /> */}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => onEditPersona(persona)}>{t("Edit")}</DropdownMenuItem>

                            <DropdownMenuItem onClick={() => onDuplicatePersona(persona)}>
                              {t("Duplicate")}
                            </DropdownMenuItem>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>{t("Delete")}</DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("AreYouAbsolutelySure")}</AlertDialogTitle>
                                  <AlertDialogDescription>{t("DeletePersonaWarning")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={removeBodyPointerEvents}>{t("Cancel")}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePersona(persona.id)}>
                                    {t("Delete")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </PersonaCardContent>
                    </PersonaCard>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <EmptyMessage className="text-center block">{t("NoPersonasFound")}</EmptyMessage>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </RouteWrapper>
    </HistoryMain>
  );
}
