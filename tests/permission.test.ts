import { describe, expect, it } from "vitest";
import {
  canAccessDashboard,
  canAssignCarrier,
  canAssignDriver,
  canCancelShipment,
  canConfirmDelivery,
  canIssuePickupCode,
  canModifyUserRoleOrActive,
  canRecallLot,
  canSeeNavItem,
  type Shipment,
} from "@/lib/auth/permission";
import type { SessionUser } from "@/lib/auth/session";

function makeUser(
  role: SessionUser["role"],
  tenantId = "tenant-owner",
  tenantCode = "SGFRESH",
  userId = "user-1",
): SessionUser {
  return {
    id: userId,
    email: "user@example.com",
    full_name: "Test User",
    phone: null,
    role,
    is_active: true,
    last_login_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    tenant: {
      id: tenantId,
      code: tenantCode,
      legal_name: "Test Tenant",
      gs1_company_prefix: "8930001",
      status: "ACTIVE",
    },
  };
}

function makeShipment(
  overrides: Partial<
    Pick<
      Shipment,
      | "status"
      | "owner_tenant_id"
      | "carrier_tenant_id"
      | "consignee_tenant_id"
      | "assigned_driver_id"
      | "participants"
    >
  > = {},
) {
  return {
    status: "CREATED" as const,
    owner_tenant_id: "tenant-owner",
    carrier_tenant_id: "tenant-owner",
    consignee_tenant_id: "tenant-consignee",
    assigned_driver_id: null,
    participants: [
      {
        tenant_id: "tenant-owner",
        role: "OWNER" as const,
        tenant_code: "SGFRESH",
        legal_name: "Saigon Fresh",
      },
      {
        tenant_id: "tenant-owner",
        role: "CARRIER" as const,
        tenant_code: "SGFRESH",
        legal_name: "Saigon Fresh",
      },
      {
        tenant_id: "tenant-consignee",
        role: "CONSIGNEE" as const,
        tenant_code: "D7MART",
        legal_name: "D7 Mart",
      },
    ],
    ...overrides,
  };
}

