/**
 * Zod request/response schemas — one definition per shape, imported by both
 * the client (instant feedback) and the API routes (authoritative checks).
 */
import { z } from "zod";
import { PRICING } from "./pricing";
import { isAcceptablePassword, isValidPincode, normalizeMobile } from "./validators";
import { DEFAULT_COUNTRY_CODE } from "./config";

const mobileField = (field = "Mobile number") =>
  z
    .string({ error: `${field} is required` })
    .trim()
    .refine((v) => normalizeMobile(v, DEFAULT_COUNTRY_CODE) !== null, {
      message: `${field} must be a valid 10-digit number`,
    });

const passwordField = z
  .string({ error: "Password is required" })
  .max(72, "Password must be at most 72 characters")
  .refine(isAcceptablePassword, {
    message: "Password must be 8+ characters with at least one letter and one number",
  })
  // Stray pasted whitespace silently poisons an account (you can't retype a
  // space you didn't know existed), so it never reaches the hash.
  .transform((s) => s.trim());

export const signupSchema = z
  .object({
    name: z.string({ error: "Name is required" }).trim().min(2, "Name looks too short").max(80, "Name looks too long"),
    mobile: mobileField(),
    password: passwordField,
    confirmPassword: z
      .string({ error: "Please confirm your password" })
      .transform((s) => s.trim()),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  mobile: mobileField(),
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export const deliveryAddressSchema = z.object({
  fullName: z.string({ error: "Full name is required" }).trim().min(2, "Full name is required").max(80),
  mobile: mobileField(),
  line1: z.string({ error: "Address line 1 is required" }).trim().min(3, "Address line 1 is required").max(120),
  line2: z.string().trim().max(120).optional().default(""),
  city: z.string({ error: "City is required" }).trim().min(2, "City is required").max(60),
  state: z.string({ error: "State is required" }).trim().min(2, "State is required").max(60),
  pincode: z
    .string({ error: "Pincode is required" })
    .trim()
    .refine(isValidPincode, { message: "Pincode must be a valid 6-digit code" }),
  landmark: z.string().trim().max(120).optional().default(""),
});

export const orderItemInputSchema = z.object({
  documentId: z.string().uuid("Invalid document reference"),
  copies: z
    .number({ error: "Copies must be a number" })
    .int("Copies must be a whole number")
    .min(1, "Copies must be at least 1")
    .max(PRICING.maxCopiesPerDoc, `Copies cannot exceed ${PRICING.maxCopiesPerDoc}`),
  colorMode: z.enum(["bw", "color"], { error: "Color mode must be bw or color" }),
});

export const createOrderSchema = z.object({
  items: z
    .array(orderItemInputSchema)
    .min(1, "Add at least one document before checkout")
    .max(PRICING.maxDocsPerOrder, `An order can contain at most ${PRICING.maxDocsPerOrder} documents`),
  address: deliveryAddressSchema,
  paymentMethod: z.enum(["upi", "cod"], { error: "Payment method must be upi or cod" }),
  upiId: z.string().trim().max(100).optional(),
  expectedTotalPaise: z
    .number({ error: "expectedTotalPaise is required" })
    .int("expectedTotalPaise must be an integer")
    .min(0, "expectedTotalPaise cannot be negative"),
  idempotencyKey: z
    .string({ error: "idempotencyKey is required" })
    .trim()
    .min(8, "idempotencyKey is too short")
    .max(64, "idempotencyKey is too long"),
});

export const quoteRequestSchema = z.object({
  items: z
    .array(
      z.object({
        pageCount: z.number().int().min(1, "Page count must be at least 1").max(100000),
        copies: z.number().int().min(1).max(PRICING.maxCopiesPerDoc),
        colorMode: z.enum(["bw", "color"]),
      }),
    )
    .min(1, "Add at least one document before checkout")
    .max(PRICING.maxDocsPerOrder),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
