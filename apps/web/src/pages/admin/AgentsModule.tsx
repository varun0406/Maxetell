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
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { api } from "../../lib/api";

export function AgentsModule() {
  const [agents, setAgents] = useState<any[]>([]);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: "", phone: "" });

  async function load() {
    const r = await api.get("/mx/agents");
    setAgents(r.data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Box className="stagger-1">
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: "none", background: "linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, rgba(236, 72, 153, 0.05) 100%)" }}>
        <Typography variant="h4" className="text-gradient gradient-rose" gutterBottom>
          Agents
        </Typography>
        <Typography color="text.secondary">
          Manage sales and delivery agents shown on challan PDFs.
        </Typography>
        <Stack direction="row" spacing={2} mt={3}>
          <Chip icon={<SupportAgentIcon />} label={`${agents.length} Active Agents`} variant="outlined" color="error" />
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Agents Directory</Typography>
        <Button variant="contained" color="error" startIcon={<AddIcon />} onClick={() => setShowNewAgent(!showNewAgent)}>
          {showNewAgent ? "Cancel" : "Add Agent"}
        </Button>
      </Stack>

      {showNewAgent && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(244, 63, 94, 0.2)", background: "rgba(244, 63, 94, 0.02)" }} className="animate-slide-down">
          <Typography fontWeight={700} mb={2}>Register New Agent</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" label="Agent Name" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Phone Number" value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} />
            <Button
              variant="contained" color="error"
              onClick={async () => {
                if (!agentForm.name.trim()) return;
                await api.post("/mx/agents", agentForm);
                setAgentForm({ name: "", phone: "" });
                setShowNewAgent(false);
                await load();
              }}
            >
              Save Agent
            </Button>
          </Stack>
        </Paper>
      )}

      <Grid container spacing={3}>
        {agents.map((a, idx) => (
          <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper elevation={0} sx={{ p: 3, height: "100%", borderRadius: 4 }} className={`stagger-${(idx % 5) + 1}`}>
              <Typography variant="h6" fontWeight={800}>{a.name}</Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                {a.phone || "No phone registered"}
              </Typography>
              {a.notes && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  {a.notes}
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}
        {!agents.length && (
          <Grid  size={{ xs: 12 }}>
            <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
              <Typography color="text.secondary">No agents added yet.</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
