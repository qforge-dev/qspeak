import { Routes, Route } from "react-router";
import { Root } from "./pages/root";
import { Layout } from "@renderer/recorder/components/layout";
import { Personas } from "@renderer/recorder/pages/personas";
import { ConversationStateProvider } from "@renderer/hooks/useConversationState";
import { AudioDataProvider } from "@renderer/hooks/useStreamingAudio";
import { Minimized } from "./pages/minimized";
import { MaximizeLayout } from "./components/maximize-layout";
import { useAppState } from "@renderer/hooks/useAppState";
import { useEffect } from "react";
import { Toaster } from "@renderer/components/toasts";

export function App(): JSX.Element {
  const { state } = useAppState();

  useEffect(() => {
    if (state?.context.recording_window_context.theme) {
      document?.documentElement.classList.remove("light", "dark");

      document?.documentElement.classList.add(state.context.recording_window_context.theme.toLowerCase());
    }
  }, [state?.context.recording_window_context.theme]);

  return (
    <ConversationStateProvider>
      <AudioDataProvider>
        <Toaster
          theme={(state?.context.recording_window_context.theme || "dark").toLowerCase() as "dark" | "light" | "system"}
        />

        <Layout>
          <Routes>
            <Route element={<MaximizeLayout />}>
              <Route path="*" element={<Root />} />
              <Route path="/personas" element={<Personas />} />
            </Route>

            <Route path="/minimized" element={<Minimized />} />
          </Routes>
        </Layout>
      </AudioDataProvider>
    </ConversationStateProvider>
  );
}
