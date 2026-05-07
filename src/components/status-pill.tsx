import type { OrderStatus } from "@/lib/types";

const styles: Record<OrderStatus, string> = {
  new: "bg-tomato/10 text-tomato ring-tomato/20",
  preparing: "bg-amber-100 text-amber-700 ring-amber-200",
  completed: "bg-leaf/10 text-leaf ring-leaf/20",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200"
};

const labels: Record<OrderStatus, string> = {
  new: "新訂單",
  preparing: "製作中",
  completed: "已完成",
  cancelled: "已取消"
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
