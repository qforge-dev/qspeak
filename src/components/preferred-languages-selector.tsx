import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@renderer/components/dialog";
import { Badge } from "@renderer/components/badge";
import { X, Plus } from "lucide-react";
import { languages } from "@shared/languages";
import { cn } from "@renderer/utils/cn";

interface PreferredLanguagesSelectorProps {
  selectedLanguages: string[];
  onLanguagesChange: (languages: string[]) => void;
}

export function PreferredLanguagesSelector({ selectedLanguages, onLanguagesChange }: PreferredLanguagesSelectorProps) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleLanguageToggle = (languageCode: string) => {
    if (selectedLanguages.includes(languageCode)) {
      onLanguagesChange(selectedLanguages.filter(code => code !== languageCode));
    } else {
      onLanguagesChange([...selectedLanguages, languageCode]);
    }
  };

  const removeLanguage = (languageCode: string) => {
    onLanguagesChange(selectedLanguages.filter(code => code !== languageCode));
  };

  const selectedLanguageObjects = selectedLanguages.map(code => 
    languages.find(lang => lang.code === code)
  ).filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 min-h-[40px] items-start justify-end">
        {selectedLanguageObjects.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">
            {t("NoPreferredLanguagesSelected")}
          </div>
        ) : (
          selectedLanguageObjects.map((language) => (
            <Badge key={language!.code} variant="secondary" className="flex items-center gap-1">
              <span>{language!.flag}</span>
              <span>{language!.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 hover:bg-transparent"
                onClick={() => removeLanguage(language!.code)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="max-w-[150px] self-end px-3 w-full">
            {t("AddLanguage")}
            <Plus className="h-4 w-4 opacity-50" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("SelectLanguages")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageToggle(language.code)}
                className={cn(
                  "flex items-center justify-between gap-2 border w-full p-3 rounded-lg text-sm transition-colors",
                  selectedLanguages.includes(language.code)
                    ? "bg-blue-500/10 border-blue-500"
                    : "cursor-pointer hover:bg-blue-500/5 transition-colors hover:border-blue-500/60"
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{language.flag}</span>
                  <span>{language.name}</span>
                </div>
                {selectedLanguages.includes(language.code) && (
                  <X className="h-3 w-3 text-blue-500" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 