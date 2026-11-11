import type { QueryClient } from "@tanstack/react-query";

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => ["auth", "me", {}] as const,
  },
  tenant: {
    all: ["tenant"] as const,
    detail: () => ["tenant", "detail", {}] as const,
  },
  users: {
    all: ["users"] as const,
    list: (
      params: { role?: string; is_active?: boolean; cursor?: string } = {},
    ) => ["users", "list", params] as const,
    detail: (userId: string) => ["users", "detail", { userId }] as const,
  },
  directory: {
    all: ["directory"] as const,
    location: (gln: string) => ["directory", "location", { gln }] as const,
    tenant: (code: string) => ["directory", "tenant", { code }] as const,
  },
  locations: {
    all: ["locations"] as const,
    list: (
      params: { is_active?: boolean; cursor?: string; limit?: number } = {},
    ) => ["locations", "list", params] as const,
    detail: (locationId: string) =>
      ["locations", "detail", { locationId }] as const,
  },
  products: {
    all: ["products"] as const,
    list: (
      params: {
        q?: string;
        is_active?: boolean;
        cursor?: string;
        limit?: number;
      } = {},
    ) => ["products", "list", params] as const,
    detail: (productId: string) =>
      ["products", "detail", { productId }] as const,
  },
  lots: {
    all: ["lots"] as const,
    list: (
      params: {
        product_id?: string;
        status?: string;
        cursor?: string;
        limit?: number;
      } = {},
    ) => ["lots", "list", params] as const,
    detail: (lotId: string) => ["lots", "detail", { lotId }] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    list: (
      params: {
        location_id?: string;
        lot_id?: string;
        cursor?: string;
        limit?: number;
      } = {},
    ) => ["inventory", "list", params] as const,
  },
  shipments: {
    all: ["shipments"] as const,
    summary: () => ["shipments", "summary", {}] as const,
    list: (
      params: {
        status?: string;
        party?: string;
        sscc?: string;
        lot_id?: string;
        assigned_to_me?: boolean;
        cursor?: string;
        limit?: number;
      } = {},
    ) => ["shipments", "list", params] as const,
    detail: (shipmentId: string) =>
      ["shipments", "detail", { shipmentId }] as const,
    events: (shipmentId: string) =>
      ["shipments", "events", { shipmentId }] as const,
    integrity: (shipmentId: string) =>
      ["shipments", "integrity", { shipmentId }] as const,
  },
  telemetry: {
    all: ["telemetry"] as const,
    readings: (
      sscc: string,
      params: {
        resolution?: "raw" | "1m" | "15m";
        from?: string;
        to?: string;
      } = {},
    ) => ["telemetry", "readings", { sscc, ...params }] as const,
    shipmentIncidents: (sscc: string) =>
      ["telemetry", "shipmentIncidents", { sscc }] as const,
    incidents: (
      params: {
        state?: "open" | "resolved";
        cursor?: string;
        limit?: number;
      } = {},
    ) => ["telemetry", "incidents", params] as const,
    incidentsSummary: () => ["telemetry", "incidentsSummary", {}] as const,
  },
} as const;

export function invalidateShipmentQueries(
  queryClient: QueryClient,
  shipmentId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.shipments.all });
  if (shipmentId) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.shipments.detail(shipmentId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.shipments.events(shipmentId),
    });
  }
}

export function invalidateIncidentQueries(
  queryClient: QueryClient,
  sscc?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: ["telemetry", "incidents"],
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.telemetry.incidentsSummary(),
  });
  if (sscc) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.telemetry.shipmentIncidents(sscc),
    });
  }
}
