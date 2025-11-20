import { routes } from "../routes";
import { useTransitionNavigate } from "@renderer/hooks/useNavigate";
import { useLocation } from "@renderer/hooks/useLocation";
import { NavigateOptions } from "react-router";

export const useOnboardingNavigate = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const navigate = useTransitionNavigate();

  const onBack = () => {
    switch (pathname) {
      case routes.verifyCode():
        navigate(routes.login());
        break;
      case routes.transcriptionLanguage():
        navigate(routes.root());
        break;
      case routes.mediaSelect():
        navigate(routes.transcriptionLanguage());
        break;
      case routes.permissions():
        navigate(routes.mediaSelect());
        break;
      case routes.transcriptionModels():
        navigate(routes.permissions());
        break;
      case routes.transcriptionRun():
        navigate(routes.transcriptionModels());
        break;
      case routes.personaSelect():
        navigate(routes.transcriptionRun());
        break;
      case routes.transformationRun():
        navigate(routes.personaSelect());
        break;
      case routes.onboardingFinished():
        navigate(routes.transformationRun());
        break;

      default:
        throw new Error("Invalid route");
    }
  };

  const onNext = (options?: NavigateOptions) => {
    switch (pathname) {
      case routes.root():
        navigate(routes.login(), options);
        break;
      case routes.login():
        navigate(routes.verifyCode(), options);
        break;
      case routes.verifyCode():
        navigate(routes.transcriptionLanguage(), options);
        break;
      case routes.transcriptionLanguage():
        navigate(routes.mediaSelect(), options);
        break;
      case routes.mediaSelect():
        navigate(routes.permissions(), options);
        break;
      case routes.permissions():
        navigate(routes.transcriptionModels(), options);
        break;
      case routes.transcriptionModels():
        navigate(routes.transcriptionRun(), options);
        break;
      case routes.transcriptionRun():
        navigate(routes.personaSelect(), options);
        break;
      case routes.personaSelect():
        navigate(routes.transformationRun(), options);
        break;
      case routes.transformationRun():
        navigate(routes.onboardingFinished(), options);
        break;
      default:
        throw new Error("Invalid route");
    }
  };

  return { onBack, onNext };
};
