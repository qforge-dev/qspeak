import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel } from "@renderer/components/select";

import { useTranslation } from "react-i18next";
import { useAppState } from "@renderer/hooks/useAppState";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@renderer/components/tooltip";
import { Button } from "@renderer/components/button";
import * as SelectPrimitive from "@radix-ui/react-select";
import { motion } from "motion/react";
import { languages } from "@shared/languages";



export function LanguageSelect() {
  const { state, updateLanguage } = useAppState();
  const { t } = useTranslation();

  const preferredLanguages = useMemo(() => {
    if (!state?.context.preferred_languages) return [];
    
    return state.context.preferred_languages.map(langCode => 
      languages.find(lang => lang.code === langCode)
    ).filter(Boolean);
  }, [state?.context.preferred_languages]);

  const currentLanguage = useMemo(() => {
    if (!state?.context.language) return null;
    return languages.find(lang => lang.code === state.context.language);
  }, [state?.context.language]);

  const onLanguageChange = (languageCode: string) => {
    updateLanguage(languageCode);
  };

  if (!currentLanguage) return null;

  // If there are no preferred languages or only one, show as non-clickable
  if (preferredLanguages.length <= 1) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="xxs"
              variant="ghost"
              className="text-foreground/70 pointer-events-none"
            >
              <span className="text-sm">{currentLanguage.flag}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("currentLanguage")}: {currentLanguage.name}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show as clickable select when there are multiple preferred languages
  return (
    <Select onValueChange={onLanguageChange} value={undefined}>
      <TooltipProvider>
        <Tooltip>
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
          >
            <SelectPrimitive.Trigger asChild>
              <TooltipTrigger asChild>
                <Button size="xxs" variant="ghost" className="text-foreground/70 hover:text-foreground mb-0.5">
                  <span className="text-xs">{currentLanguage.flag}</span>
                </Button>
              </TooltipTrigger>
            </SelectPrimitive.Trigger>
          </motion.div>

          <TooltipContent>{t("switchLanguage")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-xs text-muted-foreground/80 pl-2">{t("selectLanguage")}</SelectLabel>
          {preferredLanguages.map((language) => (
            <SelectItem 
              key={language!.code} 
              value={language!.code}
              indicator={false}
              className="max-w-[200px] leading-[24px]"
            >
              <div className="flex items-center gap-2">
                <span>{language!.flag}</span>
                <span className="line-clamp-1">{language!.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
} 