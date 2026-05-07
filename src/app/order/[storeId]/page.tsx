import { OrderPageClient } from "@/components/order/order-page-client";

export default async function OrderPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <OrderPageClient storeId={storeId} />;
}
