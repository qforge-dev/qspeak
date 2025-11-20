import { Button } from "@renderer/components/button";
import { Persona, usePersonas } from "@renderer/hooks/usePersonas";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CardDescription } from "@renderer/components/card";
import { RouteWrapper } from "../components/layout";
import { BasicLink } from "@renderer/components/basic-link";
import { HistoryHeader, HistoryHeading, HistoryMain } from "../components/history/history-layout";
import { PersonasForm } from "../components/personas/personas-form";
import { errorToast } from "@renderer/components/toasts";
import { useTransitionNavigate } from "@renderer/hooks/useNavigate";
import { useLocation } from "react-router";

export function AddPersona() {
  const { t } = useTranslation();
  const { state, addPersona } = usePersonas();
  const navigate = useTransitionNavigate();
  const { state: routeState } = useLocation();

  const onSave = (newPersona: Omit<Persona, "id">) => {
    if (state?.context.personas.find((persona) => persona.name.toLowerCase() === newPersona.name.toLowerCase())) {
      errorToast(t("PersonaWithNameAlreadyExists"));
      return;
    }

    addPersona(newPersona);

    navigate("/personas");
  };

  const onCancel = () => {
    navigate("/personas");
  };

  return (
    <HistoryMain>
      <HistoryHeader className="pt-6 pb-0 select-none cursor-grab flex items-start gap-1" data-tauri-drag-region>
        <Button size="sm" asChild variant="ghost">
          <BasicLink to="/personas">
            <ChevronLeft />
          </BasicLink>
        </Button>

        <div>
          <HistoryHeading className="flex items-center gap-1">{t("AddNewPersona")}</HistoryHeading>

          <CardDescription data-tauri-drag-region>{t("ManagePersonasDescription1")}</CardDescription>
        </div>
      </HistoryHeader>

      <RouteWrapper className="grow h-full">
        <PersonasForm onSave={onSave} onCancel={onCancel} defaultValues={routeState?.persona ?? undefined} />
      </RouteWrapper>
    </HistoryMain>
  );
}
