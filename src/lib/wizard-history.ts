import { useCallback, useEffect } from "react";

type WizardHistoryOptions<T extends string> = {
  step: T;
  initialStep: T;
  setStep: (step: T) => void;
};

/** Tie multi-step flows to the browser back button via history state. */
export function useWizardHistory<T extends string>({
  step,
  initialStep,
  setStep,
}: WizardHistoryOptions<T>) {
  useEffect(() => {
    window.history.replaceState({ wizardStep: initialStep }, "");
  }, [initialStep]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const nextStep = (event.state as { wizardStep?: T } | null)?.wizardStep;
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
      window.history.pushState({ wizardStep: nextStep }, "");
      setStep(nextStep);
    },
    [setStep, step],
  );

  return { goToStep };
}
