import { z } from "zod";

/** Roll lifecycle on the warehouse floor */
export const RollStatus = z.enum(["inward", "at_job_work", "in_cutting", "depleted"]);
export type RollStatus = z.infer<typeof RollStatus>;

export const PackingStatus = z.enum([
  "packed",
  "in_godown",
  "consolidated",
  "dispatched",
  "faulty",
]);
export type PackingStatus = z.infer<typeof PackingStatus>;

export const ParcelStatus = z.enum(["open", "sealed", "dispatched"]);
export type ParcelStatus = z.infer<typeof ParcelStatus>;

export const ChallanStatus = z.enum([
  "created",
  "assigned",
  "assembling",
  "dispatched",
  "delivered",
]);
export type ChallanStatus = z.infer<typeof ChallanStatus>;

export const JobWorkState = z.enum(["outward", "inward", "closed"]);
export type JobWorkState = z.infer<typeof JobWorkState>;

export const SyncEntity = z.enum([
  "roll",
  "job_work",
  "packing",
  "parcel",
  "challan",
  "challan_scan",
  "godown_receive",
]);
export type SyncEntity = z.infer<typeof SyncEntity>;

export const SyncOutboxItem = z.object({
  client_id: z.string().uuid(),
  entity: SyncEntity,
  op: z.enum(["upsert", "delete"]),
  payload: z.record(z.string(), z.unknown()),
  updated_at: z.string(),
  device_id: z.string().min(1),
});
export type SyncOutboxItem = z.infer<typeof SyncOutboxItem>;

export const SyncPushBody = z.object({
  device_id: z.string().min(1),
  items: z.array(SyncOutboxItem).min(1).max(500),
});
export type SyncPushBody = z.infer<typeof SyncPushBody>;

export const SyncPushResultItem = z.object({
  client_id: z.string(),
  entity: SyncEntity,
  status: z.enum(["applied", "conflict", "rejected"]),
  reason: z.string().optional(),
});
export type SyncPushResultItem = z.infer<typeof SyncPushResultItem>;

export const CutPackingPayload = z.object({
  packing_id: z.string().uuid(),
  parent_roll_id: z.string().min(1),
  length_meters: z.number().positive(),
  variant_code: z.string().min(1),
  packing_date: z.string().min(1),
  notes: z.string().optional(),
  device_id: z.string().optional(),
});
export type CutPackingPayload = z.infer<typeof CutPackingPayload>;

export const ParcelCreatePayload = z.object({
  parcel_id: z.string().uuid(),
  packing_ids: z.array(z.string().uuid()).min(1).max(20),
  created_at: z.string().min(1),
  device_id: z.string().optional(),
});
export type ParcelCreatePayload = z.infer<typeof ParcelCreatePayload>;

export const ChallanScanPayload = z.object({
  scan_id: z.string().uuid(),
  challan_id: z.string().min(1),
  scan_type: z.enum(["packing", "parcel"]),
  scanned_ref: z.string().min(1),
  scanned_at: z.string().min(1),
  device_id: z.string().optional(),
});
export type ChallanScanPayload = z.infer<typeof ChallanScanPayload>;

export function shortCode(prefix: string, uuid: string): string {
  return `${prefix}${uuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
