import { Label } from "@renderer/components/label";
import { RadioGroup, RadioGroupItem } from "@renderer/components/radio-group";
import { useAppState } from "@renderer/hooks/useAppState";
import { usePersonas } from "@renderer/hooks/usePersonas";
import { Persona, PersonasState } from "@renderer/shared/types";
import { cn } from "@renderer/utils/cn";
import * as SelectPrimitive from "@radix-ui/react-select";
import { forwardRef, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RecordStatus } from "./recorder.components";
import { RecordingStatus } from "../recorder.reducer";
import { Select, SelectContent, SelectItem } from "@renderer/components/select";
import { ChevronDown } from "lucide-react";

export interface PersonasSelectProps {
  personas: PersonasState;
  onSelectPersona: (personaId: string | null) => void;
}

export function PersonasSelect({ personas, onSelectPersona }: PersonasSelectProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(
    personas.currentPersonaId ? personas.personas.find((p) => p.id === personas.currentPersonaId)!.id : null,
  );

  const onValueChange = (value: string | null) => {
    setSelectedPersona(value);
    onSelectPersona(value);
  };

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey && /^[1-9]$/.test(event.key)) {
      event.preventDefault();

      const digit = parseInt(event.key);

      if (digit === 1) {
        onValueChange(null);
        return;
      }

      const index = digit - 2;
      const targetPersona = personas.personas[index];
      if (targetPersona) {
        onValueChange(targetPersona.id);
      }
      return;
    }

    if (event.key === "Enter") {
      onValueChange(selectedPersona);
    }
  }

  function onClick(e: React.MouseEvent<HTMLLabelElement>) {
    if (e.type === "click" && e.clientX !== 0 && e.clientY !== 0) {
      const value = e.currentTarget.getAttribute("data-value");

      onValueChange(value === "null" ? null : value);
    }
  }

  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  useEffect(() => {
    setSelectedPersona(
      personas.currentPersonaId ? personas.personas.find((p) => p.id === personas.currentPersonaId)!.id : null,
    );
  }, [personas.currentPersonaId]);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedPersona]);

  return (
    <div className={cn("rounded-xl z-50 pl-0 pr-2 py-0 grow overflow-y-auto", "flex flex-col gap-2 scrollbar-custom")}>
      <RadioGroup
        autoFocus
        value={selectedPersona ?? "null"}
        className="gap-1"
        onValueChange={onValueChange}
        onKeyDown={onKeyDown}
      >
        <PersonaItem
          key="null"
          persona={null}
          isSelected={selectedPersona === null}
          ref={selectedPersona === null ? ref : null}
          onClick={onClick}
        />
        {personas?.personas?.map((persona) => (
          <PersonaItem
            key={persona.id}
            persona={persona}
            isSelected={persona.id === personas.currentPersonaId}
            ref={persona.id === personas.currentPersonaId ? ref : null}
            onClick={onClick}
          />
        ))}
      </RadioGroup>
    </div>
  );
}

const PersonaItem = forwardRef<
  HTMLButtonElement,
  {
    persona: Persona | null;
    isSelected: boolean;
    onClick?: (e: React.MouseEvent<HTMLLabelElement>) => void;
  }
>(({ persona, isSelected, onClick }, ref) => {
  const { t } = useTranslation();
  return (
    <Label
      onClick={onClick}
      data-value={persona?.id ?? "null"}
      htmlFor={persona?.id ?? "null"}
      className={cn(
        "cursor-pointer flex items-center space-x-2 w-full justify-between px-2 py-2 rounded-lg hover:bg-background-surface transition",
        {
          "bg-background-surface": isSelected,
        },
      )}
    >
      <div className="flex items-center gap-1 text-foreground">
        {/* <FooterButtonShortcut className="w-fit whitespace-nowrap">
          {getShortcut(["ctrl", `${index + 1}`]).getKeysIcons()}
        </FooterButtonShortcut> */}
        {persona?.name ?? t("noPersona")}
      </div>

      <RadioGroupItem value={persona?.id ?? "null"} id={persona?.id ?? "null"} ref={ref} />
    </Label>
  );
});

export function PersonaFooterButton({ status }: { status: RecordingStatus }) {
  const { t } = useTranslation();
  const { state: appState } = useAppState();
  const { state: personasState, changePersona } = usePersonas();

  if (!appState || !personasState) return null;

  const onValueChange = (value: string | null) => {
    changePersona(value);
  };

  return (
    <Select onValueChange={onValueChange} value={appState?.context.active_persona?.id} disabled={status !== "idle"}>
      <SelectPrimitive.Trigger>
        <div className="flex items-center gap-1 text-foreground py-0.5 px-2 bg-teal/10 dark:bg-teal/10 rounded-full border border-teal/20 hover:bg-teal/20 dark:hover:bg-teal/20">
          <RecordStatus status={status} className="w-1.5 h-1.5 mr-1" />
          <div className="text-xs text-teal font-medium">
            {personasState?.context.personas.find((persona) => persona.id === appState?.context.active_persona?.id)
              ?.name ?? t("noPersona")}
          </div>

          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-3 w-3 text-teal opacity-50" />
          </SelectPrimitive.Icon>
        </div>
      </SelectPrimitive.Trigger>
      <SelectContent>
        <SelectItem key="null" value="null">
          {t("noPersona")}
        </SelectItem>

        {personasState?.context.personas.map((persona) => (
          <SelectItem key={persona.id} value={persona.id}>
            {persona.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
