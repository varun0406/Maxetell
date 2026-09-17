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
  Chip,
  Tabs,
  Tab,
} from "@mui/material";
import { api } from "../../lib/api";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index } = props;
  return <div hidden={value !== index}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>;
}

export function AccountsWorkspace() {
  const [tab, setTab] = useState(0);
  const [summary, setSummary] = useState<any>({ receivables: [], payables: [] });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  async function loadData() {
    try {
      const [sumRes, invRes, payRes] = await Promise.all([
        api.get("/mx/accounts/ledger-summary"),
        api.get("/mx/accounts/invoices"),
        api.get("/mx/accounts/payments"),
      ]);
      setSummary(sumRes.data.data);
      setInvoices(invRes.data.data);
      setPayments(payRes.data.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const totalAR = summary.receivables.reduce((sum: number, r: any) => sum + (r.total_billed - r.total_received), 0);
  const totalAP = summary.payables.reduce((sum: number, p: any) => sum + (p.total_billed - p.total_paid), 0);

  return (
    <Box sx={{ maxWidth: 1200, margin: "0 auto", p: 2 }}>
      <Typography variant="h4" fontWeight={900} mb={3} display="flex" alignItems="center" gap={1}>
        <AccountBalanceIcon fontSize="large" color="primary" /> Accounts Workspace
      </Typography>

      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderLeft: "6px solid", borderColor: "success.main" }}>
            <Typography variant="subtitle2" color="text.secondary">Total Accounts Receivable (Parties)</Typography>
            <Typography variant="h3" fontWeight={700} color="success.dark">
              ₹{totalAR.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderLeft: "6px solid", borderColor: "error.main" }}>
            <Typography variant="subtitle2" color="text.secondary">Total Accounts Payable (Suppliers)</Typography>
            <Typography variant="h3" fontWeight={700} color="error.dark">
              ₹{totalAP.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Receivables (AR)" />
          <Tab label="Payables (AP)" />
          <Tab label="All Invoices" />
          <Tab label="All Payments" />
        </Tabs>
      </Box>

      {/* AR */}
      <TabPanel value={tab} index={0}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Party</TableCell>
                <TableCell align="right">Total Billed</TableCell>
                <TableCell align="right">Total Received</TableCell>
                <TableCell align="right">Outstanding Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.receivables.map((r: any) => {
                const out = r.total_billed - r.total_received;
                return (
                  <TableRow key={r.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                    <TableCell align="right">₹{r.total_billed.toLocaleString()}</TableCell>
                    <TableCell align="right">₹{r.total_received.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ color: out > 0 ? "error.main" : "text.primary", fontWeight: 700 }}>
                      ₹{out.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* AP */}
      <TabPanel value={tab} index={1}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Supplier</TableCell>
                <TableCell align="right">Total Billed</TableCell>
                <TableCell align="right">Total Paid</TableCell>
                <TableCell align="right">Outstanding Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.payables.map((p: any) => {
                const out = p.total_billed - p.total_paid;
                return (
                  <TableRow key={p.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                    <TableCell align="right">₹{p.total_billed.toLocaleString()}</TableCell>
                    <TableCell align="right">₹{p.total_paid.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ color: out > 0 ? "error.main" : "text.primary", fontWeight: 700 }}>
                      ₹{out.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Invoices */}
      <TabPanel value={tab} index={2}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Date</TableCell>
                <TableCell>Invoice No</TableCell>
                <TableCell>Party</TableCell>
                <TableCell>Challan Ref</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{inv.invoice_no}</TableCell>
                  <TableCell>{inv.party_name}</TableCell>
                  <TableCell>{inv.challan_id || "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>₹{inv.total_amount.toLocaleString()}</TableCell>
                  <TableCell><Chip size="small" label={inv.status} color={inv.status === "paid" ? "success" : "warning"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Payments */}
      <TabPanel value={tab} index={3}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>Date</TableCell>
                <TableCell>Entity Type</TableCell>
                <TableCell>Entity ID</TableCell>
                <TableCell>Mode / Ref</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((pay) => (
                <TableRow key={pay.id}>
                  <TableCell>{new Date(pay.payment_date).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{pay.entity_type}</TableCell>
                  <TableCell>#{pay.entity_id}</TableCell>
                  <TableCell>{pay.payment_mode || "—"} {pay.reference_no ? `(${pay.reference_no})` : ""}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: "success.main" }}>₹{pay.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>
    </Box>
  );
}
