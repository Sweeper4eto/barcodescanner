export async function relocateUploadsOnBoot() {
  const { relocateLegacyUploads } = await import("@/lib/upload");
  await relocateLegacyUploads();
}
