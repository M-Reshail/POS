import React, { useState } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card, Select, Badge } from '../../components/common';
import { useStore } from '../../store';
import { BarChart3, Users, Package, TrendingUp, Download, Calendar, ShoppingCart } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const bills = useStore((state) => state.bills);
  const retailers = useStore((state) => state.retailers);
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState('monthly');

  const formatPeriod = (date: Date) => {
    if (dateRange === 'daily') return date.toLocaleDateString();
    if (dateRange === 'yearly') return date.getFullYear().toString();
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  const salesRows = Array.from(
    bills.reduce((map, bill) => {
      const period = formatPeriod(new Date(bill.createdAt));
      const current = map.get(period) || { period, sales: 0, pets: 0, count: 0, paid: 0, pending: 0 };
      current.sales += bill.total;
      current.pets += bill.items.reduce((sum, item) => sum + item.quantity, 0);
      current.count += 1;
      current.paid += bill.paidAmount;
      current.pending += bill.pendingAmount;
      map.set(period, current);
      return map;
    }, new Map<string, { period: string; sales: number; pets: number; count: number; paid: number; pending: number }>())
      .values()
  );

  const productsData = Array.from(
    bills.reduce((map, bill) => {
      bill.items.forEach((item) => {
        const current = map.get(item.productId) || { product: item.productId, sold: 0, revenue: 0 };
        current.sold += item.quantity;
        current.revenue += item.total;
        map.set(item.productId, current);
      });
      return map;
    }, new Map<string, { product: string; sold: number; revenue: number }>())
      .values()
  );

  const workerPerformance = Array.from(
    bills.reduce((map, bill) => {
      const worker = bill.workerId || 'Unknown';
      const current = map.get(worker) || { name: worker, salesValue: 0, pets: 0, bills: 0, paid: 0, pending: 0 };
      current.salesValue += bill.total;
      current.pets += bill.items.reduce((sum, item) => sum + item.quantity, 0);
      current.bills += 1;
      current.paid += bill.paidAmount;
      current.pending += bill.pendingAmount;
      map.set(worker, current);
      return map;
    }, new Map<string, { name: string; salesValue: number; pets: number; bills: number; paid: number; pending: number }>())
      .values()
  );

  const priceVariance = bills.flatMap((bill) =>
    bill.items
      .filter((item) => item.discount || item.price <= 0)
      .map((item) => ({
        date: new Date(bill.createdAt).toLocaleDateString(),
        worker: bill.workerId || 'Unknown',
        product: item.productId,
        defaultPrice: item.price + (item.discount || 0),
        billedPrice: item.price,
        status: 'flagged',
      }))
  );

  const creditReport = Array.from(
    bills.reduce((map, bill) => {
      const retailer = retailers.find((r) => r.id === bill.retailerId);
      const current = map.get(bill.retailerId) || {
        retailer: retailer?.shopName || bill.retailerId,
        limit: retailer?.creditLimit || 0,
        outstanding: 0,
        paid: 0,
        status: 'paid',
      };
      current.outstanding += bill.pendingAmount;
      current.paid += bill.paidAmount;
      current.status = current.outstanding > 0 ? 'active' : 'paid';
      map.set(bill.retailerId, current);
      return map;
    }, new Map<string, { retailer: string; limit: number; outstanding: number; paid: number; status: string }>())
      .values()
  );

  const sidebarItems = [
    { label: 'Dashboard', icon: <BarChart3 size={20} />, path: '/admin/dashboard' },
    { label: 'Create Sale', icon: <ShoppingCart size={20} />, path: '/worker/sales' },
    { label: 'Inventory', icon: <Package size={20} />, path: '/admin/inventory' },
    { label: 'Retailers', icon: <Users size={20} />, path: '/admin/retailers' },
    { label: 'Reports', icon: <TrendingUp size={20} />, path: '/admin/reports' },
  ];

  return (
    <Layout sidebarItems={sidebarItems}>
      <PageContainer>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <Button variant="secondary">
            <Download size={18} className="mr-2" />
            Export Reportor
          </Button>
        </div>

        {/* Filter Section */}
        <Card className="mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <Select
                label="Report Type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                options={[
                  { value: 'sales', label: 'Sales Summary' },
                  { value: 'products', label: 'Product Performance' },
                  { value: 'workers', label: 'Worker Performance' },
                  { value: 'price-variance', label: 'Price Variance' },
                  { value: 'credit', label: 'Credit & Ledger' },
                ]}
              />
            </div>
            <div className="flex-1 min-w-48">
              <Select
                label="Date Range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'yearly', label: 'Yearly' },
                ]}
              />
            </div>
            <Button variant="secondary">
              <Calendar size={18} className="mr-2" />
              Filter
            </Button>
          </div>
        </Card>

        {/* Sales Report */}
        {reportType === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <p className="text-gray-600 text-sm">Total Sales</p>
                <p className="text-3xl font-bold mt-2">
                  ₨{salesRows.reduce((sum, m) => sum + m.sales, 0).toFixed(0)}
                </p>
                <p className="text-xs text-gray-500 mt-2">Last 3 months</p>
              </Card>
              <Card>
                <p className="text-gray-600 text-sm">Total PET Moved</p>
                <p className="text-3xl font-bold mt-2">
                  {salesRows.reduce((sum, m) => sum + m.pets, 0)}
                </p>
              </Card>
              <Card>
                <p className="text-gray-600 text-sm">Avg Monthly</p>
                <p className="text-3xl font-bold mt-2">
                  ₨{(salesRows.reduce((sum, m) => sum + m.sales, 0) / Math.max(1, salesRows.length)).toFixed(0)}
                </p>
              </Card>
            </div>

            <Card title="Sales Trend">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Period</th>
                      <th className="text-right py-2">Sales Value</th>
                      <th className="text-right py-2">PET Units</th>
                      <th className="text-right py-2">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesRows.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-2">{row.period}</td>
                        <td className="py-2 text-right font-semibold">₨{row.sales.toFixed(0)}</td>
                        <td className="py-2 text-right">{row.pets}</td>
                        <td className="py-2 text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Products Report */}
        {reportType === 'products' && (
          <Card title="Product Performance">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4">Product</th>
                    <th className="text-right py-3 px-4">Units Sold</th>
                    <th className="text-right py-3 px-4">Revenue</th>
                    <th className="text-center py-3 px-4">Trend</th>
                    <th className="text-center py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {productsData.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{row.product}</td>
                      <td className="py-3 px-4 text-right">{row.sold}</td>
                      <td className="py-3 px-4 text-right">₨{row.revenue.toFixed(0)}</td>
                      <td className="py-3 px-4 text-center text-green-600 font-semibold">Tracked</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="success">Hot Seller</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Worker Performance */}
        {reportType === 'workers' && (
          <Card title="Worker Performance">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4">Worker</th>
                    <th className="text-right py-3 px-4">Total Sales</th>
                    <th className="text-right py-3 px-4">PET Sold</th>
                    <th className="text-right py-3 px-4">Bills</th>
                    <th className="text-right py-3 px-4">Paid</th>
                    <th className="text-right py-3 px-4">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {workerPerformance.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{row.name}</td>
                      <td className="py-3 px-4 text-right">₨{row.salesValue.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right">{row.pets}</td>
                      <td className="py-3 px-4 text-right">{row.bills}</td>
                      <td className="py-3 px-4 text-right">₨{row.paid.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right text-orange-600 font-semibold">₨{row.pending.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Price Variance Report */}
        {reportType === 'price-variance' && (
          <Card title="Price Variance Report">
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                ⚠️ These flagged entries show deviations from default sale prices. Review for patterns.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Worker</th>
                    <th className="text-left py-3 px-4">Product</th>
                    <th className="text-right py-3 px-4">Default Price</th>
                    <th className="text-right py-3 px-4">Billed Price</th>
                    <th className="text-right py-3 px-4">Variance</th>
                    <th className="text-center py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {priceVariance.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-xs">{row.date}</td>
                      <td className="py-3 px-4">{row.worker}</td>
                      <td className="py-3 px-4">{row.product}</td>
                      <td className="py-3 px-4 text-right">₨{row.defaultPrice}</td>
                      <td className="py-3 px-4 text-right">₨{row.billedPrice}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-semibold">
                        -₨{row.defaultPrice - row.billedPrice}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="warning">Flagged</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Credit Report */}
        {reportType === 'credit' && (
          <Card title="Credit & Ledger Report">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4">Retailer</th>
                    <th className="text-right py-3 px-4">Credit Limit</th>
                    <th className="text-right py-3 px-4">Outstanding</th>
                    <th className="text-right py-3 px-4">Paid</th>
                    <th className="text-center py-3 px-4">Usage %</th>
                    <th className="text-center py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {creditReport.map((row, idx) => {
                    const usage = (row.outstanding / row.limit) * 100;
                    return (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{row.retailer}</td>
                        <td className="py-3 px-4 text-right">₨{row.limit.toFixed(0)}</td>
                        <td className="py-3 px-4 text-right text-orange-600 font-semibold">
                          ₨{row.outstanding.toFixed(0)}
                        </td>
                        <td className="py-3 px-4 text-right">₨{row.paid.toFixed(0)}</td>
                        <td className="py-3 px-4 text-right">{usage.toFixed(1)}%</td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={
                              row.status === 'paid'
                                ? 'success'
                                : row.status === 'active'
                                ? 'info'
                                : 'warning'
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageContainer>
    </Layout>
  );
};
