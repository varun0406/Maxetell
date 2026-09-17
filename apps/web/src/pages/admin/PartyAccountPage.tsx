import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
} from "@mui/material";
import { api } from "../../lib/api";
import StorefrontIcon from "@mui/icons-material/Storefront";

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export function PartyAccountPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [party, setParty] = useState<any>(null);
  const [tab, setTab] = useState(0);

  async function load() {
    try {
      const res = await api.get(`/mx/parties/${id}`);
      setParty(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  if (!party) return null;

  const liveOrders = (party.challans || []).filter((c: any) => !["delivered", "cancelled"].includes(c.status));

  return (
    <Box sx={{ maxWidth: 1200, margin: "0 auto", p: 2 }}>
      <Button onClick={() => navigate("/parties")} sx={{ mb: 2 }}>
        &larr; Back to Parties
      </Button>

      {/* Header Block */}
      <Paper sx={{ p: 3, mb: 3, borderLeft: "6px solid", borderColor: "info.main" }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={1}>
              <StorefrontIcon fontSize="large" color="info" />
              <Typography variant="h4" fontWeight={900}>{party.name}</Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary" mb={2}>
              {party.phone || "No phone"} • GSTIN: {party.gstin || "N/A"}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", height: "100%", bgcolor: "grey.50" }}>
                  <Typography variant="caption" color="text.secondary">Live Orders (Challans)</Typography>
                  <Typography variant="h6" fontWeight={700} color="info.dark">
                    {liveOrders.length}
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", height: "100%", bgcolor: "grey.50" }}>
                  <Typography variant="caption" color="text.secondary">Addresses</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {party.addresses?.length || 0}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Live Orders" />
          <Tab label="Order History" />
          <Tab label="Ledger & Financials" />
        </Tabs>
      </Box>

      {/* Tab 1: Live Orders */}
      <TabPanel value={tab} index={0}>
        <Grid container spacing={2}>
          {liveOrders.map((c: any) => {
             // We estimate progress based on scan count if total_required is not available, or a real calculation
             // For simplicity, we just show status
             return (
               <Grid size={{ xs: 12, md: 6 }} key={c.challan_id}>
                 <Paper variant="outlined" sx={{ p: 2 }}>
                   <Stack direction="row" justifyContent="space-between" mb={1}>
                     <Typography variant="subtitle1" fontWeight={700}>{c.challan_no}</Typography>
                     <Chip label={c.status} size="small" color={c.status === "dispatched" ? "success" : "primary"} />
                   </Stack>
                   <Typography variant="body2" color="text.secondary" mb={1}>
                     Created on: {new Date(c.challan_date).toLocaleDateString()}
                   </Typography>
                   <Typography variant="body2">
                     <strong>{c.scan_count}</strong> scans | <strong>{c.total_required_meters || "?"}m</strong> required
                   </Typography>
                   {c.status === "assembling" && (
                     <LinearProgress sx={{ mt: 2, height: 6, borderRadius: 3 }} />
                   )}
                 </Paper>
               </Grid>
             );
          })}
          {liveOrders.length === 0 && (
            <Typography variant="body1" color="text.secondary" sx={{ p: 2 }}>No live orders.</Typography>
          )}
        </Grid>
      </TabPanel>

      {/* Tab 2: Order History */}
      <TabPanel value={tab} index={1}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Date</TableCell>
                <TableCell>Challan No</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Scans</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(party.challans || []).map((c: any) => (
                <TableRow key={c.challan_id}>
                  <TableCell>{new Date(c.challan_date).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{c.challan_no}</TableCell>
                  <TableCell>
                    <Chip size="small" label={c.status} />
                  </TableCell>
                  <TableCell>{c.scan_count}</TableCell>
                </TableRow>
              ))}
              {party.challans?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>No order history.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 3: Ledger */}
      <TabPanel value={tab} index={2}>
        <Grid container spacing={3} mb={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, textAlign: "center", bgcolor: "grey.50" }}>
              <Typography variant="caption" color="text.secondary">Total Billed (Invoices)</Typography>
              <Typography variant="h5" fontWeight={700}>
                ₹{Number(party.ledger?.total_billed || 0).toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, textAlign: "center", bgcolor: "success.50" }}>
              <Typography variant="caption" color="success.main">Total Received</Typography>
              <Typography variant="h5" fontWeight={700} color="success.dark">
                ₹{Number(party.ledger?.total_received || 0).toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, textAlign: "center", bgcolor: "error.50" }}>
              <Typography variant="caption" color="error.main">Outstanding Balance</Typography>
              <Typography variant="h5" fontWeight={700} color="error.dark">
                ₹{Number(party.ledger?.outstanding || 0).toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Typography variant="h6" mb={2}>Invoices & Payments</Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell>Invoice Date</TableCell>
                    <TableCell>Invoice No</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(party.ledger?.invoices || []).map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell>{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{inv.invoice_no}</TableCell>
                      <TableCell align="right">₹{Number(inv.total_amount).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {(!party.ledger?.invoices || party.ledger.invoices.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: "text.secondary" }}>No invoices recorded.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          <Grid size={{ xs: 12, md: 6 }}>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell>Payment Date</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(party.ledger?.payments || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell>{p.payment_mode || "—"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: "success.main" }}>+₹{Number(p.amount).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {(!party.ledger?.payments || party.ledger.payments.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: "text.secondary" }}>No payments received.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
}
