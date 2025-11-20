import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/button";
import { Plus, Trash2 } from "lucide-react";
import { useReducer } from "react";
import { SettingsCard, SettingsCardContent } from "../cards";
import { Persona, PersonaExample } from "@renderer/hooks/usePersonas";
import { CardDescription } from "@renderer/components/card";
import { Input } from "@renderer/components/input";
import { Textarea } from "@renderer/components/textarea";
import { Switch } from "@renderer/components/switch";
import { errorToast } from "@renderer/components/toasts";
import { PersonaIcon, personasIconsRegistry } from "@renderer/icons/icons-registry.personas";
import { PersonaCardIcon } from "./personas-list";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@renderer/components/dialog";
import { IconSelectForm } from "./icon-select-form";

type PersonasFormProps = {
  onSave: (data: Omit<Persona, "id"> & { id?: string }) => void;
  onCancel: () => void;
  defaultValues?: Persona;
};

export function PersonasForm({ onSave, onCancel, defaultValues }: PersonasFormProps) {
  const { t } = useTranslation();

  const [state, dispatch] = useReducer(toolFormReducer, {
    id: defaultValues?.id,
    name: defaultValues?.name || "",
    description: defaultValues?.description || "",
    system_prompt: defaultValues?.system_prompt || "",
    voice_command: defaultValues?.voice_command || "",
    paste_on_finish: defaultValues?.paste_on_finish || false,
    record_output_audio: defaultValues?.record_output_audio || false,
    icon: defaultValues?.icon || null,
    examples: defaultValues?.examples || [],
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!state.name) {
      errorToast(t("PersonaNameRequired"));
      return;
    }

    if (!state.system_prompt) {
      errorToast(t("SystemPromptRequired"));
      return;
    }

    onSave({
      ...defaultValues,
      ...state,
      icon: (state.icon as string) || "sparkle",
    });
  };

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setName(e.target.value));
  };

  const onDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setDescription(e.target.value));
  };

  const onSystemPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(setSystemPrompt(e.target.value));
  };

  const onVoiceCommandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setVoiceCommand(e.target.value));
  };

  const onPasteOnFinishChange = (checked: boolean) => {
    dispatch(setPasteOnFinish(checked));
  };

  const onIconSave = (icon: keyof typeof personasIconsRegistry) => {
    dispatch(setIcon(icon));
  };

  const onRecordOutputAudioChange = (checked: boolean) => {
    dispatch(setRecordOutputAudio(checked));
  };

  const onAddExample = () => {
    dispatch(addExample({ question: "", answer: "" }));
  };

  const onUpdateExample = (index: number, field: "question" | "answer", value: string) => {
    const updatedExample = { ...state.examples[index], [field]: value };
    dispatch(updateExample(index, updatedExample));
  };

  const onRemoveExample = (index: number) => {
    dispatch(removeExample(index));
  };

  return (
    <form className="grow h-full" onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 grow h-[calc(100%_-_45px)] px-1 pb-4 mb-3 overflow-y-auto scrollbar-custom">
        <Dialog>
          <DialogTrigger asChild>
            <SettingsCard className="cursor-pointer border border-transparent hover:border-primary/30 transition-all">
              <SettingsCardContent className="p-3 space-0 divide-none flex flex-row items-center gap-2">
                <PersonaCardIcon>
                  <PersonaIcon icon={state.icon} className="size-4" />
                </PersonaCardIcon>
                <div>
                  <CardDescription className="text-foreground">{t("PersonaIcon")}</CardDescription>
                  <CardDescription className="text-muted-foreground">{t("PersonaIconDescription")}</CardDescription>
                </div>
              </SettingsCardContent>
            </SettingsCard>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl" onSubmit={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>{t("PersonaIcon")}</DialogTitle>
              <DialogDescription>{t("PersonaIconSelectorDescription")}</DialogDescription>
            </DialogHeader>

            <IconSelectForm onSave={onIconSave} defaultIcon={state.icon} />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button" fullWidth size="sm">
                  {t("Cancel")}
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button form="icon-select-form" type="submit" fullWidth size="sm">
                  {t("Save")}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center w-full gap-2">
          <div className="grow grid gap-2">
            <CardDescription>{t("Name")}</CardDescription>
            <Input id="name" name="name" value={state.name} onChange={onNameChange} placeholder={t("Required")} />
          </div>

          <div className="grow grid gap-2">
            <CardDescription>{t("VoiceCommand")}</CardDescription>
            <Input
              id="voice_command"
              name="voice_command"
              value={state.voice_command}
              onChange={onVoiceCommandChange}
              placeholder={t("Optional")}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <CardDescription>{t("Description")}</CardDescription>
          <Input
            id="description"
            name="description"
            value={state.description}
            onChange={onDescriptionChange}
            placeholder={t("Optional")}
          />
        </div>

        <div>
          <CardDescription className="mb-2">{t("SystemPrompt")}</CardDescription>
          <Textarea
            id="system_prompt"
            name="system_prompt"
            value={state.system_prompt}
            onChange={onSystemPromptChange}
            placeholder={t("Required")}
            rows={7}
          />
          <CardDescription className="text-muted-foreground/60 mt-1">{t("SystemPromptDescription")}</CardDescription>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <CardDescription>{t("Examples")}</CardDescription>
            <Button type="button" variant="outline" size="sm" onClick={onAddExample}>
              <Plus className="size-4" />
              {t("AddExample")}
            </Button>
          </div>
          <CardDescription className="text-muted-foreground/60 mb-3">{t("ExamplesDescription")}</CardDescription>

          {state.examples.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CardDescription>No examples yet. Add your first example above.</CardDescription>
            </div>
          ) : (
            <div className="space-y-3">
              {state.examples.map((example, index) => (
                <SettingsCard key={index} className="p-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <CardDescription className="text-foreground">Example {index + 1}</CardDescription>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveExample(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <CardDescription>{t("Question")}</CardDescription>
                      <Input
                        value={example.question}
                        onChange={(e) => onUpdateExample(index, "question", e.target.value)}
                        placeholder={t("QuestionPlaceholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <CardDescription>{t("Answer")}</CardDescription>
                      <Textarea
                        value={example.answer}
                        onChange={(e) => onUpdateExample(index, "answer", e.target.value)}
                        placeholder={t("AnswerPlaceholder")}
                        rows={3}
                      />
                    </div>
                  </div>
                </SettingsCard>
              ))}
            </div>
          )}
        </div>

        <SettingsCard>
          <SettingsCardContent className="p-3 flex flex-row justify-between items-center">
            <div>
              <CardDescription className="text-foreground">{t("PasteOnFinish")}</CardDescription>
              <CardDescription className="text-muted-foreground">{t("PasteOnFinishDescription")}</CardDescription>
            </div>
            <Switch checked={state.paste_on_finish} onCheckedChange={onPasteOnFinishChange} />
          </SettingsCardContent>
        </SettingsCard>

        <SettingsCard>
          <SettingsCardContent className="p-3 flex flex-row justify-between items-center">
            <div>
              <CardDescription className="text-foreground">{t("RecordOutputAudio")}</CardDescription>
              <CardDescription className="text-muted-foreground">{t("RecordOutputAudioDescription")}</CardDescription>
            </div>
            <Switch checked={state.record_output_audio} onCheckedChange={onRecordOutputAudioChange} />
          </SettingsCardContent>
        </SettingsCard>
      </div>

      <footer className="flex gap-2">
        <Button variant="outline" type="button" fullWidth onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button type="submit" fullWidth>
          {t("Save")}
        </Button>
      </footer>
    </form>
  );
}

