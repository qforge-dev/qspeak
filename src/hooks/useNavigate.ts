import { NavigateFunction, To, useNavigate as useNavigateReactRouter } from "react-router";

export const useNavigate = useNavigateReactRouter;

export const useTransitionNavigate = () => {
  const navigation = useNavigate();

  // @ts-ignore
  const navigate: NavigateFunction = (args, options) => {
    if (!document.startViewTransition) {
      navigation(args as To, options);
    } else {
      document.startViewTransition(() => {
        navigation(args as To, options);
      });
    }
  };

  return navigate;
};
