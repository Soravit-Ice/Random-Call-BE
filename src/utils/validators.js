import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  radiusKmDefault: z.number().min(1).max(1000).optional()
});

export const postSchema = z.object({
  content: z.string().min(1).max(500)
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z
    .object({
      p256dh: z.string().min(1),
      auth: z.string().min(1)
    })
    .partial()
    .optional()
});

export function validate(schema, payload) {
  try {
    return schema.parse(payload);
  } catch (err) {
    const message = err.errors?.[0]?.message || "Invalid payload";
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
}
