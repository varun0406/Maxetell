import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import { api } from "../../lib/api";

export function GodownsModule() {
  const [godowns, setGodowns] = useState<any[]>([]);
  const [showNewGodown, setShowNewGodown] = useState(false);
  const [gForm, setGForm] = useState({ code: "", name: "", location: "" });

  async function load() {
    const r = await api.get("/mx/godowns");
    setGodowns(r.data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Box className="stagger-1">
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: "none", background: "linear-gradient(135deg, rgba(100, 116, 139, 0.1) 0%, rgba(71, 85, 105, 0.05) 100%)" }}>
        <Typography variant="h4" className="text-gradient gradient-slate" gutterBottom>
          Godowns & Warehouse
        </Typography>
        <Typography color="text.secondary">
          Manage warehouse locations for packing and receiving stock.
        </Typography>
        <Stack direction="row" spacing={2} mt={3}>
          <Chip icon={<WarehouseIcon />} label={`${godowns.length} Registered Locations`} variant="outlined" color="primary" sx={{ borderColor: "#64748b", color: "#475569" }} />
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Warehouse Directory</Typography>
        <Button variant="contained" sx={{ bgcolor: "#64748b", "&:hover": { bgcolor: "#475569" } }} startIcon={<AddIcon />} onClick={() => setShowNewGodown(!showNewGodown)}>
          {showNewGodown ? "Cancel" : "Add Godown"}
        </Button>
      </Stack>

      {showNewGodown && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(100, 116, 139, 0.2)", background: "rgba(100, 116, 139, 0.02)" }} className="animate-slide-down">
          <Typography fontWeight={700} mb={2}>Register New Godown</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" label="Code (e.g. WH1)" value={gForm.code} onChange={(e) => setGForm({ ...gForm, code: e.target.value })} />
            <TextField size="small" label="Name" value={gForm.name} onChange={(e) => setGForm({ ...gForm, name: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Location Hint" value={gForm.location} onChange={(e) => setGForm({ ...gForm, location: e.target.value })} />
            <Button
              variant="contained" sx={{ bgcolor: "#64748b", "&:hover": { bgcolor: "#475569" } }}
              onClick={async () => {
                if (!gForm.code.trim() || !gForm.name.trim()) return;
                await api.post("/mx/godowns", gForm);
                setGForm({ code: "", name: "", location: "" });
                setShowNewGodown(false);
                await load();
              }}
            >
              Save Godown
            </Button>
          </Stack>
        </Paper>
      )}

      <Grid container spacing={3}>
        {godowns.map((g, idx) => (
          <Grid key={g.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper elevation={0} sx={{ p: 3, height: "100%", borderRadius: 4 }} className={`stagger-${(idx % 5) + 1}`}>
              <Typography variant="overline" color="primary" fontWeight={800} sx={{ color: "#64748b" }}>
                {g.code}
              </Typography>
              <Typography variant="h6" fontWeight={800}>{g.name}</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {g.location || "No location specified"}
              </Typography>
            </Paper>
          </Grid>
        ))}
        {!godowns.length && (
          <Grid  size={{ xs: 12 }}>
            <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
              <Typography color="text.secondary">No godowns added yet.</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
