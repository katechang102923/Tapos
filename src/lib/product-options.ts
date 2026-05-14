import type { OrderItemOption, Product, ProductOptionGroup, SharedOptionGroup } from "./types";

/** Maximum nesting depth (0-indexed). 3 means levels 0–3, giving 4 visible group rows. */
const MAX_DEPTH = 3;

function legacyPriceDelta(value: string) {
  return Number(value.match(/\+(\d+)/)?.[1] ?? 0);
}

export function legacySelections(product: Product): OrderItemOption[] {
  return (product.options ?? []).flatMap((option, index) => {
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

function isSharedGroupReference(group: ProductOptionGroup) {
  return group.sourceType === "shared" || Boolean(group.groupId || group.sharedGroupId);
}

function resolveSharedGroupReference(group: ProductOptionGroup, sharedGroups: (ProductOptionGroup | SharedOptionGroup)[]) {
  if (!isSharedGroupReference(group)) return group;
  const sharedId = group.groupId ?? group.sharedGroupId ?? group.id.replace(/^shared-/, "");
  const shared = sharedGroups.find((item) => item.id === sharedId);
  if (!shared) {
    return {
      ...group,
      id: group.id,
      name: group.name || "共用群組",
      groupName: group.groupName || group.name || "共用群組",
      options: group.options ?? []
    };
  }
  return {
    ...shared,
    id: shared.id,
    sourceType: "shared" as const,
    groupId: shared.id,
    sharedGroupId: shared.id
  };
}

export function productOptionGroups(product: Product, sharedGroups: (ProductOptionGroup | SharedOptionGroup)[] = []): ProductOptionGroup[] {
  if (product.optionGroups?.length) return product.optionGroups.map((group) => resolveSharedGroupReference(group, sharedGroups));
  return (product.options ?? []).map((option, index) => ({
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

export function visibleOptionGroups(product: Product, selected: OrderItemOption[], sharedGroups: (ProductOptionGroup | SharedOptionGroup)[] = []) {
  const groups = productOptionGroups(product, sharedGroups);
  const childIds = new Set(groups.flatMap((group) => group.options.flatMap((option) => option.nextGroupIds ?? [])));
  const selectedChoiceIds = new Set(selected.map((item) => item.choiceId));

  function resolveChildGroups(option: ProductOptionGroup["options"][number]): ProductOptionGroup[] {
    return [
      ...(option.children ?? []),
      ...(option.nextGroupIds ?? []).flatMap((id) => groups.filter((g) => g.id === id)),
      ...(option.childGroupIds ?? []).flatMap((id) => sharedGroups.filter((g) => g.id === id))
    ];
  }

  function collect(nextGroups: ProductOptionGroup[], depth: number, ancestors: ReadonlySet<string>): ProductOptionGroup[] {
    if (depth > MAX_DEPTH) return [];
    return nextGroups.flatMap((group) => {
      if (ancestors.has(group.id)) return [];
      const nextAncestors = new Set([...ancestors, group.id]);
      const childGroups = group.options
        .filter((option) => selectedChoiceIds.has(option.id))
        .flatMap(resolveChildGroups);
      return [group, ...collect(childGroups, depth + 1, nextAncestors)];
    });
  }

  const rootGroups = groups.filter((group) => !childIds.has(group.id));
  return collect(rootGroups, 0, new Set());
}

export function optionGroupLevels(product: Product, selected: OrderItemOption[], sharedGroups: (ProductOptionGroup | SharedOptionGroup)[] = []) {
  const groups = productOptionGroups(product, sharedGroups);
  const selectedChoiceIds = new Set(selected.map((item) => item.choiceId));
  const levels = new Map<string, number>();

  function walk(nextGroups: ProductOptionGroup[], level: number, ancestors: ReadonlySet<string>) {
    if (level > MAX_DEPTH) return;
    nextGroups.forEach((group) => {
      if (ancestors.has(group.id)) return;
      levels.set(group.id, level);
      const nextAncestors = new Set([...ancestors, group.id]);
      group.options
        .filter((option) => selectedChoiceIds.has(option.id))
        .forEach((option) => {
          const childGroups = [
            ...(option.children ?? []),
            ...(option.nextGroupIds ?? []).flatMap((id) => groups.filter((g) => g.id === id)),
            ...(option.childGroupIds ?? []).flatMap((id) => sharedGroups.filter((g) => g.id === id))
          ];
          walk(childGroups, level + 1, nextAncestors);
        });
    });
  }

  walk(groups, 0, new Set());
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
