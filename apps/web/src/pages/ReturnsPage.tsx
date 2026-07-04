import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";
import {
  createPurchaseReturn,
  createSalesReturn,
  deletePurchaseReturn,
  deleteSalesReturn,
  fetchPurchaseLedger,
  fetchPurchaseReturns,
  fetchSalesReturns,
  fetchOrders,
  fetchProductStockBreakdown,
  fetchSyncExport,
  importSyncReturns,
} from "../lib/api";
import type { PurchaseLedgerRow, PurchaseReturnRow, SalesReturnRow } from "../lib/api";
import type { OrderRow } from "../lib/api";
import { exportToCsv } from "../lib/export";
import * as XLSX from "xlsx";

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function ReturnsPage() {
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncMonth, setSyncMonth] = useState(dayjs().format("YYYY-MM"));

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [pos, setPos] = useState<PurchaseLedgerRow[]>([]);
  const [salesReturns, setSalesReturns] = useState<SalesReturnRow[]>([]);
  const [salesSearch, setSalesSearch] = useState("");
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturnRow[]>([]);

  const [salesOrderId, setSalesOrderId] = useState<number>(0);
  const [salesReturnType, setSalesReturnType] = useState<"standard" | "old">("standard");
  const [salesProductId, setSalesProductId] = useState<number>(0);
  const [productList, setProductList] = useState<any[]>([]);

  const [salesDate, setSalesDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [salesWeight, setSalesWeight] = useState<number>(0);
  const [salesNote, setSalesNote] = useState("");
  const [salesRemarks, setSalesRemarks] = useState("");

  const [poId, setPoId] = useState<number>(0);
  const [poDate, setPoDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [poWeight, setPoWeight] = useState<number>(0);
  const [poNote, setPoNote] = useState("");
  const [poRemarks, setPoRemarks] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([fetchOrders(), fetchPurchaseLedger(), fetchSalesReturns(), fetchPurchaseReturns(), fetchProductStockBreakdown()])
      .then(([o, p, sr, pr, prod]) => {
        if (!alive) return;
        setOrders(o);
        setPos(p);
        setSalesReturns(sr);
        setPurchaseReturns(pr);
        setProductList(prod);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const orderChoices = useMemo(() => {
    const byId = new Map<number, OrderRow>();
    for (const r of orders) if (!byId.has(r.order_id)) byId.set(r.order_id, r);
    return [...byId.values()].sort((a, b) => b.order_id - a.order_id);
  }, [orders]);

  const poChoices = useMemo(() => pos.slice().sort((a, b) => b.id - a.id), [pos]);

  const filteredSalesReturns = useMemo(() => {
    if (!salesSearch.trim()) return salesReturns;
    const term = salesSearch.toLowerCase();
    return salesReturns.filter((r) => 
      (r.order_client_po_no && r.order_client_po_no.toLowerCase().includes(term)) ||
      (r.order_wo_no && r.order_wo_no.toLowerCase().includes(term)) ||
      (r.product_item && r.product_item.toLowerCase().includes(term)) ||
      (r.note && r.note.toLowerCase().includes(term)) ||
      (r.remarks && r.remarks.toLowerCase().includes(term))
    );
  }, [salesReturns, salesSearch]);

  async function refresh() {
    const [sr, pr, prod] = await Promise.all([fetchSalesReturns(), fetchPurchaseReturns(), fetchProductStockBreakdown()]);
    setSalesReturns(sr);
    setPurchaseReturns(pr);
    setProductList(prod);
  }

  async function handleExportMonthly() {
    setSaving(true);
    setErr(null);
    try {
      const { orders: syncOrders, purchases: syncPurchases, dispatches: syncDispatches, salesReturns: syncSalesReturns, receipts: syncReceipts, purchaseReturns: syncPurchaseReturns } = await fetchSyncExport(syncMonth);
      
      const wb = XLSX.utils.book_new();

      const salesData = syncOrders.map(o => ({
        "Order ID (DO NOT EDIT)": o.id,
        "WO No": o.wo_no,
        "Order Date": o.order_date,
        "Client Name": o.client_name,
        "Item": o.item,
        "Size": o.size,
        "Grade": o.grade,
        "Order Kgs": o.order_kgs,
        "Total Dispatch": o.total_dispatch,
        "Previous Sales Return": o.total_sales_return,
        "New Sales Return Weight (kg)": "",
        "New Sales Return Date (YYYY-MM-DD)": dayjs().format("YYYY-MM-DD"),
        "Return Note": "",
        "Return Remarks": "",
        "New Dispatch Weight (kg)": "",
        "New Dispatch Date (YYYY-MM-DD)": dayjs().format("YYYY-MM-DD"),
        "New Dispatch Pcs": "",
        "New Bundle No": "",
        "Line ID (DO NOT EDIT)": o.line_id
      }));
      const wsSales = XLSX.utils.json_to_sheet(salesData);
      XLSX.utils.book_append_sheet(wb, wsSales, "Sales & Dispatches");

      const purchaseData = syncPurchases.map(p => ({
        "Purchase Entry ID (DO NOT EDIT)": p.purchase_entry_id,
        "PO No": p.po_no || "N/A",
        "Purchase Date": p.purchase_date,
        "Supplier": p.supplier_name,
        "Item": p.item || "",
        "Size": p.size || "",
        "Grade": p.grade || "",
        "Ordered Weight": p.ordered_weight,
        "Received Weight": p.received_weight,
        "Previous Purchase Return": p.total_purchase_return,
        "New Purchase Return Weight (kg)": "",
        "New Purchase Return Date (YYYY-MM-DD)": dayjs().format("YYYY-MM-DD"),
        "Return Note": "",
        "Return Remarks": "",
        "New Receipt Weight (kg)": "",
        "New Receipt Date (YYYY-MM-DD)": dayjs().format("YYYY-MM-DD"),
        "Receipt Note": ""
      }));
      const wsPurchase = XLSX.utils.json_to_sheet(purchaseData);
      XLSX.utils.book_append_sheet(wb, wsPurchase, "Purchases & Receipts");

      const histDispatches = syncDispatches.map(d => ({
        "Dispatch ID": d.id,
        "Dispatch Date": d.dispatch_date,
        "Weight (kg)": d.dispatch_weight,
        "Pcs": d.dispatch_pcs,
        "Bundle No": d.bundle_no || "",
        "WO No": d.wo_no,
        "Client": d.client_name,
        "Item": d.item,
        "Size": d.size,
        "Grade": d.grade
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histDispatches), "Historical Dispatches");

      const histSalesReturns = syncSalesReturns.map(sr => ({
        "Return ID": sr.id,
        "Return Date": sr.return_date,
        "Weight (kg)": sr.weight,
        "Note": sr.note || "",
        "Remarks": sr.remarks || "",
        "WO No": sr.wo_no,
        "Client": sr.client_name,
        "Item": sr.item,
        "Size": sr.size,
        "Grade": sr.grade
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histSalesReturns), "Historical Sales Returns");

      const histReceipts = syncReceipts.map(r => ({
        "Receipt ID": r.id,
        "Receipt Date": r.receipt_date,
        "Weight Received": r.weight_received,
        "Note": r.note || "",
        "PO No": r.po_no || "",
        "Supplier": r.supplier_name,
        "Item": r.item,
        "Size": r.size,
        "Grade": r.grade
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histReceipts), "Historical Receipts");

      const histPurchaseReturns = syncPurchaseReturns.map(pr => ({
        "Return ID": pr.id,
        "Return Date": pr.return_date,
        "Weight (kg)": pr.weight,
        "Note": pr.note || "",
        "Remarks": pr.remarks || "",
        "PO No": pr.po_no || "",
        "Supplier": pr.supplier_name,
        "Item": pr.item,
        "Size": pr.size,
        "Grade": pr.grade
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histPurchaseReturns), "Historical Purchase Returns");

      XLSX.writeFile(wb, `returns_sync_${syncMonth}.xlsx`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to export");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportMonthly(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setErr(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        
        const wsSales = wb.Sheets["Sales & Dispatches"] || wb.Sheets["Sales Returns"];
        const wsPurchases = wb.Sheets["Purchases & Receipts"] || wb.Sheets["Purchase Returns"];

        const salesReturns: any[] = [];
        const purchaseReturns: any[] = [];
        const dispatches: any[] = [];
        const receipts: any[] = [];
        const newOrders: any[] = [];
        const newPurchases: any[] = [];

        if (wsSales) {
          const rows = XLSX.utils.sheet_to_json<any>(wsSales);
          for (const row of rows) {
            const orderId = Number(row["Order ID (DO NOT EDIT)"]);
            if (orderId) {
              const retWeight = Number(row["New Sales Return Weight (kg)"]);
              if (retWeight > 0) {
                salesReturns.push({
                  order_id: orderId,
                  weight: retWeight,
                  return_date: row["New Sales Return Date (YYYY-MM-DD)"],
                  note: row["Return Note"]?.toString() || "",
                  remarks: row["Return Remarks"]?.toString() || ""
                });
              }
              const dispWeight = Number(row["New Dispatch Weight (kg)"]);
              if (dispWeight > 0) {
                dispatches.push({
                  order_id: orderId,
                  order_line_item_id: Number(row["Line ID (DO NOT EDIT)"]),
                  dispatch_weight: dispWeight,
                  dispatch_date: row["New Dispatch Date (YYYY-MM-DD)"],
                  dispatch_pcs: Number(row["New Dispatch Pcs"]) || 0,
                  bundle_no: row["New Bundle No"]?.toString() || ""
                });
              }
            } else if (row["WO No"] && row["Client Name"] && row["Order Kgs"] > 0) {
              newOrders.push({
                wo_no: row["WO No"]?.toString(),
                order_date: row["Order Date"]?.toString() || dayjs().format("YYYY-MM-DD"),
                client_name: row["Client Name"]?.toString(),
                item: row["Item"]?.toString(),
                size: row["Size"]?.toString(),
                grade: row["Grade"]?.toString(),
                order_kgs: Number(row["Order Kgs"])
              });
            }
          }
        }

        if (wsPurchases) {
          const rows = XLSX.utils.sheet_to_json<any>(wsPurchases);
          for (const row of rows) {
            const purchaseEntryId = Number(row["Purchase Entry ID (DO NOT EDIT)"]);
            if (purchaseEntryId) {
              const retWeight = Number(row["New Purchase Return Weight (kg)"]);
              if (retWeight > 0) {
                purchaseReturns.push({
                  purchase_entry_id: purchaseEntryId,
                  weight: retWeight,
                  return_date: row["New Purchase Return Date (YYYY-MM-DD)"],
                  note: row["Return Note"]?.toString() || "",
                  remarks: row["Return Remarks"]?.toString() || ""
                });
              }
              const recWeight = Number(row["New Receipt Weight (kg)"]);
              if (recWeight > 0) {
                receipts.push({
                  purchase_entry_id: purchaseEntryId,
                  weight_received: recWeight,
                  receipt_date: row["New Receipt Date (YYYY-MM-DD)"],
                  note: row["Receipt Note"]?.toString() || ""
                });
              }
            } else if (row["Supplier"] && row["Ordered Weight"] > 0) {
              newPurchases.push({
                po_no: row["PO No"]?.toString(),
                purchase_date: row["Purchase Date"]?.toString() || dayjs().format("YYYY-MM-DD"),
                supplier_name: row["Supplier"]?.toString(),
                item: row["Item"]?.toString() || "",
                size: row["Size"]?.toString() || "",
                grade: row["Grade"]?.toString() || "",
                ordered_weight: Number(row["Ordered Weight"])
              });
            }
          }
        }

        if (salesReturns.length === 0 && purchaseReturns.length === 0 && dispatches.length === 0 && receipts.length === 0 && newOrders.length === 0 && newPurchases.length === 0) {
          throw new Error("No valid data found to import. Make sure you entered weights > 0 in the new columns or added new rows with valid data.");
        }

        const res = await importSyncReturns({ salesReturns, purchaseReturns, dispatches, receipts, newOrders, newPurchases });
        setSuccess(`Successfully imported ${res.importedSales} sales returns, ${res.importedDispatches} dispatches, ${res.importedPurchases} purchase returns, ${res.importedReceipts} purchase receipts, ${res.importedNewOrders} new orders, and ${res.importedNewPurchases} new purchases.`);
        await refresh();
      } catch (err: any) {
        setErr(err.message || "Failed to process XLSX file.");
      } finally {
        setSaving(false);
        e.target.value = "";
      }
    };

    reader.onerror = () => {
      setErr("Failed to read file.");
      setSaving(false);
    };

    reader.readAsArrayBuffer(file);
  }


  return (
    <Box>
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2 }}>
        Returns
      </Typography>

      {err ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      ) : null}

      {success ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      ) : null}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography fontWeight={900} sx={{ mb: 1 }}>
            Monthly Report & Bulk Sync
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a month to export all orders and purchases. The exported XLSX will have empty columns for new Returns, Dispatches, and Receipts. 
            Fill them out to bulk-import operations on existing records. You can also bulk-create completely new Orders or Purchases by adding new rows and leaving the ID columns blank!
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField 
              label="Sync Month" 
              type="month" 
              size="small" 
              value={syncMonth} 
              onChange={(e) => setSyncMonth(e.target.value)} 
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" onClick={handleExportMonthly} disabled={saving}>
              Export {syncMonth} (XLSX)
            </Button>
            <Button variant="contained" component="label" disabled={saving}>
              Import Completed XLSX
              <input type="file" accept=".xlsx" hidden onChange={handleImportMonthly} />
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography fontWeight={900} sx={{ mb: 1 }}>
              Dispatch Return (Sales return)
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                select
                SelectProps={{ native: true }}
                label="Return Type"
                size="small"
                value={salesReturnType}
                onChange={(e) => setSalesReturnType(e.target.value as "standard" | "old")}
              >
                <option value="standard">Standard Return (Linked to WO)</option>
                <option value="old">Old Return (No linked Sales record)</option>
              </TextField>

              {salesReturnType === "standard" ? (
                <TextField
                  select
                  SelectProps={{ native: true }}
                  label="Order (WO)"
                  size="small"
                  value={salesOrderId || ""}
                  onChange={(e) => setSalesOrderId(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Select WO…
                  </option>
                  {orderChoices.map((o) => (
                    <option key={o.order_id} value={o.order_id}>
                      {o.wo_no} {o.client_po_no ? `(PO: ${o.client_po_no})` : ""} — {o.client_name}
                    </option>
                  ))}
                </TextField>
              ) : (
                <TextField
                  select
                  SelectProps={{ native: true }}
                  label="Item to Return"
                  size="small"
                  value={salesProductId || ""}
                  onChange={(e) => setSalesProductId(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Select Product…
                  </option>
                  {productList.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.item} {p.size} {p.grade} (Stock: {Math.round(p.current_stock)} kg)
                    </option>
                  ))}
                </TextField>
              )}

              <TextField
                label="Return date"
                size="small"
                type="date"
                value={salesDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setSalesDate(e.target.value)}
              />
              <TextField
                label="Weight (kg)"
                size="small"
                type="number"
                value={salesWeight || ""}
                onChange={(e) => setSalesWeight(Number(e.target.value))}
              />
              <TextField label="Note" size="small" value={salesNote} onChange={(e) => setSalesNote(e.target.value)} />
              <TextField label="Remarks" size="small" value={salesRemarks} onChange={(e) => setSalesRemarks(e.target.value)} />
              <Button
                variant="contained"
                disabled={saving || salesWeight <= 0 || (salesReturnType === "standard" ? !salesOrderId : !salesProductId)}
                onClick={async () => {
                  setSaving(true);
                  setErr(null);
                  try {
                    await createSalesReturn({
                      order_id: salesReturnType === "standard" ? salesOrderId : null,
                      product_id: salesReturnType === "old" ? salesProductId : null,
                      return_date: salesDate,
                      weight: salesWeight,
                      note: salesNote.trim() || undefined,
                      remarks: salesRemarks.trim() || undefined,
                    });
                    setSalesWeight(0);
                    setSalesNote("");
                    setSalesRemarks("");
                    await refresh();
                  } catch (e: unknown) {
                    setErr(e instanceof Error ? e.message : "Failed to save sales return");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Add sales return
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography fontWeight={900} sx={{ mb: 1 }}>
              Incoming RM Return (Purchase return)
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                select
                SelectProps={{ native: true }}
                label="Purchase order"
                size="small"
                value={poId || ""}
                onChange={(e) => setPoId(Number(e.target.value))}
              >
                <option value="" disabled>
                  Select PO…
                </option>
                {poChoices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.po_no ?? `PO#${p.id}`} {p.client_po_no ? `(Client PO: ${p.client_po_no})` : ""} — {p.supplier_name} — {p.item ?? ""} {p.size ?? ""} {p.grade ?? ""}
                  </option>
                ))}
              </TextField>
              <TextField
                label="Return date"
                size="small"
                type="date"
                value={poDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setPoDate(e.target.value)}
              />
              <TextField
                label="Weight (kg)"
                size="small"
                type="number"
                value={poWeight}
                onChange={(e) => setPoWeight(Number(e.target.value))}
              />
              <TextField label="Note" size="small" value={poNote} onChange={(e) => setPoNote(e.target.value)} />
              <TextField label="Remarks" size="small" value={poRemarks} onChange={(e) => setPoRemarks(e.target.value)} />
              <Button
                variant="contained"
                disabled={saving || !poId || poWeight <= 0}
                onClick={async () => {
                  setSaving(true);
                  setErr(null);
                  try {
                    await createPurchaseReturn({
                      purchase_entry_id: poId,
                      return_date: poDate,
                      weight: poWeight,
                      note: poNote.trim() || undefined,
                      remarks: poRemarks.trim() || undefined,
                    });
                    setPoWeight(0);
                    setPoNote("");
                    setPoRemarks("");
                    await refresh();
                  } catch (e: unknown) {
                    setErr(e instanceof Error ? e.message : "Failed to save purchase return");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Add purchase return
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography fontWeight={900}>
                Sales returns history
              </Typography>
              <Button variant="outlined" size="small" onClick={() => exportToCsv("sales_returns", filteredSalesReturns)}>
                Export
              </Button>
            </Stack>
            <TextField
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
              placeholder="Search Client PO / WO / Item…"
              size="small"
              fullWidth
              sx={{ mb: 1.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            {filteredSalesReturns.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No sales returns yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {filteredSalesReturns.map((r) => (
                  <Box
                    key={r.id}
                    sx={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 1, p: 1, display: "flex", justifyContent: "space-between" }}
                  >
                    <Box>
                      <b>{r.return_date}</b> — {money(r.weight)} kg — {r.order_id ? `WO: ${r.order_wo_no || `order #${r.order_id}`}` : `Old Return (${r.product_item} ${r.product_size} ${r.product_grade})`}
                      {r.note ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Note: {r.note}
                        </Typography>
                      ) : null}
                      {r.remarks ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Remarks: {r.remarks}
                        </Typography>
                      ) : null}
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={async () => {
                        if (!window.confirm("Are you sure you want to delete this sales return?")) return;
                        if (!window.confirm("Are you REALLY sure?")) return;
                        setSaving(true);
                        try {
                          await deleteSalesReturn(r.id);
                          await refresh();
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography fontWeight={900}>
                Purchase returns history
              </Typography>
              <Button variant="outlined" size="small" onClick={() => exportToCsv("purchase_returns", purchaseReturns)}>
                Export
              </Button>
            </Stack>
            {purchaseReturns.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No purchase returns yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {purchaseReturns.map((r) => (
                  <Box
                    key={r.id}
                    sx={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 1, p: 1, display: "flex", justifyContent: "space-between" }}
                  >
                    <Box>
                      <b>{r.return_date}</b> — {money(r.weight)} kg — PO #{r.purchase_entry_id}
                      {r.note ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Note: {r.note}
                        </Typography>
                      ) : null}
                      {r.remarks ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Remarks: {r.remarks}
                        </Typography>
                      ) : null}
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={async () => {
                        if (!window.confirm("Are you sure you want to delete this purchase return?")) return;
                        if (!window.confirm("Are you REALLY sure?")) return;
                        setSaving(true);
                        try {
                          await deletePurchaseReturn(r.id);
                          await refresh();
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

