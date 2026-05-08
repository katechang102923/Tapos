import { AdminStoreMenu } from "@/components/admin/admin-store-menu";

export default async function AdminStoreMenuPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <AdminStoreMenu storeId={storeId} />;
}
