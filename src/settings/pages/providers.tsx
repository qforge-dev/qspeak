import { useTranslation } from "react-i18next";
import { ProvidersCard, ProvidersCardHeader, ProvidersCardTitle } from "../components/cards";
import { RouteWrapper } from "../components/layout";

export function Providers() {
  const { t } = useTranslation();
  // const onProviderChange = (provider: "openai" | "elevenlabs") => {
  //   return (e: React.ChangeEvent<HTMLInputElement>) => {
  //     const newProviders: AppContext["providers"] = {
  //       ...stateMachine.context.providers,
  //       [provider]: {
  //         ...stateMachine.context.providers[provider],
  //         apiKey: e.target.value,
  //       },
  //     };

  //     communicator.cast("action", { type: "ActionChangeProviders", providers: newProviders });
  //   };
  // };

  return (
    <RouteWrapper>
      <ProvidersCard>
        <ProvidersCardHeader>
          <ProvidersCardTitle>{t("Providers")}</ProvidersCardTitle>
        </ProvidersCardHeader>

        {/* <ProvidersCardContent>
        <OptionWrapper>
          <OptionContent>
            <OptionTitle>OpenAI API Key</OptionTitle>
            <OptionDescription>Your OpenAI API key for text generation</OptionDescription>
          </OptionContent>
          <Input
            type="password"
            value={stateMachine?.context.providers.openai.apiKey || ""}
            onChange={onProviderChange("openai")}
            className="w-[300px]"
          />
        </OptionWrapper>

        <OptionWrapper>
          <OptionContent>
            <OptionTitle>ElevenLabs API Key</OptionTitle>
            <OptionDescription>Your ElevenLabs API key for text-to-speech</OptionDescription>
          </OptionContent>
          <Input
            type="password"
            value={stateMachine?.context.providers.elevenlabs.apiKey || ""}
            onChange={onProviderChange("elevenlabs")}
            className="w-[300px]"
          />
        </OptionWrapper>
      </ProvidersCardContent> */}
      </ProvidersCard>
    </RouteWrapper>
  );
}