describe("access control policy matrix", () => {
  it("restricts dashboard access and navigation by role", () => {
    const admin = makeUser("ADMIN");
    const wm = makeUser("WAREHOUSE_MANAGER");
    const driver = makeUser("DRIVER");

    expect(canAccessDashboard(admin)).toBe(true);
    expect(canAccessDashboard(wm)).toBe(true);
    expect(canAccessDashboard(driver)).toBe(false);

    expect(canSeeNavItem(admin, "users")).toBe(true);
    expect(canSeeNavItem(admin, "locations")).toBe(true);
    expect(canSeeNavItem(wm, "users")).toBe(false);
    expect(canSeeNavItem(wm, "locations")).toBe(false);
    expect(canSeeNavItem(wm, "shipments")).toBe(true);
  });

  it("prevents an admin from modifying their own role or active flag", () => {
    const admin = makeUser("ADMIN", "t-1", "SGFRESH", "admin-1");
    expect(canModifyUserRoleOrActive(admin, { id: "admin-1" }).allowed).toBe(
      false,
    );
    expect(canModifyUserRoleOrActive(admin, { id: "other-user" }).allowed).toBe(
      true,
    );
  });

  it("enforces carrier assignment preconditions (OWNER, CREATED, no external carrier yet)", () => {
    const ownerWm = makeUser("WAREHOUSE_MANAGER", "tenant-owner", "SGFRESH");
    const consigneeWm = makeUser(
      "WAREHOUSE_MANAGER",
      "tenant-consignee",
      "D7MART",
    );

    const inHouseShipment = makeShipment();
    expect(canAssignCarrier(ownerWm, inHouseShipment).allowed).toBe(true);
    expect(canAssignCarrier(consigneeWm, inHouseShipment).allowed).toBe(false);

    const externalCarrierAssigned = makeShipment({
      carrier_tenant_id: "tenant-carrier",
    });
    expect(canAssignCarrier(ownerWm, externalCarrierAssigned)).toEqual({
      allowed: false,
      reasonKey: "permissions.externalCarrierAlreadyAssigned",
    });
  });

  it("enforces driver assignment and pickup code issuance rules", () => {
    const ownerWm = makeUser("WAREHOUSE_MANAGER", "tenant-owner", "SGFRESH");
    const carrierWm = makeUser(
      "WAREHOUSE_MANAGER",
      "tenant-carrier",
      "MEKONG_COLD",
    );

    const shipmentWithExternalCarrier = makeShipment({
      carrier_tenant_id: "tenant-carrier",
      participants: [
        {
          tenant_id: "tenant-owner",
          role: "OWNER",
          tenant_code: "SGFRESH",
          legal_name: "Saigon Fresh",
        },
        {
          tenant_id: "tenant-carrier",
          role: "CARRIER",
          tenant_code: "MEKONG_COLD",
          legal_name: "Mekong Cold",
        },
        {
          tenant_id: "tenant-consignee",
          role: "CONSIGNEE",
          tenant_code: "D7MART",
          legal_name: "D7 Mart",
        },
      ],
    });

    expect(canAssignDriver(ownerWm, shipmentWithExternalCarrier).allowed).toBe(
      false,
    );
    expect(
      canAssignDriver(carrierWm, shipmentWithExternalCarrier).allowed,
    ).toBe(true);

    // Pickup code requires OWNER + CREATED + driver assigned
    expect(
      canIssuePickupCode(ownerWm, shipmentWithExternalCarrier).allowed,
    ).toBe(false);

    const withDriver = {
      ...shipmentWithExternalCarrier,
      assigned_driver_id: "driver-1",
    };
    expect(canIssuePickupCode(ownerWm, withDriver).allowed).toBe(true);
    expect(canIssuePickupCode(carrierWm, withDriver).allowed).toBe(false);
  });

  it("enforces delivery confirmation (CONSIGNEE + IN_TRANSIT) and cancellation (OWNER + CREATED)", () => {
    const ownerAdmin = makeUser("ADMIN", "tenant-owner", "SGFRESH");
    const consigneeWm = makeUser(
      "WAREHOUSE_MANAGER",
      "tenant-consignee",
      "D7MART",
    );

    const createdShipment = makeShipment({ status: "CREATED" });
    expect(canCancelShipment(ownerAdmin, createdShipment).allowed).toBe(true);
    expect(canConfirmDelivery(consigneeWm, createdShipment).allowed).toBe(
      false,
    );

    const inTransitShipment = makeShipment({ status: "IN_TRANSIT" });
    expect(canCancelShipment(ownerAdmin, inTransitShipment).allowed).toBe(
      false,
    );
    expect(canConfirmDelivery(consigneeWm, inTransitShipment).allowed).toBe(
      true,
    );
    expect(canConfirmDelivery(ownerAdmin, inTransitShipment).allowed).toBe(
      false,
    );
  });

  it("locks all shipment actions when RECALLED and restricts lot recall to lot OWNER ADMIN", () => {
    const ownerAdmin = makeUser("ADMIN", "tenant-owner", "SGFRESH");
    const ownerWm = makeUser("WAREHOUSE_MANAGER", "tenant-owner", "SGFRESH");
    const holderAdmin = makeUser("ADMIN", "tenant-consignee", "D7MART");

    const recalledShipment = makeShipment({
      status: "RECALLED",
      assigned_driver_id: "driver-1",
    });
    expect(canAssignCarrier(ownerAdmin, recalledShipment).allowed).toBe(false);
    expect(canIssuePickupCode(ownerAdmin, recalledShipment).allowed).toBe(
      false,
    );
    expect(canCancelShipment(ownerAdmin, recalledShipment).allowed).toBe(false);

    const activeLot = {
      owner_tenant_id: "tenant-owner",
      status: "ACTIVE" as const,
    };
    expect(canRecallLot(ownerAdmin, activeLot).allowed).toBe(true);
    expect(canRecallLot(ownerWm, activeLot).allowed).toBe(false);
    expect(canRecallLot(holderAdmin, activeLot).allowed).toBe(false);
  });
});

