import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Button,
} from "@mui/material";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";

export function CoordinatorBoard() {
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  async function load() {
    try {
      // 1) Ready to send (rolls in inward or in_cutting)
      const r = await api.get("/mx/rolls?status=inward");
      const c = await api.get("/mx/rolls?status=in_cutting");
      const ready = [...(r.data.data ?? []), ...(c.data.data ?? [])].filter(
        (roll: any) => roll.remaining_meterage > 0
      );

      // 2) Currently out + Awaiting Validation
      const pend = await api.get("/mx/analytics/job-work-pendency");

      setData({
        ready,
        open: pend.data.data.open ?? [],
        awaiting_confirm: pend.data.data.awaiting_confirm ?? [],
      });
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (!data) return <LinearProgress />;

  return (
    <Box sx={{ height: "calc(100vh - 100px)", display: "flex", flexDirection: "column" }}>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Coordinator Control Board
      </Typography>

      <Grid container spacing={2} sx={{ flexGrow: 1, overflow: "hidden" }}>
        {/* Panel 1: Ready to Send */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Paper sx={{ p: 2, bgcolor: "grey.100", height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              Ready to Send ({data.ready.length})
            </Typography>
            <Box sx={{ overflowY: "auto", flexGrow: 1, px: 1 }}>
              <Stack spacing={1.5}>
                {data.ready.map((roll: any) => (
                  <Card key={roll.roll_id} variant="outlined">
                    <CardContent sx={{ p: "12px !important" }}>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" fontWeight={700}>{roll.lot_display}</Typography>
                        <Typography variant="body2" color="primary.main" fontWeight={600}>{roll.remaining_meterage}m</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {roll.item_name} · {roll.variant_code}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Supplier: {roll.supplier_name}
                      </Typography>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        sx={{ mt: 1, py: 0 }}
                        onClick={() => navigate("/job-work")}
                      >
                        Send
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Panel 2: Currently Out */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Paper sx={{ p: 2, bgcolor: "primary.50", height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2} color="primary.dark">
              Currently Out ({data.open.length})
            </Typography>
            <Box sx={{ overflowY: "auto", flexGrow: 1, px: 1 }}>
              <Stack spacing={1.5}>
                {data.open.map((job: any) => (
                  <Card key={job.job_work_id} variant="outlined" sx={{ cursor: "pointer", "&:hover": { borderColor: "primary.main" } }} onClick={() => navigate(`/job-work/worker/${job.job_worker_id}`)}>
                    <CardContent sx={{ p: "12px !important" }}>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" fontWeight={700}>{job.worker_name}</Typography>
                        <Chip label={`${job.days_out}d`} size="small" color={job.days_out > 7 ? "error" : "primary"} variant={job.days_out > 7 ? "filled" : "outlined"} />
                      </Stack>
                      <Typography variant="caption" display="block">
                        Ref: {job.job_work_ref || "—"} | {job.meters_outstanding}m sent
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {job.roll_short} · {job.variant_code} | Bill: <strong>{job.purchase_bill_no || "N/A"}</strong>
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Panel 3: Awaiting Validation */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Paper sx={{ p: 2, bgcolor: "warning.50", height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2} color="warning.dark">
              Awaiting Validation ({data.awaiting_confirm.length})
            </Typography>
            <Box sx={{ overflowY: "auto", flexGrow: 1, px: 1 }}>
              <Stack spacing={1.5}>
                {data.awaiting_confirm.map((job: any) => (
                  <Card key={job.job_work_id} variant="outlined">
                    <CardContent sx={{ p: "12px !important" }}>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" fontWeight={700}>{job.worker_name}</Typography>
                        <Typography variant="body2" fontWeight={700} color={job.shortage_meters > 5 ? "error.main" : "text.secondary"}>
                          -{job.shortage_meters.toFixed(1)}m short
                        </Typography>
                      </Stack>
                      <Typography variant="caption" display="block">
                        Ref: {job.job_work_ref || "—"} | {job.meter_returned}m returned
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Bill: <strong>{job.purchase_bill_no || "N/A"}</strong>
                      </Typography>
                      <Button 
                        size="small" 
                        variant="contained" 
                        color="warning" 
                        sx={{ mt: 1, py: 0, boxShadow: "none" }}
                        onClick={() => navigate(`/job-work/worker/${job.job_worker_id}`)}
                      >
                        Review
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {data.awaiting_confirm.length === 0 && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
                    No returns pending validation.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
