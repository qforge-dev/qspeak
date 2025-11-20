import { Routes, Route } from "react-router";
import { useTranslation } from "react-i18next";
import { Settings } from "./pages/settings";
import { History } from "./pages/history";
import { Layout, Main, NavLink, SidebarNav, SidebarNavItem, SidebarNavList } from "./components/layout";
import { Aside } from "./components/aside";
import {
  SettingsIcon,
  UserCircle,
  HistoryIcon,
  HomeIcon,
  Brain,
  CircleHelp,
  Book,
  Wrench,
  X,
  Minus,
  Bug,
  Loader,
  Wifi,
} from "lucide-react";
import { InterfaceLanguageSelect } from "@renderer/components/interface-language-select";
import { Providers } from "./pages/providers";
import { Personas } from "./pages/personas";
import { Models } from "./pages/models";
import { Home } from "./pages/home";
import { DictionaryPage } from "./pages/dictionary";
import { useInterfaceLanguage } from "@renderer/hooks/useInterfaceLanguage";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@renderer/components/dropdown-menu";
import { Button } from "@renderer/components/button";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { useVersion } from "@renderer/hooks/useVersion";
import { useQSpeakLinks } from "@renderer/hooks/useQSpeakLinks";
import { useErrorToasts } from "@renderer/hooks/useErrorToasts";
import { invokeEvent, useAppState } from "@renderer/hooks/useAppState";
import { useCallback, useEffect, useRef } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@renderer/components/tooltip";
import { TooltipProvider } from "@renderer/components/tooltip";
import { ToolsPage } from "./pages/tools";
import { AddNewTool } from "./pages/tools-add";
import { EditTool } from "./pages/tools-edit";
import { WebsocketSettings } from "./pages/websocket";

import { WindowCloseButton, WindowMinimizeButton } from "@renderer/components/window-management";
import { Toaster } from "@renderer/components/toasts";
import { AddPersona } from "./pages/personas-add";
import { EditPersona } from "./pages/personas-edit";
import { AddNewModel } from "./pages/models-add";
import { EditModel } from "./pages/models-edit";
import { CustomDate } from "@renderer/utils/custom-date";
import { Badge } from "@renderer/components/badge";
import "./settings.css";

