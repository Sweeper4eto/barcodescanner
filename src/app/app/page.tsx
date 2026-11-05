"use client";

import { HomeClassicMenu } from "@/components/home-classic-menu";
import { HomeHubHome } from "@/components/home-hub-home";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { useAppSession } from "@/components/app-session-provider";

/**
 * Home switches by account flag (`Client.newUiEnabled`):
 * - off → classic link-card home + always-visible bottom tabs
 * - on  → gradient icon hub (all users on that account)
 */
export default function AppHomePage() {
  const { ready, newUiEnabled } = useAppSession();

  if (!ready) {
    return (
      <LoadingSpinnerBlock wrapperClassName="flex justify-center py-16" />
    );
  }

  return newUiEnabled ? <HomeHubHome /> : <HomeClassicMenu />;
}
