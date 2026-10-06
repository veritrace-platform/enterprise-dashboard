import type { components, operations } from "@/lib/api/schema";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";

type ListShipmentsQuery = NonNullable<
  operations["listShipments"]["parameters"]["query"]
>;

type CreateShipmentInput =
  components["schemas"]["ShipmentCreateRequest"];

export async function listShipments(
  query: ListShipmentsQuery = {},
) {
  const result = await apiClient.GET("/api/v1/shipments", {
    params: {
      query,
    },
  });

  return unwrap(result);
}

export async function getShipment(shipmentId: string) {
  const result = await apiClient.GET(
    "/api/v1/shipments/{shipment_id}",
    {
      params: {
        path: {
          shipment_id: shipmentId,
        },
      },
    },
  );

  return unwrap(result);
}

export async function createShipment(input: CreateShipmentInput) {
  const result = await apiClient.POST("/api/v1/shipments", {
    body: input,
  });

  return unwrap(result);
}