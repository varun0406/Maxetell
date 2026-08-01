import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../../lib/api";

function TabPanel({ value, index, children }: { value: number; index: number; children: ReactNode }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 2.5 }}>{children}</Box>;
}

const cardSx = {
  p: 2.5,
  height: "100%",
  borderRadius: 3,
  border: "1px solid",
  borderColor: "divider",
  transition: "transform .12s, border-color .12s, box-shadow .12s",
} as const;

const hoverCardSx = {
  ...cardSx,
  cursor: "pointer",
  "&:hover": {
    transform: "translateY(-2px)",
    borderColor: "primary.main",
    boxShadow: 3,
  },
} as const;

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ sm: "center" }}
      mb={2.5}
      gap={1.5}
    >
      <Box>
        <Typography variant="h6" fontWeight={800}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

function EmptyState({ text, onAdd, label }: { text: string; onAdd: () => void; label: string }) {
  return (
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
        {text}
      </Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
        {label}
      </Button>
    </Paper>
  );
}

function CreatePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "primary.light",
        background: "linear-gradient(145deg, rgba(25,118,210,0.06), transparent 60%)",
      }}
    >
      <Typography fontWeight={800} mb={1.5}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

/* ─── Item Charter ─────────────────────────────────────────── */

function ItemCharter({
  items,
  variants,
  onReload,
}: {
  items: any[];
  variants: any[];
  onReload: () => Promise<void>;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [itemForm, setItemForm] = useState({ code: "", name: "", quality: "" });
  const [varForm, setVarForm] = useState({ variant_code: "", variant_name: "", color: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const openItem = items.find((i) => i.id === openId) ?? null;
  const itemVariants = variants.filter((v) => v.item_id === openId);

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
            background: "linear-gradient(145deg, rgba(25,118,210,0.1), transparent 55%)",
          }}
        >
          <Typography variant="overline" color="primary" fontWeight={800}>
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

        <CreatePanel title="Add variant to this item">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField size="small" label="Code" value={varForm.variant_code} onChange={(e) => setVarForm({ ...varForm, variant_code: e.target.value })} />
            <TextField size="small" label="Name" value={varForm.variant_name} onChange={(e) => setVarForm({ ...varForm, variant_name: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Color" value={varForm.color} onChange={(e) => setVarForm({ ...varForm, color: e.target.value })} />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={async () => {
                if (!varForm.variant_code.trim() || !varForm.variant_name.trim()) return;
                await api.post("/mx/variants", { ...varForm, item_id: openItem.id });
                setVarForm({ variant_code: "", variant_name: "", color: "" });
                setMsg("Variant added");
                await onReload();
              }}
            >
              Add
            </Button>
          </Stack>
        </CreatePanel>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: 0.1, textTransform: "uppercase" }}>
          Variants
        </Typography>
        <Grid container spacing={2}>
          {itemVariants.map((v) => (
            <Grid key={v.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={0} sx={cardSx}>
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
                sx={{ p: 4, textAlign: "center", borderRadius: 3, border: "1px dashed", borderColor: "divider", color: "text.secondary" }}
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
      <SectionHeader
        title="Items"
        subtitle="Open an item to manage its variants as modules."
        action={
          <Button variant={showNew ? "outlined" : "contained"} startIcon={<AddIcon />} onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancel" : "New item"}
          </Button>
        }
      />
      {msg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg}
        </Alert>
      )}
      {showNew && (
        <CreatePanel title="Create item">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField size="small" label="Code" value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} />
            <TextField size="small" label="Name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Quality" value={itemForm.quality} onChange={(e) => setItemForm({ ...itemForm, quality: e.target.value })} />
            <Button
              variant="contained"
              onClick={async () => {
                if (!itemForm.code.trim() || !itemForm.name.trim()) return;
                await api.post("/mx/items", itemForm);
                setItemForm({ code: "", name: "", quality: "" });
                setShowNew(false);
                setMsg("Item created");
                await onReload();
              }}
            >
              Save item
            </Button>
          </Stack>
        </CreatePanel>
      )}
      <Grid container spacing={2}>
        {items.map((it) => {
          const list = variants.filter((v) => v.item_id === it.id);
          return (
            <Grid key={it.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Paper elevation={0} onClick={() => setOpenId(it.id)} sx={hoverCardSx}>
                <Stack direction="row" justifyContent="space-between">
                  <Box>
                    <Typography variant="overline" color="primary" fontWeight={800}>
                      {it.code}
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>
                      {it.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {it.quality || "No quality set"}
                    </Typography>
                  </Box>
                  <Chip size="small" color="primary" variant="outlined" label={`${list.length} var`} />
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {list.slice(0, 4).map((v) => (
                    <Chip key={v.id} size="small" label={v.variant_code} sx={{ fontFamily: "monospace" }} />
                  ))}
                  {list.length > 4 && <Chip size="small" variant="outlined" label={`+${list.length - 4}`} />}
                  {!list.length && (
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
            <EmptyState text="No items yet. Create your first cloth item." onAdd={() => setShowNew(true)} label="New item" />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

/* ─── Parties ──────────────────────────────────────────────── */

function PartiesSection({ parties, addresses, onReload }: { parties: any[]; addresses: any[]; onReload: () => Promise<void> }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", address_line: "", city: "", state: "", gstin: "", phone: "" });
  const [shipForm, setShipForm] = useState({ address_line: "", city: "", state: "", phone: "", label: "Deliver to" });

  const open = parties.find((p) => p.id === openId) ?? null;
  const ships = addresses.filter((a) => a.party_id === openId);

  if (open) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => setOpenId(null)} sx={{ mb: 2 }}>
          All parties
        </Button>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            background: "linear-gradient(145deg, rgba(46,125,50,0.08), transparent 55%)",
          }}
        >
          <Typography variant="overline" color="success.main" fontWeight={800}>
            Party
          </Typography>
          <Typography variant="h4" fontWeight={900}>
            {open.name}
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            {[open.address_line, open.city, open.state].filter(Boolean).join(", ") || "No billing address"}
          </Typography>
          <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
            <Chip label={open.gstin ? `GSTIN ${open.gstin}` : "No GSTIN"} sx={{ fontFamily: "monospace" }} />
            <Chip label={open.phone || "No phone"} variant="outlined" />
            <Chip label={`${ships.length} ship-to`} color="primary" variant="outlined" />
          </Stack>
        </Paper>

        <CreatePanel title="Add ship-to for this party">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField size="small" label="Address" value={shipForm.address_line} onChange={(e) => setShipForm({ ...shipForm, address_line: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="City" value={shipForm.city} onChange={(e) => setShipForm({ ...shipForm, city: e.target.value })} />
            <TextField size="small" label="Phone" value={shipForm.phone} onChange={(e) => setShipForm({ ...shipForm, phone: e.target.value })} />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={async () => {
                await api.post("/mx/addresses", {
                  party_id: open.id,
                  party_name: open.name,
                  ...shipForm,
                });
                setShipForm({ address_line: "", city: "", state: "", phone: "", label: "Deliver to" });
                await onReload();
              }}
            >
              Add
            </Button>
          </Stack>
        </CreatePanel>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: 0.1, textTransform: "uppercase" }}>
          Deliver-to addresses
        </Typography>
        <Grid container spacing={2}>
          {ships.map((a) => (
            <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={0} sx={cardSx}>
                <Typography fontWeight={800}>{a.label || "Deliver to"}</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  {a.address_line || "—"}
                </Typography>
                <Typography variant="body2">
                  {[a.city, a.state].filter(Boolean).join(", ")}
                </Typography>
                {a.phone && <Chip size="small" sx={{ mt: 1.5 }} label={a.phone} />}
              </Paper>
            </Grid>
          ))}
          {!ships.length && (
            <Grid size={12}>
              <Typography color="text.secondary">No ship-to yet — add one above for challan delivery.</Typography>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <SectionHeader
        title="Parties"
        subtitle="Billing identity — name, address, GSTIN, phone. Open to manage ship-to."
        action={
          <Button variant={showNew ? "outlined" : "contained"} startIcon={<AddIcon />} onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancel" : "Onboard party"}
          </Button>
        }
      />
      {showNew && (
        <CreatePanel title="Onboard party">
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField size="small" label="Party name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
              <TextField size="small" label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField size="small" label="Address" value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <TextField size="small" label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              <Button
                variant="contained"
                onClick={async () => {
                  if (!form.name.trim()) return;
                  await api.post("/mx/parties", form);
                  setForm({ name: "", address_line: "", city: "", state: "", gstin: "", phone: "" });
                  setShowNew(false);
                  await onReload();
                }}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </CreatePanel>
      )}
      <Grid container spacing={2}>
        {parties.map((p) => {
          const n = addresses.filter((a) => a.party_id === p.id).length;
          return (
            <Grid key={p.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Paper elevation={0} onClick={() => setOpenId(p.id)} sx={hoverCardSx}>
                <Typography variant="h6" fontWeight={800}>
                  {p.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  {[p.city, p.state].filter(Boolean).join(", ") || p.address_line || "—"}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={p.gstin || "No GST"} sx={{ fontFamily: "monospace", fontSize: 11 }} />
                  <Chip size="small" variant="outlined" label={p.phone || "No phone"} />
                  <Chip size="small" color="primary" variant="outlined" label={`${n} ship-to`} />
                </Stack>
              </Paper>
            </Grid>
          );
        })}
        {!parties.length && (
          <Grid size={12}>
            <EmptyState text="No parties yet." onAdd={() => setShowNew(true)} label="Onboard party" />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

/* ─── Generic card master (agents, suppliers, workers, godowns, orphan ship-to) ─── */

function CardMaster({
  title,
  subtitle,
  createLabel,
  rows,
  renderCard,
  form,
}: {
  title: string;
  subtitle: string;
  createLabel: string;
  rows: any[];
  renderCard: (row: any) => ReactNode;
  form: (opts: { onDone: () => void }) => ReactNode;
}) {
  const [showNew, setShowNew] = useState(false);
  return (
    <Box>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button variant={showNew ? "outlined" : "contained"} startIcon={<AddIcon />} onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancel" : createLabel}
          </Button>
        }
      />
      {showNew && <CreatePanel title={createLabel}>{form({ onDone: () => setShowNew(false) })}</CreatePanel>}
      <Grid container spacing={2}>
        {rows.map((r) => (
          <Grid key={r.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Paper elevation={0} sx={cardSx}>
              {renderCard(r)}
            </Paper>
          </Grid>
        ))}
        {!rows.length && (
          <Grid size={12}>
            <EmptyState text={`No ${title.toLowerCase()} yet.`} onAdd={() => setShowNew(true)} label={createLabel} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

function ShipToOrphans({
  addresses,
  parties,
  onReload,
}: {
  addresses: any[];
  parties: any[];
  onReload: () => Promise<void>;
}) {
  const orphans = addresses.filter((a) => !a.party_id);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    party_id: 0,
    party_name: "",
    address_line: "",
    city: "",
    state: "",
    phone: "",
    label: "Deliver to",
  });

  return (
    <Box>
      <SectionHeader
        title="Ship-to"
        subtitle="Deliver-to addresses. Prefer linking from a Party card. Orphans listed here."
        action={
          <Button variant={showNew ? "outlined" : "contained"} startIcon={<AddIcon />} onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancel" : "Add ship-to"}
          </Button>
        }
      />
      {showNew && (
        <CreatePanel title="Add ship-to">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="Party"
              value={form.party_id}
              onChange={(e) => {
                const id = Number(e.target.value);
                const p = parties.find((x) => x.id === id);
                setForm({ ...form, party_id: id, party_name: p?.name ?? form.party_name });
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
            <TextField size="small" label="Label / name" value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
            <TextField size="small" label="Address" value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} sx={{ minWidth: 180 }} />
            <TextField size="small" label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextField size="small" label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Button
              variant="contained"
              onClick={async () => {
                await api.post("/mx/addresses", { ...form, party_id: form.party_id || undefined });
                setForm({ party_id: 0, party_name: "", address_line: "", city: "", state: "", phone: "", label: "Deliver to" });
                setShowNew(false);
                await onReload();
              }}
            >
              Save
            </Button>
          </Stack>
        </CreatePanel>
      )}
      <Grid container spacing={2}>
        {addresses.map((a) => (
          <Grid key={a.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Paper elevation={0} sx={cardSx}>
              <Typography fontWeight={800}>{a.party_name}</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {a.address_line || "—"}
              </Typography>
              <Typography variant="body2">{[a.city, a.state].filter(Boolean).join(", ")}</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {a.party_master_name || a.party_id ? (
                  <Chip size="small" color="success" variant="outlined" label={a.party_master_name || "Linked"} />
                ) : (
                  <Chip size="small" color="warning" variant="outlined" label="Unlinked" />
                )}
                {a.phone && <Chip size="small" label={a.phone} />}
              </Stack>
            </Paper>
          </Grid>
        ))}
        {!addresses.length && (
          <Grid size={12}>
            <EmptyState text="No ship-to addresses." onAdd={() => setShowNew(true)} label="Add ship-to" />
          </Grid>
        )}
      </Grid>
      {orphans.length > 0 && (
        <Typography variant="caption" color="text.secondary" display="block" mt={2}>
          Tip: open Parties → party card to attach ship-to under billing party.
        </Typography>
      )}
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

  const [agentForm, setAgentForm] = useState({ name: "", phone: "" });
  const [supForm, setSupForm] = useState({ name: "", contact: "" });
  const [jwForm, setJwForm] = useState({ name: "", contact: "", job_work_type: "" });
  const [gForm, setGForm] = useState({ code: "", name: "", location: "" });

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
        Modular setup for items, parties, agents, and warehouse.
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": { fontWeight: 700, textTransform: "none", minHeight: 48 },
        }}
      >
        <Tab label="Items" />
        <Tab label="Parties" />
        <Tab label="Ship-to" />
        <Tab label="Agents" />
        <Tab label="Suppliers" />
        <Tab label="Job workers" />
        <Tab label="Godowns" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <ItemCharter items={items} variants={variants} onReload={load} />
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <PartiesSection parties={parties} addresses={addresses} onReload={load} />
      </TabPanel>
      <TabPanel value={tab} index={2}>
        <ShipToOrphans addresses={addresses} parties={parties} onReload={load} />
      </TabPanel>
      <TabPanel value={tab} index={3}>
        <CardMaster
          title="Agents"
          subtitle="Sales / delivery agents shown on challan PDFs."
          createLabel="Add agent"
          rows={agents}
          renderCard={(a) => (
            <>
              <Typography variant="h6" fontWeight={800}>
                {a.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {a.phone || "No phone"}
              </Typography>
              {a.notes && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  {a.notes}
                </Typography>
              )}
            </>
          )}
          form={({ onDone }) => (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField size="small" label="Name" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="Phone" value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} />
              <Button
                variant="contained"
                onClick={async () => {
                  if (!agentForm.name.trim()) return;
                  await api.post("/mx/agents", agentForm);
                  setAgentForm({ name: "", phone: "" });
                  onDone();
                  await load();
                }}
              >
                Save
              </Button>
            </Stack>
          )}
        />
      </TabPanel>
      <TabPanel value={tab} index={4}>
        <CardMaster
          title="Suppliers"
          subtitle="Mills / companies for stock-in lots."
          createLabel="Add supplier"
          rows={suppliers}
          renderCard={(s) => (
            <>
              <Typography variant="h6" fontWeight={800}>
                {s.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {s.contact || "No contact"}
              </Typography>
            </>
          )}
          form={({ onDone }) => (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField size="small" label="Name" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="Contact" value={supForm.contact} onChange={(e) => setSupForm({ ...supForm, contact: e.target.value })} />
              <Button
                variant="contained"
                onClick={async () => {
                  if (!supForm.name.trim()) return;
                  await api.post("/mx/suppliers", supForm);
                  setSupForm({ name: "", contact: "" });
                  onDone();
                  await load();
                }}
              >
                Save
              </Button>
            </Stack>
          )}
        />
      </TabPanel>
      <TabPanel value={tab} index={5}>
        <CardMaster
          title="Job workers"
          subtitle="Process houses — dyeing, finishing, printing."
          createLabel="Add job worker"
          rows={workers}
          renderCard={(w) => (
            <>
              <Typography variant="h6" fontWeight={800}>
                {w.name}
              </Typography>
              <Stack direction="row" spacing={1} mt={1.5}>
                <Chip size="small" color="primary" variant="outlined" label={w.job_work_type || "General"} />
                {w.contact && <Chip size="small" label={w.contact} />}
              </Stack>
            </>
          )}
          form={({ onDone }) => (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField size="small" label="Name" value={jwForm.name} onChange={(e) => setJwForm({ ...jwForm, name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="Type" value={jwForm.job_work_type} onChange={(e) => setJwForm({ ...jwForm, job_work_type: e.target.value })} placeholder="Dyeing" />
              <Button
                variant="contained"
                onClick={async () => {
                  if (!jwForm.name.trim()) return;
                  await api.post("/mx/job-workers", jwForm);
                  setJwForm({ name: "", contact: "", job_work_type: "" });
                  onDone();
                  await load();
                }}
              >
                Save
              </Button>
            </Stack>
          )}
        />
      </TabPanel>
      <TabPanel value={tab} index={6}>
        <CardMaster
          title="Godowns"
          subtitle="Warehouse locations for packing receive."
          createLabel="Add godown"
          rows={godowns}
          renderCard={(g) => (
            <>
              <Typography variant="overline" color="primary" fontWeight={800}>
                {g.code}
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {g.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {g.location || "No location hint"}
              </Typography>
            </>
          )}
          form={({ onDone }) => (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField size="small" label="Code" value={gForm.code} onChange={(e) => setGForm({ ...gForm, code: e.target.value })} />
              <TextField size="small" label="Name" value={gForm.name} onChange={(e) => setGForm({ ...gForm, name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="Location" value={gForm.location} onChange={(e) => setGForm({ ...gForm, location: e.target.value })} />
              <Button
                variant="contained"
                onClick={async () => {
                  if (!gForm.code.trim() || !gForm.name.trim()) return;
                  await api.post("/mx/godowns", gForm);
                  setGForm({ code: "", name: "", location: "" });
                  onDone();
                  await load();
                }}
              >
                Save
              </Button>
            </Stack>
          )}
        />
      </TabPanel>
    </Box>
  );
}
