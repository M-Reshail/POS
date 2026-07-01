import React, { useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Card, Badge } from '../../components/common';
import { useStore } from '../../store';
import { BarChart3, Users, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';

export const AdminDashboard: React.FC = () => {
  const bills = useStore((state) => state.bills);
  const products = useStore((state) => state.products);
  const retailers = useStore((state) => state.retailers);
  const fetchInitialData = useStore((state) => state.fetchInitialData);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Calculate metrics
  const totalSales = bills.reduce((sum, bill) => sum + Number(bill.total), 0);
  const totalPets = bills.reduce((sum, bill) => 
    sum + bill.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  );

  const today = new Date().toDateString();
  const todaysSales = bills.filter(b => new Date(b.createdAt).toDateString() === today);
  const todaysSalesAmount = todaysSales.reduce((sum, bill) => sum + Number(bill.total), 0);

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Metrics Cards */}
          <Card className="border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Today's Sales</p>
                <p className="text-2xl font-bold mt-2">{todaysSalesAmount.toFixed(0)}</p>
              </div>
              <BarChart3 size={32} className="text-blue-600 opacity-50" />
            </div>
          </Card>

          <Card className="border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Retailers</p>
                <p className="text-2xl font-bold mt-2">{retailers.length}</p>
              </div>
              <Users size={32} className="text-green-600 opacity-50" />
            </div>
          </Card>

          <Card className="border-l-4 border-purple-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Products</p>
                <p className="text-2xl font-bold mt-2">{products.length}</p>
              </div>
              <Package size={32} className="text-purple-600 opacity-50" />
            </div>
          </Card>

          <Card className="border-l-4 border-orange-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total PET Sold</p>
                <p className="text-2xl font-bold mt-2">{totalPets.toFixed(1)}</p>
              </div>
              <TrendingUp size={32} className="text-orange-600 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Alert & Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alerts */}
          <Card title="Alerts & Notices" className="lg:col-span-2">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-yellow-800">Low Stock Alert</p>
                  <p className="text-sm text-yellow-700">Pepsi 1.5L below minimum threshold</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-red-800">Expiry Warning</p>
                  <p className="text-sm text-red-700">Fanta 500ml expires in 3 days</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-blue-800">Credit Limit Alert</p>
                  <p className="text-sm text-blue-700">Future Shop at 85% of credit limit</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Summary Stats */}
          <Card title="Summary">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Total Sales (All Time)</p>
                <p className="text-lg font-bold">{totalSales.toFixed(0)}</p>
              </div>
              <hr />
              <div>
                <p className="text-gray-600">Total Bills</p>
                <p className="text-lg font-bold">{bills.length}</p>
              </div>
              <hr />
              <div>
                <p className="text-gray-600">Avg Bill Value</p>
                <p className="text-lg font-bold">
                  {bills.length > 0 ? (totalSales / bills.length).toFixed(0) : 0}
                </p>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card title="Recent Bills" className="lg:col-span-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Bill #</th>
                    <th className="text-left py-2">Retailer</th>
                    <th className="text-right py-2">Amount</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.slice(-5).reverse().map((bill) => (
                    <tr key={bill.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 font-mono text-xs">{bill.billNumber}</td>
                      <td className="py-2">{bill.retailerId}</td>
                      <td className="py-2 text-right font-semibold">₨{Number(bill.total).toFixed(0)}</td>
                      <td className="py-2 text-center">
                        <Badge variant={bill.status === 'paid' ? 'success' : 'warning'}>
                          {bill.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bills.length === 0 && (
                <p className="text-center text-gray-500 py-6">No bills yet</p>
              )}
            </div>
          </Card>
        </div>
      </PageContainer>
    </Layout>
  );
};
