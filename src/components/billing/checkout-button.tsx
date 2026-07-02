"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  plan: string;
  amountPaise: number;
  label: string;
  isLoggedIn: boolean;
};

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

export function CheckoutButton({ plan, amountPaise, label, isLoggedIn }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async () => {
    if (!isLoggedIn) {
      router.push(`/signup?next=/pricing`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Load Razorpay's checkout script lazily.
      if (typeof window !== "undefined" && !window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Razorpay script failed to load"));
          document.body.appendChild(s);
        });
      }

      const orderRes = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountPaise, plan }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(order.error || "Could not create order");
      }

      const keyId = order.key_id ?? "";
      if (!keyId || !window.Razorpay) {
        throw new Error("Payment is not configured. Please email us to upgrade.");
      }

      const rzp = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Learning Loop",
        description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`,
        theme: { color: "#c8860a" },
        handler: async (resp: Record<string, unknown>) => {
          const verifyRes = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              plan,
            }),
          });
          const data = await verifyRes.json();
          if (verifyRes.ok && data.upgraded) {
            router.push("/dashboard?upgraded=1");
            router.refresh();
          } else {
            setError(data.error || "Payment verified but upgrade failed. Email us.");
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={checkout}
        disabled={busy}
        className="btn btn-primary w-full"
      >
        {busy ? "Opening checkout..." : label}
      </button>
      {error && (
        <p className="mt-2 text-xs text-[var(--red)] font-mono text-center">{error}</p>
      )}
    </div>
  );
}
