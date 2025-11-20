import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@renderer/components/button";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { TooltipContent, TooltipProvider } from "@renderer/components/tooltip";
import { TooltipTrigger } from "@renderer/components/tooltip";
import { Tooltip } from "@renderer/components/tooltip";
import { cn } from "@renderer/utils/cn";
import { ShortcutKey } from "@renderer/components/shortcut";
import { Shortcut } from "@renderer/utils/shortcut";

interface ShortcutRecorderProps {
  value: string[] | undefined;
  onChange: (shortcut: string[]) => void;
  requireModifierAndCharacter?: boolean;
  onReset: () => void;
  defaultValue: string[];
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

export function ShortcutRecorder({
  value,
  onChange,
  requireModifierAndCharacter = false,
  onReset,
  defaultValue,
}: ShortcutRecorderProps) {
  const { t } = useTranslation();
  const [isShaking, setIsShaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentKeys, { isRecording, startRecording, stopRecording }] = useShortcutRecorder(value, {
    onStart: () => {
      setIsShaking(false);
      setErrorMessage(null);
    },
    onStop: (keys) => {
      if (keys.length === 0) {
        setIsShaking(true);
        setErrorMessage(t("shortcutPleaseRecordAShortcut"));
        setTimeout(() => setIsShaking(false), 500);
        return;
      }

      if (hasOnlyModifiers(new Set(keys))) {
        setIsShaking(true);
        setErrorMessage(t("shortcutCannotUseOnlyModifierKeys"));
        setTimeout(() => setIsShaking(false), 500);
        return;
      }

      if (requireModifierAndCharacter) {
        const hasModifier = Array.from(keys).some((key) => MODIFIER_KEYS.has(key));
        const hasCharacter = Array.from(keys).some((key) => !MODIFIER_KEYS.has(key));

        if (!hasModifier || !hasCharacter) {
          setIsShaking(true);
          setErrorMessage(t("shortcutMustIncludeModifierAndCharacter"));
          setTimeout(() => setIsShaking(false), 500);
          return;
        }
      }
      onChange(sortKeys(new Set(keys)));
    },
  });

  const displayValue = useMemo(() => {
    if (isRecording) {
      if (currentKeys.length === 0)
        return <span className="text-foreground/70 italic">{t("shortcutPleaseRecordAShortcut")}</span>;
      return sortKeys(new Set(currentKeys)).map((key) => (
        <ShortcutKey key={key}>{Shortcut.keyToIcon(key)}</ShortcutKey>
      ));
    }

    return (
      value?.map((key) => <ShortcutKey key={key}>{Shortcut.keyToIcon(key)}</ShortcutKey>) || (
        <span className="text-foreground/70 italic">{t("shortcutPleaseRecordAShortcut")}</span>
      )
    );
  }, [currentKeys.join("+"), isRecording, value]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" className="[&>svg]:size-3.5" size="icon" onClick={onReset}>
                <RotateCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                <span className="text-foreground/70">{t("defaultShortcut")}:</span>{" "}
                <span className="text-foreground font-semibold">{defaultValue.join("+")}</span>
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button
          variant="outline"
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            `p-1.5 gap-1.5 items-center justify-between text-xs transition-colors duration-300 shadow-inner rounded-2xl`,
            {
              "border-red-500 shake": isShaking,
              "border-input": !isShaking,
            },
          )}
        >
          {displayValue}
        </Button>
      </div>
      {errorMessage && <p className="text-xs text-red-500 text-right">{errorMessage}</p>}
    </div>
  );
}

function useShortcutRecorder(
  value: string[] | undefined,
  {
    onStop,
    onStart,
  }: {
    onStop?: (keys: string[]) => void;
    onStart?: () => void;
  } = {},
): [string[], { isRecording: boolean; startRecording: () => void; stopRecording: () => void }] {
  const [isRecording, setIsRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState<Set<string>>(new Set(value));

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setCurrentKeys(new Set());
    onStart?.();
  }, [onStart]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    onStop?.(Array.from(currentKeys.values()));
  }, [Array.from(currentKeys.values()).join("+"), onStop]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();

      setCurrentKeys((prev) => {
        const newKeys = new Set(prev);
        if (MODIFIER_KEYS.has(getKey(e))) {
          newKeys.add(getKey(e));
        } else {
          newKeys.add(getKey(e).length === 1 ? getKey(e).toUpperCase() : getKey(e));
        }
        return newKeys;
      });
    },
    [isRecording],
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();

      if (isRecording && currentKeys.has(getKey(e))) {
        stopRecording();
      }
    },
    [isRecording, Array.from(currentKeys.values()).join("+")],
  );

  useEffect(() => {
    if (isRecording) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording, handleKeyDown, handleKeyUp, Array.from(currentKeys.values()).join("+")]);

  return [
    Array.from(currentKeys.values()) || [],
    {
      isRecording,
      startRecording,
      stopRecording,
    },
  ];
}

function getKey(e: KeyboardEvent) {
  let key = MODIFIER_KEYS.has(e.key) ? e.key : e.code;
  if (key === "Meta") key = "Super";
  if (key === " ") key = "Space";
  return key;
}

function sortKeys(keys: Set<string>) {
  return Array.from(keys).sort((a, b) => {
    const aIsModifier = a.includes("Control") || a.includes("Alt") || a.includes("Shift") || a.includes("Super");
    const bIsModifier = b.includes("Control") || b.includes("Alt") || b.includes("Shift") || b.includes("Super");
    if (aIsModifier && !bIsModifier) return -1;
    if (!aIsModifier && bIsModifier) return 1;
    return 0;
  });
}

function hasOnlyModifiers(keys: Set<string>) {
  return Array.from(keys).every((key) => MODIFIER_KEYS.has(key));
}
