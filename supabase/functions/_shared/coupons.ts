/**
 * A coupon may only be redeemed once per account. Redemptions are recorded in
 * `coupon_redemptions` at charge time; this reads that ledger back so the same
 * buyer cannot reuse a code (e.g. FREEFLEA) on every order.
 */
export async function couponAlreadyUsed(
  serviceClient: { from: (table: string) => any },
  couponId: string,
  userId: string,
): Promise<boolean> {
  if (!couponId || !userId) return false;
  try {
    const { count, error } = await serviceClient
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", couponId)
      .eq("user_id", userId);
    if (error) return false;
    return (count ?? 0) > 0;
  } catch (_) {
    return false;
  }
}
