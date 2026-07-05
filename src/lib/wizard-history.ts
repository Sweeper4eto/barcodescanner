import { useCallback, useEffect } from "react";

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

/** Tie multi-step flows to the browser back button without replacing the initial history entry. */
export function useWizardHistory<T extends string>({
  step,
  initialStep,
  setStep,
}: WizardHistoryOptions<T>) {
  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const nextStep = readWizardStep<T>(event.state);
      if (nextStep) {
        setStep(nextStep);
        return;
      }
      if (step !== initialStep) {
        setStep(initialStep);
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialStep, setStep, step]);

  const goToStep = useCallback(
    (nextStep: T) => {
      if (nextStep === step) return;
      if (nextStep !== initialStep || step !== initialStep) {
        window.history.pushState(mergeWizardState(nextStep), "");
      }
      setStep(nextStep);
    },
    [initialStep, setStep, step],
  );

  return { goToStep };
}
