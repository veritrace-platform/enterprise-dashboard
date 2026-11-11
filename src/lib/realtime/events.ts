import { z } from "zod";
import type { components } from "@/lib/api/telemetry";

export type NotificationMessage = components["schemas"]["NotificationMessage"];
export type ClientMessage = components["schemas"]["ClientMessage"];
export type NotificationBreachConfirmed =
  components["schemas"]["NotificationBreachConfirmed"];
export type NotificationBreachResolved =
  components["schemas"]["NotificationBreachResolved"];
export type NotificationRecall = components["schemas"]["NotificationRecall"];
export type NotificationReading = components["schemas"]["NotificationReading"];
export type NotificationSubscription =
  components["schemas"]["NotificationSubscription"];
export type NotificationError = components["schemas"]["NotificationError"];

const envelopeSchema = z.object({
  id: z.string(),
  sent_at: z.string(),
});

export const breachConfirmedDataSchema = z.object({
  incident_id: z.string(),
  shipment_id: z.string(),
  sscc: z.string(),
  device_id: z.string(),
  started_at: z.string(),
  confirmed_at: z.string(),
  min_temp_celsius: z.number(),
  max_temp_celsius: z.number(),
  temperature_celsius: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  incident_hash: z.string(),
  product_name: z.string(),
  gtin: z.string(),
});

export const breachResolvedDataSchema = z.object({
  incident_id: z.string(),
  sscc: z.string(),
  ended_at: z.string(),
  duration_seconds: z.number(),
  extreme_temperature_celsius: z.number(),
});

export const recallDataSchema = z.object({
  shipment_id: z.string(),
  sscc: z.string(),
  recall_id: z.string(),
  gtin: z.string(),
  lot_number: z.string(),
  product_name: z.string(),
  reason: z.string(),
});

export const readingDataSchema = z.object({
  device_id: z.string(),
  sscc: z.string(),
  recorded_at: z.string(),
  temperature_celsius: z.number(),
  humidity_percent: z.number().nullable(),
  latitude: z.number(),
  longitude: z.number(),
});

export const subscriptionDataSchema = z.object({
  channel: z.literal("telemetry"),
  sscc: z.string(),
});

export const errorDataSchema = z.object({
  code: z.enum(["FORBIDDEN", "NOT_FOUND", "INVALID_MESSAGE"]),
  message: z.string(),
});

export const notificationMessageSchema = z.discriminatedUnion("type", [
  envelopeSchema.extend({
    type: z.literal("cold_chain.breach_confirmed"),
    data: breachConfirmedDataSchema,
  }),
  envelopeSchema.extend({
    type: z.literal("cold_chain.breach_resolved"),
    data: breachResolvedDataSchema,
  }),
  envelopeSchema.extend({
    type: z.literal("shipment.recalled"),
    data: recallDataSchema,
  }),
  envelopeSchema.extend({
    type: z.literal("telemetry.reading"),
    data: readingDataSchema,
  }),
  envelopeSchema.extend({
    type: z.literal("subscribed"),
    data: subscriptionDataSchema,
  }),
  envelopeSchema.extend({
    type: z.literal("unsubscribed"),
    data: subscriptionDataSchema,
  }),
  envelopeSchema.extend({
    type: z.literal("error"),
    data: errorDataSchema,
  }),
]);

export function parseNotificationMessage(
  raw: string,
): NotificationMessage | null {
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = notificationMessageSchema.safeParse(json);
    if (!parsed.success) {
      return null;
    }
    return parsed.data as NotificationMessage;
  } catch {
    return null;
  }
}
