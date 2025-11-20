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
import { useParams } from "react-router";

export function EditPersona() {
  const { t } = useTranslation();
  const { state, updatePersona } = usePersonas();
  const { id } = useParams();
  const navigate = useTransitionNavigate();

  if (!id) {
    navigate("/personas");
    return null;
  }

  const persona = state?.context.personas.find((persona) => persona.id === id);

  if (!persona) {
    navigate("/personas");
    return null;
  }

  const onSave = (updatedPersona: Omit<Persona, "id">) => {
    if (
      state?.context.personas.find(
        (p) => p.name.toLowerCase() === updatedPersona.name.toLowerCase() && p.id !== persona.id,
      )
    ) {
      errorToast(t("PersonaWithNameAlreadyExists"));
      return;
    }

    updatePersona({ ...persona, ...updatedPersona });

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
          <HistoryHeading className="flex items-center gap-1">{t("EditPersona")}</HistoryHeading>

          <CardDescription data-tauri-drag-region>{t("ManagePersonasDescription1")}</CardDescription>
        </div>
      </HistoryHeader>

      <RouteWrapper className="grow h-full">
        <PersonasForm onSave={onSave} onCancel={onCancel} defaultValues={persona} />
      </RouteWrapper>
    </HistoryMain>
  );
}
