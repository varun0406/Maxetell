import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography, Autocomplete } from "@mui/material";
import { api } from "../../lib/api";

export function AdminChallanCreatePage() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [form, setForm] = useState({
    challan_date: new Date().toISOString().slice(0, 10),
    party_id: 0,
    address_id: 0,
    agent_id: 0,
    notes: "",
  });
  const [reqs, setReqs] = useState<{ variant_code: string; required_meters: number; required_pieces: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get("/mx/addresses"), api.get("/mx/parties"), api.get("/mx/agents"), api.get("/mx/items")]).then(
      ([a, p, ag, i]) => {
        setAddresses(a.data.data ?? []);
        setParties(p.data.data ?? []);
        setAgents(ag.data.data ?? []);
        setVariants(i.data.data.variants ?? []);
      },
    );
  }, []);

  const shipOptions = form.party_id
    ? addresses.filter((a) => a.party_id === form.party_id || !a.party_id)
    : addresses;

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Create Delivery Challan
      </Typography>
      <Stack spacing={2} maxWidth={560}>
        <TextField
          type="date"
          label="Date"
          InputLabelProps={{ shrink: true }}
          value={form.challan_date}
          onChange={(e) => setForm({ ...form, challan_date: e.target.value })}
        />
        <Autocomplete
          options={parties}
          getOptionLabel={(p) => p.name + (p.gstin ? ` · ${p.gstin}` : "")}
          value={parties.find(p => p.id === form.party_id) || null}
          onChange={(_, newValue) => setForm({ ...form, party_id: newValue?.id || 0, address_id: 0 })}
          renderInput={(params) => <TextField {...params} label="Party (billing)" />}
        />
        
        <Autocomplete
          options={shipOptions}
          getOptionLabel={(a) => `${a.party_name} · ${a.address_line ?? ""} ${a.city ?? ""}`}
          value={shipOptions.find(a => a.id === form.address_id) || null}
          onChange={(_, newValue) => setForm({ ...form, address_id: newValue?.id || 0 })}
          renderInput={(params) => <TextField {...params} label="Deliver to (ship address)" />}
        />

        <Autocomplete
          options={agents}
          getOptionLabel={(a) => a.name}
          value={agents.find(a => a.id === form.agent_id) || null}
          onChange={(_, newValue) => setForm({ ...form, agent_id: newValue?.id || 0 })}
          renderInput={(params) => <TextField {...params} label="Agent" />}
        />
        <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        <Typography fontWeight={700}>Requirements</Typography>
        {reqs.map((r, idx) => (
          <Stack direction="row" spacing={1} key={idx}>
            <Chip
              label={`${r.variant_code} ${r.required_meters}m / ${r.required_pieces}pcs`}
              onDelete={() => setReqs(reqs.filter((_, i) => i !== idx))}
            />
          </Stack>
        ))}
        <Stack direction="row" spacing={1}>
          <Autocomplete
            options={variants}
            getOptionLabel={(v) => v.variant_code}
            onChange={(_, newValue) => {
              if (newValue) {
                setReqs([...reqs, { variant_code: newValue.variant_code, required_meters: 0, required_pieces: 0 }]);
              }
            }}
            renderInput={(params) => <TextField {...params} label="Variant" size="small" />}
            sx={{ minWidth: 160 }}
          />
        </Stack>

        <Button
          variant="contained"
          onClick={async () => {
            const body = {
              challan_date: form.challan_date,
              notes: form.notes,
              party_id: form.party_id || undefined,
              address_id: form.address_id || undefined,
              agent_id: form.agent_id || undefined,
              requirements: reqs,
            };
            const res = await api.post("/mx/challans", body);
            setMsg(`Created ${res.data.data.challan_no}`);
            setReqs([]);
          }}
        >
          Create challan
        </Button>
        {msg && <Alert severity="success">{msg}</Alert>}
      </Stack>
    </Box>
  );
}
