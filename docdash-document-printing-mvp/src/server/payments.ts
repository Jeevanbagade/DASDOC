/**
 * Payment provider seam.
 *
 * `PaymentProvider` is the stable interface; the order service depends only
 * on it. Today we ship MockUpiProvider (deterministic, test-friendly).
 * A Razorpay/Stripe integration implements the same interface and is chosen
 * here via env — nothing upstream changes.
 */
import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";
import { isValidUpiId } from "@/lib/validators";
import { serverEnv } from "./env";
import { log } from "./log";

export interface PaymentChargeRequest {
  amountPaise: number;
  upiId: string;
  orderNumber: string;
}

export interface PaymentChargeResult {
  provider: string;
  status: "paid" | "failed";
  txnRef: string | null;
  failureReason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  isAvailable(): boolean;
  charge(req: PaymentChargeRequest): Promise<PaymentChargeResult>;
}

/**
 * Deterministic mock UPI gateway:
 *  - valid handle + amount > 0  → paid
 *  - handle containing "fail"   → failed (lets QA exercise the failure path)
 */
export class MockUpiProvider implements PaymentProvider {
  readonly name = "mock_upi";

  isAvailable(): boolean {
    return serverEnv.upiMockEnabled;
  }

  async charge(req: PaymentChargeRequest): Promise<PaymentChargeResult> {
    if (!this.isAvailable()) {
      throw new AppError("PAYMENT_FAILED", "UPI is temporarily unavailable — please choose Cash on Delivery");
    }
    if (!isValidUpiId(req.upiId)) {
      throw new AppError("UPI_ID_INVALID", "That UPI handle doesn't look right (expected name@bank)");
    }
    if (req.amountPaise <= 0) {
      throw new AppError("PAYMENT_FAILED", "Payment amount must be greater than zero");
    }
    // Simulate gateway latency without slowing tests to a crawl.
    await new Promise((r) => setTimeout(r, 20));
    if (/fail/i.test(req.upiId)) {
      log.warn("payment.failed", { provider: this.name, orderNumber: req.orderNumber, amountPaise: req.amountPaise });
      return {
        provider: this.name,
        status: "failed",
        txnRef: null,
        failureReason: "Your UPI app declined the collect request",
      };
    }
    const txnRef = `UPI-${randomUUID().slice(0, 8).toUpperCase()}`;
    log.info("payment.captured", { provider: this.name, orderNumber: req.orderNumber, amountPaise: req.amountPaise });
    return { provider: this.name, status: "paid", txnRef };
  }
}

export function getUpiProvider(): PaymentProvider {
  // Razorpay/Stripe: return the real provider here based on env config.
  return new MockUpiProvider();
}
