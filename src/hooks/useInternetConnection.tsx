import { useCallback, useEffect, useState } from "react";
import { useAppState } from "./useAppState";

export function useInternetConnection(args: { interval: number } = { interval: 5000 }) {
  const { checkOnline } = useAppState();
  const [online, setOnline] = useState(false);

  const checkIsOnline = useCallback(() => {
    checkOnline().then((online) => {
      setOnline(typeof online === "boolean" ? online : false);
    });
  }, []);

  useEffect(() => {
    checkIsOnline();

    const id = setInterval(() => {
      checkIsOnline();
    }, args.interval);

    return () => {
      clearInterval(id);
    };
  }, [args.interval, checkIsOnline]);

  return [online];
}
