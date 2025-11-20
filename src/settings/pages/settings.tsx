import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@renderer/components/select";
import { Switch } from "@renderer/components/switch";
import { useAppState } from "@renderer/hooks/useAppState";
import { useInputDevices } from "@renderer/onboarding/hooks/useAudioDevices";
import { Shortcuts } from "@shared/communicator/state-machine.types";
import { languages } from "@shared/languages";
import { SettingsCard, SettingsCardContent, SettingsCardHeader, SettingsCardTitle } from "../components/cards";
import { OptionContent, OptionDescription, OptionTitle, OptionWrapper, RouteWrapper } from "../components/layout";
import { ShortcutRecorder } from "../components/shortcut-recorder";
import { PreferredLanguagesSelector } from "@renderer/components/preferred-languages-selector";
import { HistoryHeader, HistoryHeading, HistoryMain } from "../components/history/history-layout";
import { CardDescription } from "@renderer/components/card";

export function Settings() {
  const { t } = useTranslation();
  const { state, updateInputDevice, updateLanguage, updatePreferredLanguages, updateShortcuts, updateTheme, updateOpenSettingsOnStart } = useAppState();
  const { devices } = useInputDevices();
  const onMicrophoneChange = (value: string) => {
    updateInputDevice(value);
  };

  const onLanguageChange = (language: string) => {
    updateLanguage(language);
  };

  const onOpenSettingsOnStartChange = (openSettingsOnStart: boolean) => {
    updateOpenSettingsOnStart(openSettingsOnStart);
  };

  function onShortcutChange(key: keyof Shortcuts, value: string[]) {
    if (!state) {
      return;
    }

    updateShortcuts({
      ...state.context.shortcuts,
      [key]: value,
    });
  }

  function resetShortcut(key: keyof Shortcuts) {
    if (!state) {
      return;
    }

    updateShortcuts({
      ...state.context.shortcuts,
      [key]: state.context.default_shortcuts[key],
    });
  }

  if (!state) {
    return null;
  }

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-0 select-none cursor-grab" data-tauri-drag-region>
        <HistoryHeading>{t("Settings")}</HistoryHeading>
        <CardDescription className="mt-1 max-w-lg" data-tauri-drag-region>
          {t("SettingsDescription")}
        </CardDescription>
      </HistoryHeader>

      <RouteWrapper className="overflow-y-auto">
        <SettingsCard>
          <SettingsCardHeader>
            <SettingsCardTitle>{t("General")}</SettingsCardTitle>
          </SettingsCardHeader>

          <SettingsCardContent>
            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("AudioInput")}</OptionTitle>
                <OptionDescription>{t("AudioInputDescription")}</OptionDescription>
              </OptionContent>

              <Select onValueChange={onMicrophoneChange} value={state?.context.input_device ?? undefined}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("SelectMicrophone")} />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.name} value={device.name}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("Language")}</OptionTitle>
                <OptionDescription>{t("LanguageDescription")}</OptionDescription>
              </OptionContent>

              <Select onValueChange={onLanguageChange} value={state?.context.language}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t("Language")} />
                </SelectTrigger>

                <SelectContent position="item-aligned">
                  {languages.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.name} {language.flag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("PreferredLanguages")}</OptionTitle>
                <OptionDescription>{t("PreferredLanguagesDescription")}</OptionDescription>
              </OptionContent>

              <PreferredLanguagesSelector
                selectedLanguages={state?.context.preferred_languages ?? []}
                onLanguagesChange={(languages) => updatePreferredLanguages(languages)}
              />
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("Theme")}</OptionTitle>
                <OptionDescription>{t("ThemeDescription")}</OptionDescription>
              </OptionContent>

              <Select onValueChange={updateTheme} value={state?.context.recording_window_context.theme}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t("Theme")} />
                </SelectTrigger>

                <SelectContent position="item-aligned">
                  {[
                    {
                      name: "Light",
                      value: "Light",
                    },
                    {
                      name: "Dark",
                      value: "Dark",
                    },
                  ].map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("OpenSettingsOnStart")}</OptionTitle>
                <OptionDescription>{t("OpenSettingsOnStartDescription")}</OptionDescription>
              </OptionContent>

              <Switch
                checked={state?.context.settings_window_context.open_settings_on_start ?? true}
                onCheckedChange={onOpenSettingsOnStartChange}
              />
            </OptionWrapper>

          </SettingsCardContent>
        </SettingsCard>

        <SettingsCard>
          <SettingsCardHeader>
            <SettingsCardTitle>{t("Shortcuts")}</SettingsCardTitle>
          </SettingsCardHeader>

          <SettingsCardContent>
            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("Record")}</OptionTitle>
                <OptionDescription>{t("RecordShortcutDescription")}</OptionDescription>
              </OptionContent>
              <ShortcutRecorder
                value={state.context.shortcuts.recording}
                defaultValue={state.context.default_shortcuts.recording}
                onChange={(value) => onShortcutChange("recording", value)}
                onReset={() => resetShortcut("recording")}
              />
            </OptionWrapper>
            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("Close")}</OptionTitle>
                <OptionDescription>{t("CloseShortcutDescription")}</OptionDescription>
              </OptionContent>
              <ShortcutRecorder
                value={state.context.shortcuts.close}
                defaultValue={state.context.default_shortcuts.close}
                onChange={(value) => onShortcutChange("close", value)}
                onReset={() => resetShortcut("close")}
              />
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("Personas")}</OptionTitle>
                <OptionDescription>{t("PersonasShortcutDescription")}</OptionDescription>
              </OptionContent>
              <ShortcutRecorder
                value={state.context.shortcuts.personas}
                defaultValue={state.context.default_shortcuts.personas}
                onChange={(value) => onShortcutChange("personas", value)}
                requireModifierAndCharacter
                onReset={() => resetShortcut("personas")}
              />
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("Screenshot")}</OptionTitle>
                <OptionDescription>{t("ScreenshotShortcutDescription")}</OptionDescription>
              </OptionContent>
              <ShortcutRecorder
                value={state.context.shortcuts.screenshot}
                defaultValue={state.context.default_shortcuts.screenshot}
                onChange={(value) => onShortcutChange("screenshot", value)}
                onReset={() => resetShortcut("screenshot")}
              />
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("CopyText")}</OptionTitle>
                <OptionDescription>{t("CopyTextShortcutDescription")}</OptionDescription>
              </OptionContent>
              <ShortcutRecorder
                value={state.context.shortcuts.copy_text}
                defaultValue={state.context.default_shortcuts.copy_text}
                onChange={(value) => onShortcutChange("copy_text", value)}
                onReset={() => resetShortcut("copy_text")}
              />
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("ToggleMinimized")}</OptionTitle>
                <OptionDescription>{t("ToggleMinimizedShortcutDescription")}</OptionDescription>
              </OptionContent>
              <ShortcutRecorder
                value={state.context.shortcuts.toggle_minimized}
                defaultValue={state.context.default_shortcuts.toggle_minimized}
                onChange={(value) => onShortcutChange("toggle_minimized", value)}
                onReset={() => resetShortcut("toggle_minimized")}
              />
            </OptionWrapper>

            <OptionWrapper>
              <OptionContent>
                <OptionTitle>{t("SwitchLanguage")}</OptionTitle>
                <OptionDescription>{t("SwitchLanguageShortcutDescription")}</OptionDescription>
              </OptionContent>
              <ShortcutRecorder
                value={state.context.shortcuts.switch_language}
                defaultValue={state.context.default_shortcuts.switch_language}
                onChange={(value) => onShortcutChange("switch_language", value)}
                onReset={() => resetShortcut("switch_language")}
              />
            </OptionWrapper>
          </SettingsCardContent>
        </SettingsCard>
      </RouteWrapper>
    </HistoryMain>
  );
}
