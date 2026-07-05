"use client";

import { useCallback, useState } from "react";

type UseWizardStepOptions<T extends string> = {
  initialStep: T;
};

/** In-memory wizard steps — avoids router.push on the same page, which breaks tab navigation. */
export function useWizardStep<T extends string>({ initialStep }: UseWizardStepOptions<T>) {
  const [step, setStep] = useState(initialStep);

  const goToStep = useCallback((nextStep: T) => {
    setStep(nextStep);
  }, []);

  return { step, goToStep };
}
