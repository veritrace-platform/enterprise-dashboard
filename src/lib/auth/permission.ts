import type { components } from "@/lib/api/core";
import type { SessionUser, UserRole } from "./session";

export type Shipment = components["schemas"]["Shipment"];
export type ShipmentStatus = components["schemas"]["ShipmentStatus"];
export type ParticipantRole = components["schemas"]["ParticipantRole"];
export type Lot = components["schemas"]["Lot"];
export type LotStatus = components["schemas"]["LotStatus"];
export type User = components["schemas"]["User"];

export type DashboardNavItemId =
  | "overview"
  | "shipments"
  | "lots"
  | "inventory"
  | "products"
  | "locations"
  | "alerts"
  | "users"
  | "settings";

export interface PermissionResult {
  allowed: boolean;
  reasonKey?: string;
}

const DASHBOARD_ROLES: ReadonlySet<UserRole> = new Set([
  "ADMIN",
  "WAREHOUSE_MANAGER",
  "INSPECTOR",
]);

const OPERATIONAL_ROLES: ReadonlySet<UserRole> = new Set([
  "ADMIN",
  "WAREHOUSE_MANAGER",
]);

export function canAccessDashboard(user: SessionUser | null): boolean {
  if (!user?.is_active) {
    return false;
  }
  return DASHBOARD_ROLES.has(user.role);
}

export function canSeeNavItem(
  user: SessionUser | null,
  item: DashboardNavItemId,
): boolean {
  if (!user) {
    return false;
  }

  switch (item) {
    case "overview":
    case "shipments":
    case "alerts":
    case "settings":
      return DASHBOARD_ROLES.has(user.role);
    case "lots":
    case "inventory":
    case "products":
      return OPERATIONAL_ROLES.has(user.role);
    case "locations":
    case "users":
      return user.role === "ADMIN";
  }
}

export function getShipmentParties(
  user: SessionUser | null,
  shipment: Pick<
    Shipment,
    | "owner_tenant_id"
    | "carrier_tenant_id"
    | "consignee_tenant_id"
    | "participants"
  >,
): Set<ParticipantRole> {
  const parties = new Set<ParticipantRole>();
  if (!user) {
    return parties;
  }

  const tenantId = user.tenant.id;
  const tenantCode = user.tenant.code.toUpperCase();

  if (shipment.owner_tenant_id === tenantId) {
    parties.add("OWNER");
  }
  if (shipment.carrier_tenant_id === tenantId) {
    parties.add("CARRIER");
  }
  if (shipment.consignee_tenant_id === tenantId) {
    parties.add("CONSIGNEE");
  }

  for (const participant of shipment.participants) {
    if (
      participant.tenant_id === tenantId ||
      participant.tenant_code.toUpperCase() === tenantCode
    ) {
      parties.add(participant.role);
    }
  }

  return parties;
}

export function hasExternalCarrier(
  shipment: Pick<Shipment, "owner_tenant_id" | "carrier_tenant_id">,
): boolean {
  return shipment.carrier_tenant_id !== shipment.owner_tenant_id;
}

export function canManageTenantProfile(user: SessionUser | null): boolean {
  return user?.role === "ADMIN";
}

export function canManageUsers(user: SessionUser | null): boolean {
  return user?.role === "ADMIN";
}

export function canModifyUserRoleOrActive(
  user: SessionUser | null,
  targetUser: Pick<User, "id">,
): PermissionResult {
  if (user?.role !== "ADMIN") {
    return { allowed: false, reasonKey: "permissions.adminRequired" };
  }
  if (user.id === targetUser.id) {
    return { allowed: false, reasonKey: "permissions.cannotModifySelf" };
  }
  return { allowed: true };
}

export function canListDrivers(user: SessionUser | null): boolean {
  return Boolean(user && OPERATIONAL_ROLES.has(user.role));
}

export function canManageLocations(user: SessionUser | null): boolean {
  return user?.role === "ADMIN";
}

export function canManageProducts(user: SessionUser | null): boolean {
  return Boolean(user && OPERATIONAL_ROLES.has(user.role));
}

export function canCommissionLot(user: SessionUser | null): boolean {
  return Boolean(user && OPERATIONAL_ROLES.has(user.role));
}

export function canCreateShipment(
  user: SessionUser | null,
  lot?: Pick<Lot, "status"> | null,
): PermissionResult {
  if (!user || !OPERATIONAL_ROLES.has(user.role)) {
    return { allowed: false, reasonKey: "permissions.operationalRoleRequired" };
  }
  if (lot && lot.status !== "ACTIVE") {
    return { allowed: false, reasonKey: "permissions.lotRecalled" };
  }
  return { allowed: true };
}

export function canRecallLot(
  user: SessionUser | null,
  lot: Pick<Lot, "owner_tenant_id" | "status">,
): PermissionResult {
  if (user?.role !== "ADMIN") {
    return { allowed: false, reasonKey: "permissions.adminRequired" };
  }
  if (lot.owner_tenant_id !== user.tenant.id) {
    return { allowed: false, reasonKey: "permissions.lotOwnerRequired" };
  }
  if (lot.status !== "ACTIVE") {
    return { allowed: false, reasonKey: "permissions.lotAlreadyRecalled" };
  }
  return { allowed: true };
}

