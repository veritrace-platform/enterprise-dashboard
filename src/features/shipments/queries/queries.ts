"use client";

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { operations } from "@/lib/api/schema";
import {
  createShipment,
  getShipment,
  listShipments,
} from "../api";

type ListShipmentsQuery = NonNullable<
  operations["listShipments"]["parameters"]["query"]
>;

export const shipmentKeys = {
  all: ["shipments"] as const,
  list: (query: ListShipmentsQuery) =>
    [...shipmentKeys.all, "list", query] as const,
  detail: (id: string) =>
    [...shipmentKeys.all, "detail", id] as const,
};

export function shipmentsQueryOptions(
  query: ListShipmentsQuery = {},
) {
  return queryOptions({
    queryKey: shipmentKeys.list(query),
    queryFn: () => listShipments(query),
  });
}

export function shipmentQueryOptions(id: string) {
  return queryOptions({
    queryKey: shipmentKeys.detail(id),
    queryFn: () => getShipment(id),
  });
}

export function useShipments(query: ListShipmentsQuery = {}) {
  return useQuery(shipmentsQueryOptions(query));
}

export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createShipment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: shipmentKeys.all,
      });
    },
  });
}