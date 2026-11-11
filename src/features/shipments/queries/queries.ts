import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateShipmentQueries, queryKeys } from "@/lib/api/query-client";
import {
  assignShipmentCarrier,
  assignShipmentDriver,
  cancelShipment,
  confirmShipmentDelivery,
  createShipment,
  fetchActiveDrivers,
  fetchAvailableInventory,
  fetchLocationsList,
  fetchLotsList,
  fetchShipment,
  fetchShipmentEvents,
  fetchShipmentIncidents,
  fetchShipmentIntegrity,
  fetchShipmentReadings,
  fetchShipmentSummary,
  fetchShipments,
  issueShipmentPickupCode,
  recallShipmentLot,
} from "../api";
import type {
  Position,
  ShipmentCreateRequest,
  ShipmentListFilters,
} from "../types";

export function useShipmentSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.shipments.summary(),
    queryFn: fetchShipmentSummary,
    enabled,
  });
}

export function useShipmentsQuery(
  filters: ShipmentListFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.shipments.list(filters),
    queryFn: () => fetchShipments(filters),
    enabled,
  });
}

export function useShipmentDetailQuery(shipmentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shipments.detail(shipmentId),
    queryFn: () => fetchShipment(shipmentId),
    enabled: Boolean(shipmentId) && enabled,
  });
}

export function useShipmentEventsQuery(shipmentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shipments.events(shipmentId),
    queryFn: () => fetchShipmentEvents(shipmentId),
    enabled: Boolean(shipmentId) && enabled,
  });
}

export function useShipmentReadingsQuery(
  sscc: string | undefined,
  resolution: "raw" | "1m" | "15m" = "raw",
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.telemetry.readings(sscc ?? "", { resolution }),
    queryFn: () => fetchShipmentReadings(sscc ?? "", resolution),
    enabled: Boolean(sscc) && enabled,
  });
}

export function useShipmentIncidentsQuery(
  sscc: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.telemetry.shipmentIncidents(sscc ?? ""),
    queryFn: () => fetchShipmentIncidents(sscc ?? ""),
    enabled: Boolean(sscc) && enabled,
  });
}

export function useAvailableInventoryQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.inventory.list({ limit: 100 }),
    queryFn: fetchAvailableInventory,
    enabled,
  });
}

export function useLotsListQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.lots.list({ limit: 100 }),
    queryFn: fetchLotsList,
    enabled,
  });
}

export function useLocationsListQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.locations.list({ is_active: true, limit: 100 }),
    queryFn: fetchLocationsList,
    enabled,
  });
}

export function useActiveDriversQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.list({ role: "DRIVER", is_active: true }),
    queryFn: fetchActiveDrivers,
    enabled,
  });
}

export function useCreateShipmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ShipmentCreateRequest) => createShipment(body),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.shipments.detail(created.id), created);
      invalidateShipmentQueries(queryClient, created.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

export function useAssignCarrierMutation(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (carrierTenantCode: string) =>
      assignShipmentCarrier(shipmentId, carrierTenantCode),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.shipments.detail(shipmentId), updated);
      invalidateShipmentQueries(queryClient, shipmentId);
    },
  });
}

export function useAssignDriverMutation(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (driverUserId: string) =>
      assignShipmentDriver(shipmentId, driverUserId),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.shipments.detail(shipmentId), updated);
      invalidateShipmentQueries(queryClient, shipmentId);
    },
  });
}

export function useIssuePickupCodeMutation(shipmentId: string) {
  return useMutation({
    mutationFn: () => issueShipmentPickupCode(shipmentId),
  });
}

export function useConfirmDeliveryMutation(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sscc, position }: { sscc: string; position: Position }) =>
      confirmShipmentDelivery(shipmentId, sscc, position),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.shipments.detail(shipmentId), updated);
      invalidateShipmentQueries(queryClient, shipmentId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

export function useCancelShipmentMutation(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => cancelShipment(shipmentId, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.shipments.detail(shipmentId), updated);
      invalidateShipmentQueries(queryClient, shipmentId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

export function useVerifyShipmentIntegrityMutation(shipmentId: string) {
  return useMutation({
    mutationFn: () => fetchShipmentIntegrity(shipmentId),
  });
}

export function useRecallShipmentLotMutation(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lotId, reason }: { lotId: string; reason: string }) =>
      recallShipmentLot(lotId, reason),
    onSuccess: () => {
      invalidateShipmentQueries(queryClient, shipmentId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}
