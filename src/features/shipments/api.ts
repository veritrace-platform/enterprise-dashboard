import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type {
  Position,
  ShipmentCreateRequest,
  ShipmentListFilters,
} from "./types";

export async function fetchShipmentSummary() {
  return unwrap(await apiClient.GET("/api/v1/shipments/summary"));
}

export async function fetchShipments(filters: ShipmentListFilters = {}) {
  return unwrap(
    await apiClient.GET("/api/v1/shipments", {
      params: {
        query: {
          status: filters.status,
          party: filters.party,
          sscc: filters.sscc || undefined,
          lot_id: filters.lot_id,
          assigned_to_me: filters.assigned_to_me,
          cursor: filters.cursor,
          limit: filters.limit ?? 20,
        },
      },
    }),
  );
}

export async function fetchShipment(shipmentId: string) {
  return unwrap(
    await apiClient.GET("/api/v1/shipments/{shipment_id}", {
      params: { path: { shipment_id: shipmentId } },
    }),
  );
}

export async function fetchShipmentEvents(shipmentId: string) {
  return unwrap(
    await apiClient.GET("/api/v1/shipments/{shipment_id}/events", {
      params: {
        path: { shipment_id: shipmentId },
        query: { limit: 100 },
      },
    }),
  );
}

export async function fetchShipmentIntegrity(shipmentId: string) {
  return unwrap(
    await apiClient.GET("/api/v1/shipments/{shipment_id}/integrity", {
      params: { path: { shipment_id: shipmentId } },
    }),
  );
}

export async function createShipment(body: ShipmentCreateRequest) {
  return unwrap(await apiClient.POST("/api/v1/shipments", { body }));
}

export async function assignShipmentCarrier(
  shipmentId: string,
  carrierTenantCode: string,
) {
  return unwrap(
    await apiClient.POST("/api/v1/shipments/{shipment_id}/carrier", {
      params: { path: { shipment_id: shipmentId } },
      body: { carrier_tenant_code: carrierTenantCode },
    }),
  );
}

export async function assignShipmentDriver(
  shipmentId: string,
  driverUserId: string,
) {
  return unwrap(
    await apiClient.POST("/api/v1/shipments/{shipment_id}/driver", {
      params: { path: { shipment_id: shipmentId } },
      body: { driver_user_id: driverUserId },
    }),
  );
}

export async function issueShipmentPickupCode(shipmentId: string) {
  return unwrap(
    await apiClient.POST("/api/v1/shipments/{shipment_id}/pickup-code", {
      params: { path: { shipment_id: shipmentId } },
    }),
  );
}

export async function confirmShipmentDelivery(
  shipmentId: string,
  sscc: string,
  position: Position,
) {
  return unwrap(
    await apiClient.POST("/api/v1/shipments/{shipment_id}/delivery", {
      params: { path: { shipment_id: shipmentId } },
      body: { sscc, position },
    }),
  );
}

export async function cancelShipment(shipmentId: string, reason: string) {
  return unwrap(
    await apiClient.POST("/api/v1/shipments/{shipment_id}/cancel", {
      params: { path: { shipment_id: shipmentId } },
      body: { reason },
    }),
  );
}

export async function recallShipmentLot(lotId: string, reason: string) {
  return unwrap(
    await apiClient.POST("/api/v1/lots/{lot_id}/recall", {
      params: { path: { lot_id: lotId } },
      body: { reason },
    }),
  );
}

export async function fetchShipmentReadings(
  sscc: string,
  resolution: "raw" | "1m" | "15m" = "raw",
) {
  return unwrap(
    await apiClient.GET("/api/v1/telemetry/shipments/{sscc}/readings", {
      params: {
        path: { sscc },
        query: { resolution },
      },
    }),
  );
}

export async function fetchShipmentIncidents(sscc: string) {
  return unwrap(
    await apiClient.GET("/api/v1/telemetry/shipments/{sscc}/incidents", {
      params: {
        path: { sscc },
        query: { limit: 50 },
      },
    }),
  );
}

export async function lookupDirectoryLocation(gln: string) {
  return unwrap(
    await apiClient.GET("/api/v1/directory/locations/{gln}", {
      params: { path: { gln } },
    }),
  );
}

export async function lookupDirectoryTenant(code: string) {
  return unwrap(
    await apiClient.GET("/api/v1/directory/tenants/{code}", {
      params: { path: { code } },
    }),
  );
}

export async function fetchAvailableInventory() {
  return unwrap(
    await apiClient.GET("/api/v1/inventory", {
      params: { query: { limit: 100 } },
    }),
  );
}

export async function fetchLotsList() {
  return unwrap(
    await apiClient.GET("/api/v1/lots", {
      params: { query: { limit: 100 } },
    }),
  );
}

export async function fetchLocationsList() {
  return unwrap(
    await apiClient.GET("/api/v1/locations", {
      params: { query: { is_active: true, limit: 100 } },
    }),
  );
}

export async function fetchActiveDrivers() {
  return unwrap(
    await apiClient.GET("/api/v1/users", {
      params: { query: { role: "DRIVER", is_active: true, limit: 100 } },
    }),
  );
}
