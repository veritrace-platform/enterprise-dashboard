import type { components as CoreComponents } from "@/lib/api/core";
import type { components as TelemetryComponents } from "@/lib/api/telemetry";

export type Shipment = CoreComponents["schemas"]["Shipment"];
export type ShipmentStatus = CoreComponents["schemas"]["ShipmentStatus"];
export type ParticipantRole = CoreComponents["schemas"]["ParticipantRole"];
export type ShipmentPage = CoreComponents["schemas"]["ShipmentPage"];
export type ShipmentSummary = CoreComponents["schemas"]["ShipmentSummary"];
export type ShipmentCreateRequest =
  CoreComponents["schemas"]["ShipmentCreateRequest"];
export type ShipmentEvent = CoreComponents["schemas"]["ShipmentEvent"];
export type ShipmentEventPage = CoreComponents["schemas"]["ShipmentEventPage"];
export type Integrity = CoreComponents["schemas"]["Integrity"];
export type PickupCode = CoreComponents["schemas"]["PickupCode"];
export type DirectoryLocation = CoreComponents["schemas"]["DirectoryLocation"];
export type DirectoryTenant = CoreComponents["schemas"]["DirectoryTenant"];
export type Balance = CoreComponents["schemas"]["Balance"];
export type Lot = CoreComponents["schemas"]["Lot"];
export type Location = CoreComponents["schemas"]["Location"];
export type User = CoreComponents["schemas"]["User"];
export type Position = CoreComponents["schemas"]["Position"];

export type Incident = TelemetryComponents["schemas"]["Incident"];
export type Reading = TelemetryComponents["schemas"]["Reading"];
export type ReadingBucket = TelemetryComponents["schemas"]["ReadingBucket"];
export type ReadingSeries = TelemetryComponents["schemas"]["ReadingSeries"];

export interface ShipmentListFilters {
  status?: ShipmentStatus;
  party?: ParticipantRole;
  sscc?: string;
  lot_id?: string;
  assigned_to_me?: boolean;
  cursor?: string;
  limit?: number;
}
