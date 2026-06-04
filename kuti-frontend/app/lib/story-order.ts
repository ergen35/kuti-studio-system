export type OrderedEntity = {
  id: string;
  orderIndex: number;
};

export function getOrderSwap<T extends OrderedEntity>(
  items: T[],
  itemId: string,
  direction: -1 | 1,
) {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  const index = sorted.findIndex((item) => item.id === itemId);

  if (index < 0) {
    return null;
  }

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= sorted.length) {
    return null;
  }

  return {
    current: sorted[index],
    target: sorted[targetIndex],
  };
}
