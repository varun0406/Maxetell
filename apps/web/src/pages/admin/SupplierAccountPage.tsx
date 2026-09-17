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
} from "@mui/material";
import { api } from "../../lib/api";
import FactoryIcon from "@mui/icons-material/Factory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export function SupplierAccountPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<any>(null);
  const [tab, setTab] = useState(0);

  async function load() {
    try {
      const res = await api.get(`/mx/suppliers/${id}`);
      setSupplier(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  if (!supplier) return null;

  return (
    <Box sx={{ maxWidth: 1200, margin: "0 auto", p: 2 }}>
      <Button onClick={() => navigate("/suppliers")} sx={{ mb: 2 }}>
        &larr; Back to Suppliers
      </Button>

      {/* Header Block */}
      <Paper sx={{ p: 3, mb: 3, borderLeft: "6px solid", borderColor: "secondary.main" }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={1}>
              <FactoryIcon fontSize="large" color="secondary" />
              <Typography variant="h4" fontWeight={900}>{supplier.name}</Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary" mb={2}>
              {supplier.contact || "No contact info"} • Supplier ID: #{supplier.id}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", height: "100%", bgcolor: "grey.50" }}>
                  <Typography variant="caption" color="text.secondary">Active POs</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {supplier.active_pos?.length || 0}
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", height: "100%", bgcolor: "grey.50" }}>
                  <Typography variant="caption" color="text.secondary">Recent Rolls</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {supplier.recent_rolls?.length || 0}
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
          <Tab label="Active Purchase Bills" />
          <Tab label="Recent Rolls Supplied" />
          <Tab label="Ledger & Financials" />
        </Tabs>
      </Box>

      {/* Tab 1: Active POs */}
      <TabPanel value={tab} index={0}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Date</TableCell>
                <TableCell>Bill Ref</TableCell>
                <TableCell>Rolls Expected</TableCell>
                <TableCell>Meters Expected</TableCell>
                <TableCell>Received</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(supplier.active_pos || []).map((b: any) => (
                <TableRow key={b.purchase_bill_id}>
                  <TableCell>{b.bill_date}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{b.supplier_bill_no || "—"}</TableCell>
                  <TableCell>{b.rolls_expected || 0}</TableCell>
                  <TableCell>{b.meters_expected || 0}</TableCell>
                  <TableCell>{b.rolls_received || 0}</TableCell>
                  <TableCell>
                    <Chip size="small" label={b.status} color={b.status === "open" ? "warning" : "success"} />
                  </TableCell>
                </TableRow>
              ))}
              {supplier.active_pos?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>No active purchase bills.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 2: Recent Rolls */}
      <TabPanel value={tab} index={1}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Short Code</TableCell>
                <TableCell>Item Variant</TableCell>
                <TableCell>Lot No</TableCell>
                <TableCell align="right">Original Meters</TableCell>
                <TableCell>Received At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(supplier.recent_rolls || []).map((r: any) => (
                <TableRow key={r.short_code}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.short_code}</TableCell>
                  <TableCell>{r.item_name} • {r.variant_code}</TableCell>
                  <TableCell>{r.lot_no || "—"}</TableCell>
                  <TableCell align="right">{r.original_meters.toFixed(1)}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {supplier.recent_rolls?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>No recent rolls.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 3: Ledger Placeholder */}
      <TabPanel value={tab} index={2}>
        <Paper sx={{ p: 4, textAlign: "center", bgcolor: "grey.50" }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Financials Module Pending (Phase 5)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ledger reconciliation, debit notes, and payment tracking will be enabled in the upcoming Phase 5 rollout.
          </Typography>
        </Paper>
      </TabPanel>
    </Box>
  );
}
