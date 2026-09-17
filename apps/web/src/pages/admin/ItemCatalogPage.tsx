import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import CategoryIcon from "@mui/icons-material/Category";
import { api } from "../../lib/api";

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block" sx={{ letterSpacing: 0.06, textTransform: "uppercase" }}>
        {label}
      </Typography>
      <Typography fontWeight={800} fontSize="1.15rem" color={accent || "text.primary"} sx={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
    </Box>
  );
}

export function ItemCatalogPage() {
  const [items, setItems] = useState<any[]>([]);
  const [searchItems, setSearchItems] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [searchVariants, setSearchVariants] = useState("");
  const [searchLots, setSearchLots] = useState("");

  const [showNewItem, setShowNewItem] = useState(false);
  const [itemForm, setItemForm] = useState({ code: "", name: "", quality: "" });

  const [showNewVar, setShowNewVar] = useState(false);
  const [varForm, setVarForm] = useState({ variant_code: "", variant_name: "", color: "" });

  async function loadList() {
    const r = await api.get("/mx/analytics/by-item");
    setItems(r.data.data ?? []);
  }

  async function openItem(id: number) {
    setOpenId(id);
    const r = await api.get(`/mx/analytics/item/${id}`);
    setDetail(r.data.data);
  }

  useEffect(() => {
    void loadList();
  }, []);

  if (openId && detail) {
    const { item, variants, lots } = detail;
    
    const filteredVariants = variants.filter((v: any) => 
      v.variant_code?.toLowerCase().includes(searchVariants.toLowerCase()) || 
      v.variant_name?.toLowerCase().includes(searchVariants.toLowerCase())
    );

    const filteredLots = lots.filter((l: any) => 
      l.lot_no?.toLowerCase().includes(searchLots.toLowerCase()) || 
      String(l.job_id).toLowerCase().includes(searchLots.toLowerCase())
    );

    return (
      <Box className="animate-scale-in">
        <Button startIcon={<ArrowBackIcon />} onClick={() => { setOpenId(null); setDetail(null); }} sx={{ mb: 2 }}>
          Back to Catalog
        </Button>

        <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: "none", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)" }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="overline" color="primary" fontWeight={800} sx={{ color: "#6366f1" }}>
                Item Charter
              </Typography>
              <Typography variant="h4" fontWeight={900} letterSpacing={-0.5} className="text-gradient gradient-indigo">
                {item.code}
              </Typography>
              <Typography variant="h6" color="text.secondary" fontWeight={500}>
                {item.name}
                {item.quality ? ` · ${item.quality}` : ""}
              </Typography>
            </Box>
            <Chip label={`${variants.length} variants active`} sx={{ borderColor: "#6366f1", color: "#6366f1" }} variant="outlined" />
          </Stack>
        </Paper>

        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Variant Master</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              placeholder="Search variants..."
              value={searchVariants}
              onChange={(e) => setSearchVariants(e.target.value)}
              sx={{ width: 250 }}
            />
            <Button variant="contained" sx={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }} startIcon={<AddIcon />} onClick={() => setShowNewVar(!showNewVar)}>
              {showNewVar ? "Cancel" : "Add Variant"}
            </Button>
          </Stack>
        </Stack>

        {showNewVar && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(99, 102, 241, 0.2)", background: "rgba(99, 102, 241, 0.02)" }} className="animate-slide-down">
            <Typography fontWeight={700} mb={2}>Add New Variant (Color/Shade)</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField size="small" label="Variant Code (e.g. BLK)" value={varForm.variant_code} onChange={(e) => setVarForm({ ...varForm, variant_code: e.target.value })} />
              <TextField size="small" label="Name" value={varForm.variant_name} onChange={(e) => setVarForm({ ...varForm, variant_name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="Color" value={varForm.color} onChange={(e) => setVarForm({ ...varForm, color: e.target.value })} />
              <Button
                variant="contained" sx={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                onClick={async () => {
                  if (!varForm.variant_code.trim() || !varForm.variant_name.trim()) return;
                  await api.post("/mx/variants", { ...varForm, item_id: openId });
                  setVarForm({ variant_code: "", variant_name: "", color: "" });
                  setShowNewVar(false);
                  await openItem(openId);
                }}
              >
                Save Variant
              </Button>
            </Stack>
          </Paper>
        )}

        <Grid container spacing={3} mb={4}>
          {filteredVariants.map((v: any, idx: number) => (
            <Grid key={v.variant_code} size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ p: 3, height: "100%", borderRadius: 4 }} className={`stagger-${(idx % 5) + 1}`}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Typography fontFamily="monospace" fontWeight={800} fontSize="1.25rem" color="#6366f1">
                      {v.variant_code}
                    </Typography>
                    <Typography color="text.secondary">
                      {v.variant_name}
                      {v.color ? ` · ${v.color}` : ""}
                    </Typography>
                  </Box>
                  <Chip size="small" label={`${v.roll_count || 0} lots`} />
                </Stack>
                <Grid container spacing={1}>
                  <Grid  size={{ xs: 4 }}><Metric label="Available" value={`${Number(v.available_m || 0).toFixed(0)} m`} accent="success.main" /></Grid>
                  <Grid  size={{ xs: 4 }}><Metric label="On lots" value={`${Number(v.roll_remaining_m || 0).toFixed(0)} m`} /></Grid>
                  <Grid  size={{ xs: 4 }}><Metric label="At mill" value={`${Number(v.mill_wip_m || 0).toFixed(0)} m`} accent="warning.main" /></Grid>
                  <Grid  size={{ xs: 4 }}><Metric label="Godown" value={`${Number(v.godown_m || 0).toFixed(0)} m`} /></Grid>
                  <Grid  size={{ xs: 4 }}><Metric label="Packed" value={`${Number(v.packed_m || 0).toFixed(0)} m`} /></Grid>
                  <Grid  size={{ xs: 4 }}><Metric label="Dispatched" value={`${Number(v.dispatched_m || 0).toFixed(0)} m`} /></Grid>
                </Grid>
              </Paper>
            </Grid>
          ))}
          {!filteredVariants.length && (
            <Grid  size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
                <Typography color="text.secondary">No variants for this item. Add the first color/shade above.</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>

        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Active Lots (Job IDs)</Typography>
          <TextField
            size="small"
            placeholder="Search lots..."
            value={searchLots}
            onChange={(e) => setSearchLots(e.target.value)}
            sx={{ width: 250 }}
          />
        </Stack>
        <Paper elevation={0} sx={{ borderRadius: 4, border: "none", overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Lot no</TableCell>
                <TableCell>Job ID</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell align="right">Remaining</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLots.map((l: any) => (
                <TableRow key={l.job_id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{l.lot_no}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12, color: "text.secondary" }}>{String(l.job_id).slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell>{l.variant_code}</TableCell>
                  <TableCell>{l.supplier_name}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {Number(l.remaining_meterage).toFixed(1)} <Typography component="span" variant="caption" color="text.secondary">/ {Number(l.original_meterage).toFixed(0)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={l.status} variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
              {!filteredLots.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 3 }}>
                    No lots received yet for this item.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    );
  }

  const filteredItems = items.filter(it => 
    it.code?.toLowerCase().includes(searchItems.toLowerCase()) || 
    it.name?.toLowerCase().includes(searchItems.toLowerCase())
  );

  return (
    <Box className="stagger-1">
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: "none", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)" }}>
        <Typography variant="h4" className="text-gradient gradient-indigo" gutterBottom>
          Item Catalog
        </Typography>
        <Typography color="text.secondary">
          Manage items, variants, and view full stock analytics per module.
        </Typography>
        <Stack direction="row" spacing={2} mt={3}>
          <Chip icon={<CategoryIcon />} label={`${items.length} Master Items`} variant="outlined" sx={{ borderColor: "#6366f1", color: "#6366f1" }} />
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Item Directory</Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            placeholder="Search items..."
            value={searchItems}
            onChange={(e) => setSearchItems(e.target.value)}
            sx={{ width: 250 }}
          />
          <Button variant="contained" sx={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }} startIcon={<AddIcon />} onClick={() => setShowNewItem(!showNewItem)}>
            {showNewItem ? "Cancel" : "Add Item"}
          </Button>
        </Stack>
      </Stack>

      {showNewItem && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(99, 102, 241, 0.2)", background: "rgba(99, 102, 241, 0.02)" }} className="animate-slide-down">
          <Typography fontWeight={700} mb={2}>Create New Item</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" label="Item Code" value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} />
            <TextField size="small" label="Item Name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Quality" value={itemForm.quality} onChange={(e) => setItemForm({ ...itemForm, quality: e.target.value })} />
            <Button
              variant="contained" sx={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
              onClick={async () => {
                if (!itemForm.code.trim() || !itemForm.name.trim()) return;
                await api.post("/mx/items", itemForm);
                setItemForm({ code: "", name: "", quality: "" });
                setShowNewItem(false);
                await loadList();
              }}
            >
              Save Item
            </Button>
          </Stack>
        </Paper>
      )}

      <Grid container spacing={3}>
        {filteredItems.map((it, idx) => (
          <Grid key={it.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Paper
              elevation={0}
              onClick={() => void openItem(it.id)}
              sx={{
                p: 3,
                borderRadius: 4,
                cursor: "pointer",
                height: "100%",
              }}
              className={`stagger-${(idx % 5) + 1}`}
            >
              <Typography variant="overline" color="primary" fontWeight={800} sx={{ color: "#6366f1" }}>
                {it.code}
              </Typography>
              <Typography variant="h6" fontWeight={800} gutterBottom>
                {it.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {it.quality || "No quality set"} · {it.variant_count || 0} variants
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" color="success" variant="outlined" label={`${Number(it.available_m || 0).toFixed(0)}m avail`} />
                <Chip size="small" variant="outlined" label={`${Number(it.roll_remaining_m || 0).toFixed(0)}m on lots`} />
              </Stack>
            </Paper>
          </Grid>
        ))}
        {!filteredItems.length && (
          <Grid  size={{ xs: 12 }}>
            <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
              <Typography color="text.secondary">No items yet. Create your first item.</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
