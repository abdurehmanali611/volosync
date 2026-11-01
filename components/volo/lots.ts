export type LotGroup<T> = {
  key: string;
  itemName: string;
  category: string;
  lots: T[];
  quantity: number;
};

/** Lots collapse into one row per item name + category, matching Store's inventory. */
export function groupLotsByItem<
  T extends { item_name: string; category?: string | null; remaining_quantity: string },
>(lots: T[]): LotGroup<T>[] {
  const groups = new Map<string, LotGroup<T>>();
  for (const lot of lots) {
    const itemName = lot.item_name.trim();
    const category = lot.category?.trim() || "Uncategorised";
    const key = `${itemName.toLowerCase()}::${category.toLowerCase()}`;
    const group =
      groups.get(key) ??
      { key, itemName, category, lots: [], quantity: 0 };
    group.lots.push(lot);
    group.quantity += Number(lot.remaining_quantity);
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort(
    (a, b) =>
      a.itemName.localeCompare(b.itemName) || a.category.localeCompare(b.category),
  );
}

/** Case-insensitive "contains" over any of the supplied fields. */
export function matchesQuery(query: string, ...fields: unknown[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) =>
    String(field ?? "")
      .toLowerCase()
      .includes(needle),
  );
}
