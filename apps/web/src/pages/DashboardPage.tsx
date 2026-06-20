import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Alert,
} from "@mui/material";
import { fetchDashboardAnalytics, fetchDashboardSummary } from "../lib/api";

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function KpiCard(props: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary" fontWeight={700}>
          {props.label}
        </Typography>
        <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5 }}>
          {props.value}
        </Typography>
        {props.sub ? (
          <Typography variant="caption" color="text.secondary">
            {props.sub}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof fetchDashboardAnalytics>> | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchDashboardSummary(), fetchDashboardAnalytics()])
      .then(([d, a]) => {
        if (!alive) return;
        setData(d);
        setAnalytics(a);
        setErr(null);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const kpis = useMemo(() => {
    if (!data) return null;
    return {
      totalOrders: String(data.total_orders.c),
      totalOrderKgs: `${Math.round(data.total_order_kgs).toLocaleString()} kg`,
      totalDispatch: `${Math.round(data.total_dispatch_kgs).toLocaleString()} kg`,
      currentStock: `${Math.round(data.current_stock_kgs).toLocaleString()} kg`,
      pending: `${Math.round(data.pending_kgs).toLocaleString()} kg`,
      purchaseRequired: `${Math.round(data.purchase_required_kgs).toLocaleString()} kg`,
    };
  }, [data]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2 }}>
        Dashboard
      </Typography>

      {err ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      ) : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {kpis ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
          }}
        >
          <KpiCard label="Total Orders" value={kpis.totalOrders} sub="Count of WO" />
          <KpiCard label="Total Orders (Kgs)" value={kpis.totalOrderKgs} />
          <KpiCard label="Total Dispatch" value={kpis.totalDispatch} />
          <KpiCard label="Current Stock" value={kpis.currentStock} sub="Opening + Receipts + SalesReturn − Dispatch − PurchaseReturn" />
          <KpiCard label="Pending Orders" value={kpis.pending} sub="Sum of balance" />
          <KpiCard label="Purchase Required" value={kpis.purchaseRequired} sub="(Opening + Receipts − PurchaseReturn − Minimum) + Pending PO − Dispatch − Pending sales" />
        </Box>
      ) : null}

      {analytics ? (
        <>
          <Typography variant="h6" fontWeight={900} sx={{ mt: 4, mb: 2 }}>
            Averages & Financials
          </Typography>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
            <KpiCard label="Average Purchase Price" value={`₹${money(analytics.avg_purchase_price)}`} sub="Weighted average across all purchases" />
          </Box>

          <Typography variant="h6" fontWeight={900} sx={{ mt: 4, mb: 2 }}>
            Quarterly Sales Price
          </Typography>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" } }}>
            {analytics.quarterly_sales.map(q => (
              <KpiCard 
                key={q.quarter} 
                label={q.quarter} 
                value={`₹${money(q.sales_weight > 0 ? q.sales_amount / q.sales_weight : 0)}`} 
                sub={`${money(q.sales_weight)} kg sold`} 
              />
            ))}
            {analytics.quarterly_sales.length === 0 && <Typography color="text.secondary">No quarterly data available</Typography>}
          </Box>

          <Typography variant="h6" fontWeight={900} sx={{ mt: 4, mb: 2 }}>
            Monthly Summary
          </Typography>
          <Card>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 800 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr 1fr", p: 2, borderBottom: "1px solid rgba(0,0,0,0.1)", fontWeight: 800 }}>
                  <Box>Month</Box>
                  <Box>Sales (Kg / Avg ₹)</Box>
                  <Box>Purchases (Kg / Avg ₹)</Box>
                  <Box>Sales Returns</Box>
                  <Box>Purchase Returns</Box>
                </Box>
                {analytics.monthly_summary.map(m => (
                  <Box key={m.month} sx={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr 1fr", p: 2, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <Box fontWeight={800}>{m.month}</Box>
                    <Box>
                      {money(m.sales_weight)} kg<br/>
                      <Typography variant="caption" color="text.secondary">
                        Avg: ₹{money(m.sales_weight > 0 ? m.sales_amount / m.sales_weight : 0)}
                      </Typography>
                    </Box>
                    <Box>
                      {money(m.purchase_weight)} kg<br/>
                      <Typography variant="caption" color="text.secondary">
                        Avg: ₹{money(m.purchase_weight > 0 ? m.purchase_amount / m.purchase_weight : 0)}
                      </Typography>
                    </Box>
                    <Box>{money(m.sales_return_weight)} kg</Box>
                    <Box>{money(m.purchase_return_weight)} kg</Box>
                  </Box>
                ))}
                {analytics.monthly_summary.length === 0 && <Box p={2}><Typography color="text.secondary">No monthly data available</Typography></Box>}
              </Box>
            </Box>
          </Card>
        </>
      ) : null}
    </Box>
  );
}

