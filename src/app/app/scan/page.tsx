"use client";

import { Suspense, useCallback, useState } from "react";
import { useTabReselect } from "@/hooks/use-tab-reselect";
import { ScanFlow } from "./scan-flow";

export default function ScanPage() {
  const [mountKey, setMountKey] = useState(0);
  const restart = useCallback(() => setMountKey((key) => key + 1), []);
  useTabReselect("add", restart);

  return (
    <Suspense>
      <ScanFlow key={mountKey} />
    </Suspense>
  );
}
