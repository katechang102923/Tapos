import type { Promotion, PromotionDiscountLine, Product } from "./types";

type PromotionLine = { product: Product; quantity: number; unitPrice: number };

function matchesTarget(product: Product, promotion: Promotion) {
  if (promotion.targetProducts.length === 0 && promotion.targetCategories.length === 0) return true;
  return promotion.targetProducts.includes(product.id) || promotion.targetCategories.includes(product.categoryId);
}

export function calculatePromotions(
  lines: PromotionLine[],
  promotions: Promotion[]
): { discountTotal: number; appliedPromotions: PromotionDiscountLine[] } {
  if (lines.length === 0 || promotions.length === 0) {
    return { discountTotal: 0, appliedPromotions: [] };
  }

  const today = new Date().toISOString().slice(0, 10);
  const active = promotions
    .filter((p) => p.enabled && p.startDate <= today && p.endDate >= today)
    .sort((a, b) => b.priority - a.priority);

  const appliedPromotions: PromotionDiscountLine[] = [];
  let discountTotal = 0;
  let nonStackableApplied = false;

  for (const promotion of active) {
    if (!promotion.stackable && nonStackableApplied) continue;

    const targetLines = lines.filter((line) => matchesTarget(line.product, promotion));
    if (targetLines.length === 0) continue;

    let amount = 0;

    if (promotion.type === "percent_discount") {
      const subtotal = targetLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
      amount = Math.round((subtotal * promotion.discountPercent) / 100);
    } else if (promotion.type === "amount_discount") {
      const subtotal = targetLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
      amount = Math.min(promotion.discountAmount, subtotal);
    } else if (promotion.type === "buy_one_get_one") {
      for (const line of targetLines) {
        if (line.quantity >= 2) {
          amount += line.unitPrice * Math.floor(line.quantity / 2);
        }
      }
    } else if (promotion.type === "buy_x_get_y" && promotion.buyQty > 0) {
      const totalQty = targetLines.reduce((sum, line) => sum + line.quantity, 0);
      const sets = Math.floor(totalQty / promotion.buyQty);
      if (sets > 0) {
        const prices: number[] = [];
        for (const line of targetLines) {
          for (let i = 0; i < line.quantity; i++) prices.push(line.unitPrice);
        }
        prices.sort((a, b) => a - b); // cheapest first → auto-apply to lowest price
        const freeCount = Math.min(sets * promotion.freeQty, prices.length);
        amount = prices.slice(0, freeCount).reduce((sum, p) => sum + p, 0);
      }
    } else if (promotion.type === "second_half_price") {
      // Each pair of items: the cheaper one (second) is 50% off.
      // Sort descending so every second index (1, 3, 5…) is the cheaper of its pair.
      const prices: number[] = [];
      for (const line of targetLines) {
        for (let i = 0; i < line.quantity; i++) prices.push(line.unitPrice);
      }
      prices.sort((a, b) => b - a); // most expensive first
      for (let i = 1; i < prices.length; i += 2) {
        amount += Math.round(prices[i] * 0.5);
      }
    }

    if (amount > 0) {
      appliedPromotions.push({ promotionId: promotion.id, promotionName: promotion.name, amount });
      discountTotal += amount;
      if (!promotion.stackable) nonStackableApplied = true;
    }
  }

  return { discountTotal, appliedPromotions };
}
