import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Card,
  CardContent,
  LinearProgress,
  Button,
  Grid,
  Chip,
} from "@mui/material";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";


export function DispatcherBoard() {
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    try {
      setLoading(true);
      // Fetch today's challans + any active challans from before that aren't delivered
      const res = await api.get("/mx/challans");
      
      const all = res.data.data ?? [];
      // Filter for today's OR active (created, assigned, assembling)
      const todayDate = new Date().toISOString().slice(0, 10);
      const active = all.filter((c: any) => 
        c.challan_date.startsWith(todayDate) || 
        ["created", "assigned", "assembling"].includes(c.status)
      );
      setChallans(active);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(load, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && challans.length === 0) return <LinearProgress />;

  const grouped = {
    pending: challans.filter(c => ["created", "assigned"].includes(c.status)),
    assembling: challans.filter(c => c.status === "assembling"),
    dispatched: challans.filter(c => c.status === "dispatched" && c.challan_date.startsWith(new Date().toISOString().slice(0, 10))),
  };

  return (
    <Box sx={{ height: "calc(100vh - 100px)", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={800}>
          Today's Dispatch Board
        </Typography>
        <Button variant="contained" color="secondary" onClick={() => navigate("/challans/new")}>
          Create Challan
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ flexGrow: 1, overflow: "hidden" }}>
        
        {/* Pending Column */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Paper sx={{ p: 2, bgcolor: "grey.100", height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              Pending ({grouped.pending.length})
            </Typography>
            <Box sx={{ overflowY: "auto", flexGrow: 1, px: 1 }}>
              <Stack spacing={1.5}>
                {grouped.pending.map((c) => (
                  <Card key={c.challan_id} variant="outlined">
                    <CardContent sx={{ p: "12px !important" }}>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" fontWeight={700}>{c.challan_no}</Typography>
                        <Chip label={c.status} size="small" />
                      </Stack>
                      <Typography variant="body2" color="primary.main" fontWeight={600} noWrap>
                        {c.party_master_name || c.addr_party || c.party_name}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {c.total_required_meters ? `${c.total_required_meters}m required` : "No specific requirements"}
                      </Typography>
                      <Button size="small" variant="outlined" sx={{ mt: 1 }} fullWidth onClick={() => navigate(`/floor/challans/${c.challan_id}`)}>
                        Start Picking
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Assembling Column */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Paper sx={{ p: 2, bgcolor: "primary.50", height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2} color="primary.dark">
              Assembling ({grouped.assembling.length})
            </Typography>
            <Box sx={{ overflowY: "auto", flexGrow: 1, px: 1 }}>
              <Stack spacing={1.5}>
                {grouped.assembling.map((c) => {
                  const progress = c.total_required_meters ? Math.min(100, Math.round((c.assembled_meters / c.total_required_meters) * 100)) : 0;
                  return (
                    <Card key={c.challan_id} variant="outlined" sx={{ borderColor: "primary.main" }}>
                      <CardContent sx={{ p: "12px !important" }}>
                        <Stack direction="row" justifyContent="space-between" mb={1}>
                          <Typography variant="body2" fontWeight={700}>{c.challan_no}</Typography>
                          <Typography variant="caption" fontWeight={700} color="primary.main">{progress}%</Typography>
                        </Stack>
                        <Typography variant="body2" fontWeight={600} noWrap mb={1}>
                          {c.party_master_name || c.addr_party || c.party_name}
                        </Typography>
                        
                        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
                        
                        <Typography variant="caption" display="block" color="text.secondary" mb={1}>
                          {(c.assembled_meters || 0).toFixed(1)}m / {c.total_required_meters || "?"}m assembled ({c.scan_count} scans)
                        </Typography>
                        
                        <Button size="small" variant="contained" sx={{ mt: 1, boxShadow: "none" }} fullWidth onClick={() => navigate(`/floor/challans/${c.challan_id}`)}>
                          Continue Picking
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Dispatched Today Column */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Paper sx={{ p: 2, bgcolor: "success.50", height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2} color="success.dark">
              Dispatched Today ({grouped.dispatched.length})
            </Typography>
            <Box sx={{ overflowY: "auto", flexGrow: 1, px: 1 }}>
              <Stack spacing={1.5}>
                {grouped.dispatched.map((c) => (
                  <Card key={c.challan_id} variant="outlined" sx={{ bgcolor: "success.light", color: "success.contrastText", border: "none" }}>
                    <CardContent sx={{ p: "12px !important" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{c.challan_no}</Typography>
                          <Typography variant="caption" display="block" sx={{ opacity: 0.9 }}>
                            {c.party_master_name || c.addr_party || c.party_name}
                          </Typography>
                        </Box>
                        <LocalShippingIcon />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {grouped.dispatched.length === 0 && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
                    No shipments dispatched today.
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
