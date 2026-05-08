"use client";

import { useMemo, useState } from "react";
import type { OrderItemOption, Product } from "@/lib/types";
import { productFinalPrice } from "@/lib/pricing";
import { optionGroupLevels, productOptionGroups, visibleOptionGroups } from "@/lib/product-options";

export function ProductOptionModal({
  product,
  onClose,
  onConfirm
}: {
  product: Product;
  onClose: () => void;
  onConfirm: (selectedOptions: OrderItemOption[]) => void;
}) {
  const groups = useMemo(() => productOptionGroups(product), [product]);
  const [selected, setSelected] = useState<OrderItemOption[]>([]);
  const visibleGroups = visibleOptionGroups(product, selected);
  const levels = optionGroupLevels(product, selected);
  const totalDelta = selected.reduce((sum, item) => sum + item.priceDelta, 0);

  function toggle(groupId: string, groupName: string, choiceId: string, choiceName: string, priceDelta: number, maxSelect: number) {
    setSelected((current) => {
      const exists = current.some((item) => item.groupId === groupId && item.choiceId === choiceId);
      if (exists) {
        const candidate = current.filter((item) => !(item.groupId === groupId && item.choiceId === choiceId));
        const visibleIds = new Set(visibleOptionGroups(product, candidate).map((group) => group.id));
        return candidate.filter((item) => visibleIds.has(item.groupId));
      }
      const nextItem = { groupId, groupName, choiceId, choiceName, priceDelta, level: levels.get(groupId) ?? 0 };
      if (maxSelect <= 1) {
        const candidate = [...current.filter((item) => item.groupId !== groupId), nextItem];
        const visibleIds = new Set(visibleOptionGroups(product, candidate).map((group) => group.id));
        return candidate.filter((item) => visibleIds.has(item.groupId));
      }
      const sameGroup = current.filter((item) => item.groupId === groupId);
      if (sameGroup.length >= maxSelect) return current;
      const candidate = [...current, nextItem];
      const visibleIds = new Set(visibleOptionGroups(product, candidate).map((group) => group.id));
      return candidate.filter((item) => visibleIds.has(item.groupId));
    });
  }

  function missingRequired() {
    return visibleGroups.some((group) => group.required && selected.filter((item) => item.groupId === group.id).length < Math.max(1, group.minSelect));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-leaf">選擇商品選項</p>
            <h2 className="mt-1 text-3xl font-black text-ink">{product.name}</h2>
            <p className="mt-2 font-bold text-tomato">${productFinalPrice(product) + totalDelta}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 font-black text-steel">關閉</button>
        </div>
        <div className="mt-5 grid gap-4">
          {visibleGroups.map((group) => (
            <section key={group.id} className="rounded-lg border border-orange-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-black text-ink">{group.groupName ?? group.name}</h3>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-steel">{group.required ? "必選" : "非必選"} · {group.maxSelect <= 1 ? "單選" : `最多 ${group.maxSelect} 項`}</span>
              </div>
              <div className="mt-3 grid gap-2">
                {group.options.filter((option) => option.isAvailable).map((option) => {
                  const checked = selected.some((item) => item.groupId === group.id && item.choiceId === option.id);
                  return (
                    <button key={option.id} onClick={() => toggle(group.id, group.groupName ?? group.name, option.id, option.optionName ?? option.name, option.priceDelta, group.maxSelect)} className={`flex items-center justify-between rounded-lg px-4 py-3 text-left font-black ${checked ? "bg-leaf text-white" : "bg-orange-50 text-ink"}`}>
                      <span>{option.optionName ?? option.name}</span>
                      <span>{option.priceDelta > 0 ? `+$${option.priceDelta}` : "+$0"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <button disabled={missingRequired()} onClick={() => onConfirm(selected)} className="mt-5 w-full rounded-lg bg-tomato px-4 py-4 text-xl font-black text-white disabled:bg-stone-300">加入購物車</button>
      </div>
    </div>
  );
}
