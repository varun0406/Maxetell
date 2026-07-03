import axios from "axios";
import { clearAuthToken, getAuthToken } from "./auth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001",
});

api.interceptors.request.use((config) => {
  const t = getAuthToken();
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const url = String(err.config?.url ?? "");
      if (!url.includes("/auth/login") && !url.includes("/auth/register-first")) {
        clearAuthToken();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
      }
    }
    return Promise.reject(err);
  },
);

export type AuthStatus = {
  enabled: boolean;
  can_bootstrap: boolean;
  has_db_users: boolean;
};

export async function fetchAuthStatus() {
  const res = await api.get<AuthStatus>("/auth/status");
  return res.data;
}

export type AuthSession = { username: string; role: "admin" | "user" };

export async function fetchAuthSession() {
  const res = await api.get<AuthSession>("/auth/session");
  return res.data;
}

export type AppUserRow = { id: number; username: string; role: "admin" | "user"; created_at: string };

export async function fetchAppUsers() {
  const res = await api.get<{ data: AppUserRow[] }>("/auth/users");
  return res.data.data;
}

export async function createAppUser(body: { username: string; password: string; role?: "admin" | "user" }) {
  const res = await api.post<{ data: AppUserRow }>("/auth/users", body);
  return res.data.data;
}

export async function deleteAppUser(id: number) {
  await api.delete(`/auth/users/${id}`);
}

export async function registerFirstAdmin(body: { username: string; password: string }) {
  const res = await api.post<{ token: string; expires_in: number; username: string; role: "admin" }>("/auth/register-first", body);
  return res.data;
}

export type OrderRow = {
  /** Line item id (unique per grid row) */
  id: number;
  /** Work order / header id (dispatch, payments, invoice) */
  order_id: number;
  wo_no: string;
  client_po_no: string | null;
  order_date: string;
  client_name: string;
  size: string;
  item: string;
  grade: string;
  length_nos: string | null;
  order_kgs: number;
  order_pcs: number;
  dispatch_weight: number;
  dispatch_pcs: number;
  balance_kgs: number;
  balance_pcs: number;
  avg_cost: number;
  actual_avg_price: number;
  bill_rate: number;
  profit_per_kg: number;
  or_no: string | null;
  sales_date: string | null;
  weight_sold: number;
  sales_return: number;
  invoice_no: string | null;
  invoice_total: number;
  paid_amount: number;
  baki_amount: number;
  payment_status: "NoInvoice" | "Paid" | "Partial" | "Pending";
  remarks: string | null;
};

