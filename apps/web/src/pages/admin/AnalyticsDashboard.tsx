import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Grid,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../lib/api";
import {
  printAgingReport,
  printGodownStockReport,
  printPackingStickers,
  printStockByVariantReport,
  printSupplierStockReport,
} from "../../lib/print/docs";

const PIE_COLORS = ["#1565c0", "#2e7d32", "#ed6c02", "#6a1b9a", "#c62828", "#00838f"];

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Paper sx={{ p: 2, height: "100%", borderLeft: "4px solid", borderColor: "primary.main" }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800}>
        {value}
      </Typography>
      {sub ? (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      ) : null}
    </Paper>
  );
}

export function AnalyticsPage() {
  const [tab, setTab] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [byVariant, setByVariant] = useState<any[]>([]);
  const [bySupplier, setBySupplier] = useState<any[]>([]);
  const [godownDetail, setGodownDetail] = useState<any[]>([]);
  const [aging, setAging] = useState<any[]>([]);
  const [movement, setMovement] = useState<any[]>([]);
  const [lineageQ, setLineageQ] = useState("");
  const [lineage, setLineage] = useState<any>(null);
  const [lineageErr, setLineageErr] = useState<string | null>(null);

  async function load() {
    const [s, v, sup, g, a, m] = await Promise.all([
      api.get("/mx/analytics/summary"),
      api.get("/mx/analytics/stock-by-variant"),
      api.get("/mx/analytics/stock-by-supplier"),
      api.get("/mx/analytics/godown-detail"),
      api.get("/mx/analytics/aging"),
      api.get("/mx/analytics/movement"),
    ]);
    setSummary(s.data.data);
    setByVariant(v.data.data ?? []);
    setBySupplier(sup.data.data ?? []);
    setGodownDetail(g.data.data ?? []);
    setAging(a.data.data ?? []);
    setMovement(m.data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function lookup() {
    setLineageErr(null);
    setLineage(null);
    try {
      const r = await api.get(`/mx/analytics/lineage/${encodeURIComponent(lineageQ.trim())}`);
      setLineage(r.data.data);
    } catch {
      setLineageErr("No lineage found");
    }
  }

  const t = summary?.totals ?? {};
  const packingPie = (summary?.packings_by_status ?? []).map((r: any) => ({
    name: r.status,
    value: Number(r.meters),
  }));

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={2} gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Stock Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live meters & pieces across rolls, cutting, godown, parcels and dispatch
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button size="small" startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={() => printStockByVariantReport(byVariant, t)}>
            Variant PDF
          </Button>
          <Button size="small" startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={() => printSupplierStockReport(bySupplier)}>
            Supplier PDF
          </Button>
          <Button size="small" startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={() => printGodownStockReport(godownDetail)}>
            Godown PDF
          </Button>
          <Button size="small" startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={() => printAgingReport(aging)}>
            Aging PDF
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Kpi label="Available packing" value={`${Number(t.available_packing_m ?? 0).toFixed(0)} m`} sub={`${t.available_packing_pcs ?? 0} pieces`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Kpi label="On rolls (remaining)" value={`${Number(t.roll_remaining_m ?? 0).toFixed(0)} m`} sub={`${t.roll_count ?? 0} rolls`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Kpi label="At mill (WIP)" value={`${Number(t.mill_wip_m ?? 0).toFixed(0)} m`} sub="Job work outstanding" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Kpi label="Dispatched" value={`${Number(t.dispatched_m ?? 0).toFixed(0)} m`} sub={`${t.dispatched_pcs ?? 0} pcs · ${t.open_challans ?? 0} open DCs`} />
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Overview" />
        <Tab label="By variant" />
        <Tab label="Godown" />
        <Tab label="Aging" />
        <Tab label="Suppliers" />
        <Tab label="Trace" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Grid container spacing={2} mb={3}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper sx={{ p: 2, height: 300 }}>
                <Typography fontWeight={700} mb={1}>
                  Packing meters by stage
                </Typography>
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie data={packingPie} dataKey="value" nameKey="name" outerRadius={90} label>
                      {packingPie.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper sx={{ p: 2, height: 300 }}>
                <Typography fontWeight={700} mb={1}>
                  Daily movement (meters)
                </Typography>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={[...movement].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="roll_in" name="Roll in" fill="#2e7d32" />
                    <Bar dataKey="cut" name="Cut" fill="#1565c0" />
                    <Bar dataKey="dispatched" name="Dispatched" fill="#c62828" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          <Typography fontWeight={700} mb={1}>
            Mill WIP
          </Typography>
          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>Worker</TableCell>
                <TableCell>Jobs</TableCell>
                <TableCell align="right">Meters out</TableCell>
                <TableCell>Oldest</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(summary?.mill_wip ?? []).map((r: any) => (
                <TableRow key={r.worker_name}>
                  <TableCell>{r.worker_name}</TableCell>
                  <TableCell>{r.open_jobs}</TableCell>
                  <TableCell align="right">{Number(r.meters_outstanding).toFixed(1)}</TableCell>
                  <TableCell>{r.oldest_outward}</TableCell>
                </TableRow>
              ))}
              {!summary?.mill_wip?.length && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                    No open job work
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Typography fontWeight={700} mb={1}>
            Godown summary
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Godown</TableCell>
                <TableCell align="right">Pieces</TableCell>
                <TableCell align="right">Meters</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(summary?.godown ?? []).map((r: any) => (
                <TableRow key={r.godown_name}>
                  <TableCell>
                    {r.godown_name} ({r.godown_code})
                  </TableCell>
                  <TableCell align="right">{r.pieces}</TableCell>
                  <TableCell align="right">{Number(r.meters).toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={1}>
            <Typography fontWeight={700}>Stock by variant (detail)</Typography>
            <Button size="small" onClick={() => printStockByVariantReport(byVariant, t)}>
              Print / PDF
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Variant</TableCell>
                <TableCell>Item</TableCell>
                <TableCell align="right">Roll left</TableCell>
                <TableCell align="right">Packed</TableCell>
                <TableCell align="right">Godown</TableCell>
                <TableCell align="right">Parcel</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell align="right">Dispatched</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byVariant.map((r) => (
                <TableRow key={r.variant_code} hover>
                  <TableCell>
                    <Typography fontFamily="monospace" fontWeight={700}>
                      {r.variant_code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.variant_name} · {r.color}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.item_name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {r.quality}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{Number(r.roll_remaining_m).toFixed(1)}</TableCell>
                  <TableCell align="right">
                    {Number(r.packed_m).toFixed(0)}/{r.packed_pcs}
                  </TableCell>
                  <TableCell align="right">
                    {Number(r.godown_m).toFixed(0)}/{r.godown_pcs}
                  </TableCell>
                  <TableCell align="right">
                    {Number(r.consolidated_m).toFixed(0)}/{r.consolidated_pcs}
                  </TableCell>
                  <TableCell align="right">
                    <strong>{Number(r.available_m).toFixed(1)}</strong>/{r.available_pcs}
                  </TableCell>
                  <TableCell align="right">
                    {Number(r.dispatched_m).toFixed(0)}/{r.dispatched_pcs}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={1} flexWrap="wrap" gap={1}>
            <Typography fontWeight={700}>Godown piece list</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  printPackingStickers(
                    godownDetail.slice(0, 24).map((r) => ({
                      ...r,
                      roll_short: "",
                    })),
                  )
                }
              >
                Sticker sheet PDF
              </Button>
              <Button size="small" onClick={() => printGodownStockReport(godownDetail)}>
                Print / PDF
              </Button>
            </Stack>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Godown</TableCell>
                <TableCell>Rack</TableCell>
                <TableCell>Packing</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell align="right">m</TableCell>
                <TableCell>Age</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {godownDetail.map((r) => (
                <TableRow key={r.packing_id}>
                  <TableCell>
                    {r.godown_name} ({r.godown_code})
                  </TableCell>
                  <TableCell>{r.location_hint ?? "—"}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{r.short_code}</TableCell>
                  <TableCell>
                    {r.variant_code} {r.variant_name}
                  </TableCell>
                  <TableCell align="right">{r.length_meters}</TableCell>
                  <TableCell>
                    <Chip size="small" label={`${r.age_days}d`} color={r.age_days > 14 ? "warning" : "default"} />
                  </TableCell>
                  <TableCell>{r.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={1}>
            <Typography fontWeight={700}>Aging — packed / godown / parcel</Typography>
            <Button size="small" onClick={() => printAgingReport(aging)}>
              Print / PDF
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Age</TableCell>
                <TableCell>Packing</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell align="right">m</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Supplier</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aging.map((r) => (
                <TableRow key={r.packing_id}>
                  <TableCell>
                    <Chip size="small" label={`${r.age_days}d`} color={r.age_days > 14 ? "warning" : r.age_days > 7 ? "default" : "success"} />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{r.short_code}</TableCell>
                  <TableCell>
                    {r.variant_code} {r.variant_name}
                  </TableCell>
                  <TableCell align="right">{r.length_meters}</TableCell>
                  <TableCell>
                    {r.godown_name ?? "—"} {r.location_hint ?? ""}
                  </TableCell>
                  <TableCell>{r.supplier_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 4 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={1}>
            <Typography fontWeight={700}>Supplier stock</Typography>
            <Button size="small" onClick={() => printSupplierStockReport(bySupplier)}>
              Print / PDF
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Supplier</TableCell>
                <TableCell align="right">Rolls</TableCell>
                <TableCell align="right">Original m</TableCell>
                <TableCell align="right">Remaining m</TableCell>
                <TableCell align="right">At mill</TableCell>
                <TableCell align="right">In cutting</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bySupplier.map((r) => (
                <TableRow key={r.supplier_name}>
                  <TableCell>{r.supplier_name}</TableCell>
                  <TableCell align="right">{r.rolls}</TableCell>
                  <TableCell align="right">{Number(r.original_m).toFixed(1)}</TableCell>
                  <TableCell align="right">
                    <strong>{Number(r.remaining_m).toFixed(1)}</strong>
                  </TableCell>
                  <TableCell align="right">{Number(r.at_mill_m).toFixed(1)}</TableCell>
                  <TableCell align="right">{Number(r.in_cutting_m).toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 5 && (
        <Box>
          <Typography fontWeight={700} mb={1}>
            Lineage trace
          </Typography>
          <Stack direction="row" spacing={1} mb={2}>
            <TextField
              size="small"
              fullWidth
              label="Packing / Parcel / Roll ID or short code"
              value={lineageQ}
              onChange={(e) => setLineageQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void lookup()}
            />
            <Button variant="contained" onClick={() => void lookup()}>
              Trace
            </Button>
          </Stack>
          {lineageErr && <Alert severity="warning">{lineageErr}</Alert>}
          {lineage && (
            <Paper sx={{ p: 2 }}>
              <Chip label={lineage.type} color="primary" sx={{ mb: 1 }} />
              {lineage.type === "packing" && (
                <Box>
                  <Typography fontWeight={700}>
                    {lineage.packing.short_code} · {lineage.packing.length_meters}m · {lineage.packing.variant_code}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {lineage.packing.item_name} · {lineage.packing.variant_name} · {lineage.packing.color} · {lineage.packing.quality}
                  </Typography>
                  <Typography variant="body2" mt={1}>
                    Supplier: {lineage.packing.supplier_name} · Roll {lineage.packing.roll_short} ({lineage.packing.roll_status})
                  </Typography>
                  <Typography variant="body2">Siblings on roll: {(lineage.sibling_packings ?? []).length}</Typography>
                  <Typography variant="body2">Challan links: {(lineage.challan_scans ?? []).length}</Typography>
                </Box>
              )}
              {lineage.type !== "packing" && (
                <pre style={{ margin: 0, fontSize: 12, overflow: "auto" }}>{JSON.stringify(lineage, null, 2)}</pre>
              )}
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}
