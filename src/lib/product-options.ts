import type { OrderItemOption, Product, ProductOptionGroup } from "./types";

function legacyPriceDelta(value: string) {
  return Number(value.match(/\+(\d+)/)?.[1] ?? 0);
}

export function legacySelections(product: Product): OrderItemOption[] {
  return product.options.flatMap((option, index) => {
    const value = option.values[0];
    if (!value) return [];
    return [{
      groupId: `legacy-${index}`,
      groupName: option.name,
      choiceId: `legacy-${index}-0`,
      choiceName: value.replace(/\s*\+\d+$/, ""),
      priceDelta: legacyPriceDelta(value)
    }];
  });
}

export function productOptionGroups(product: Product): ProductOptionGroup[] {
  if (product.optionGroups?.length) return product.optionGroups;
  return product.options.map((option, index) => ({
    id: `legacy-${index}`,
    name: option.name,
    required: Boolean(option.required),
    minSelect: option.required ? 1 : 0,
    maxSelect: 1,
    options: option.values.map((value, optionIndex) => ({
      id: `legacy-${index}-${optionIndex}`,
      name: value.replace(/\s*\+\d+$/, ""),
      priceDelta: legacyPriceDelta(value),
      isAvailable: true
    }))
  }));
}

export function visibleOptionGroups(product: Product, selected: OrderItemOption[]) {
  const groups = productOptionGroups(product);
  const childIds = new Set(groups.flatMap((group) => group.options.flatMap((option) => option.nextGroupIds ?? [])));
  const selectedChoiceIds = new Set(selected.map((item) => item.choiceId));

  function collect(nextGroups: ProductOptionGroup[]): ProductOptionGroup[] {
    return nextGroups.flatMap((group) => {
      const selectedOptions = group.options.filter((option) => selectedChoiceIds.has(option.id));
      const children = selectedOptions.flatMap((option) => [
        ...(option.children ?? []),
        ...(option.nextGroupIds ?? []).flatMap((id) => groups.filter((candidate) => candidate.id === id))
      ]);
      return [group, ...collect(children)];
    });
  }

  const rootGroups = groups.filter((group) => !childIds.has(group.id));
  return collect(rootGroups);
}

export function optionGroupLevels(product: Product, selected: OrderItemOption[]) {
  const groups = productOptionGroups(product);
  const selectedChoiceIds = new Set(selected.map((item) => item.choiceId));
  const levels = new Map<string, number>();

  function walk(nextGroups: ProductOptionGroup[], level: number) {
    nextGroups.forEach((group) => {
      levels.set(group.id, level);
      group.options
        .filter((option) => selectedChoiceIds.has(option.id))
        .forEach((option) => walk(option.children ?? [], level + 1));
    });
  }

  walk(groups, 0);
  return levels;
}

export function selectionsTotal(selected: OrderItemOption[]) {
  return selected.reduce((sum, item) => sum + item.priceDelta, 0);
}

export function normalizeSelectedOptions(value: unknown): OrderItemOption[] {
  if (Array.isArray(value)) return value as OrderItemOption[];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, string>).map(([groupName, choiceName], index) => ({
    groupId: `legacy-${index}`,
    groupName,
    choiceId: `legacy-${index}-0`,
    choiceName,
    priceDelta: legacyPriceDelta(choiceName)
  }));
}
