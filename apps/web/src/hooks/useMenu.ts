import { useCallback, useEffect, useState } from "react";
import { fetchMenu } from "../api";
import type { Drink } from "../types";

export function useMenu() {
  const [menu, setMenu] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Changing this re-runs the effect, which is how "Try again" reloads.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetchMenu(controller.signal)
      .then(setMenu)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== "AbortError") {
          setError(reason.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setAttempt((value) => value + 1);
  }, []);

  return { menu, loading, error, reload };
}
