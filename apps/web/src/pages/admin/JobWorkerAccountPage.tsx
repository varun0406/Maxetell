import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Stack,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  LinearProgress,
} from "@mui/material";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../../lib/api";

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }} className="animate-slide-down">{children}</Box>;
}

export function JobWorkerAccountPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<any>(null);

  async function load() {
    try {
      const res = await api.get(`/mx/job-workers/${id}`);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  if (!data) return <LinearProgress />;

  const { worker, open_jobs, total_meters_out, capacity, history, stats } = data;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/job-work")} sx={{ mb: 2 }}>
        Back to Job Work
      </Button>

      {/* Header Block */}
      <Paper sx={{ p: 3, mb: 3, borderLeft: "6px solid", borderColor: "primary.main" }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={1}>
              <PrecisionManufacturingIcon fontSize="large" color="primary" />
              <Typography variant="h4" fontWeight={900}>{worker.name}</Typography>
              <Chip label={worker.job_work_type || "General"} size="small" color="secondary" />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Contact: {worker.contact || "—"} &nbsp;&nbsp;|&nbsp;&nbsp; GSTIN: {worker.gstin || "—"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Address: {worker.address || "—"}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", height: "100%" }}>
                  <Typography variant="caption" color="text.secondary">Avg Turnaround</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {stats.avg_turnaround_days ? Number(stats.avg_turnaround_days).toFixed(1) + " days" : "—"}
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", height: "100%" }}>
                  <Typography variant="caption" color="text.secondary">Total Shortage</Typography>
                  <Typography variant="h6" fontWeight={700} color={stats.shortage_pct > 2 ? "error.main" : "text.primary"}>
                    {Number(stats.shortage_pct).toFixed(1)}%
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab label={`With Them Now (${open_jobs.length})`} />
        <Tab label="Capacity & Load" />
        <Tab label="History" />
        <Tab label="Ledger / Account" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Typography variant="h6" fontWeight={800} gutterBottom>
          Currently at {worker.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Total outstanding: {total_meters_out.toFixed(1)} meters
        </Typography>

        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job Ref</TableCell>
                <TableCell>Lot / Roll</TableCell>
                <TableCell>Item & Shade</TableCell>
                <TableCell align="right">Meters Sent</TableCell>
                <TableCell>Sent On</TableCell>
                <TableCell>Days Out</TableCell>
                <TableCell>Purchase Bill</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {open_jobs.map((j: any) => {
                const over = capacity.default_turnaround_days && j.days_out > capacity.default_turnaround_days;
                return (
                  <TableRow key={j.job_work_id}>
                    <TableCell sx={{ fontWeight: 600 }}>{j.job_work_ref || "—"}</TableCell>
                    <TableCell>{j.lot_display}</TableCell>
                    <TableCell>{j.item_name} · {j.variant_code}</TableCell>
                    <TableCell align="right">{(j.meter_sent - (j.meter_returned ?? 0)).toFixed(1)}</TableCell>
                    <TableCell>{j.outward_date}</TableCell>
                    <TableCell>
                      <Chip 
                        label={`${j.days_out}d`} 
                        size="small" 
                        color={over ? "error" : "default"} 
                        variant={over ? "filled" : "outlined"} 
                      />
                    </TableCell>
                    <TableCell>{j.purchase_bill_no || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {open_jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>
                    No material currently at this job worker.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>Capacity Overview</Typography>
              <Stack spacing={2} mt={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Declared Capacity</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {capacity.declared_capacity ? `${capacity.declared_capacity} meters / day` : "Not configured"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Default Turnaround</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {capacity.default_turnaround_days ? `${capacity.default_turnaround_days} days` : "Not configured"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Current Queue</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {capacity.days_of_work_queued !== null ? `${capacity.days_of_work_queued} days of work pending` : "—"}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Typography variant="h6" fontWeight={800} gutterBottom>
          Completed Job Work
        </Typography>
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job Ref</TableCell>
                <TableCell>Lot / Roll</TableCell>
                <TableCell>Item & Shade</TableCell>
                <TableCell align="right">Sent</TableCell>
                <TableCell align="right">Returned</TableCell>
                <TableCell align="right">Shortage</TableCell>
                <TableCell>Quality</TableCell>
                <TableCell>Turnaround</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((j: any) => (
                <TableRow key={j.job_work_id}>
                  <TableCell>{j.job_work_ref || "—"}</TableCell>
                  <TableCell>{j.lot_display}</TableCell>
                  <TableCell>{j.item_name} · {j.variant_code}</TableCell>
                  <TableCell align="right">{j.meter_sent.toFixed(1)}</TableCell>
                  <TableCell align="right">{j.meter_returned?.toFixed(1)}</TableCell>
                  <TableCell align="right" sx={{ color: j.shortage_meters > 5 ? "error.main" : "inherit" }}>
                    {j.shortage_meters ? j.shortage_meters.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell>
                    {j.quality_result ? (
                      <Chip 
                        label={j.quality_result} 
                        size="small" 
                        color={j.quality_result === "rejected" ? "error" : j.quality_result === "defect" ? "warning" : "success"} 
                        variant="outlined"
                      />
                    ) : "—"}
                  </TableCell>
                  <TableCell>{j.turnaround_days}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <Paper sx={{ p: 4, textAlign: "center", bgcolor: "background.default" }} variant="outlined">
          <Typography variant="h6" color="text.secondary" gutterBottom>Ledger Integration Pending</Typography>
          <Typography variant="body2" color="text.secondary">
            Financial ledger, agent commissions, and debit/credit notes will be implemented in Phase 4.
          </Typography>
        </Paper>
      </TabPanel>
    </Box>
  );
}