export async function fetchOrders(params?: {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  const res = await api.get<{ data: OrderRow[] }>("/orders", { params });
  return res.data.data;
}

export type CreateOrderLine = {
  size: string;
  item: string;
  grade: string;
  length_nos?: string;
  order_kgs: number;
  order_pcs?: number;
  bill_rate: number;
};

export type SplitImportRow = {
  id: number;
  code: number;
  order_id: number;
  size: string;
  item: string;
  grade: string;
  length_nos?: string | null;
  order_kgs: number;
  order_pcs: number;
  bill_rate: number;
  avg_cost?: number;
};

export async function splitImportOrders(rows: SplitImportRow[]) {
  const res = await api.post<{ success: boolean; affectedOrdersCount: number }>("/orders/split-import", rows);
  return res.data;
}

export async function createOrder(body: {
  wo_no: string;
  client_po_no?: string | null;
  order_date: string;
  client_name: string;
  remarks?: string;
  lines: CreateOrderLine[];
}) {
  const res = await api.post<{ data: OrderRow[] }>("/orders", body);
  return res.data.data;
}

export async function patchOrder(
  orderId: number,
  body: Partial<Pick<OrderRow, "invoice_no" | "invoice_total" | "paid_amount">>,
) {
  const res = await api.patch<{ data: OrderRow[] }>(`/orders/${orderId}`, body);
  return res.data.data;
}

export async function patchOrderMeta(
  orderId: number,
  body: Partial<Pick<OrderRow, "wo_no" | "client_po_no" | "order_date" | "client_name" | "remarks">>,
) {
  const res = await api.patch<{ data: OrderRow[] }>(`/orders/${orderId}/meta`, body);
  return res.data.data;
}

export async function patchOrderLine(
  lineId: number,
  body: Partial<Pick<OrderRow, "size" | "item" | "grade" | "length_nos" | "order_kgs" | "order_pcs" | "bill_rate" | "avg_cost">>,
) {
  const res = await api.patch<{ data: OrderRow }>(`/order-lines/${lineId}`, body);
  return res.data.data;
}

export async function addOrderLine(orderId: number, body: CreateOrderLine) {
  const res = await api.post<{ data: OrderRow }>(`/orders/${orderId}/lines`, body);
  return res.data.data;
}

export async function deleteOrderLine(lineId: number) {
  const res = await api.delete<{ data: OrderRow[] }>(`/order-lines/${lineId}`);
  return res.data.data;
}

export async function deleteOrder(orderId: number) {
  const res = await api.delete<{ data: { success: boolean } }>(`/orders/${orderId}`);
  return res.data.data;
}

export type MasterClient = { id: number; name: string };
export type MasterSupplier = { id: number; name: string };
export type MasterProduct = { id: number; size: string; item: string; grade: string; avg_cost: number };

export async function fetchClients() {
  const res = await api.get<{ data: MasterClient[] }>("/masters/clients");
  return res.data.data;
}
export async function fetchSuppliers() {
  const res = await api.get<{ data: MasterSupplier[] }>("/masters/suppliers");
  return res.data.data;
}
export async function fetchProducts() {
  const res = await api.get<{ data: MasterProduct[] }>("/masters/products");
  return res.data.data;
}

export type DashboardSummary = {
  total_order_kgs: number;
  total_dispatch_kgs: number;
  pending_kgs: number;
  opening_stock_kgs: number;
  minimum_stock_kgs: number;
  current_stock_kgs: number;
  purchase_required_kgs: number;
  profit_per_kg_positive_sum: number;
  profit_per_kg_negative_sum: number;
  total_orders: { c: number };
  breakdown: {
    pending_sales_orders_kgs: number;
    pending_purchase_orders_kgs: number;
    incoming_material_kgs: number;
    dispatch_kgs: number;
    dispatch_return_kgs: number;
    incoming_rm_return_kgs: number;
  };
};

export async function fetchDashboardSummary() {
  const res = await api.get<{ data: DashboardSummary }>("/dashboard/summary");
  return res.data.data;
}

export type DashboardAnalytics = {
  avg_purchase_price: number;
  monthly_summary: Array<{
    month: string;
    sales_weight: number;
    sales_amount: number;
    purchase_weight: number;
    purchase_amount: number;
    sales_return_weight: number;
    purchase_return_weight: number;
  }>;
  quarterly_sales: Array<{
    quarter: string;
    sales_weight: number;
    sales_amount: number;
  }>;
  top_clients: Array<{ name: string; total_weight: number; total_amount: number }>;
  top_products: Array<{ name: string; total_weight: number }>;
};

export async function fetchDashboardAnalytics() {
  const res = await api.get<{ data: DashboardAnalytics }>("/dashboard/analytics");
  return res.data.data;
}

export type ProductStockRow = {
  product_id: number;
  size: string;
  item: string;
  grade: string;
  receipts: number;
  purchase_returns: number;
  dispatches: number;
  sales_returns: number;
  current_stock: number;
  actual_avg_price: number;
};

export async function fetchProductStockBreakdown() {
  const res = await api.get<{ data: ProductStockRow[] }>("/dashboard/product_stock");
  return res.data.data;
}

export type ProductLedgerRow = {
  type: string;
  date: string;
  weight: number;
  ref: string | null;
  balance: number;
};

export async function fetchProductLedger(productId: number) {
  const res = await api.get<{ data: ProductLedgerRow[] }>(`/dashboard/product_ledger/${productId}`);
  return res.data.data;
}

export type InventoryLedgerRow = {
  transaction_type: string;
  date: string;
  product_id: number;
  item: string;
  size: string;
  grade: string;
  inward_quantity: number;
  outward_quantity: number;
  balance_quantity: number;
  reference_number: string | null;
  client_po: string | null;
  rate: number;
  actual_avg_price: number;
};

export async function fetchInventoryLedger() {
  const res = await api.get<{ data: InventoryLedgerRow[] }>("/inventory/ledger");
  return res.data.data;
}

export async function patchOpeningStock(opening_stock_kgs: number) {
  const res = await api.patch<{ data: { opening_stock_kgs: number } }>("/inventory/opening-stock", {
    opening_stock_kgs,
  });
  return res.data.data;
}

export async function patchMinimumStock(minimum_stock_kgs: number) {
  const res = await api.patch<{ data: { minimum_stock_kgs: number } }>("/inventory/minimum-stock", {
    minimum_stock_kgs,
  });
  return res.data.data;
}

export type DispatchEntry = {
  id: number;
  order_line_item_id?: number | null;
  item?: string;
  size?: string;
  grade?: string;
  dispatch_date: string;
  dispatch_weight: number;
  dispatch_pcs: number;
  bundle_no: string | null;
  transport: string | null;
  sales_rate: number;
  packing_weight: number;
  actual_avg_price?: number;
  tally_bill_nos?: string[];
  created_at: string;
};

export async function createDispatch(
  orderId: number,
  body: {
    dispatch_date: string;
    dispatch_weight: number;
    dispatch_pcs?: number;
    bundle_no?: string;
    transport?: string;
    sales_rate?: number;
    packing_weight?: number;
    tally_bill_nos?: string[];
  },
) {
  const res = await api.post<{ data: OrderRow[] }>(`/orders/${orderId}/dispatch`, body);
  return res.data.data;
}

export async function fetchDispatch(orderId: number) {
  const res = await api.get<{ data: DispatchEntry[] }>(`/orders/${orderId}/dispatch`);
  return res.data.data;
}

// Item-wise dispatch (compat with older/newer backends)
export async function fetchDispatchForLine(lineId: number) {
  const res = await api.get<{ data: DispatchEntry[] }>(`/order-lines/${lineId}/dispatch`);
  return res.data.data;
}

export async function createDispatchForLine(
  lineId: number,
  body: {
    dispatch_date: string;
    dispatch_weight: number;
    dispatch_pcs?: number;
    bundle_no?: string;
    transport?: string;
    sales_rate?: number;
    packing_weight?: number;
    tally_bill_nos?: string[];
  },
) {
  const res = await api.post<{ data: OrderRow[] }>(`/order-lines/${lineId}/dispatch`, body);
  return res.data.data;
}

export async function addDispatchTallyBill(dispatchId: number, bill_no: string) {
  const res = await api.post<{ data: { success: true } }>(`/dispatch/${dispatchId}/tally-bills`, { bill_no });
  return res.data.data;
}

export async function patchDispatch(
  dispatchId: number,
  body: Partial<Pick<DispatchEntry, "dispatch_date" | "dispatch_weight" | "dispatch_pcs" | "bundle_no" | "transport" | "sales_rate" | "packing_weight">>,
) {
  const res = await api.patch<{ data: OrderRow[] }>(`/dispatch/${dispatchId}`, body);
  return res.data.data;
}

export async function deleteDispatch(dispatchId: number) {
  const res = await api.delete<{ data: OrderRow[] }>(`/dispatch/${dispatchId}`);
  return res.data.data;
}

export type PurchaseLedgerRow = {
  id: number;
  po_no: string | null;
  client_po_no: string | null;
  purchase_date: string;
  supplier_name: string;
  size: string | null;
  item: string | null;
  grade: string | null;
  weight: number;
  received_weight: number;
  balance_weight: number;
  rate: number;
  amount_ordered: number;
  amount_received: number;
  debit_note: string | null;
  rec_note: string | null;
  remarks: string | null;
  actual_avg_price: number;
};

export async function createPurchase(body: {
  supplier_name: string;
  po_no?: string;
  client_po_no?: string;
  purchase_date: string;
  weight: number;
  rate: number;
  debit_note?: string;
  size: string;
  item: string;
  grade: string;
  remarks?: string;
}) {
  const res = await api.post<{ data: PurchaseLedgerRow }>("/purchase", body);
  return res.data.data;
}

export async function createPurchaseBatch(body: {
  supplier_name: string;
  po_no?: string;
  client_po_no?: string;
  purchase_date: string;
  lines: Array<{
    weight: number;
    rate: number;
    debit_note?: string;
    size: string;
    item: string;
    grade: string;
    remarks?: string;
  }>;
}) {
  const res = await api.post<{ data: PurchaseLedgerRow[] }>("/purchase/batch", body);
  return res.data.data;
}

export async function fetchPurchaseLedger() {
  const res = await api.get<{ data: PurchaseLedgerRow[] }>("/purchase-ledger");
  return res.data.data;
}

export type PurchaseReceiptRow = {
  id: number;
  receipt_date: string;
  weight_received: number;
  note: string | null;
  created_at: string;
};

export async function fetchPurchaseReceipts(purchaseId: number) {
  const res = await api.get<{ data: PurchaseReceiptRow[] }>(`/purchase/${purchaseId}/receipts`);
  return res.data.data;
}

export async function createPurchaseReceipt(
  purchaseId: number,
  body: { receipt_date: string; weight_received: number; note?: string },
) {
  const res = await api.post<{ data: PurchaseLedgerRow }>(`/purchase/${purchaseId}/receipt`, body);
  return res.data.data;
}

export async function patchPurchase(
  purchaseId: number,
  body: Partial<
    Pick<PurchaseLedgerRow, "supplier_name" | "po_no" | "client_po_no" | "purchase_date" | "weight" | "rate" | "debit_note" | "rec_note" | "size" | "item" | "grade" | "remarks">
  >,
) {
  const res = await api.patch<{ data: PurchaseLedgerRow }>(`/purchase/${purchaseId}`, body);
  return res.data.data;
}

export async function patchPurchaseReceipt(
  receiptId: number,
  body: Partial<Pick<PurchaseReceiptRow, "receipt_date" | "weight_received" | "note">>,
) {
  const res = await api.patch<{ data: PurchaseLedgerRow }>(`/purchase-receipts/${receiptId}`, body);
  return res.data.data;
}

export async function deletePurchaseReceipt(receiptId: number) {
  const res = await api.delete<{ data: PurchaseLedgerRow }>(`/purchase-receipts/${receiptId}`);
  return res.data.data;
}

export async function patchPurchaseRecNote(purchaseId: number, rec_note: string | null) {
  const res = await api.patch<{ data: PurchaseLedgerRow }>(`/purchase/${purchaseId}`, { rec_note });
  return res.data.data;
}

export async function deletePurchase(purchaseId: number) {
  const res = await api.delete<{ data: { success: boolean } }>(`/purchase/${purchaseId}`);
  return res.data.data;
}

export type PaymentEntry = {
  id: number;
  payment_date: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export async function fetchPayments(orderId: number) {
  const res = await api.get<{ data: PaymentEntry[] }>(`/orders/${orderId}/payments`);
  return res.data.data;
}

export async function createPayment(orderId: number, body: { payment_date: string; amount: number; note?: string }) {
  const res = await api.post<{ data: OrderRow[] }>(`/orders/${orderId}/payments`, body);
  return res.data.data;
}

export type SalesReturnRow = {
  id: number;
  order_id: number | null;
  product_id: number | null;
  return_date: string;
  weight: number;
  note: string | null;
  remarks: string | null;
  created_at: string;
  order_wo_no?: string | null;
  order_client_po_no?: string | null;
  product_item?: string | null;
  product_size?: string | null;
  product_grade?: string | null;
};

export type PurchaseReturnRow = {
  id: number;
  purchase_entry_id: number;
  return_date: string;
  weight: number;
  note: string | null;
  remarks: string | null;
  created_at: string;
};

export async function fetchSalesReturns() {
  const res = await api.get<{ data: SalesReturnRow[] }>("/returns/sales");
  return res.data.data;
}

export async function createSalesReturn(body: { 
  order_id?: number | null; 
  product_id?: number | null; 
  return_date: string; 
  weight: number; 
  note?: string; 
  remarks?: string;
}) {
  const res = await api.post<{ data: { success: true } }>("/returns/sales", body);
  return res.data.data;
}

export async function deleteSalesReturn(id: number) {
  const res = await api.delete<{ data: { success: true } }>(`/returns/sales/${id}`);
  return res.data.data;
}

export async function fetchPurchaseReturns() {
  const res = await api.get<{ data: PurchaseReturnRow[] }>("/returns/purchase");
  return res.data.data;
}

export async function createPurchaseReturn(body: { purchase_entry_id: number; return_date: string; weight: number; note?: string; remarks?: string }) {
  const res = await api.post<{ data: { success: true } }>("/returns/purchase", body);
  return res.data.data;
}

export async function deletePurchaseReturn(id: number) {
  const res = await api.delete<{ data: { success: true } }>(`/returns/purchase/${id}`);
  return res.data.data;
}

export type JobWorkClient = {
  id: number;
  name: string;
  created_at: string;
};

export async function fetchJobWorkClients() {
  const res = await api.get<{ data: JobWorkClient[] }>("/jobwork/clients");
  return res.data.data;
}

export async function createJobWorkClient(name: string) {
  const res = await api.post<{ data: { id: number }; error?: string }>("/jobwork/clients", { name });
  if (res.data.error) throw new Error(res.data.error);
  return res.data.data;
}

export type JobWorkInward = {
  id: number;
  client_id: number;
  challan_date: string;
  description: string;
  qty: number;
  short_qty: number;
  created_at: string;
};

export type JobWorkOutward = {
  id: number;
  client_id: number;
  dispatch_date: string;
  dispatch_qty: number;
  process_loss: number;
  created_at: string;
};

export type JobWorkClientLedger = JobWorkClient & {
  inwards: JobWorkInward[];
  outwards: JobWorkOutward[];
  total_inward: number;
  total_dispatched: number;
  total_loss: number;
  balance: number;
};

export async function fetchJobWorkList() {
  const res = await api.get<{ data: JobWorkClientLedger[] }>("/jobwork");
  return res.data.data;
}

export async function createJobWorkInward(body: { client_id: number; challan_date: string; description: string; qty: number; short_qty?: number }) {
  const res = await api.post<{ data: { id: number } }>("/jobwork/inward", body);
  return res.data.data;
}

export async function createJobWorkOutward(body: { client_id: number; dispatch_date: string; dispatch_qty: number; process_loss?: number }) {
  const res = await api.post<{ data: { id: number } }>("/jobwork/outward", body);
  return res.data.data;
}

export async function deleteJobWorkInward(id: number) {
  await api.delete(`/jobwork/inward/${id}`);
}

export async function deleteJobWorkOutward(id: number) {
  await api.delete(`/jobwork/outward/${id}`);
}

export async function mergeInventoryItems(body: { sourceName: string; targetName: string }) {
  const res = await api.post<{ success: boolean }>("/inventory/merge-items", body);
  return res.data;
}

export type JobWorkOutSent = {
  id: number;
  client_id: number;
  challan_date: string;
  description: string;
  qty: number;
  short_qty: number;
  created_at: string;
};

export type JobWorkOutReceipt = {
  id: number;
  client_id: number;
  receipt_date: string;
  receipt_qty: number;
  process_loss: number;
  created_at: string;
};

export type JobWorkOutClientLedger = JobWorkClient & {
  sents: JobWorkOutSent[];
  receipts: JobWorkOutReceipt[];
  total_sent: number;
  total_received: number;
  total_loss: number;
  balance: number;
};

export async function fetchJobWorkOutList() {
  const res = await api.get<{ data: JobWorkOutClientLedger[] }>("/jobwork-out");
  return res.data.data;
}

export async function createJobWorkOutSent(body: { client_id: number; challan_date: string; description: string; qty: number; short_qty?: number }) {
  const res = await api.post<{ data: { id: number } }>("/jobwork-out/sent", body);
  return res.data.data;
}

export async function createJobWorkOutReceipt(body: { client_id: number; receipt_date: string; receipt_qty: number; process_loss?: number }) {
  const res = await api.post<{ data: { id: number } }>("/jobwork-out/receipt", body);
  return res.data.data;
}

export async function deleteJobWorkOutSent(id: number) {
  await api.delete(`/jobwork-out/sent/${id}`);
}

export async function deleteJobWorkOutReceipt(id: number) {
  await api.delete(`/jobwork-out/receipt/${id}`);
}

export async function fetchSyncExport(month: string) {
  const res = await api.get<{ orders: any[]; purchases: any[] }>(`/sync/export?month=${month}`);
  return res.data;
}

export async function importSyncReturns(body: {
  salesReturns: { order_id: number; return_date: string; weight: number; note?: string; remarks?: string }[];
  purchaseReturns: { purchase_entry_id: number; return_date: string; weight: number; note?: string; remarks?: string }[];
  dispatches: { order_id: number; order_line_item_id: number; dispatch_date: string; dispatch_weight: number; dispatch_pcs?: number; bundle_no?: string }[];
  receipts: { purchase_entry_id: number; receipt_date: string; weight_received: number; note?: string }[];
  newOrders: { wo_no: string; order_date: string; client_name: string; item: string; size: string; grade: string; order_kgs: number }[];
  newPurchases: { po_no?: string; purchase_date: string; supplier_name: string; item: string; size: string; grade: string; ordered_weight: number }[];
}) {
  const res = await api.post("/sync/import", body);
  return res.data;
}
