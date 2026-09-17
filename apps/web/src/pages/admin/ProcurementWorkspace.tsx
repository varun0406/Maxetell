import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Button,
  TextField,
  Autocomplete,
} from "@mui/material";
import { api } from "../../lib/api";
import ReceiptIcon from "@mui/icons-material/Receipt";

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index } = props;
  return <div hidden={value !== index}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>;
}

export function ProcurementWorkspace() {
  const [tab, setTab] = useState(0);
  const [purchaseBills, setPurchaseBills] = useState<any[]>([]);
  const [jobWorkBills, setJobWorkBills] = useState<any[]>([]);
  const [jobWorkers, setJobWorkers] = useState<any[]>([]);

  const [jwBillForm, setJwBillForm] = useState({
    job_worker_id: 0,
    bill_no: "",
    bill_date: new Date().toISOString().slice(0, 10),
    total_amount: "",
    notes: "",
  });

  async function loadData() {
    try {
      const [pbRes, jwbRes, jwRes] = await Promise.all([
        api.get("/mx/purchase-bills"),
        api.get("/mx/accounts/job-work-bills"),
        api.get("/mx/job-workers"),
      ]);
      setPurchaseBills(pbRes.data.data ?? []);
      setJobWorkBills(jwbRes.data.data ?? []);
      setJobWorkers(jwRes.data.data ?? []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const handlePostJwBill = async () => {
    if (!jwBillForm.job_worker_id || !jwBillForm.bill_no || !jwBillForm.total_amount) return;
    await api.post("/mx/accounts/job-work-bills", {
      ...jwBillForm,
      total_amount: Number(jwBillForm.total_amount),
    });
    setJwBillForm({
      job_worker_id: 0,
      bill_no: "",
      bill_date: new Date().toISOString().slice(0, 10),
      total_amount: "",
      notes: "",
    });
    await loadData();
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: "0 auto", p: 2 }}>
      <Typography variant="h4" fontWeight={900} mb={3} display="flex" alignItems="center" gap={1}>
        <ReceiptIcon fontSize="large" color="secondary" /> Procurement & Payables
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="secondary" indicatorColor="secondary">
          <Tab label="Purchase Bills (Material)" />
          <Tab label="Job Work Bills (Process)" />
        </Tabs>
      </Box>

      {/* Purchase Bills */}
      <TabPanel value={tab} index={0}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Note: Purchase Bills are automatically logged when stock is inwarded in the Suppliers module.
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Date</TableCell>
                <TableCell>Bill No</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell align="right">Meters Billed</TableCell>
                <TableCell align="right">Total Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchaseBills.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{new Date(b.bill_date).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{b.bill_no}</TableCell>
                  <TableCell>{b.supplier_name}</TableCell>
                  <TableCell align="right">{b.total_meterage ? b.total_meterage.toLocaleString() : "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "error.main" }}>
                    ₹{b.total_amount ? b.total_amount.toLocaleString() : "0"}
                  </TableCell>
                </TableRow>
              ))}
              {purchaseBills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>No purchase bills found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Job Work Bills */}
      <TabPanel value={tab} index={1}>
        <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 3, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(168, 85, 247, 0.02)" }}>
          <Typography fontWeight={700} mb={2}>Log Manual Job Work Bill</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <Autocomplete
                size="small"
                options={jobWorkers}
                getOptionLabel={(w) => w.name}
                value={jobWorkers.find((w) => w.id === jwBillForm.job_worker_id) || null}
                onChange={(_, newValue) => setJwBillForm({ ...jwBillForm, job_worker_id: newValue?.id || 0 })}
                renderInput={(params) => <TextField {...params} label="Job Worker" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField size="small" fullWidth label="Bill No" value={jwBillForm.bill_no} onChange={(e) => setJwBillForm({ ...jwBillForm, bill_no: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField size="small" fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} value={jwBillForm.bill_date} onChange={(e) => setJwBillForm({ ...jwBillForm, bill_date: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField size="small" fullWidth type="number" label="Amount (₹)" value={jwBillForm.total_amount} onChange={(e) => setJwBillForm({ ...jwBillForm, total_amount: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button variant="contained" color="secondary" fullWidth onClick={handlePostJwBill}>
                Log Bill
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Date</TableCell>
                <TableCell>Bill No</TableCell>
                <TableCell>Job Worker</TableCell>
                <TableCell align="right">Total Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobWorkBills.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{new Date(b.bill_date).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{b.bill_no}</TableCell>
                  <TableCell>{b.job_worker_name}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "error.main" }}>
                    ₹{b.total_amount ? b.total_amount.toLocaleString() : "0"}
                  </TableCell>
                </TableRow>
              ))}
              {jobWorkBills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>No job work bills found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>
    </Box>
  );
}
