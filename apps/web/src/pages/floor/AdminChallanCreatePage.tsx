import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
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
        <TextField
          select
          label="Party (billing)"
          value={form.party_id}
          onChange={(e) => setForm({ ...form, party_id: Number(e.target.value), address_id: 0 })}
        >
          <MenuItem value={0}>—</MenuItem>
          {parties.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name} {p.gstin ? `· ${p.gstin}` : ""}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Deliver to (ship address)"
          value={form.address_id}
          onChange={(e) => setForm({ ...form, address_id: Number(e.target.value) })}
        >
          <MenuItem value={0}>—</MenuItem>
          {shipOptions.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.party_name} · {a.address_line ?? ""} {a.city ?? ""}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Agent" value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: Number(e.target.value) })}>
          <MenuItem value={0}>—</MenuItem>
          {agents.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>
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
          <TextField
            select
            size="small"
            label="Variant"
            sx={{ minWidth: 160 }}
            defaultValue=""
            onChange={(e) => {
              const code = e.target.value;
              if (!code) return;
              setReqs([...reqs, { variant_code: code, required_meters: 0, required_pieces: 1 }]);
            }}
          >
            {variants.map((v) => (
              <MenuItem key={v.variant_code} value={v.variant_code}>
                {v.variant_code}
              </MenuItem>
            ))}
          </TextField>
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
