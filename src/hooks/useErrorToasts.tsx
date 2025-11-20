import { AppError } from "@renderer/hooks/useNewState";
import { useEffect, useRef } from "react";
import { errorToast } from "@renderer/components/toasts";

export const useErrorToasts = (errors: AppError[] = [], onError?: (error: AppError) => void) => {
  const errorsRef = useRef<string[] | null>(null);

  useEffect(() => {
    const newErrors = errors.filter((error) => !errorsRef.current?.includes(error.id));

    newErrors.forEach((error) => {
      errorToast(error.message);
      errorsRef.current = [...(errorsRef.current ?? []), error.id];

      onError?.(error);
    });
  }, [errors.length]);
};
