import { normalizeBarcode } from "@/lib/barcode";

export type ScanLookupProduct = {
  id: string;
  name: string;
  imagePath: string | null;
  barcode: string;
};

export type ScanLookupResult =
  | { status: "found"; barcode: string; product: ScanLookupProduct }
  | { status: "missing"; barcode: string }
  | { status: "error"; message: string }
  | { status: "unauthorized" };

type ProductLookupResponse = {
  product?: ScanLookupProduct;
  error?: string;
};

export async function lookupProductByBarcode(
  value: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ScanLookupResult> {
  const barcode = normalizeBarcode(value);
  if (!barcode) {
    return { status: "error", message: "INVALID_BARCODE" };
  }

  try {
    const response = await fetchImpl(
      `/api/products?barcode=${encodeURIComponent(barcode)}`,
      { credentials: "same-origin" },
    );

    if (response.status === 401) {
      return { status: "unauthorized" };
    }

    const data = (await response.json().catch(() => null)) as ProductLookupResponse | null;
    if (!response.ok || !data) {
      return { status: "error", message: data?.error ?? "LOOKUP_FAILED" };
    }

    if (!data.product) {
      return { status: "missing", barcode };
    }

    return { status: "found", barcode, product: data.product };
  } catch {
    return { status: "error", message: "NETWORK_ERROR" };
  }
}
