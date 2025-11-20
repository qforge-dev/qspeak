import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@renderer/components/switch";
import { Input } from "@renderer/components/input";
import { SettingsCard, SettingsCardContent, SettingsCardHeader, SettingsCardTitle } from "../components/cards";
import { OptionContent, OptionDescription, OptionTitle, OptionWrapper, RouteWrapper } from "../components/layout";
import { HistoryHeader, HistoryHeading, HistoryMain } from "../components/history/history-layout";
import { CardDescription } from "@renderer/components/card";
import { useAppState } from "@renderer/hooks/useAppState";

export function WebsocketSettings() {
  const { t } = useTranslation();
  const { state, updateWebsocketServerSettings } = useAppState();
  const [portValue, setPortValue] = useState("4456");
  const [passwordValue, setPasswordValue] = useState("");

  const contextPort = state?.context.websocket_server_context.port ?? 4456;
  const contextPassword = state?.context.websocket_server_context.password ?? "";

  useEffect(() => {
    const nextValue = contextPort.toString();
    setPortValue((prev) => (prev === nextValue ? prev : nextValue));
  }, [contextPort]);

  useEffect(() => {
    setPasswordValue((prev) => (prev === contextPassword ? prev : contextPassword));
  }, [contextPassword]);

  if (!state) {
    return null;
  }

  const { websocket_server_context: websocketContext } = state.context;
  const { enabled, port, password } = websocketContext;
  const savedPassword = password ?? "";

  const commitSettings = useCallback(
    (overrides: Partial<{ enabled: boolean; port: number; password: string }>) => {
      updateWebsocketServerSettings({
        enabled: overrides.enabled ?? enabled,
        port: overrides.port ?? port,
        password: overrides.password ?? savedPassword,
      });
    },
    [enabled, port, savedPassword, updateWebsocketServerSettings],
  );

  const handleToggle = (checked: boolean) => {
    commitSettings({ enabled: checked });
  };

  const handlePortCommit = () => {
    const trimmed = portValue.trim();
    if (trimmed.length === 0) {
      setPortValue(port.toString());
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed)) {
      setPortValue(port.toString());
      return;
    }

    const normalized = Math.min(65535, Math.max(1, parsed));
    const normalizedString = normalized.toString();
    if (normalizedString !== portValue) {
      setPortValue(normalizedString);
    }

    if (normalized === port) {
      return;
    }

    commitSettings({ port: normalized });
  };

  const handlePasswordCommit = () => {
    if (passwordValue === savedPassword) {
      return;
    }

    commitSettings({ password: passwordValue });
  };

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-0 select-none cursor-grab" data-tauri-drag-region>
        <HistoryHeading>{t("WebSocketServer")}</HistoryHeading>
        <CardDescription className="mt-1 max-w-lg" data-tauri-drag-region>
          {t("WebSocketServerDescription")}
        </CardDescription>
      </HistoryHeader>

      <RouteWrapper className="overflow-y-auto">
        <SettingsCard>
          <SettingsCardHeader>
            <SettingsCardTitle>{t("WebSocketServerSettings")}</SettingsCardTitle>
          </SettingsCardHeader>

          <SettingsCardContent>
            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("EnableWebSocketServer")}</OptionTitle>
                <OptionDescription>{t("EnableWebSocketServerDescription")}</OptionDescription>
              </OptionContent>

              <Switch checked={enabled} onCheckedChange={handleToggle} />
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("WebSocketServerPort")}</OptionTitle>
                <OptionDescription>{t("WebSocketServerPortDescription")}</OptionDescription>
              </OptionContent>

              <Input
                type="number"
                min={1}
                max={65535}
                value={portValue}
                onChange={(event) => setPortValue(event.target.value)}
                className="w-[120px]"
                disabled={!enabled}
                onBlur={handlePortCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("WebSocketServerPassword")}</OptionTitle>
                <OptionDescription>{t("WebSocketServerPasswordDescription")}</OptionDescription>
              </OptionContent>

              <Input
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                className="w-[220px]"
                disabled={!enabled}
                placeholder={t("Optional")}
                onBlur={handlePasswordCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </OptionWrapper>
          </SettingsCardContent>
        </SettingsCard>
      </RouteWrapper>
    </HistoryMain>
  );
}
