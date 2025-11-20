import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/button";
import { useReducer } from "react";
import { SettingsCard, SettingsCardContent } from "../cards";
import { CardDescription } from "@renderer/components/card";
import { Input } from "@renderer/components/input";
import { Checkbox } from "@renderer/components/checkbox";
import { errorToast } from "@renderer/components/toasts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@renderer/components/select";
import { MODEL_TEMPLATES } from "@renderer/shared/model-templates";

type ConversationModelFormData = {
  model: string;
  url: string;
  api_key?: string;
  supports_tools?: boolean;
  supports_vision?: boolean;
};

type ModelsFormProps = {
  onSave: (data: ConversationModelFormData) => void;
  onCancel: () => void;
  defaultValues?: ConversationModelFormData;
};

export function ModelsForm({ onSave, onCancel, defaultValues }: ModelsFormProps) {
  const { t } = useTranslation();

  const [state, dispatch] = useReducer(modelFormReducer, {
    model: defaultValues?.model || "",
    url: defaultValues?.url || "",
    api_key: defaultValues?.api_key || "",
    supports_tools: defaultValues?.supports_tools || false,
    supports_vision: defaultValues?.supports_vision || false,
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!state.model.trim()) {
      errorToast(t("ModelRequired"));
      return;
    }

    if (!state.url.trim()) {
      errorToast(t("ModelURLRequired"));
      return;
    }

    // Basic URL validation
    try {
      new URL(state.url);
    } catch {
      errorToast(t("InvalidURL"));
      return;
    }

    onSave({
      model: state.model.trim(),
      url: state.url.trim(),
      api_key: state.api_key.trim() || undefined,
      supports_tools: state.supports_tools,
      supports_vision: state.supports_vision,
    });
  };

  const onModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setModel(e.target.value));
  };

  const onUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setUrl(e.target.value));
  };

  const onApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setApiKey(e.target.value));
  };

  const onSupportsToolsChange = (checked: boolean) => {
    dispatch(setSupportsTools(checked));
  };

  const onSupportsVisionChange = (checked: boolean) => {
    dispatch(setSupportsVision(checked));
  };

  return (
    <form className="grow h-full" onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 grow h-[calc(100%_-_45px)] px-1 pb-4 mb-3 overflow-y-auto scrollbar-custom">
        <SettingsCard>
          <SettingsCardContent className="p-3">
            <CardDescription>{t("AddModelDescription")}</CardDescription>
          </SettingsCardContent>
        </SettingsCard>

        <div className="grid gap-2">
          <CardDescription>{t("ModelTemplate")}</CardDescription>
          <Select
            value={MODEL_TEMPLATES.find((t) => t.url === state.url)?.url || "Custom"}
            onValueChange={(value) => {
              if (value !== "Custom") {
                dispatch(setUrl(value));
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("SelectModelTemplate")} />
            </SelectTrigger>
            <SelectContent>
              {MODEL_TEMPLATES.map((template) => (
                <SelectItem key={template.label} value={template.url} indicator={false}>
                  {template.label}
                </SelectItem>
              ))}
              <SelectItem value="Custom" indicator={false}>
                Custom
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <CardDescription>{t("Model")}</CardDescription>
          <Input
            id="model"
            name="model"
            value={state.model}
            onChange={onModelChange}
            placeholder={t("Required, e.g., gpt-4")}
          />
        </div>

        <div className="grid gap-2">
          <CardDescription>{t("APIEndpoint")}</CardDescription>
          <Input
            id="url"
            name="url"
            value={state.url}
            onChange={onUrlChange}
            placeholder={t("Required, e.g., https://api.openai.com/v1")}
          />
        </div>

        <div className="grid gap-2">
          <CardDescription>{t("APIKey")}</CardDescription>
          <Input
            id="api_key"
            name="api_key"
            type="password"
            value={state.api_key}
            onChange={onApiKeyChange}
            placeholder={t("Optional")}
          />
          <CardDescription className="text-muted-foreground/60 text-xs">{t("APIKeyDescription")}</CardDescription>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox id="supports_tools" checked={state.supports_tools} onCheckedChange={onSupportsToolsChange} />
            <label htmlFor="supports_tools" className="text-sm text-muted-foreground cursor-pointer">
              {t("SupportsTools")}
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="supports_vision" checked={state.supports_vision} onCheckedChange={onSupportsVisionChange} />
            <label htmlFor="supports_vision" className="text-sm text-muted-foreground cursor-pointer">
              {t("SupportsVision")}
            </label>
          </div>
        </div>
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
  model: string;
  url: string;
  api_key: string;
  supports_tools: boolean;
  supports_vision: boolean;
};

type Action =
  | { type: "set_model"; payload: string }
  | { type: "set_url"; payload: string }
  | { type: "set_api_key"; payload: string }
  | { type: "set_supports_tools"; payload: boolean }
  | { type: "set_supports_vision"; payload: boolean };

function modelFormReducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_model":
      return { ...state, model: action.payload };
    case "set_url":
      return { ...state, url: action.payload };
    case "set_api_key":
      return { ...state, api_key: action.payload };
    case "set_supports_tools":
      return { ...state, supports_tools: action.payload };
    case "set_supports_vision":
      return { ...state, supports_vision: action.payload };
    default:
      return state;
  }
}

const setModel = (payload: string) => ({ type: "set_model" as const, payload });
const setUrl = (payload: string) => ({ type: "set_url" as const, payload });
const setApiKey = (payload: string) => ({ type: "set_api_key" as const, payload });
const setSupportsTools = (payload: boolean) => ({ type: "set_supports_tools" as const, payload });
const setSupportsVision = (payload: boolean) => ({ type: "set_supports_vision" as const, payload });
