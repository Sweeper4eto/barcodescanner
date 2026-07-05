"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

type UseWizardStepOptions<T extends string> = {
  initialStep: T;
  param?: string;
  validSteps?: readonly T[];
};

/** Wizard steps via URL search params so Next.js router stays in sync with the back button. */
export function useWizardStep<T extends string>({
  initialStep,
  param = "step",
  validSteps,
}: UseWizardStepOptions<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const step = useMemo(() => {
    const raw = searchParams.get(param);
    if (!raw) return initialStep;
    if (validSteps && !validSteps.includes(raw as T)) return initialStep;
    return raw as T;
  }, [initialStep, param, searchParams, validSteps]);

  const goToStep = useCallback(
    (nextStep: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextStep === initialStep) {
        params.delete(param);
      } else {
        params.set(param, nextStep);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [initialStep, param, pathname, router, searchParams],
  );

  return { step, goToStep };
}
