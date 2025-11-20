import { Routes, Route } from "react-router";
import { Root } from "./pages/root";
import { TranscriptionModels } from "./pages/transcription-models";
import { routes } from "./routes";
import { TranscriptionRun } from "./pages/transcription-run";
import { TranscriptionLanguage } from "./pages/transcription-language";
import { PersonaSelect } from "./pages/persona-select";
import { TransformationRun } from "./pages/transformation.run";
import { MediaSelect } from "./pages/media-select";
import { OnboardingFinished } from "./pages/onboarding-finished";
import { Login } from "./pages/login";
import { VerificationCode } from "./pages/verification-code";
import { invokeEvent, useAppState } from "@renderer/hooks/useAppState";
import { useErrorToasts } from "@renderer/hooks/useErrorToasts";
import { Permissions } from "./pages/permissions";
import { WindowCloseButton } from "@renderer/components/window-management";
import { X } from "lucide-react";

function App(): JSX.Element {
  const { state, closeOnboardingWindow } = useAppState();

  useErrorToasts(state?.context.errors ?? [], (err) => invokeEvent("ActionRemoveError", err.id));
  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="h-[30px] px-2 py-1 flex items-center gap-1.5 absolute top-1 left-1" data-tauri-drag-region>
        <WindowCloseButton onClick={closeOnboardingWindow}>
          <X />
        </WindowCloseButton>
      </div>
      <Routes>
        <Route index element={<Root />} />
        <Route path={routes.login()} element={<Login />} />
        <Route path={routes.verifyCode()} element={<VerificationCode />} />
        <Route path={routes.transcriptionLanguage()} element={<TranscriptionLanguage />} />
        <Route path={routes.mediaSelect()} element={<MediaSelect />} />
        <Route path={routes.permissions()} element={<Permissions />} />
        <Route path={routes.transcriptionModels()} element={<TranscriptionModels />} />
        <Route path={routes.transcriptionRun()} element={<TranscriptionRun />} />
        <Route path={routes.personaSelect()} element={<PersonaSelect />} />
        <Route path={routes.transformationRun()} element={<TransformationRun />} />
        <Route path={routes.onboardingFinished()} element={<OnboardingFinished />} />
      </Routes>
    </div>
  );
}

export default App;
