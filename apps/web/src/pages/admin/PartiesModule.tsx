import { useEffect, useState } from "react";
import {
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
import StorefrontIcon from "@mui/icons-material/Storefront";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../../lib/api";

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }} className="animate-slide-down">{children}</Box>;
}

export function PartiesModule() {
  const [tab, setTab] = useState(0);
  const [parties, setParties] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  
  const [showNewParty, setShowNewParty] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const [form, setForm] = useState({ name: "", address_line: "", city: "", state: "", gstin: "", phone: "" });
  const [shipForm, setShipForm] = useState({
    party_id: 0,
    party_name: "",
    address_line: "",
    city: "",
    state: "",
    phone: "",
    label: "Deliver to",
  });

  async function load() {
    const [p, a] = await Promise.all([
      api.get("/mx/parties"),
      api.get("/mx/addresses"),
    ]);
    setParties(p.data.data ?? []);
    setAddresses(a.data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const openParty = parties.find((p) => p.id === openId) ?? null;
  const partyAddresses = addresses.filter((a) => a.party_id === openId);

  return (
    <Box className="stagger-1">
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: "none", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%)" }}>
        <Typography variant="h4" className="text-gradient gradient-emerald" gutterBottom>
          Parties & Ship-to
        </Typography>
        <Typography color="text.secondary">
          Manage buyers, billing identities, and their delivery addresses.
        </Typography>
        <Stack direction="row" spacing={2} mt={3}>
          <Chip icon={<StorefrontIcon />} label={`${parties.length} Parties`} variant="outlined" color="success" />
          <Chip icon={<LocalShippingIcon />} label={`${addresses.length} Delivery Addresses`} variant="outlined" color="info" />
        </Stack>
      </Paper>

      {openParty ? (
        <Box className="animate-scale-in">
          <Button startIcon={<ArrowBackIcon />} onClick={() => setOpenId(null)} sx={{ mb: 2 }} color="success">
            Back to Parties
          </Button>
          
          <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: "1px solid rgba(16, 185, 129, 0.2)", background: "rgba(16, 185, 129, 0.02)" }}>
            <Typography variant="overline" color="success.main" fontWeight={800}>Party Details</Typography>
            <Typography variant="h4" fontWeight={900}>{openParty.name}</Typography>
            <Typography color="text.secondary" mt={1}>
              {[openParty.address_line, openParty.city, openParty.state].filter(Boolean).join(", ") || "No billing address"}
            </Typography>
            <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
              <Chip label={openParty.gstin ? `GSTIN ${openParty.gstin}` : "No GSTIN"} sx={{ fontFamily: "monospace" }} />
              <Chip label={openParty.phone || "No phone"} variant="outlined" />
              <Chip label={`${partyAddresses.length} ship-to`} color="success" variant="outlined" />
            </Stack>
          </Paper>

          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">Deliver-to Addresses for {openParty.name}</Typography>
            <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={() => setShowNewAddress(!showNewAddress)}>
              {showNewAddress ? "Cancel" : "Add Ship-to"}
            </Button>
          </Stack>

          {showNewAddress && (
            <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(16, 185, 129, 0.2)" }} className="animate-slide-down">
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" label="Label (e.g. Factory)" value={shipForm.label} onChange={(e) => setShipForm({ ...shipForm, label: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" label="Address" value={shipForm.address_line} onChange={(e) => setShipForm({ ...shipForm, address_line: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField fullWidth size="small" label="City" value={shipForm.city} onChange={(e) => setShipForm({ ...shipForm, city: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField fullWidth size="small" label="Phone" value={shipForm.phone} onChange={(e) => setShipForm({ ...shipForm, phone: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    variant="contained" color="success" fullWidth sx={{ height: 40 }}
                    onClick={async () => {
                      await api.post("/mx/addresses", {
                        party_id: openParty.id,
                        party_name: openParty.name,
                        ...shipForm,
                      });
                      setShipForm({ party_id: 0, party_name: "", address_line: "", city: "", state: "", phone: "", label: "Deliver to" });
                      setShowNewAddress(false);
                      await load();
                    }}
                  >
                    Save
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}

          <Grid container spacing={3}>
            {partyAddresses.map((a, idx) => (
              <Grid item xs={12} sm={6} md={4} key={a.id}>
                <Paper elevation={0} sx={{ p: 3, height: "100%", borderRadius: 4 }} className={`stagger-${(idx % 5) + 1}`}>
                  <Typography fontWeight={800}>{a.label || "Deliver to"}</Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.5}>{a.address_line || "—"}</Typography>
                  <Typography variant="body2">{[a.city, a.state].filter(Boolean).join(", ")}</Typography>
                  {a.phone && <Chip size="small" sx={{ mt: 1.5 }} label={a.phone} />}
                </Paper>
              </Grid>
            ))}
            {!partyAddresses.length && (
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
                  <Typography color="text.secondary">No ship-to addresses yet. Add one above.</Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              mb: 2,
              "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0", background: "linear-gradient(90deg, #10b981, #0ea5e9)" },
              "& .MuiTab-root": { fontWeight: 700, textTransform: "none", fontSize: "1rem" },
              "& .Mui-selected": { color: "#10b981 !important" },
            }}
          >
            <Tab label="Parties Directory" />
            <Tab label="All Ship-to Addresses" />
          </Tabs>

          <TabPanel value={tab} index={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">Billing Parties</Typography>
              <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={() => setShowNewParty(!showNewParty)}>
                {showNewParty ? "Cancel" : "Onboard Party"}
              </Button>
            </Stack>

            {showNewParty && (
              <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(16, 185, 129, 0.2)", background: "rgba(16, 185, 129, 0.02)" }} className="animate-slide-down">
                <Typography fontWeight={700} mb={2}>Onboard New Party</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}><TextField fullWidth size="small" label="Party name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6} md={4}><TextField fullWidth size="small" label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6} md={4}><TextField fullWidth size="small" label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6} md={4}><TextField fullWidth size="small" label="Address" value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6} md={3}><TextField fullWidth size="small" label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6} md={3}><TextField fullWidth size="small" label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Grid>
                  <Grid item xs={12} md={2}>
                    <Button
                      variant="contained" color="success" fullWidth sx={{ height: 40 }}
                      onClick={async () => {
                        if (!form.name.trim()) return;
                        await api.post("/mx/parties", form);
                        setForm({ name: "", address_line: "", city: "", state: "", gstin: "", phone: "" });
                        setShowNewParty(false);
                        await load();
                      }}
                    >
                      Save
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            )}

            <Grid container spacing={3}>
              {parties.map((p, idx) => {
                const n = addresses.filter((a) => a.party_id === p.id).length;
                return (
                  <Grid item xs={12} sm={6} md={4} key={p.id}>
                    <Paper 
                      elevation={0} 
                      onClick={() => setOpenId(p.id)} 
                      sx={{ p: 3, height: "100%", borderRadius: 4, cursor: "pointer", transition: "all 0.2s", "&:hover": { borderColor: "success.main", transform: "translateY(-4px)" } }} 
                      className={`stagger-${(idx % 5) + 1}`}
                    >
                      <Typography variant="h6" fontWeight={800}>{p.name}</Typography>
                      <Typography variant="body2" color="text.secondary" mt={0.5}>
                        {[p.city, p.state].filter(Boolean).join(", ") || p.address_line || "—"}
                      </Typography>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={p.gstin || "No GST"} sx={{ fontFamily: "monospace", fontSize: 11 }} />
                        <Chip size="small" variant="outlined" label={p.phone || "No phone"} />
                        <Chip size="small" color="success" variant="outlined" label={`${n} ship-to`} />
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
              {!parties.length && (
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
                    <Typography color="text.secondary">No parties yet.</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">All Ship-to Addresses</Typography>
              <Button variant="contained" color="info" startIcon={<AddIcon />} onClick={() => setShowNewAddress(!showNewAddress)}>
                {showNewAddress ? "Cancel" : "Add Orphan Ship-to"}
              </Button>
            </Stack>

            {showNewAddress && (
              <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(14, 165, 233, 0.2)" }} className="animate-slide-down">
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      select fullWidth size="small" label="Link to Party"
                      value={shipForm.party_id}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const p = parties.find((x) => x.id === id);
                        setShipForm({ ...shipForm, party_id: id, party_name: p?.name ?? shipForm.party_name });
                      }}
                    >
                      <MenuItem value={0}>— Orphan —</MenuItem>
                      {parties.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField fullWidth size="small" label="Label / name" value={shipForm.party_name} onChange={(e) => setShipForm({ ...shipForm, party_name: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField fullWidth size="small" label="Address" value={shipForm.address_line} onChange={(e) => setShipForm({ ...shipForm, address_line: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField fullWidth size="small" label="City" value={shipForm.city} onChange={(e) => setShipForm({ ...shipForm, city: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField fullWidth size="small" label="Phone" value={shipForm.phone} onChange={(e) => setShipForm({ ...shipForm, phone: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained" color="info"
                      onClick={async () => {
                        await api.post("/mx/addresses", { ...shipForm, party_id: shipForm.party_id || undefined });
                        setShipForm({ party_id: 0, party_name: "", address_line: "", city: "", state: "", phone: "", label: "Deliver to" });
                        setShowNewAddress(false);
                        await load();
                      }}
                    >
                      Save Address
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            )}

            <Grid container spacing={3}>
              {addresses.map((a, idx) => (
                <Grid item xs={12} sm={6} md={4} key={a.id}>
                  <Paper elevation={0} sx={{ p: 3, height: "100%", borderRadius: 4 }} className={`stagger-${(idx % 5) + 1}`}>
                    <Typography fontWeight={800}>{a.party_name}</Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>{a.address_line || "—"}</Typography>
                    <Typography variant="body2">{[a.city, a.state].filter(Boolean).join(", ")}</Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {a.party_master_name || a.party_id ? (
                        <Chip size="small" color="success" variant="outlined" label={a.party_master_name || "Linked"} />
                      ) : (
                        <Chip size="small" color="warning" variant="outlined" label="Unlinked (Orphan)" />
                      )}
                      {a.phone && <Chip size="small" label={a.phone} />}
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </TabPanel>
        </>
      )}
    </Box>
  );
}
