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
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }} className="animate-slide-down">{children}</Box>;
}

export function JobWorkModule() {
  const [tab, setTab] = useState(0);
  const [workers, setWorkers] = useState<any[]>([]);
  const [openJobs, setOpenJobs] = useState<any[]>([]);
  const [rolls, setRolls] = useState<any[]>([]);
  const [showNewWorker, setShowNewWorker] = useState(false);

  const [jwForm, setJwForm] = useState({ name: "", contact: "", job_work_type: "" });
  const [outForm, setOutForm] = useState({
    roll_id: "",
    job_worker_id: 0,
    meter_sent: 0,
    outward_date: new Date().toISOString().slice(0, 10)
  });
  const [meters, setMeters] = useState<Record<string, number>>({});
  const [searchJobs, setSearchJobs] = useState("");
  const [searchWorkers, setSearchWorkers] = useState("");
  const [qualityResults, setQualityResults] = useState<Record<string, string>>({});
  const [isFinals, setIsFinals] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  async function load() {
    const [w, j, r] = await Promise.all([
      api.get("/mx/job-workers"),
      api.get("/mx/job-work"),
      api.get("/mx/rolls"),
    ]);
    setWorkers(w.data.data ?? []);
    setOpenJobs((j.data.data ?? []).filter((job: any) => job.processed_state === "outward"));
    setRolls(r.data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Box className="stagger-1">
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: "none", background: "linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(236, 72, 153, 0.05) 100%)" }}>
        <Typography variant="h4" className="text-gradient gradient-purple" gutterBottom>
          Job Work
        </Typography>
        <Typography color="text.secondary">
          Manage process houses, send material out, and confirm returns.
        </Typography>
        <Stack direction="row" spacing={2} mt={3}>
          <Chip icon={<PrecisionManufacturingIcon />} label={`${workers.length} Processors`} variant="outlined" color="secondary" />
          <Chip icon={<ContentCutIcon />} label={`${openJobs.length} Active Outward`} variant="outlined" color="warning" />
        </Stack>
      </Paper>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0", background: "linear-gradient(90deg, #a855f7, #ec4899)" },
          "& .MuiTab-root": { fontWeight: 700, textTransform: "none", fontSize: "1rem" },
          "& .Mui-selected": { color: "#a855f7 !important" },
        }}
      >
        <Tab label="Send Out" />
        <Tab label="Receive Returns" />
        <Tab label="Job Workers Directory" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4 }}>
          <Typography variant="h6" mb={1}>Send to Job Work</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Dispatch rolls to process houses (dyeing, finishing, printing).
          </Typography>
          
          <Grid container spacing={3}>
            <Grid  size={{ xs: 12, md: 4 }}>
              <Autocomplete
                options={rolls.filter((r) => r.remaining_meterage > 0)}
                getOptionLabel={(r) => `${r.lot_no || r.short_code} (${r.remaining_meterage}m available)`}
                value={rolls.find((r) => r.roll_id === outForm.roll_id) || null}
                onChange={(_, newValue) => setOutForm({ ...outForm, roll_id: newValue?.roll_id || "" })}
                renderInput={(params) => <TextField {...params} label="Select Lot / Roll" />}
                fullWidth
              />
            </Grid>
            <Grid  size={{ xs: 12, md: 4 }}>
              <Autocomplete
                options={workers}
                getOptionLabel={(w) => w.name}
                value={workers.find((w) => w.id === outForm.job_worker_id) || null}
                onChange={(_, newValue) => setOutForm({ ...outForm, job_worker_id: newValue?.id || 0 })}
                renderInput={(params) => <TextField {...params} label="Job Worker" />}
                fullWidth
              />
            </Grid>
            <Grid  size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField 
                fullWidth type="number" label="Meters Sent" 
                value={outForm.meter_sent || ""} 
                onChange={(e) => setOutForm({ ...outForm, meter_sent: Number(e.target.value) })} 
              />
            </Grid>
            <Grid  size={{ xs: 12, sm: 6, md: 2 }}>
              <Button
                variant="contained" fullWidth sx={{ height: 56, background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
                onClick={async () => {
                  if (!outForm.roll_id || !outForm.job_worker_id || !outForm.meter_sent) return;
                  await api.post("/mx/job-work/out", outForm);
                  setOutForm({ ...outForm, meter_sent: 0, roll_id: "" });
                  await load();
                  setTab(1); // Jump to receive
                }}
              >
                Dispatch
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Receive Returns</Typography>
          <TextField size="small" placeholder="Search by roll or processor..." value={searchJobs} onChange={(e) => setSearchJobs(e.target.value)} sx={{ width: 250 }} />
        </Stack>
        <Grid container spacing={2}>
          {openJobs
            .filter((j) => j.roll_short?.toLowerCase().includes(searchJobs.toLowerCase()) || j.worker_name?.toLowerCase().includes(searchJobs.toLowerCase()))
            .map((j, idx) => (
            <Grid key={j.job_work_id} size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 3, display: "flex", alignItems: "center", gap: 3, borderRadius: 3 }} className={`stagger-${(idx % 5) + 1}`}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2, background: "rgba(168, 85, 247, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ContentCutIcon sx={{ color: "#a855f7" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={800} sx={{ fontFamily: "monospace", fontSize: "1.1rem" }}>{j.roll_short}</Typography>
                  <Typography variant="body2" color="text.secondary">Outward Date: {new Date(j.created_at).toLocaleDateString()}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Processor</Typography>
                  <Typography fontWeight={600}>{j.worker_name}</Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="body2" color="text.secondary">Meters Sent</Typography>
                  <Typography fontWeight={700} color="warning.main">{j.meter_sent}m</Typography>
                </Box>
                
                <Box sx={{ width: "1px", height: 40, bgcolor: "divider", mx: 1 }} />
                
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    size="small"
                    type="number"
                    label="Return m"
                    sx={{ width: 100 }}
                    value={meters[j.job_work_id] ?? j.meter_sent}
                    onChange={(e) => setMeters({ ...meters, [j.job_work_id]: Number(e.target.value) })}
                  />
                  <TextField
                    select
                    size="small"
                    label="Quality"
                    sx={{ width: 120 }}
                    value={qualityResults[j.job_work_id] || "accepted"}
                    onChange={(e) => setQualityResults({ ...qualityResults, [j.job_work_id]: e.target.value })}
                  >
                    <MenuItem value="accepted">Accepted</MenuItem>
                    <MenuItem value="defect">Defect</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </TextField>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isFinals[j.job_work_id] ?? true}
                      onChange={(e) => setIsFinals({ ...isFinals, [j.job_work_id]: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Final Return?
                  </label>
                  <Button
                    variant="contained" color="secondary"
                    onClick={async () => {
                      await api.post(`/mx/job-work/${j.job_work_id}/return`, {
                        meter_returned: meters[j.job_work_id] ?? j.meter_sent,
                        inward_date: new Date().toISOString().slice(0, 10),
                        received_by: "warehouse",
                        confirm_receive: true,
                        quality_result: qualityResults[j.job_work_id] || "accepted",
                        is_final: isFinals[j.job_work_id] ?? true,
                      });
                      await load();
                    }}
                  >
                    Confirm Receive
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
          {!openJobs.length && (
            <Grid  size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
                <Typography color="text.secondary">No open job-work pending return.</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Job Workers List</Typography>
          <Stack direction="row" spacing={2}>
            <TextField size="small" placeholder="Search workers..." value={searchWorkers} onChange={(e) => setSearchWorkers(e.target.value)} sx={{ width: 250 }} />
            <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setShowNewWorker(!showNewWorker)}>
              {showNewWorker ? "Cancel" : "Add Processor"}
            </Button>
          </Stack>
        </Stack>

        {showNewWorker && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid rgba(168, 85, 247, 0.2)", background: "rgba(168, 85, 247, 0.02)" }} className="animate-slide-down">
            <Typography fontWeight={700} mb={2}>Add New Job Worker</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField size="small" label="Name" value={jwForm.name} onChange={(e) => setJwForm({ ...jwForm, name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label="Type (e.g. Dyeing)" value={jwForm.job_work_type} onChange={(e) => setJwForm({ ...jwForm, job_work_type: e.target.value })} />
              <Button
                variant="contained" color="secondary"
                onClick={async () => {
                  if (!jwForm.name.trim()) return;
                  await api.post("/mx/job-workers", jwForm);
                  setJwForm({ name: "", contact: "", job_work_type: "" });
                  setShowNewWorker(false);
                  await load();
                }}
              >
                Save
              </Button>
            </Stack>
          </Paper>
        )}

        <Grid container spacing={3}>
          {workers
            .filter((w) => w.name?.toLowerCase().includes(searchWorkers.toLowerCase()) || w.job_work_type?.toLowerCase().includes(searchWorkers.toLowerCase()))
            .map((w, idx) => (
            <Grid key={w.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper 
                elevation={0} 
                sx={{ p: 3, height: "100%", borderRadius: 4, cursor: "pointer", "&:hover": { borderColor: "primary.main", borderWidth: 2, borderStyle: "solid", m: "-2px" } }} 
                className={`stagger-${(idx % 5) + 1}`}
                onClick={() => navigate(`/job-work/worker/${w.id}`)}
              >
                <Typography variant="h6" fontWeight={800}>{w.name}</Typography>
                <Stack direction="row" spacing={1} mt={2}>
                  <Chip size="small" color="secondary" variant="outlined" label={w.job_work_type || "General"} />
                  {w.contact && <Chip size="small" label={w.contact} />}
                </Stack>
              </Paper>
            </Grid>
          ))}
          {!workers.length && (
            <Grid  size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 6, textAlign: "center", border: "1px dashed rgba(0,0,0,0.1)", borderRadius: 4 }}>
                <Typography color="text.secondary">No job workers added yet.</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </TabPanel>
    </Box>
  );
}
