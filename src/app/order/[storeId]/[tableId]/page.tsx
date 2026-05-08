import { OrderPageClient } from "@/components/order/order-page-client";

export default async function TableOrderPage({ params }: { params: Promise<{ storeId: string; tableId: string }> }) {
  const { storeId, tableId } = await params;
  return <OrderPageClient storeId={storeId} tableId={tableId} />;
}
