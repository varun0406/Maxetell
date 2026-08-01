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
  MenuItem,
  Grid,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import { api, createAppUser, deleteAppUser, fetchAppUsers, type AppUserRow } from "../../lib/api";
import { getPrinterConfig, setPrinterConfig } from "../../lib/print/zpl";
import { runSyncOnce } from "../../offline/syncWorker";
import { listPendingOutbox } from "../../offline/localDb";

export { AnalyticsPage } from "./AnalyticsDashboard";

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

function ItemCharterModular({
  items,
  variants,
  onReload,
}: {
  items: any[];
  variants: any[];
  onReload: () => Promise<void>;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [itemForm, setItemForm] = useState({ code: "", name: "", quality: "" });
  const [varForm, setVarForm] = useState({ variant_code: "", variant_name: "", color: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const openItem = items.find((i) => i.id === openId) ?? null;
  const itemVariants = variants.filter((v) => v.item_id === openId);

  async function createItem() {
    if (!itemForm.code.trim() || !itemForm.name.trim()) return;
    await api.post("/mx/items", itemForm);
    setItemForm({ code: "", name: "", quality: "" });
    setShowNewItem(false);
    setMsg("Item created");
    await onReload();
  }

  async function createVariant() {
    if (!openId || !varForm.variant_code.trim() || !varForm.variant_name.trim()) return;
    await api.post("/mx/variants", { ...varForm, item_id: openId });
    setVarForm({ variant_code: "", variant_name: "", color: "" });
    setMsg("Variant added");
    await onReload();
  }

  if (openItem) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => setOpenId(null)} sx={{ mb: 2 }}>
          All items
        </Button>
        {msg && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg(null)}>
            {msg}
          </Alert>
        )}

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            background: "linear-gradient(145deg, rgba(25,118,210,0.1) 0%, rgba(255,255,255,0) 55%)",
          }}
        >
          <Typography variant="overline" color="primary" fontWeight={800} letterSpacing={0.12}>
            Item charter
          </Typography>
          <Typography variant="h4" fontWeight={900} letterSpacing={-0.6}>
            {openItem.code}
          </Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={500}>
            {openItem.name}
            {openItem.quality ? ` · ${openItem.quality}` : ""}
          </Typography>
          <Chip sx={{ mt: 1.5 }} label={`${itemVariants.length} variants`} color="primary" variant="outlined" />
        </Paper>

        <Paper
          elevation={0}
          sx={{ p: 2.5, mb: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <Typography fontWeight={800} mb={1.5}>
            Add variant to this item
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <TextField
              size="small"
              label="Variant code"
              value={varForm.variant_code}
              onChange={(e) => setVarForm({ ...varForm, variant_code: e.target.value })}
              sx={{ minWidth: 120 }}
            />
            <TextField
              size="small"
              label="Variant name"
              value={varForm.variant_name}
              onChange={(e) => setVarForm({ ...varForm, variant_name: e.target.value })}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Color"
              value={varForm.color}
              onChange={(e) => setVarForm({ ...varForm, color: e.target.value })}
              sx={{ minWidth: 120 }}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => void createVariant()}>
              Add
            </Button>
          </Stack>
        </Paper>

        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ mb: 1.5, letterSpacing: 0.1, textTransform: "uppercase" }}
        >
          Variants inside {openItem.code}
        </Typography>
        <Grid container spacing={2}>
          {itemVariants.map((v) => (
            <Grid key={v.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  height: "100%",
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  transition: "border-color .15s, box-shadow .15s",
                  "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                }}
              >
                <Typography fontFamily="monospace" fontWeight={900} fontSize="1.35rem" color="primary.main">
                  {v.variant_code}
                </Typography>
                <Typography fontWeight={700} mt={0.5}>
                  {v.variant_name}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={v.color || "No color"} />
                  <Chip size="small" variant="outlined" label={openItem.quality || "—"} />
                </Stack>
              </Paper>
            </Grid>
          ))}
          {!itemVariants.length && (
            <Grid size={12}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  textAlign: "center",
                  borderRadius: 3,
                  border: "1px dashed",
                  borderColor: "divider",
                  color: "text.secondary",
                }}
              >
                No variants yet — add the first color / shade above.
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={2} gap={1}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Items
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Open an item to manage its variants as modules.
          </Typography>
        </Box>
        <Button variant={showNewItem ? "outlined" : "contained"} startIcon={<AddIcon />} onClick={() => setShowNewItem((v) => !v)}>
          {showNewItem ? "Cancel" : "New item"}
        </Button>
      </Stack>

      {msg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg}
        </Alert>
      )}

      {showNewItem && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 3, border: "1px solid", borderColor: "primary.light" }}>
          <Typography fontWeight={800} mb={1.5}>
            Create item
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField size="small" label="Code" value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} />
            <TextField size="small" label="Name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Quality" value={itemForm.quality} onChange={(e) => setItemForm({ ...itemForm, quality: e.target.value })} />
            <Button variant="contained" onClick={() => void createItem()}>
              Save item
            </Button>
          </Stack>
        </Paper>
      )}

      <Grid container spacing={2}>
        {items.map((it) => {
          const count = variants.filter((v) => v.item_id === it.id).length;
          const preview = variants.filter((v) => v.item_id === it.id).slice(0, 4);
          return (
            <Grid key={it.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Paper
                elevation={0}
                onClick={() => setOpenId(it.id)}
                sx={{
                  p: 2.5,
                  height: "100%",
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  cursor: "pointer",
                  transition: "transform .12s, border-color .12s, box-shadow .12s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: "primary.main",
                    boxShadow: 3,
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="overline" color="primary" fontWeight={800}>
                      {it.code}
                    </Typography>
                    <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                      {it.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      {it.quality || "No quality set"}
                    </Typography>
                  </Box>
                  <Chip size="small" color="primary" variant="outlined" label={`${count} var`} />
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {preview.map((v) => (
                    <Chip key={v.id} size="small" label={v.variant_code} sx={{ fontFamily: "monospace" }} />
                  ))}
                  {count > 4 && <Chip size="small" variant="outlined" label={`+${count - 4}`} />}
                  {!count && (
                    <Typography variant="caption" color="text.secondary">
                      Empty — open to add variants
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
          );
        })}
        {!items.length && (
          <Grid size={12}>
            <Paper
              elevation={0}
              sx={{
                p: 5,
                textAlign: "center",
                borderRadius: 3,
                border: "1px dashed",
                borderColor: "divider",
              }}
            >
              <Typography color="text.secondary" mb={2}>
                No items yet. Create your first cloth item.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowNewItem(true)}>
                New item
              </Button>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

export function MastersPage() {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  const [supForm, setSupForm] = useState({ name: "", contact: "" });
  const [jwForm, setJwForm] = useState({ name: "", contact: "", job_work_type: "" });
  const [gForm, setGForm] = useState({ code: "", name: "", location: "" });
  const [partyForm, setPartyForm] = useState({
    name: "",
    address_line: "",
    city: "",
    state: "",
    gstin: "",
    phone: "",
  });
  const [agentForm, setAgentForm] = useState({ name: "", phone: "" });
  const [aForm, setAForm] = useState({
    party_id: 0,
    party_name: "",
    address_line: "",
    city: "",
    state: "",
    phone: "",
    label: "Deliver to",
  });

  async function load() {
    const [i, s, w, g, a, p, ag] = await Promise.all([
      api.get("/mx/items"),
      api.get("/mx/suppliers"),
      api.get("/mx/job-workers"),
      api.get("/mx/godowns"),
      api.get("/mx/addresses"),
      api.get("/mx/parties"),
      api.get("/mx/agents"),
    ]);
    setItems(i.data.data.items ?? []);
    setVariants(i.data.data.variants ?? []);
    setSuppliers(s.data.data ?? []);
    setWorkers(w.data.data ?? []);
    setGodowns(g.data.data ?? []);
    setAddresses(a.data.data ?? []);
    setParties(p.data.data ?? []);
    setAgents(ag.data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} letterSpacing={-0.5} gutterBottom>
        Masters
      </Typography>
      <Typography color="text.secondary" mb={2}>
        Parties, agents, godowns, and the item charter.
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Item Charter" />
        <Tab label="Parties" />
        <Tab label="Ship-to" />
        <Tab label="Agents" />
        <Tab label="Suppliers" />
        <Tab label="Job Workers" />
        <Tab label="Godowns" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <ItemCharterModular items={items} variants={variants} onReload={load} />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Party onboarding — billing name, address, GSTIN, phone
        </Typography>
        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Party name" value={partyForm.name} onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })} />
          <TextField size="small" label="Address" value={partyForm.address_line} onChange={(e) => setPartyForm({ ...partyForm, address_line: e.target.value })} sx={{ minWidth: 200 }} />
          <TextField size="small" label="City" value={partyForm.city} onChange={(e) => setPartyForm({ ...partyForm, city: e.target.value })} />
          <TextField size="small" label="State" value={partyForm.state} onChange={(e) => setPartyForm({ ...partyForm, state: e.target.value })} />
          <TextField size="small" label="GSTIN" value={partyForm.gstin} onChange={(e) => setPartyForm({ ...partyForm, gstin: e.target.value })} />
          <TextField size="small" label="Phone" value={partyForm.phone} onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })} />
          <Button
            variant="contained"
            onClick={async () => {
              await api.post("/mx/parties", partyForm);
              setPartyForm({ name: "", address_line: "", city: "", state: "", gstin: "", phone: "" });
              await load();
            }}
          >
            Onboard party
          </Button>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>GSTIN</TableCell>
              <TableCell>Phone</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parties.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>
                  {[p.address_line, p.city, p.state].filter(Boolean).join(", ")}
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>{p.gstin || "—"}</TableCell>
                <TableCell>{p.phone || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Ship-to / deliver-to addresses (linked to a party when possible)
        </Typography>
        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label="Party"
            value={aForm.party_id}
            onChange={(e) => {
              const id = Number(e.target.value);
              const p = parties.find((x) => x.id === id);
              setAForm({
                ...aForm,
                party_id: id,
                party_name: p?.name ?? aForm.party_name,
              });
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value={0}>—</MenuItem>
            {parties.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Ship label / name" value={aForm.party_name} onChange={(e) => setAForm({ ...aForm, party_name: e.target.value })} />
          <TextField size="small" label="Deliver-to address" value={aForm.address_line} onChange={(e) => setAForm({ ...aForm, address_line: e.target.value })} sx={{ minWidth: 200 }} />
          <TextField size="small" label="City" value={aForm.city} onChange={(e) => setAForm({ ...aForm, city: e.target.value })} />
          <TextField size="small" label="Phone" value={aForm.phone} onChange={(e) => setAForm({ ...aForm, phone: e.target.value })} />
          <Button
            variant="contained"
            onClick={async () => {
              await api.post("/mx/addresses", {
                ...aForm,
                party_id: aForm.party_id || undefined,
              });
              setAForm({ party_id: 0, party_name: "", address_line: "", city: "", state: "", phone: "", label: "Deliver to" });
              await load();
            }}
          >
            Add ship-to
          </Button>
        </Stack>
        {addresses.map((a) => (
          <Chip key={a.id} label={`${a.party_name} · ${a.city ?? ""}`} sx={{ m: 0.5 }} />
        ))}
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <Stack direction="row" spacing={1} mb={2}>
          <TextField size="small" label="Agent name" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} />
          <TextField size="small" label="Phone" value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} />
          <Button
            variant="contained"
            onClick={async () => {
              await api.post("/mx/agents", agentForm);
              setAgentForm({ name: "", phone: "" });
              await load();
            }}
          >
            Add agent
          </Button>
        </Stack>
        {agents.map((a) => (
          <Chip key={a.id} label={`${a.name}${a.phone ? ` · ${a.phone}` : ""}`} sx={{ m: 0.5 }} />
        ))}
      </TabPanel>

      <TabPanel value={tab} index={4}>
        <Stack direction="row" spacing={1} mb={2}>
          <TextField size="small" label="Name" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
          <TextField size="small" label="Contact" value={supForm.contact} onChange={(e) => setSupForm({ ...supForm, contact: e.target.value })} />
          <Button
            variant="contained"
            onClick={async () => {
              await api.post("/mx/suppliers", supForm);
              setSupForm({ name: "", contact: "" });
              await load();
            }}
          >
            Add
          </Button>
        </Stack>
        {suppliers.map((s) => (
          <Chip key={s.id} label={s.name} sx={{ m: 0.5 }} />
        ))}
      </TabPanel>

      <TabPanel value={tab} index={5}>
        <Stack direction="row" spacing={1} mb={2}>
          <TextField size="small" label="Name" value={jwForm.name} onChange={(e) => setJwForm({ ...jwForm, name: e.target.value })} />
          <TextField size="small" label="Type" value={jwForm.job_work_type} onChange={(e) => setJwForm({ ...jwForm, job_work_type: e.target.value })} />
          <Button
            variant="contained"
            onClick={async () => {
              await api.post("/mx/job-workers", jwForm);
              setJwForm({ name: "", contact: "", job_work_type: "" });
              await load();
            }}
          >
            Add
          </Button>
        </Stack>
        {workers.map((w) => (
          <Chip key={w.id} label={w.name} sx={{ m: 0.5 }} />
        ))}
      </TabPanel>

      <TabPanel value={tab} index={6}>
        <Stack direction="row" spacing={1} mb={2}>
          <TextField size="small" label="Code" value={gForm.code} onChange={(e) => setGForm({ ...gForm, code: e.target.value })} />
          <TextField size="small" label="Name" value={gForm.name} onChange={(e) => setGForm({ ...gForm, name: e.target.value })} />
          <TextField size="small" label="Location" value={gForm.location} onChange={(e) => setGForm({ ...gForm, location: e.target.value })} />
          <Button
            variant="contained"
            onClick={async () => {
              await api.post("/mx/godowns", gForm);
              setGForm({ code: "", name: "", location: "" });
              await load();
            }}
          >
            Add
          </Button>
        </Stack>
        {godowns.map((g) => (
          <Chip key={g.id} label={`${g.code} ${g.name}`} sx={{ m: 0.5 }} />
        ))}
      </TabPanel>
    </Box>
  );
}

function JobWorkReceivePanel({ onDone }: { onDone: () => Promise<void> }) {
  const [openJobs, setOpenJobs] = useState<any[]>([]);
  const [meters, setMeters] = useState<Record<string, number>>({});

  async function loadJobs() {
    const r = await api.get("/mx/job-work");
    setOpenJobs((r.data.data ?? []).filter((j: any) => j.processed_state === "outward"));
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  return (
    <Box mb={2}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Worker</TableCell>
            <TableCell>Roll</TableCell>
            <TableCell align="right">Sent m</TableCell>
            <TableCell align="right">Return m</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {openJobs.map((j) => (
            <TableRow key={j.job_work_id}>
              <TableCell>{j.worker_name}</TableCell>
              <TableCell sx={{ fontFamily: "monospace" }}>{j.roll_short}</TableCell>
              <TableCell align="right">{j.meter_sent}</TableCell>
              <TableCell align="right">
                <TextField
                  size="small"
                  type="number"
                  sx={{ width: 100 }}
                  value={meters[j.job_work_id] ?? j.meter_sent}
                  onChange={(e) => setMeters({ ...meters, [j.job_work_id]: Number(e.target.value) })}
                />
              </TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="contained"
                  onClick={async () => {
                    await api.post(`/mx/job-work/${j.job_work_id}/return`, {
                      meter_returned: meters[j.job_work_id] ?? j.meter_sent,
                      inward_date: new Date().toISOString().slice(0, 10),
                      received_by: "warehouse",
                      confirm_receive: true,
                    });
                    await loadJobs();
                    await onDone();
                  }}
                >
                  Receive & confirm
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!openJobs.length && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>
                No open job-work outward
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

export function RollsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [form, setForm] = useState({
    supplier_id: 0,
    variant_code: "",
    lot_no: "",
    original_meterage: 100,
    received_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [jw, setJw] = useState({ roll_id: "", job_worker_id: 0, meter_sent: 0, outward_date: new Date().toISOString().slice(0, 10) });

  async function load() {
    const [r, s, i, w] = await Promise.all([api.get("/mx/rolls"), api.get("/mx/suppliers"), api.get("/mx/items"), api.get("/mx/job-workers")]);
    setRows(r.data.data ?? []);
    setSuppliers(s.data.data ?? []);
    setVariants(i.data.data.variants ?? []);
    setWorkers(w.data.data ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Stock in (lots)
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Type the supplier <strong>lot no</strong>. System creates a unique <strong>job ID</strong> for tracing cuts → parcels → challans.
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} mb={2} flexWrap="wrap">
        <TextField
          size="small"
          label="Lot no"
          required
          value={form.lot_no}
          onChange={(e) => setForm({ ...form, lot_no: e.target.value })}
          sx={{ minWidth: 140 }}
          placeholder="e.g. SF-2401-A"
        />
        <TextField select size="small" label="Supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: Number(e.target.value) })} sx={{ minWidth: 160 }}>
          {suppliers.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Variant" value={form.variant_code} onChange={(e) => setForm({ ...form, variant_code: e.target.value })} sx={{ minWidth: 160 }}>
          {variants.map((v) => (
            <MenuItem key={v.variant_code} value={v.variant_code}>
              {v.variant_code} {v.variant_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" type="number" label="Meters" value={form.original_meterage} onChange={(e) => setForm({ ...form, original_meterage: Number(e.target.value) })} />
        <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
        <Button
          variant="contained"
          onClick={async () => {
            if (!form.lot_no.trim()) return;
            await api.post("/mx/rolls", form);
            setForm({ ...form, lot_no: "" });
            await load();
          }}
        >
          Stock In
        </Button>
      </Stack>

      <Typography fontWeight={700} mb={1}>
        Send to job work
      </Typography>
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <TextField select size="small" label="Lot" value={jw.roll_id} onChange={(e) => setJw({ ...jw, roll_id: e.target.value })} sx={{ minWidth: 180 }}>
          {rows.filter((r) => r.remaining_meterage > 0).map((r) => (
            <MenuItem key={r.roll_id} value={r.roll_id}>
              {r.lot_no || r.short_code} ({r.remaining_meterage}m)
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Worker" value={jw.job_worker_id} onChange={(e) => setJw({ ...jw, job_worker_id: Number(e.target.value) })} sx={{ minWidth: 160 }}>
          {workers.map((w) => (
            <MenuItem key={w.id} value={w.id}>
              {w.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" type="number" label="Meters" value={jw.meter_sent || ""} onChange={(e) => setJw({ ...jw, meter_sent: Number(e.target.value) })} />
        <Button
          variant="outlined"
          onClick={async () => {
            await api.post("/mx/job-work/out", jw);
            await load();
          }}
        >
          Send out
        </Button>
      </Stack>

      <Typography fontWeight={700} mb={1}>
        Confirm material received from job work
      </Typography>
      <JobWorkReceivePanel onDone={load} />

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Lot no</TableCell>
            <TableCell>Job ID</TableCell>
            <TableCell>Supplier</TableCell>
            <TableCell>Variant</TableCell>
            <TableCell>Remaining</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.roll_id}>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.lot_no || r.short_code}</TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{String(r.job_id || r.roll_id).slice(0, 8).toUpperCase()}</TableCell>
              <TableCell>{r.supplier_name}</TableCell>
              <TableCell>{r.variant_code}</TableCell>
              <TableCell>
                {r.remaining_meterage} / {r.original_meterage}
              </TableCell>
              <TableCell>
                <Chip size="small" label={r.status} />
              </TableCell>
              <TableCell>{r.received_date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export function SettingsSyncPage() {
  const [host, setHost] = useState(getPrinterConfig()?.host ?? "");
  const [port, setPort] = useState(getPrinterConfig()?.port ?? 9100);
  const [pending, setPending] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);

  async function refresh() {
    setPending((await listPendingOutbox()).length);
    try {
      const c = await api.get("/mx/sync/conflicts");
      setConflicts(c.data.data ?? []);
    } catch {
      /* auth/offline */
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Device & Sync
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Thermal printer (ZPL LAN) and offline outbox
      </Typography>
      <Stack direction="row" spacing={1} mb={2}>
        <TextField size="small" label="Printer host" value={host} onChange={(e) => setHost(e.target.value)} />
        <TextField size="small" type="number" label="Port" value={port} onChange={(e) => setPort(Number(e.target.value))} sx={{ width: 100 }} />
        <Button
          variant="contained"
          onClick={() => {
            setPrinterConfig(host ? { host, port } : null);
            setMsg("Printer saved");
          }}
        >
          Save printer
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} mb={2} alignItems="center">
        <Chip label={`Pending sync: ${pending}`} />
        <Button
          variant="outlined"
          onClick={async () => {
            const r = await runSyncOnce();
            setMsg(`Pushed ${r.pushed}, pulled=${r.pulled}, conflicts=${r.conflicts}`);
            await refresh();
          }}
        >
          Sync now
        </Button>
        <Button
          variant="outlined"
          color="warning"
          onClick={async () => {
            if (!confirm("Replace all Maxwell stock data with full demo seed?")) return;
            try {
              const r = await api.post("/mx/demo/reseed");
              setMsg(`Demo loaded: ${r.data.data.rolls} rolls, ${r.data.data.packings} packings, ${r.data.data.challans} challans`);
            } catch (e: any) {
              setMsg(e?.response?.data?.error ?? "Reseed failed — restart API first");
            }
          }}
        >
          Load demo data
        </Button>
      </Stack>
      {msg && <Alert severity="info">{msg}</Alert>}
      <Typography fontWeight={700} mt={2} mb={1}>
        Open conflicts
      </Typography>
      {conflicts.map((c) => (
        <Paper key={c.id} sx={{ p: 1.5, mb: 1 }}>
          <Typography variant="body2">
            {c.entity} · {c.client_id.slice(0, 8)}… — {c.reason}
          </Typography>
          <Button
            size="small"
            onClick={async () => {
              await api.post(`/mx/sync/conflicts/${c.id}/resolve`, { status: "resolved" });
              await refresh();
            }}
          >
            Resolve
          </Button>
        </Paper>
      ))}
    </Box>
  );
}

export function UsersAdminPage() {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [form, setForm] = useState({ username: "", password: "", role: "user" });
  async function load() {
    setUsers(await fetchAppUsers());
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Users
      </Typography>
      <Stack direction="row" spacing={1} mb={2}>
        <TextField size="small" label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <TextField size="small" type="password" label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <TextField select size="small" label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} sx={{ minWidth: 120 }}>
          {["admin", "user", "packing", "godown", "floor"].map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          onClick={async () => {
            await createAppUser(form);
            setForm({ username: "", password: "", role: "user" });
            await load();
          }}
        >
          Create
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Role</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.role}</TableCell>
              <TableCell>
                <Button size="small" color="error" onClick={async () => { await deleteAppUser(u.id); await load(); }}>
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
