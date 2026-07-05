import { useCallback, useEffect, useRef } from "react";

type WizardHistoryOptions<T extends string> = {
  step: T;
  initialStep: T;
  setStep: (step: T) => void;
};

function mergeWizardState<T extends string>(wizardStep: T): Record<string, unknown> {
  const current =
    typeof window !== "undefined" && window.history.state && typeof window.history.state === "object"
      ? (window.history.state as Record<string, unknown>)
      : {};
  return { ...current, wizardStep };
}

function readWizardStep<T extends string>(state: unknown): T | undefined {
  if (!state || typeof state !== "object") return undefined;
  return (state as { wizardStep?: T }).wizardStep;
}

/** Tie multi-step flows to the browser back button via history state. */
export function useWizardHistory<T extends string>({
  step,
  initialStep,
  setStep,
}: WizardHistoryOptions<T>) {
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    window.history.replaceState(mergeWizardState(initialStep), "");
  }, [initialStep]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const nextStep = readWizardStep<T>(event.state);
      if (nextStep) {
        setStep(nextStep);
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setStep]);

  const goToStep = useCallback(
    (nextStep: T) => {
      if (nextStep === step) return;
      window.history.pushState(mergeWizardState(nextStep), "");
      setStep(nextStep);
    },
    [setStep, step],
  );

  return { goToStep };
}
