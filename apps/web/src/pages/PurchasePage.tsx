import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Drawer,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  Select,
  MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";
import {
  createPurchaseBatch,
  createPurchaseReceipt,
  deletePurchase,
  deletePurchaseReceipt,
  fetchProducts,
  fetchPurchaseLedger,
  fetchPurchaseReceipts,
  patchPurchase,
  patchPurchaseReceipt,
} from "../lib/api";
import type { MasterProduct, PurchaseLedgerRow, PurchaseReceiptRow } from "../lib/api";
import { exportToCsv } from "../lib/export";

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function PurchasePage() {
  const [tab, setTab] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [poNo, setPoNo] = useState("");
  const [clientPoNo, setClientPoNo] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [products, setProducts] = useState<MasterProduct[]>([]);

  const [rows, setRows] = useState<PurchaseLedgerRow[]>([]);
  const [q, setQ] = useState("");
  const [searchAttr, setSearchAttr] = useState("All");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [poForReceipt, setPoForReceipt] = useState<PurchaseLedgerRow | null>(null);
  const [recDate, setRecDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [recWeight, setRecWeight] = useState<number>(0);
  const [recNote, setRecNote] = useState("");

  const [drawerPo, setDrawerPo] = useState<PurchaseLedgerRow | null>(null);
  const [receiptLines, setReceiptLines] = useState<PurchaseReceiptRow[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  type PoLineDraft = {
    item: string;
    size: string;
    grade: string;
    weight: number;
    rate: number;
    debit_note: string;
    remarks: string;
  };

  const emptyPoLine = (): PoLineDraft => ({
    item: "",
    size: "",
    grade: "",
    weight: 0,
    rate: 0,
    debit_note: "",
    remarks: "",
  });

  /** A single PO can contain many raw-material lines. */
  const [poLines, setPoLines] = useState<PoLineDraft[]>([emptyPoLine()]);

  const itemOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(p.item);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);

  function productLabel(r: PurchaseLedgerRow) {
    if (r.item && r.size && r.grade) return `${r.item} • ${r.size} • ${r.grade}`;
    return "—";
  }

  const shownRows = useMemo(() => {
    let list = rows;
    if (hideCompleted) {
      list = list.filter((r) => r.balance_weight > 0.01);
    }
    if (q.trim()) {
      const searchVal = q.toLowerCase();
      if (searchAttr === "All") {
        list = list.filter((r) => 
          (r.client_po_no && r.client_po_no.toLowerCase().includes(searchVal)) ||
          (r.po_no && r.po_no.toLowerCase().includes(searchVal)) ||
          (r.supplier_name && r.supplier_name.toLowerCase().includes(searchVal)) ||
          (r.item && r.item.toLowerCase().includes(searchVal))
        );
      } else {
        list = list.filter((r) => {
          const val = r[searchAttr as keyof PurchaseLedgerRow];
          if (typeof val === 'string') {
            return val.toLowerCase().includes(searchVal);
          }
          return false;
        });
      }
    }
    return list;
  }, [rows, hideCompleted, q, searchAttr]);

  const loadLedger = useCallback(() => {
    setLoading(true);
    fetchPurchaseLedger()
      .then(setRows)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
  }, []);

  useEffect(() => {
    if (!drawerPo) return;
    setLoadingReceipts(true);
    fetchPurchaseReceipts(drawerPo.id)
      .then(setReceiptLines)
      .finally(() => setLoadingReceipts(false));
  }, [drawerPo?.id]);

  async function submitPo() {
    if (!supplier.trim()) {
      setErr("Enter supplier name.");
      return;
    }
    const clean = poLines
      .map((l) => ({
        item: l.item.trim(),
        size: l.size.trim() || "-",
        grade: l.grade.trim() || "-",
        weight: Number(l.weight) || 0,
        rate: Number(l.rate) || 0,
        debit_note: l.debit_note.trim(),
        remarks: l.remarks.trim(),
      }))
      .filter((l) => l.item && l.weight > 0);

    if (clean.length === 0) {
      setErr("Add at least one raw-material line with Item and WEIGHT > 0.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const created = await createPurchaseBatch({
        supplier_name: supplier.trim(),
        po_no: poNo.trim() || undefined,
        client_po_no: clientPoNo.trim() || undefined,
        purchase_date: date,
        lines: clean.map((l) => ({
          weight: l.weight,
          rate: l.rate,
          debit_note: l.debit_note || undefined,
          size: l.size,
          item: l.item,
          grade: l.grade,
          remarks: l.remarks || undefined,
        })),
      });
      setRows((prev) => [...created, ...prev]);
      setSupplier("");
      setPoNo("");
      setClientPoNo("");
      setPoLines([emptyPoLine()]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function submitReceipt() {
    if (!poForReceipt) return;
    setSaving(true);
    setErr(null);
    try {
      const updated = await createPurchaseReceipt(poForReceipt.id, {
        receipt_date: recDate,
        weight_received: recWeight,
        note: recNote.trim() || undefined,
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setPoForReceipt(updated);
      setRecWeight(0);
      setRecNote("");
      if (drawerPo?.id === updated.id) {
        setDrawerPo(updated);
        setReceiptLines(await fetchPurchaseReceipts(updated.id));
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save receipt");
    } finally {
      setSaving(false);
    }
  }

  async function saveDrawerPoPatch(
    patch: Partial<
      Pick<
        PurchaseLedgerRow,
        | "supplier_name"
        | "po_no"
        | "client_po_no"
        | "purchase_date"
        | "weight"
        | "rate"
        | "debit_note"
        | "rec_note"
        | "size"
        | "item"
        | "grade"
        | "remarks"
      >
    >,
  ) {
    if (!drawerPo) return;
    setSaving(true);
    setErr(null);
    try {
      const updated = await patchPurchase(drawerPo.id, patch);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setDrawerPo(updated);
      if (poForReceipt?.id === updated.id) setPoForReceipt(updated);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update PO");
    } finally {
      setSaving(false);
    }
  }

  async function saveReceiptLine(
    id: number,
    patch: Partial<Pick<PurchaseReceiptRow, "receipt_date" | "weight_received" | "note">>,
  ) {
    if (!drawerPo) return;
    setSaving(true);
    setErr(null);
    try {
      const updatedPo = await patchPurchaseReceipt(id, patch);
      setRows((prev) => prev.map((r) => (r.id === updatedPo.id ? updatedPo : r)));
      setDrawerPo(updatedPo);
      setReceiptLines(await fetchPurchaseReceipts(updatedPo.id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update receipt");
    } finally {
      setSaving(false);
    }
  }

  async function removeReceiptLine(id: number) {
    if (!drawerPo) return;
    setSaving(true);
    setErr(null);
    try {
      const updatedPo = await deletePurchaseReceipt(id);
      setRows((prev) => prev.map((r) => (r.id === updatedPo.id ? updatedPo : r)));
      setDrawerPo(updatedPo);
      setReceiptLines(await fetchPurchaseReceipts(updatedPo.id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete receipt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h5" fontWeight={900}>
          Raw material — Purchase orders & receipts
        </Typography>
        <Button variant="outlined" onClick={() => exportToCsv("purchases", rows)}>
          Export to Excel
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Create a PO first, then record each goods-in (received weight) against that PO. Balance = ordered − received (negative
        balance means you are within the allowed +300 kg over-receipt vs ordered). AVE on sales orders is the weighted purchase
        rate: Σ(receipt kg × PO rate) ÷ Σ(receipt kg) for that material.
      </Typography>

      {err ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      ) : null}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="1. New purchase order (PO)" />
        <Tab label="2. Record receipt (what we received)" />
      </Tabs>

      {tab === 0 ? (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Supplier (NAME)"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  fullWidth
                />
                <TextField label="PO NO" value={poNo} onChange={(e) => setPoNo(e.target.value)} fullWidth />
                <TextField label="CLIENT PO NO" value={clientPoNo} onChange={(e) => setClientPoNo(e.target.value)} fullWidth />
                <TextField
                  label="DATE"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Stack>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={800}>Raw material lines</Typography>
                <Button startIcon={<AddIcon />} size="small" onClick={() => setPoLines((p) => [...p, emptyPoLine()])}>
                  Add item
                </Button>
              </Stack>

              {poLines.map((line, idx) => {
                const sizeOptions = [...new Set(products.filter((p) => p.item === line.item).map((p) => p.size))].sort((a, b) =>
                  a.localeCompare(b),
                );
                const gradeOptions = [
                  ...new Set(products.filter((p) => p.item === line.item && p.size === line.size).map((p) => p.grade)),
                ].sort((a, b) => a.localeCompare(b));
                const amountPreview = (Number(line.weight) || 0) * (Number(line.rate) || 0);
                return (
                  <Box key={idx} sx={{ border: "1px solid rgba(15,23,42,0.10)", borderRadius: 2, p: 2 }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontWeight={800}>Item {idx + 1}</Typography>
                        {poLines.length > 1 ? (
                          <IconButton size="small" color="error" onClick={() => setPoLines((p) => p.filter((_, i) => i !== idx))}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        ) : null}
                      </Stack>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
                        <Box sx={{ flex: { md: "3 1 240px" }, minWidth: 0 }}>
                          <Autocomplete
                            options={itemOptions}
                            freeSolo
                            value={line.item || null}
                            inputValue={line.item}
                            onInputChange={(_, v) => {
                              setPoLines((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], item: v, size: "", grade: "" };
                                return next;
                              });
                            }}
                            renderInput={(params) => <TextField {...params} label="Item" required />}
                          />
                        </Box>
                        <Box sx={{ flex: { md: "1.2 1 140px" }, minWidth: 0 }}>
                          <Autocomplete
                            options={sizeOptions}
                            freeSolo
                            value={line.size || null}
                            inputValue={line.size}
                            onInputChange={(_, v) => {
                              setPoLines((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], size: v, grade: "" };
                                return next;
                              });
                            }}
                            renderInput={(params) => <TextField {...params} label="Size" />}
                          />
                        </Box>
                        <Box sx={{ flex: { md: "0 0 140px" }, width: { md: 140 }, maxWidth: { md: 160 } }}>
                          <Autocomplete
                            options={gradeOptions}
                            freeSolo
                            value={line.grade || null}
                            inputValue={line.grade}
                            onInputChange={(_, v) => {
                              setPoLines((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], grade: v };
                                return next;
                              });
                            }}
                            renderInput={(params) => <TextField {...params} label="Grade" />}
                          />
                        </Box>
                      </Stack>

                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <TextField
                          label="WEIGHT (ordered, kg)"
                          type="number"
                          value={line.weight}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setPoLines((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], weight: v };
                              return next;
                            });
                          }}
                          fullWidth
                        />
                        <TextField
                          label="RATE"
                          type="number"
                          value={line.rate}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setPoLines((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], rate: v };
                              return next;
                            });
                          }}
                          fullWidth
                          helperText={
                            products.find(p => p.item === line.item && p.size === line.size && p.grade === line.grade)?.avg_cost 
                            ? `Actual Average Price: ₹${products.find(p => p.item === line.item && p.size === line.size && p.grade === line.grade)?.avg_cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                            : undefined
                          }
                        />
                        <TextField label="AMOUNT (wt × rate)" value={money(amountPreview)} disabled fullWidth />
                      </Stack>

                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <TextField
                          label="DEBIT NOTE (optional)"
                          value={line.debit_note}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPoLines((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], debit_note: v };
                              return next;
                            });
                          }}
                          fullWidth
                          multiline
                          minRows={2}
                        />
                        <TextField
                          label="Remarks (optional)"
                          value={line.remarks}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPoLines((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], remarks: v };
                              return next;
                            });
                          }}
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}

              <Box>
                <Button
                  variant="contained"
                  disabled={
                    saving ||
                    !supplier.trim()
                  }
                  onClick={submitPo}
                >
                  {saving ? "Saving…" : "Save purchase order"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              <Autocomplete
                options={shownRows}
                value={poForReceipt}
                onChange={(_, v) => setPoForReceipt(v)}
                getOptionLabel={(r) =>
                  `${r.po_no ?? "PO"} • ${r.supplier_name} • ${productLabel(r)} • bal ${Math.round(r.balance_weight)} kg`
                }
                renderInput={(params) => <TextField {...params} label="Select PO" placeholder="Search…" />}
              />
              {poForReceipt ? (
                <Typography variant="body2" color="text.secondary">
                  Ordered {money(poForReceipt.weight)} kg • Received {money(poForReceipt.received_weight)} kg • Balance{" "}
                  <b>{money(poForReceipt.balance_weight)}</b> kg • Max weight for next receipt{" "}
                  <b>{money(poForReceipt.balance_weight + 300)}</b> kg (balance + 300 kg variance)
                </Typography>
              ) : null}
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Receipt DATE"
                  type="date"
                  value={recDate}
                  onChange={(e) => setRecDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="WEIGHT received (kg)"
                  type="number"
                  value={recWeight}
                  onChange={(e) => setRecWeight(Number(e.target.value))}
                  fullWidth
                />
                <TextField
                  label="Note (REC DATE / remarks)"
                  value={recNote}
                  onChange={(e) => setRecNote(e.target.value)}
                  fullWidth
                />
              </Stack>
              <Box>
                <Button
                  variant="contained"
                  disabled={saving || !poForReceipt || recWeight <= 0}
                  onClick={submitReceipt}
                >
                  {saving ? "Saving…" : "Add receipt"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography fontWeight={800}>Purchase orders ledger</Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: { xs: 1, sm: 0 }, minWidth: { sm: 400 } }}>
              <Select
                size="small"
                value={searchAttr}
                onChange={(e) => setSearchAttr(e.target.value)}
                sx={{ minWidth: 140, bgcolor: "background.paper" }}
              >
                <MenuItem value="All">All fields</MenuItem>
                <MenuItem value="po_no">PO No</MenuItem>
                <MenuItem value="client_po_no">Client PO</MenuItem>
                <MenuItem value="supplier_name">Supplier Name</MenuItem>
                <MenuItem value="item">Product</MenuItem>
              </Select>
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchAttr === "All" ? "Search Client PO / PO / Supplier…" : `Search ${searchAttr.replace('_', ' ')}...`}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControlLabel
                sx={{ whiteSpace: "nowrap", ml: 1 }}
                control={<Switch checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />}
                label="Hide completed"
              />
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Click a row to see receipt lines. Columns match PO / WEIGHT / rec wt. / bal / RATE / amounts / supplier.
          </Typography>
          {loading ? (
            <CircularProgress size={22} />
          ) : shownRows.length === 0 ? (
            <Typography color="text.secondary">No purchase orders yet.</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns:
                    "100px 100px 110px minmax(100px, 1fr) minmax(160px, 220px) 90px 90px 90px 80px 100px 110px 110px 120px 140px 160px",
                  minWidth: 1740,
                  gap: 0.5,
                  alignItems: "center",
                  borderBottom: "1px solid rgba(15,23,42,0.1)",
                  py: 1,
                  px: 1,
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                <span>PO NO</span>
                <span>CLIENT PO</span>
                <span>DATE</span>
                <span>NAME</span>
                <span>PRODUCT</span>
                <span>WEIGHT</span>
                <span>rec wt.</span>
                <span>bal wt.</span>
                <span>DEBIT</span>
                <span>RATE</span>
                <span>AMT ord</span>
                <span>AMT recvd</span>
                <span>REC NOTE</span>
                <span>REMARKS</span>
                <span />
              </Box>
              {shownRows.map((r) => (
                <Box
                  key={r.id}
                  onClick={() => setDrawerPo(r)}
                  sx={{
                    display: "grid",
                    gridTemplateColumns:
                      "100px 100px 110px minmax(100px, 1fr) minmax(160px, 220px) 90px 90px 90px 80px 100px 110px 110px 120px 140px 160px",
                    minWidth: 1740,
                    gap: 0.5,
                    alignItems: "center",
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 1,
                    py: 1,
                    px: 1,
                    fontSize: 12.5,
                    cursor: "pointer",
                    "&:hover": { background: "rgba(37,99,235,0.04)" },
                  }}
                >
                  <span>{r.po_no ?? "—"}</span>
                  <span>{r.client_po_no ?? "—"}</span>
                  <span>{r.purchase_date}</span>
                  <span>{r.supplier_name}</span>
                  <span title={productLabel(r)} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {productLabel(r)}
                  </span>
                  <span>{money(r.weight)}</span>
                  <span>{money(r.received_weight)}</span>
                  <span style={{ color: r.balance_weight > 0.01 ? "#d97706" : undefined }}>{money(r.balance_weight)}</span>
                  <span title={r.debit_note ?? ""} style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.debit_note ? (r.debit_note.length > 14 ? `${r.debit_note.slice(0, 14)}…` : r.debit_note) : "—"}
                  </span>
                  <Box>
                    <Typography variant="body2">{money(r.rate)}</Typography>
                    {r.actual_avg_price > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10, lineHeight: 1 }}>
                        Act Avg: ₹{money(r.actual_avg_price)}
                      </Typography>
                    )}
                  </Box>
                  <span>{money(r.amount_ordered)}</span>
                  <span style={{ color: r.amount_received > 0 ? "#16a34a" : undefined }}>{money(r.amount_received)}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.rec_note ?? "—"}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.remarks ?? "—"}
                  </span>
                  <Button size="small" variant="outlined" onClick={(e) => (e.stopPropagation(), setDrawerPo(r))}>
                    Receipts
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Drawer anchor="right" open={Boolean(drawerPo)} onClose={() => setDrawerPo(null)} PaperProps={{ sx: { width: 420 } }}>
        {drawerPo ? (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontWeight={900}>PO {drawerPo.po_no ?? drawerPo.id}</Typography>
              <Stack direction="row" spacing={1}>
                <IconButton color="error" size="small" onClick={async () => {
                  setSaving(true);
                  try {
                    await deletePurchase(drawerPo.id);
                    setRows(prev => prev.filter(r => r.id !== drawerPo.id));
                    setDrawerPo(null);
                  } catch (e: unknown) {
                    alert(e instanceof Error ? e.message : "Failed to delete");
                  } finally {
                    setSaving(false);
                  }
                }}>
                  <DeleteOutlineIcon />
                </IconButton>
                <IconButton size="small" onClick={() => setDrawerPo(null)}>
                  <CloseIcon />
                </IconButton>
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {drawerPo.supplier_name} • {drawerPo.purchase_date}
              {drawerPo.item ? ` • ${productLabel(drawerPo)}` : ""}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Ordered <b>{money(drawerPo.weight)}</b> kg @ {money(drawerPo.rate)} → bal{" "}
              <b>{money(drawerPo.balance_weight)}</b> kg
            </Typography>

            {Math.abs(drawerPo.weight - drawerPo.received_weight) > 0.01 && drawerPo.received_weight > 0 && (
              <Button
                variant="contained"
                color="warning"
                startIcon={<CheckIcon />}
                size="small"
                fullWidth
                sx={{ mb: 2, textTransform: "none", fontWeight: 700 }}
                disabled={saving}
                onClick={async () => {
                  await saveDrawerPoPatch({ weight: drawerPo.received_weight });
                }}
              >
                Auto Close Client PO
              </Button>
            )}

            <Typography fontWeight={800} sx={{ mb: 1 }}>
              PO details (editable)
            </Typography>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                label="Supplier"
                size="small"
                value={drawerPo.supplier_name}
                onChange={(e) => setDrawerPo({ ...drawerPo, supplier_name: e.target.value })}
                onBlur={() => saveDrawerPoPatch({ supplier_name: drawerPo.supplier_name })}
                disabled={saving}
                fullWidth
              />
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="PO NO"
                  size="small"
                  value={drawerPo.po_no ?? ""}
                  onChange={(e) => setDrawerPo({ ...drawerPo, po_no: e.target.value || null })}
                  onBlur={() => saveDrawerPoPatch({ po_no: drawerPo.po_no })}
                  disabled={saving}
                  fullWidth
                />
                <TextField
                  label="CLIENT PO"
                  size="small"
                  value={drawerPo.client_po_no ?? ""}
                  onChange={(e) => setDrawerPo({ ...drawerPo, client_po_no: e.target.value || null })}
                  onBlur={() => saveDrawerPoPatch({ client_po_no: drawerPo.client_po_no })}
                  disabled={saving}
                  fullWidth
                />
                <TextField
                  label="DATE"
                  size="small"
                  type="date"
                  value={drawerPo.purchase_date}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => setDrawerPo({ ...drawerPo, purchase_date: e.target.value })}
                  onBlur={() => saveDrawerPoPatch({ purchase_date: drawerPo.purchase_date })}
                  disabled={saving}
                  fullWidth
                />
              </Stack>
              <TextField
                label="Raw material (Item)"
                size="small"
                value={drawerPo.item ?? ""}
                onChange={(e) => setDrawerPo({ ...drawerPo, item: e.target.value || null })}
                onBlur={() => saveDrawerPoPatch({ item: drawerPo.item ?? "" })}
                disabled={saving}
                fullWidth
              />
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="Size"
                  size="small"
                  value={drawerPo.size ?? ""}
                  onChange={(e) => setDrawerPo({ ...drawerPo, size: e.target.value || null })}
                  onBlur={() => saveDrawerPoPatch({ size: drawerPo.size ?? "" })}
                  disabled={saving}
                  fullWidth
                />
                <TextField
                  label="Grade"
                  size="small"
                  value={drawerPo.grade ?? ""}
                  onChange={(e) => setDrawerPo({ ...drawerPo, grade: e.target.value || null })}
                  onBlur={() => saveDrawerPoPatch({ grade: drawerPo.grade ?? "" })}
                  disabled={saving}
                  fullWidth
                />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="Weight (kg)"
                  size="small"
                  type="number"
                  value={drawerPo.weight}
                  onChange={(e) => setDrawerPo({ ...drawerPo, weight: Number(e.target.value) })}
                  onBlur={() => saveDrawerPoPatch({ weight: drawerPo.weight })}
                  disabled={saving}
                  fullWidth
                />
                <TextField
                  label="Rate"
                  size="small"
                  type="number"
                  value={drawerPo.rate}
                  onChange={(e) => setDrawerPo({ ...drawerPo, rate: Number(e.target.value) })}
                  onBlur={() => saveDrawerPoPatch({ rate: drawerPo.rate })}
                  disabled={saving}
                  fullWidth
                  helperText={`Actual Average Price: ₹${money(drawerPo.actual_avg_price)}`}
                />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="DEBIT NOTE"
                  size="small"
                  value={drawerPo.debit_note ?? ""}
                  onChange={(e) => setDrawerPo({ ...drawerPo, debit_note: e.target.value || null })}
                  onBlur={() => saveDrawerPoPatch({ debit_note: drawerPo.debit_note })}
                  disabled={saving}
                  fullWidth
                />
                <TextField
                  label="Remarks"
                  size="small"
                  value={drawerPo.remarks ?? ""}
                  onChange={(e) => setDrawerPo({ ...drawerPo, remarks: e.target.value || null })}
                  onBlur={() => saveDrawerPoPatch({ remarks: drawerPo.remarks })}
                  disabled={saving}
                  fullWidth
                />
              </Stack>
            </Stack>

            <TextField
              label="REC NOTE (header for this PO)"
              value={drawerPo.rec_note ?? ""}
              onChange={(e) => setDrawerPo({ ...drawerPo, rec_note: e.target.value || null })}
              onBlur={async () => {
                await saveDrawerPoPatch({ rec_note: drawerPo.rec_note });
              }}
              fullWidth
              multiline
              minRows={2}
              size="small"
              sx={{ mb: 2 }}
            />
            <Typography fontWeight={800} sx={{ mb: 1 }}>
              Receipt lines (what we received)
            </Typography>
            {loadingReceipts ? (
              <CircularProgress size={22} />
            ) : receiptLines.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No receipts yet — use tab “Record receipt”.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {receiptLines.map((line) => (
                  <Box
                    key={line.id}
                    sx={{
                      border: "1px solid rgba(15,23,42,0.1)",
                      borderRadius: 1,
                      p: 1,
                      fontSize: 13,
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        type="date"
                        value={line.receipt_date}
                        InputLabelProps={{ shrink: true }}
                        onChange={(e) =>
                          setReceiptLines((prev) =>
                            prev.map((x) => (x.id === line.id ? { ...x, receipt_date: e.target.value } : x)),
                          )
                        }
                        onBlur={() => {
                          const current = receiptLines.find((x) => x.id === line.id);
                          if (current) void saveReceiptLine(line.id, { receipt_date: current.receipt_date });
                        }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        value={line.weight_received}
                        onChange={(e) =>
                          setReceiptLines((prev) =>
                            prev.map((x) => (x.id === line.id ? { ...x, weight_received: Number(e.target.value) } : x)),
                          )
                        }
                        onBlur={() => {
                          const current = receiptLines.find((x) => x.id === line.id);
                          if (current) void saveReceiptLine(line.id, { weight_received: current.weight_received });
                        }}
                        sx={{ width: 120 }}
                      />
                      <IconButton size="small" color="error" onClick={() => void removeReceiptLine(line.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Note"
                      value={line.note ?? ""}
                      onChange={(e) =>
                        setReceiptLines((prev) => prev.map((x) => (x.id === line.id ? { ...x, note: e.target.value || null } : x)))
                      }
                      onBlur={() => {
                        const current = receiptLines.find((x) => x.id === line.id);
                        if (current) void saveReceiptLine(line.id, { note: current.note });
                      }}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        ) : null}
      </Drawer>
    </Box>
  );
}