function App(): JSX.Element {
  const version = useVersion();
  const { t } = useTranslation();
  const { discord } = useQSpeakLinks();
  const { state, closeSettingsWindow, minimizeSettingsWindow } = useAppState();

  const { onLanguageChange, language } = useInterfaceLanguage();

  const goToDiscord = () => {
    openUrl(discord);
  };

  useErrorToasts(state?.context.errors, (err) => invokeEvent("ActionRemoveError", err.id));

  const renderVersionState = useCallback(() => {
    if (state?.context.update_context.state === "Idle") {
      return null;
    } else if (state?.context.update_context.state === "CheckingForUpdates") {
      return <VersionCheckingForUpdatesState />;
    } else if (state?.context.update_context.state === "UpdateAvailable") {
      return <VersionUpdateAvailableState />;
    } else if (state?.context.update_context.state === "NoUpdateAvailable") {
      return <VersionNoUpdateAvailableState />;
    } else if (
      state?.context.update_context.state &&
      typeof state?.context.update_context.state === "object" &&
      "DownloadingUpdate" in state?.context.update_context.state
    ) {
      return <VersionDownloadingUpdateState progress={state?.context.update_context.state.DownloadingUpdate} />;
    } else if (state?.context.update_context.state === "UpdateDownloaded") {
      return null;
    } else if (
      state?.context.update_context.state &&
      typeof state?.context.update_context.state === "object" &&
      "Error" in state?.context.update_context.state
    ) {
      return <VersionErrorState error={state.context.update_context.state.Error} />;
    }

    return null;
  }, [state?.context.update_context.state]);

  useEffect(() => {
    if (state?.context.recording_window_context.theme) {
      document?.documentElement.classList.remove("light", "dark");

      document?.documentElement.classList.add(state.context.recording_window_context.theme.toLowerCase());
    }
  }, [state?.context.recording_window_context.theme]);

  return (
    <>
      <Toaster theme={state?.context.recording_window_context.theme === "Dark" ? "dark" : "light"} />

      <Layout>
        <Aside>
          <div className="h-[30px] px-2 py-1 flex items-center gap-1.5" data-tauri-drag-region>
            <WindowCloseButton onClick={closeSettingsWindow}>
              <X />
            </WindowCloseButton>

            <WindowMinimizeButton onClick={minimizeSettingsWindow}>
              <Minus />
            </WindowMinimizeButton>
          </div>

          <SidebarNav>
            <div className="flex items-center gap-2 py-3 px-4">
              <img
                src={state?.context.recording_window_context.theme === "Dark" ? "/logo-white.png" : "/logo-dark.png"}
                alt="qSpeak"
                className="w-9 h-9"
              />
              <h3 className="text-xl font-semibold">qSpeak</h3>
            </div>

            <SidebarNavList>
              <SidebarNavItem>
                <NavLink to="/">
                  <HomeIcon className="w-3.5 h-3.5" />
                  {t("Home")}
                </NavLink>
              </SidebarNavItem>
              <SidebarNavItem>
                <NavLink to="/settings">
                  <SettingsIcon className="w-3.5 h-3.5" />
                  {t("Settings")}
                </NavLink>
              </SidebarNavItem>
              <SidebarNavItem>
                <NavLink to="/dictionary">
                  <Book className="w-3.5 h-3.5" />
                  {t("Dictionary")}
                </NavLink>
              </SidebarNavItem>
              <SidebarNavItem>
                <NavLink to="/models">
                  <Brain className="w-3.5 h-3.5" />
                  {t("Models")}
                </NavLink>
              </SidebarNavItem>
              <SidebarNavItem>
                <NavLink to="/personas">
                  <UserCircle className="w-3.5 h-3.5" />
                  {t("Personas")}
                </NavLink>
              </SidebarNavItem>
              <SidebarNavItem>
                <NavLink to="/history">
                  <HistoryIcon className="w-3.5 h-3.5" />
                  {t("History")}
                </NavLink>
              </SidebarNavItem>
              <SidebarNavItem>
                <NavLink to="/tools">
                  <Wrench className="w-3.5 h-3.5" />
                  {t("Tools (Experimental)")}
                </NavLink>
              </SidebarNavItem>
              <SidebarNavItem>
                <NavLink to="/websocket">
                  <Wifi className="w-3.5 h-3.5" />
                  {t("WebSocketServer")}
                </NavLink>
              </SidebarNavItem>

              {/* <SidebarNavItem>
              <NavLink to="/providers">
                <KeyRound className="w-4 h-4" />
                {t("Providers")}
              </NavLink>
            </SidebarNavItem> */}
            </SidebarNavList>

            <div className="flex flex-col gap-2 grow justify-end">{renderVersionState()}</div>
          </SidebarNav>

          <div className="items-end flex p-2 justify-between">
            <InterfaceLanguageSelect value={language} onChange={onLanguageChange} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <CircleHelp />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-w-[250px] min-w-[200px]">
                <DropdownMenuLabel>Learn more</DropdownMenuLabel>
                <DropdownMenuItem onClick={goToDiscord}>
                  <Bug />
                  <span>Report a bug</span>
                </DropdownMenuItem>

                <ReleasesMenu />

                <DropdownMenuLabel className="text-xs text-muted-foreground/60 font-medium">
                  <span>qSpeak {version}</span>
                </DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Aside>

        <Main>
          <Routes>
            <Route index element={<Home />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/models" element={<Models />} />
            <Route path="/models/add" element={<AddNewModel />} />
            <Route path="/models/edit/:id" element={<EditModel />} />
            <Route path="/history" element={<History />} />
            <Route path="/personas" element={<Personas />} />
            <Route path="/personas/add" element={<AddPersona />} />
            <Route path="/personas/edit/:id" element={<EditPersona />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/dictionary" element={<DictionaryPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/tools/add" element={<AddNewTool />} />
            <Route path="/tools/edit/:id" element={<EditTool />} />
            <Route path="/websocket" element={<WebsocketSettings />} />
          </Routes>
        </Main>
      </Layout>
    </>
  );
}

export default App;

function VersionUpdateAvailableState() {
  const { releases } = useQSpeakLinks();
  const { t } = useTranslation();
  return (
    <div className="m-2">
      <Button
        onClick={() => openPath(releases)}
        size="sm"
        fullWidth
        className="h-8 text-xs rounded-lg"
        variant="outline"
      >
        <div className="relative flex items-center gap-1">
          <div className="w-1.5 h-1.5 animate-ping bg-green-500 rounded-full" />
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full absolute inset-0" />
        </div>
        {t("updateqSpeak?")}
      </Button>
    </div>
  );
}

function VersionDownloadingUpdateState({ progress }: { progress: number }) {
  return (
    <div className="m-2">
      <Button disabled size="sm" className="h-8 text-xs">
        Downloading: {progress}%
      </Button>
    </div>
  );
}

function VersionNoUpdateAvailableState() {
  return (
    <div className="m-2">
      <Button
        onClick={() => invokeEvent("ActionCheckForUpdates")}
        size="sm"
        className="h-8 text-xs text-foreground/40"
        variant="ghost"
      >
        Check for updates
      </Button>
    </div>
  );
}

function VersionCheckingForUpdatesState() {
  return (
    <div className="m-2">
      <Button disabled size="sm" className="h-8 text-xs text-foreground/40" variant="ghost">
        Checking for updates...
      </Button>
    </div>
  );
}

function VersionErrorState({ error }: { error: string }) {
  return (
    <div className="m-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild className="h-8 text-xs text-foreground/40 w-full line-clamp-2 ">
            <div>Error updating: {error}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[400px]">
            {error}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function ReleasesMenu() {
  const { state, getReleases } = useAppState();
  const { discordReleases } = useQSpeakLinks();
  const isFetched = useRef(false);

  const releases = state?.context.releases_context.releases ?? [];

  const goToDiscordReleases = () => {
    openUrl(discordReleases);
  };

  useEffect(() => {
    if (isFetched.current) return;
    getReleases();

    isFetched.current = true;
  }, []);

  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-1 justify-between">
        <span>Releases</span>
        {releases.length === 0 ? <Loader className="animate-spin size-3" /> : null}
      </DropdownMenuLabel>
      {releases.slice(0, 3).map((release, index) => {
        return (
          <DropdownMenuItem key={release.id} className="flex flex-col items-start gap-0" onClick={goToDiscordReleases}>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={index === 0 ? "secondary" : "surface"} size="sm" className="text-xs">
                {release.version}
              </Badge>
              <span className="text-foreground">{CustomDate.format(new Date(release.createdAt), "dd MMM HH:mm")}</span>
            </div>
            <span className="text-xs text-muted-foreground line-clamp-2">{release.description}</span>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
