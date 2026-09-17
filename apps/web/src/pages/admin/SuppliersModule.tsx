import { useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Grid,

  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import InventoryIcon from "@mui/icons-material/Inventory";
import { api } from "../../lib/api";


function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }} className="animate-slide-down">{children}</Box>;
}

export function SuppliersModule() {
  const [tab, setTab] = useState(0);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [rolls, setRolls] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [showNewSup, setShowNewSup] = useState(false);

  const [supForm, setSupForm] = useState({ name: "", contact: "" });
  const [rollForm, setRollForm] = useState({
    supplier_id: 0,
    variant_code: "",
    lot_no: "",
    original_meterage: 100,
    received_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [searchSuppliers, setSearchSuppliers] = useState("");
  const [searchRolls, setSearchRolls] = useState("");

  async function load() {
    const [s, r, i] = await Promise.all([
      api.get("/mx/suppliers"),
      api.get("/mx/rolls"),
      api.get("/mx/items"),
    ]);
    setSuppliers(s.data.data ?? []);
    setRolls(r.data.data ?? []);
    setVariants(i.data.data.variants ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Box className="stagger-1">
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: "none", background: "linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)" }}>
        <Typography variant="h4" className="text-gradient gradient-sky" gutterBottom>
          Suppliers & Inward
        </Typography>
        <Typography color="text.secondary">
          Manage mills, suppliers, and log incoming stock (lots/rolls).
        </Typography>
        <Stack direction="row" spacing={2} mt={3}>
          <Chip icon={<LocalShippingIcon />} label={`${suppliers.length} Suppliers`} variant="outlined" color="info" />
          <Chip icon={<InventoryIcon />} label={`${rolls.length} Lots Received`} variant="outlined" color="primary" />
        </Stack>
      </Paper>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0", background: "linear-gradient(90deg, #0ea5e9, #6366f1)" },
          "& .MuiTab-root": { fontWeight: 700, textTransform: "none", fontSize: "1rem" },
          "& .Mui-selected": { color: "#0ea5e9 !important" },
        }}
      >
        <Tab label="Stock In (Receive)" />
        <Tab label="Suppliers Directory" />
        <Tab label="Lots History" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4 }}>
          <Typography variant="h6" mb={1}>Receive New Lot</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Log incoming rolls from suppliers. A unique Job ID will be created for tracking.
          </Typography>
          
          <Grid container spacing={3}>
            <Grid  size={{ xs: 12, md: 4 }}>
              <Autocomplete
                options={suppliers}
                getOptionLabel={(s) => s.name}
                value={suppliers.find((s) => s.id === rollForm.supplier_id) || null}
                onChange={(_, newValue) => setRollForm({ ...rollForm, supplier_id: newValue?.id || 0 })}
                renderInput={(params) => <TextField {...params} label="Supplier" />}
                fullWidth
              />
            </Grid>
            <Grid  size={{ xs: 12, md: 4 }}>
              <TextField 
                fullWidth label="Lot No (from Supplier)" required
                value={rollForm.lot_no} 
                onChange={(e) => setRollForm({ ...rollForm, lot_no: e.target.value })}
                placeholder="e.g. SF-2401-A"
              />
            </Grid>
            <Grid  size={{ xs: 12, md: 4 }}>
              <Autocomplete
                options={variants}
                getOptionLabel={(v) => `${v.variant_code} ${v.variant_name}`}
                value={variants.find((v) => v.variant_code === rollForm.variant_code) || null}
                onChange={(_, newValue) => setRollForm({ ...rollForm, variant_code: newValue?.variant_code || "" })}
                renderInput={(params) => <TextField {...params} label="Item Variant" />}
                fullWidth
              />
            </Grid>
            <Grid  size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField 
                fullWidth type="number" label="Meters" 
                value={rollForm.original_meterage} 
                onChange={(e) => setRollForm({ ...rollForm, original_meterage: Number(e.target.value) })} 
              />
            </Grid>
            <Grid  size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField 
                fullWidth type="date" label="Received Date" InputLabelProps={{ shrink: true }} 
                value={rollForm.received_date} 
                onChange={(e) => setRollForm({ ...rollForm, received_date: e.target.value })} 
              />
            </Grid>
            <Grid  size={{ xs: 12, md: 4 }}>
              <Button
                variant="contained" fullWidth sx={{ height: 56, background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}
                onClick={async () => {
                  if (!rollForm.lot_no.trim() || !rollForm.supplier_id || !rollForm.variant_code) return;
                  await api.post("/mx/rolls", rollForm);
                  setRollForm({ ...rollForm, lot_no: "" });
                  await load();
                  setTab(2); // Jump to history
                }}
              >
                Stock In Lot
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Suppliers List</Typography>
          <Stack direction="row" spacing={2}>
            <TextField size="small" placeholder="Search suppliers..." value={searchSuppliers} onChange={(e) => setSearchSuppliers(e.target.value)} sx={{ width: 250 }} />
            <Button variant="contained" color="info" startIcon={<AddIcon />} onClick={() => setShowNewSup(!showNewSup)}>
              {showNewSup ? "Cancel" : "Add Supplier"}
            </Button>
          </Stack>
        </Stack>

        {showNewSup && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(14, 165, 233, 0.2)", background: "rgba(14, 165, 233, 0.02)" }} className="animate-slide-down">
            <Typography fontWeight={700} mb={2}>Add New Supplier</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField size="small" label="Name" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="Contact" value={supForm.contact} onChange={(e) => setSupForm({ ...supForm, contact: e.target.value })} />
              <Button
                variant="contained" color="info"
                onClick={async () => {
                  if (!supForm.name.trim()) return;
                  await api.post("/mx/suppliers", supForm);
                  setSupForm({ name: "", contact: "" });
                  setShowNewSup(false);
                  await load();
                }}
              >
                Save Supplier
              </Button>
            </Stack>
          </Paper>
        )}

        <Grid container spacing={3}>
          {suppliers
            .filter((s) => s.name?.toLowerCase().includes(searchSuppliers.toLowerCase()))
            .map((s, idx) => (
            <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={0} sx={{ p: 3, height: "100%", borderRadius: 4 }} className={`stagger-${(idx % 5) + 1}`}>
                <Typography variant="h6" fontWeight={800}>{s.name}</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  {s.contact || "No contact info"}
                </Typography>
              </Paper>
            </Grid>
          ))}
          {!suppliers.length && (
            <Grid  size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
                <Typography color="text.secondary">No suppliers yet.</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Lots History</Typography>
          <TextField size="small" placeholder="Search lots..." value={searchRolls} onChange={(e) => setSearchRolls(e.target.value)} sx={{ width: 250 }} />
        </Stack>
        <Grid container spacing={2}>
          {rolls
            .filter((r) => r.lot_no?.toLowerCase().includes(searchRolls.toLowerCase()) || r.short_code?.toLowerCase().includes(searchRolls.toLowerCase()) || r.supplier_name?.toLowerCase().includes(searchRolls.toLowerCase()))
            .map((r, idx) => (
            <Grid key={r.roll_id} size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 2, display: "flex", alignItems: "center", gap: 3, borderRadius: 3 }} className={`stagger-${(idx % 5) + 1}`}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2, background: "rgba(14, 165, 233, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <InventoryIcon sx={{ color: "#0ea5e9" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={800} sx={{ fontFamily: "monospace", fontSize: "1.1rem" }}>{r.lot_no || r.short_code}</Typography>
                  <Typography variant="body2" color="text.secondary">Job ID: {String(r.job_id || r.roll_id).slice(0, 8).toUpperCase()}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Supplier</Typography>
                  <Typography fontWeight={600}>{r.supplier_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Variant</Typography>
                  <Typography fontWeight={600}>{r.variant_code}</Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="body2" color="text.secondary">Meters</Typography>
                  <Typography fontWeight={700} color="primary.main">{r.remaining_meterage} <span style={{ color: "var(--mui-palette-text-secondary)", fontWeight: 400 }}>/ {r.original_meterage}</span></Typography>
                </Box>
                <Chip size="small" label={r.status} color={r.remaining_meterage > 0 ? "success" : "default"} variant="outlined" />
              </Paper>
            </Grid>
          ))}
          {!rolls.length && (
            <Grid  size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
                <Typography color="text.secondary">No lots received yet.</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </TabPanel>
    </Box>
  );
}
