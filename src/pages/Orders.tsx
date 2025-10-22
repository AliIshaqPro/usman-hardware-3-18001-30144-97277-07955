import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { salesApi } from "@/services/api";
import { OrderDetailsModal } from "@/components/orders/OrderDetailsModal";
import { PDFExportModal, ExportOptions } from "@/components/orders/PDFExportModal";
import { OrdersHeader } from "@/components/orders/OrdersHeader";
import { OrdersSummaryCards } from "@/components/orders/OrdersSummaryCards";
import { OrdersFilters } from "@/components/orders/OrdersFilters";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { useOrderPDFGenerator } from "@/components/orders/OrdersPDFGenerator";
import { generateOrdersReportPDF } from "@/utils/ordersReportPdfGenerator";

interface Sale {
  id: number;
  orderNumber: string;
  customerId: number | null;
  customerName: string | null;
  date: string;
  time: string;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

const Orders = () => {
  const { toast } = useToast();
  const { generateOrderPDF } = useOrderPDFGenerator();
  const [orders, setOrders] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0
  });
  
  const [selectedOrder, setSelectedOrder] = useState<Sale | null>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [isPDFExportModalOpen, setIsPDFExportModalOpen] = useState(false);

  // Items per page for server-side pagination
  const ITEMS_PER_PAGE = 20;
  // Cache full dataset for current filters during search to avoid repeated network calls
  const allSalesCacheRef = useRef<Sale[]>([]);
  const cacheKeyRef = useRef<string>("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      const len = searchTerm.trim().length;
      if (len === 0 || len >= 2) {
        setDebouncedSearchTerm(searchTerm);
        setCurrentPage(1); // Reset to page 1 when search changes
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchOrders();
  }, [filterStatus, filterCustomer, dateFrom, dateTo, currentPage, debouncedSearchTerm, filterPaymentMethod]);

  const fetchOrders = async () => {
    const term = debouncedSearchTerm.trim();
    const isSearching = term.length >= 2;
    const currentKey = `${filterStatus}|${filterPaymentMethod}|${dateFrom}|${dateTo}|${filterCustomer || ''}`;

    const shouldFetchFromNetwork = !isSearching || (cacheKeyRef.current !== currentKey || allSalesCacheRef.current.length === 0);

    try {
      if (shouldFetchFromNetwork) {
        setLoading(true);
      }

      // Build base filters
      const baseParams: any = {};
      if (filterStatus !== "all") baseParams.status = filterStatus;
      if (filterCustomer) baseParams.customerId = parseInt(filterCustomer);
      if (dateFrom) baseParams.dateFrom = dateFrom;
      if (dateTo) baseParams.dateTo = dateTo;
      if (filterPaymentMethod !== "all") baseParams.paymentMethod = filterPaymentMethod;

      // When not searching, use server pagination directly
      if (!isSearching) {
        const response = await salesApi.getAll({ ...baseParams, limit: ITEMS_PER_PAGE, page: currentPage });
        if (response.success) {
          const sales = response.data.sales || [];
          setOrders(sales);
          setTotalPages(response.data.pagination?.totalPages || 1);
          setSummary(response.data.summary || { totalSales: 0, totalOrders: 0, avgOrderValue: 0 });
          // Reset search cache for new filter scope
          allSalesCacheRef.current = [];
          cacheKeyRef.current = currentKey;
        }
        return;
      }

      // Searching: ensure full dataset for current filters is cached
      if (shouldFetchFromNetwork) {
        const response = await salesApi.getAll({ ...baseParams, limit: 10000, page: 1 });
        if (response.success) {
          allSalesCacheRef.current = response.data.sales || [];
          cacheKeyRef.current = currentKey;
        } else {
          allSalesCacheRef.current = [];
        }
      }

      // Client-side filter and paginate from cache
      const searchLower = term.toLowerCase();
      const filteredSales = (allSalesCacheRef.current || []).filter((sale: Sale) =>
        (sale.orderNumber?.toLowerCase().includes(searchLower)) ||
        (sale.customerName?.toLowerCase().includes(searchLower)) ||
        (sale.createdBy?.toLowerCase().includes(searchLower)) ||
        (sale.paymentMethod?.toLowerCase().includes(searchLower))
      );

      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const paginatedSales = filteredSales.slice(startIndex, endIndex);

      setOrders(paginatedSales);
      setTotalPages(Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE)));
      const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
      setSummary({ totalSales, totalOrders: filteredSales.length, avgOrderValue: filteredSales.length ? totalSales / filteredSales.length : 0 });
    } catch (error) {
      console.error('Error fetching orders:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load orders data";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      if (shouldFetchFromNetwork) setLoading(false);
    }
  };

  const handleViewOrder = (order: Sale) => {
    setSelectedOrder(order);
    setIsOrderDetailsOpen(true);
  };

  const handleOrderPDF = async (order: Sale) => {
    await generateOrderPDF(order);
  };


  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleAdvancedPDFExport = async (options: ExportOptions) => {
    try {
      setExportLoading(true);
      setIsPDFExportModalOpen(false);
      
      // Build query parameters based on options
      const params: any = { 
        limit: 10000,
        page: 1
      };

      // Add customer filtering
      if (options.customerScope === 'single' && options.selectedCustomers.length === 1) {
        params.customerId = options.selectedCustomers[0];
      } else if (options.customerScope === 'multiple' && options.selectedCustomers.length > 0) {
        params.customerIds = options.selectedCustomers.join(',');
      }

      // Add time filtering
      const now = new Date();
      let filterText = 'Filters Applied: ';
      
      if (options.customerScope === 'single') {
        filterText += 'Single Customer | ';
      } else if (options.customerScope === 'multiple') {
        filterText += `${options.selectedCustomers.length} Selected Customers | `;
      } else {
        filterText += 'All Customers | ';
      }
      
      switch (options.timeScope) {
        case 'today':
          params.dateFrom = now.toISOString().split('T')[0];
          params.dateTo = now.toISOString().split('T')[0];
          filterText += 'Today Only';
          break;
        case 'weekly':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          params.dateFrom = weekStart.toISOString().split('T')[0];
          params.dateTo = new Date().toISOString().split('T')[0];
          filterText += 'This Week';
          break;
        case 'monthly':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          params.dateFrom = monthStart.toISOString().split('T')[0];
          params.dateTo = new Date().toISOString().split('T')[0];
          filterText += 'This Month';
          break;
        case 'custom':
          if (options.startDate) params.dateFrom = options.startDate;
          if (options.endDate) params.dateTo = options.endDate;
          filterText += `${options.startDate} to ${options.endDate}`;
          break;
        default:
          filterText += 'All Time Period';
      }

      // Fetch filtered orders
      const response = await salesApi.getAll(params);
      
      if (response.success) {
        const filteredOrders = response.data.sales || response.data || [];
        
        // Calculate summary data
        const totalSales = filteredOrders.reduce((sum: number, order: Sale) => sum + (order.subtotal - order.discount), 0);
        const totalItems = filteredOrders.reduce((sum: number, order: Sale) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        const avgOrderValue = filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0;

        // Build report payload and generate PDF
        const reportData = {
          title: 'ORDERS EXPORT REPORT',
          orders: filteredOrders,
          exportDate: new Date().toLocaleString(),
          totalOrders: filteredOrders.length,
          totalSales: totalSales,
          totalItems: totalItems,
          avgOrderValue: avgOrderValue,
          filters: filterText
        };
        const filename = await generateOrdersReportPDF(reportData);

        toast({
          title: "PDF Export Successful",
          description: `Exported ${filteredOrders.length} orders to PDF.`,
        });
      }
    } catch (error) {
      console.error('Failed to export orders to PDF:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to export orders data to PDF. Please try again.";
      toast({
        title: "PDF Export Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6 space-y-6 min-h-screen bg-slate-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">Loading orders...</div>
        </div>
      </div>
    );
  }

  // Get unique customers for the export modal
  const uniqueCustomers = orders.reduce((acc: Array<{id: number, name: string}>, order) => {
    if (order.customerId && !acc.find(c => c.id === order.customerId)) {
      acc.push({
        id: order.customerId,
        name: order.customerName || `Customer #${order.customerId}`
      });
    }
    return acc;
  }, []);

  return (
    <div className="flex-1 p-2 md:p-6 space-y-3 min-h-[calc(100vh-65px)]">
      <OrdersHeader 
        onPDFExport={() => setIsPDFExportModalOpen(true)}
        exportLoading={exportLoading}
      />

      <OrdersSummaryCards summary={summary} />

      <Card className="border-slate-200">
        <CardContent>
          <OrdersFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterPaymentMethod={filterPaymentMethod}
            setFilterPaymentMethod={setFilterPaymentMethod}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            filterCustomer={filterCustomer}
            setFilterCustomer={setFilterCustomer}
          />

          <OrdersTable
            orders={orders}
            currentPage={currentPage}
            totalPages={totalPages}
            onViewOrder={handleViewOrder}
            onOrderPDF={handleOrderPDF}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <OrderDetailsModal
        open={isOrderDetailsOpen}
        onOpenChange={setIsOrderDetailsOpen}
        order={selectedOrder}
        onOrderUpdated={fetchOrders}
      />

      {/* PDF Export Modal */}
      <PDFExportModal
        open={isPDFExportModalOpen}
        onOpenChange={setIsPDFExportModalOpen}
        onExport={handleAdvancedPDFExport}
        customers={uniqueCustomers}
        isLoading={exportLoading}
      />
    </div>
  );
};

export default Orders;
