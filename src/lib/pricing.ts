import type { DiscountType, Product } from "./types";

export function productFinalPrice(product: Product) {
  const effective = effectiveProduct(product);
  return calculateDiscountedPrice(effective.price, product.discountType, product.discountValue);
}

export function effectiveProduct(product: Product, now = new Date()): Product {
  const change = latestEffectiveScheduledChange(product, now);
  if (!change) return product;
  return {
    ...product,
    price: typeof change.price === "number" ? change.price : product.price,
    cost: typeof change.cost === "number" ? change.cost : product.cost,
    isAvailable: typeof change.isActive === "boolean" ? change.isActive : product.isAvailable
  };
}

export function productIsAvailable(product: Product, now = new Date()) {
  const effective = effectiveProduct(product, now);
  return effective.isAvailable && !effective.isSoldOut;
}

function latestEffectiveScheduledChange(product: Product, now: Date) {
  const time = now.getTime();
  return (product.scheduledChanges ?? [])
    .filter((change) => {
      const effectiveAt = Date.parse(change.effectiveAt);
      return Number.isFinite(effectiveAt) && effectiveAt <= time;
    })
    .sort((a, b) => Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
}

export function calculateDiscountedPrice(price: number, discountType: DiscountType = "none", discountValue = 0) {
  if (!discountValue || discountType === "none") return price;
  if (discountType === "percent") return Math.max(0, Math.round(price * (discountValue / 100)));
  if (discountType === "amount") return Math.max(0, price - discountValue);
  if (discountType === "specialPrice") return Math.max(0, discountValue);
  return price;
}

export function discountLabel(discountType: DiscountType = "none", discountValue = 0) {
  if (!discountValue || discountType === "none") return "";
  if (discountType === "percent") return `${discountValue} 折`;
  if (discountType === "amount") return `折 $${discountValue}`;
  if (discountType === "specialPrice") return `特價 $${discountValue}`;
  return "";
}