type State = {
  id?: string;
  name: string;
  description: string;
  system_prompt: string;
  voice_command: string;
  paste_on_finish: boolean;
  record_output_audio: boolean;
  icon: keyof typeof personasIconsRegistry | null;
  examples: PersonaExample[];
};

type Action =
  | { type: "set_name"; payload: string }
  | { type: "set_description"; payload: string }
  | { type: "set_system_prompt"; payload: string }
  | { type: "set_voice_command"; payload: string }
  | { type: "set_paste_on_finish"; payload: boolean }
  | { type: "set_icon"; payload: keyof typeof personasIconsRegistry | null }
  | { type: "set_record_output_audio"; payload: boolean }
  | { type: "set_examples"; payload: PersonaExample[] }
  | { type: "add_example"; payload: PersonaExample }
  | { type: "update_example"; payload: { index: number; example: PersonaExample } }
  | { type: "remove_example"; payload: number };

function toolFormReducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_name":
      return {
        ...state,
        name: action.payload,
      };
    case "set_description":
      return {
        ...state,
        description: action.payload,
      };
    case "set_system_prompt":
      return {
        ...state,
        system_prompt: action.payload,
      };

    case "set_voice_command":
      return {
        ...state,
        voice_command: action.payload,
      };
    case "set_paste_on_finish":
      return {
        ...state,
        paste_on_finish: action.payload,
      };
    case "set_icon":
      return {
        ...state,
        icon: action.payload,
      };
    case "set_record_output_audio":
      return {
        ...state,
        record_output_audio: action.payload,
      };
    case "set_examples":
      return {
        ...state,
        examples: action.payload,
      };
    case "add_example":
      return {
        ...state,
        examples: [...state.examples, action.payload],
      };
    case "update_example":
      return {
        ...state,
        examples: state.examples.map((example, index) =>
          index === action.payload.index ? action.payload.example : example,
        ),
      };
    case "remove_example":
      return {
        ...state,
        examples: state.examples.filter((_, index) => index !== action.payload),
      };
    default:
      return state;
  }
}

function setName(payload: string) {
  return { type: "set_name", payload: payload } as const;
}

function setDescription(payload: string) {
  return { type: "set_description", payload: payload } as const;
}

function setSystemPrompt(payload: string) {
  return { type: "set_system_prompt", payload: payload } as const;
}

function setVoiceCommand(payload: string) {
  return { type: "set_voice_command", payload: payload } as const;
}

function setPasteOnFinish(payload: boolean) {
  return { type: "set_paste_on_finish", payload: payload } as const;
}

function setRecordOutputAudio(payload: boolean) {
  return { type: "set_record_output_audio", payload: payload } as const;
}

function setIcon(payload: keyof typeof personasIconsRegistry | null) {
  return { type: "set_icon", payload: payload } as const;
}

function addExample(payload: PersonaExample) {
  return { type: "add_example", payload: payload } as const;
}

function updateExample(index: number, example: PersonaExample) {
  return { type: "update_example", payload: { index, example } } as const;
}

function removeExample(payload: number) {
  return { type: "remove_example", payload: payload } as const;
}
