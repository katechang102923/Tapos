import { OrderPageClient } from "@/components/order/order-page-client";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ table?: string; type?: string }> }) {
  const { storeId } = await params;
  const query = await searchParams;
  return <OrderPageClient storeId={storeId} tableId={query.table} orderType={query.type === "takeout" ? "takeout" : query.table ? "dine-in" : undefined} />;
}
