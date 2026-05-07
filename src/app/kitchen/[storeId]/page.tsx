import { KitchenBoard } from "@/components/kitchen/kitchen-board";

export default async function KitchenPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <KitchenBoard storeId={storeId} />;
}
