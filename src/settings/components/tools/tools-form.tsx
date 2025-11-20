import { Label } from "@renderer/components/label";
import { Input } from "@renderer/components/input";
import { isExternalTool, isLocalTool, MCPServerConfig, MCPServerKind } from "@renderer/hooks/useNewState";
import { RadioGroup, RadioGroupItem } from "@renderer/components/radio-group";
import { useTranslation } from "react-i18next";
import { Cloud, HardDrive, Plus } from "lucide-react";
import { Trash2 } from "lucide-react";
import { Button } from "@renderer/components/button";
import { useReducer } from "react";
import { SettingsCard, SettingsCardContent } from "../cards";
import { ToolCardDescription, ToolCardIcon, ToolCardTitle } from "./tools-list";
import { cn } from "@renderer/utils/cn";
import { CardDescription } from "@renderer/components/card";
import { EmptyMessage } from "@renderer/components/items-list";
import { v4 as uuidv4 } from "uuid";
import { errorToast } from "@renderer/components/toasts";

type ToolsFormProps = {
  onSave: (data: MCPServerConfig) => void;
  onCancel: () => void;
  defaultValues?: MCPServerConfig;
};

export function ToolsForm({ onSave, onCancel, defaultValues }: ToolsFormProps) {
  const { t } = useTranslation();

  const [state, dispatch] = useReducer(toolFormReducer, {
    type: defaultValues ? (isLocalTool(defaultValues?.kind) ? "Local" : "External") : "Local",
    name: defaultValues?.name || "",
    key: defaultValues?.key || "",
    description: defaultValues?.description || "",
    kind: defaultValues?.kind || { Local: { command: "", env_vars: {} } },
  });

  const onToolTypeChange = (value: "Local" | "External") => {
    dispatch(setType(value));
  };

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setName(e.target.value));
  };

  const onKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setKey(e.target.value));
  };

  const onDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setDescription(e.target.value));
  };

  const onCommandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCommand(e.target.value));
  };

  const onEnvVarChange = (envKey: string, newKey: string, newValue: string) => {
    dispatch(changeEnvVar({ envKey, newKey, newValue }));
  };

  const addEnvVarField = () => {
    dispatch(addEnvVar());
  };

  const removeEnvVarField = (envKey: string) => {
    dispatch(removeEnvVar(envKey));
  };

  const onUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setUrl(e.target.value));
  };

  const envVarEntries =
    state.type === "Local" && "Local" in state.kind
      ? Object.entries(state.kind.Local.env_vars).sort(([a], [b]) => {
          const indexA = parseInt(a.split("-")[0]);
          const indexB = parseInt(b.split("-")[0]);
          return indexA - indexB;
        })
      : [];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!state.key) {
      errorToast(t("ToolKeyRequired"));
      return;
    }
    if ("Local" in state.kind && !state.kind.Local.command) {
      errorToast(t("ToolCommandRequired"));
      return;
    } else if ("External" in state.kind && !state.kind.External.url) {
      errorToast(t("ToolURLRequired"));
      return;
    }

    let newTool: MCPServerConfig;

    if (isLocalTool(state.kind)) {
      newTool = {
        ...state,
        id: uuidv4(),
        enabled: false,
        state: "Disabled",
        kind: {
          Local: {
            command: state.kind.Local.command,
            env_vars: envVarEntries.reduce(
              (acc, env) => {
                if (!env[0]) return acc;
                const parsedKey = parseEnvKey(env[0]);
                acc[parsedKey.key] = env[1];
                return acc;
              },
              {} as Record<string, string>,
            ),
          },
        },
      };
    } else {
      newTool = {
        ...state,
        id: uuidv4(),
        enabled: false,
        state: "Disabled",
        kind: { External: { url: state.kind.External.url } },
      };
    }

    onSave(newTool);
  };

  return (
    <form className="grow h-full" onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 grow h-[calc(100%_-_40px)]">
        <SettingsCard>
          <SettingsCardContent className="p-3">
            <RadioGroup value={state.type} onValueChange={onToolTypeChange} className="flex gap-2">
              <Label
                className="flex items-center gap-2 bg-background-surface-high rounded-xl p-2 grow basis-1/2 cursor-pointer"
                title={t("LocalServerShortDescription")}
                htmlFor="local"
              >
                <RadioGroupItem value="Local" id="local" />

                <ToolCardIcon isLocal className="bg-background-surface-highest">
                  <HardDrive />
                </ToolCardIcon>

                <div>
                  <ToolCardTitle>{t("LocalServer")}</ToolCardTitle>
                  <ToolCardDescription className={cn("line-clamp-1")}>
                    {t("LocalServerShortDescription")}
                  </ToolCardDescription>
                </div>
              </Label>

              <Label
                className="flex items-center gap-2 bg-background-surface-high rounded-xl p-2 grow basis-1/2 cursor-pointer"
                title={t("ExternalServerShortDescription")}
                htmlFor="external"
              >
                <RadioGroupItem value="External" id="external" />

                <ToolCardIcon isLocal className="bg-background-surface-highest">
                  <Cloud />
                </ToolCardIcon>

                <div>
                  <ToolCardTitle>{t("ExternalServer")}</ToolCardTitle>
                  <ToolCardDescription className={cn("line-clamp-1")}>
                    {t("ExternalServerShortDescription")}
                  </ToolCardDescription>
                </div>
              </Label>
            </RadioGroup>
          </SettingsCardContent>
        </SettingsCard>

        <div className="flex items-center w-full gap-2">
          <div className="grow">
            <CardDescription>{t("Name")}</CardDescription>
            <Input id="name" name="name" value={state.name} onChange={onNameChange} placeholder={t("Optional")} />
          </div>

          <div className="grow">
            <CardDescription>{t("ToolKey")}</CardDescription>
            <Input id="key" name="key" value={state.key} onChange={onKeyChange} placeholder={t("Required")} />
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

        {state.type === "Local" && "Local" in state.kind ? (
          <>
            <div className="grid gap-2">
              <CardDescription>{t("Command")}</CardDescription>
              <Input
                id="command"
                name="command"
                value={state.kind.Local.command}
                onChange={onCommandChange}
                placeholder={t("Required, like: npx -y @mcp-server")}
              />
            </div>
            <div className="col-span-4">
              <div className="flex items-center gap-2 justify-between">
                <CardDescription>{t("Environment Variables")}</CardDescription>

                <Button variant="outline" size="xs" type="button" onClick={addEnvVarField}>
                  <Plus /> {t("AddVariable")}
                </Button>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto h-[130px] mt-3 p-1">
                {envVarEntries.length > 0 ? (
                  envVarEntries.map(([envKey, envValue], index) => {
                    const parsedKey = parseEnvKey(envKey);
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder={t("Name")}
                          value={parsedKey.key}
                          onChange={(e) => onEnvVarChange(envKey, e.target.value, envValue)}
                          className="flex-1"
                        />
                        <Input
                          placeholder={t("Value")}
                          value={envValue}
                          onChange={(e) => onEnvVarChange(envKey, parsedKey.key, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEnvVarField(envKey)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <EmptyMessage className="block text-center mt-2">{t("NoEnvironmentVariables")}</EmptyMessage>
                )}
              </div>
            </div>
          </>
        ) : null}

        {state.type === "External" && "External" in state.kind ? (
          <div className="grid gap-2">
            <Label htmlFor="url">{t("Server URL (SSE)")}</Label>
            <Input
              id="url"
              name="url"
              value={state.kind.External.url}
              onChange={onUrlChange}
              placeholder={t("Required, e.g., http://localhost:8080/events")}
            />
          </div>
        ) : null}
      </div>

      <footer className="mt-2 flex gap-2">
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
  type: "Local" | "External";
  name: string;
  key: string;
  description: string;
  kind: MCPServerKind;
  nextEnvIndex?: number;
};

type Action =
  | { type: "set_type"; payload: "Local" | "External" }
  | { type: "set_name"; payload: string }
  | { type: "set_key"; payload: string }
  | { type: "set_description"; payload: string }
  | { type: "set_command"; payload: string }
  | { type: "remove_env_var"; payload: string }
  | { type: "change_env_var"; payload: { envKey: string; newKey: string; newValue: string } }
  | { type: "add_env_var" }
  | { type: "set_url"; payload: string };

function toolFormReducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_type":
      return {
        ...state,
        type: action.payload,
        kind: action.payload === "Local" ? { Local: { command: "", env_vars: {} } } : { External: { url: "" } },
      };
    case "set_name":
      return { ...state, name: action.payload, key: generateKeyFromName(action.payload) };
    case "set_key":
      return { ...state, key: action.payload };
    case "set_description":
      return { ...state, description: action.payload };
    case "set_command":
      return {
        ...state,
        kind: {
          ...state.kind,
          Local: {
            env_vars: isLocalTool(state.kind) ? { ...state.kind.Local.env_vars } : {},
            command: action.payload,
          },
        },
      };

    case "remove_env_var": {
      const removedEnvs = isLocalTool(state.kind) ? { ...state.kind.Local.env_vars } : {};
      delete removedEnvs[action.payload];

      return {
        ...state,
        kind: {
          ...state.kind,
          Local: {
            ...(isLocalTool(state.kind) ? state.kind.Local : { command: "" }),
            env_vars: removedEnvs,
          },
        },
      };
    }

    case "change_env_var": {
      const envVars = isLocalTool(state.kind) ? { ...state.kind.Local.env_vars } : {};
      const { envKey, newKey, newValue } = action.payload;
      const parsedOldKey = parseEnvKey(envKey);
      const newEnvKey = buildEnvKey(parsedOldKey.index, newKey);

      if (envKey !== newEnvKey) {
        delete envVars[envKey];
      }

      envVars[newEnvKey] = newValue;

      return {
        ...state,
        kind: {
          ...state.kind,
          Local: {
            ...(isLocalTool(state.kind) ? state.kind.Local : { command: "" }),
            env_vars: envVars,
          },
        },
      };
    }

    case "add_env_var": {
      const envVars = isLocalTool(state.kind) ? { ...state.kind.Local.env_vars } : {};

      const existingIndices = Object.keys(envVars)
        .map((key) => parseEnvKey(key).index)
        .filter((idx) => !isNaN(idx));
      const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 0;
      const newKey = buildEnvKey(nextIndex, "");

      return {
        ...state,
        kind: {
          ...state.kind,
          Local: {
            ...(isLocalTool(state.kind) ? state.kind.Local : { command: "" }),
            env_vars: { ...envVars, [newKey]: "" },
          },
        },
      };
    }

    case "set_url":
      return {
        ...state,
        kind: {
          ...state.kind,
          External: { ...(isExternalTool(state.kind) ? state.kind.External : {}), url: action.payload },
        },
      };
    default:
      return state;
  }
}

function setType(payload: "Local" | "External") {
  return { type: "set_type", payload: payload } as const;
}

function setName(payload: string) {
  return { type: "set_name", payload: payload } as const;
}

function setKey(payload: string) {
  return { type: "set_key", payload: payload } as const;
}

function setDescription(payload: string) {
  return { type: "set_description", payload: payload } as const;
}

function setCommand(payload: string) {
  return { type: "set_command", payload: payload } as const;
}

function removeEnvVar(payload: string) {
  return { type: "remove_env_var", payload: payload } as const;
}

function changeEnvVar(payload: { envKey: string; newKey: string; newValue: string }) {
  return { type: "change_env_var", payload: payload } as const;
}

function addEnvVar() {
  return { type: "add_env_var" } as const;
}

function setUrl(payload: string) {
  return { type: "set_url", payload: payload } as const;
}

function buildEnvKey(index: number, key: string) {
  return `${index}-${key}`;
}

function parseEnvKey(key: string) {
  const dashIndex = key.indexOf("-");
  if (dashIndex === -1) {
    return { index: 0, key: key };
  }
  const indexStr = key.substring(0, dashIndex);
  const actualKey = key.substring(dashIndex + 1);
  return { index: parseInt(indexStr) || 0, key: actualKey };
}

const generateKeyFromName = (name: string): string => {
  if (!name || name.trim() === "") {
    return "";
  }

  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
};
