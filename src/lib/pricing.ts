import type { DiscountType, Product } from "./types";

export function productFinalPrice(product: Product) {
  return calculateDiscountedPrice(product.price, product.discountType, product.discountValue);
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