export function canAssignCarrier(
  user: SessionUser | null,
  shipment: Pick<
    Shipment,
    | "status"
    | "owner_tenant_id"
    | "carrier_tenant_id"
    | "consignee_tenant_id"
    | "participants"
  >,
): PermissionResult {
  if (!user || !OPERATIONAL_ROLES.has(user.role)) {
    return { allowed: false, reasonKey: "permissions.operationalRoleRequired" };
  }
  const parties = getShipmentParties(user, shipment);
  if (!parties.has("OWNER")) {
    return { allowed: false, reasonKey: "permissions.ownerRequired" };
  }
  if (shipment.status === "RECALLED") {
    return { allowed: false, reasonKey: "permissions.shipmentRecalled" };
  }
  if (shipment.status !== "CREATED") {
    return { allowed: false, reasonKey: "permissions.requiresCreatedStatus" };
  }
  if (hasExternalCarrier(shipment)) {
    return {
      allowed: false,
      reasonKey: "permissions.externalCarrierAlreadyAssigned",
    };
  }
  return { allowed: true };
}

export function canAssignDriver(
  user: SessionUser | null,
  shipment: Pick<
    Shipment,
    | "status"
    | "owner_tenant_id"
    | "carrier_tenant_id"
    | "consignee_tenant_id"
    | "participants"
  >,
): PermissionResult {
  if (!user || !OPERATIONAL_ROLES.has(user.role)) {
    return { allowed: false, reasonKey: "permissions.operationalRoleRequired" };
  }
  const parties = getShipmentParties(user, shipment);
  if (!parties.has("CARRIER")) {
    return { allowed: false, reasonKey: "permissions.carrierRequired" };
  }
  if (shipment.status === "RECALLED") {
    return { allowed: false, reasonKey: "permissions.shipmentRecalled" };
  }
  if (shipment.status !== "CREATED") {
    return { allowed: false, reasonKey: "permissions.requiresCreatedStatus" };
  }
  return { allowed: true };
}

export function canIssuePickupCode(
  user: SessionUser | null,
  shipment: Pick<
    Shipment,
    | "status"
    | "owner_tenant_id"
    | "carrier_tenant_id"
    | "consignee_tenant_id"
    | "assigned_driver_id"
    | "participants"
  >,
): PermissionResult {
  if (!user || !OPERATIONAL_ROLES.has(user.role)) {
    return { allowed: false, reasonKey: "permissions.operationalRoleRequired" };
  }
  const parties = getShipmentParties(user, shipment);
  if (!parties.has("OWNER")) {
    return { allowed: false, reasonKey: "permissions.ownerRequired" };
  }
  if (shipment.status === "RECALLED") {
    return { allowed: false, reasonKey: "permissions.shipmentRecalled" };
  }
  if (shipment.status !== "CREATED") {
    return { allowed: false, reasonKey: "permissions.requiresCreatedStatus" };
  }
  if (!shipment.assigned_driver_id) {
    return { allowed: false, reasonKey: "permissions.driverRequired" };
  }
  return { allowed: true };
}

export function canConfirmDelivery(
  user: SessionUser | null,
  shipment: Pick<
    Shipment,
    | "status"
    | "owner_tenant_id"
    | "carrier_tenant_id"
    | "consignee_tenant_id"
    | "participants"
  >,
): PermissionResult {
  if (!user || !OPERATIONAL_ROLES.has(user.role)) {
    return { allowed: false, reasonKey: "permissions.operationalRoleRequired" };
  }
  const parties = getShipmentParties(user, shipment);
  if (!parties.has("CONSIGNEE")) {
    return { allowed: false, reasonKey: "permissions.consigneeRequired" };
  }
  if (shipment.status === "RECALLED") {
    return { allowed: false, reasonKey: "permissions.shipmentRecalled" };
  }
  if (shipment.status !== "IN_TRANSIT") {
    return { allowed: false, reasonKey: "permissions.requiresInTransitStatus" };
  }
  return { allowed: true };
}

export function canCancelShipment(
  user: SessionUser | null,
  shipment: Pick<
    Shipment,
    | "status"
    | "owner_tenant_id"
    | "carrier_tenant_id"
    | "consignee_tenant_id"
    | "participants"
  >,
): PermissionResult {
  if (!user || !OPERATIONAL_ROLES.has(user.role)) {
    return { allowed: false, reasonKey: "permissions.operationalRoleRequired" };
  }
  const parties = getShipmentParties(user, shipment);
  if (!parties.has("OWNER")) {
    return { allowed: false, reasonKey: "permissions.ownerRequired" };
  }
  if (shipment.status === "RECALLED") {
    return { allowed: false, reasonKey: "permissions.shipmentRecalled" };
  }
  if (shipment.status !== "CREATED") {
    return { allowed: false, reasonKey: "permissions.requiresCreatedStatus" };
  }
  return { allowed: true };
}

export function canPrintLogisticLabel(
  user: SessionUser | null,
  shipment: Pick<
    Shipment,
    | "owner_tenant_id"
    | "carrier_tenant_id"
    | "consignee_tenant_id"
    | "participants"
  >,
): PermissionResult {
  if (!user || !OPERATIONAL_ROLES.has(user.role)) {
    return { allowed: false, reasonKey: "permissions.operationalRoleRequired" };
  }
  const parties = getShipmentParties(user, shipment);
  if (!parties.has("OWNER")) {
    return { allowed: false, reasonKey: "permissions.ownerRequired" };
  }
  return { allowed: true };
}
