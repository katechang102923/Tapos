import { AdminStoreEdit } from "@/components/admin/admin-store-edit";

export default async function AdminStoreEditPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <AdminStoreEdit storeId={storeId} />;
}
