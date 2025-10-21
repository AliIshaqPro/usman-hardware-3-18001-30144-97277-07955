import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, Search, Plus, Users, AlertCircle, Phone, Mail, MapPin, DollarSign, History, MessageCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { customersApi } from "@/services/api";
import { useCustomerBalance } from "@/hooks/useCustomerBalance";
import { format } from "date-fns";

const Credits = () => {
  const { toast } = useToast();
  const { getCustomerBalance, recordManualPayment, getTransactionHistory, syncAllCustomerBalances } = useCustomerBalance();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersWithCredits, setCustomersWithCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false);
  const [isTransactionHistoryOpen, setIsTransactionHistoryOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState("");

  const fetchAllCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await customersApi.getAll({
        limit: 1000,
        status: 'active'
      });
      
      if (response.success) {
        const allCustomers = response.data?.customers || [];
        setCustomers(allCustomers);
        
        // Filter customers with credits (currentBalance > 0)
        const withCredits = allCustomers.filter((c: any) => (c.currentBalance || 0) > 0);
        setCustomersWithCredits(withCredits);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllCustomers();
  }, [fetchAllCustomers]);

  const handleAddCustomer = async (formData: any) => {
    try {
      const response = await customersApi.create(formData);
      
      if (response.success) {
        setIsAddCustomerOpen(false);
        fetchAllCustomers();
        toast({
          title: "Customer Added",
          description: "New customer has been added successfully.",
        });
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to add customer",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to add customer:', error);
      toast({
        title: "Error",
        description: "Failed to add customer",
        variant: "destructive"
      });
    }
  };

  const handleRecordPayment = async (customerId: number, amount: number, method: string, reference?: string) => {
    try {
      await recordManualPayment(customerId, amount, method, reference);
      fetchAllCustomers();
      setIsPaymentModalOpen(false);
      setSelectedCustomer(null);
    } catch (error) {
      console.error('Failed to record payment:', error);
    }
  };

  const handleRecordReceivable = async (customerId: number, amount: number, reason: string, reference?: string) => {
    try {
      // Record as negative payment to increase balance
      await recordManualPayment(customerId, -amount, 'credit', reference, reason);
      fetchAllCustomers();
      setIsReceivableModalOpen(false);
      setSelectedCustomer(null);
    } catch (error) {
      console.error('Failed to record receivable:', error);
    }
  };

  const handleViewHistory = async (customer: any) => {
    try {
      setSelectedCustomer(customer);
      const history = await getTransactionHistory(customer.id, 50, 0);
      setTransactions(history);
      setIsTransactionHistoryOpen(true);
    } catch (error) {
      console.error('Failed to fetch transaction history:', error);
    }
  };

  const handleSyncBalances = async () => {
    try {
      setIsSyncing(true);
      await syncAllCustomerBalances();
      await fetchAllCustomers();
    } catch (error) {
      console.error('Failed to sync balances:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendMessage = (customer: any) => {
    setSelectedCustomer(customer);
    setMessageText(`Dear ${customer.name}, your outstanding balance is PKR ${(customer.currentBalance || 0).toLocaleString()}. Please settle your dues at your earliest convenience. Thank you!`);
    setIsMessageModalOpen(true);
  };

  const handleSendWhatsApp = () => {
    if (!selectedCustomer?.phone) {
      toast({
        title: "No Phone Number",
        description: "Customer doesn't have a phone number registered.",
        variant: "destructive"
      });
      return;
    }

    const phone = selectedCustomer.phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(messageText);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    setIsMessageModalOpen(false);
    setSelectedCustomer(null);
  };

  // Filter logic
  const filteredCustomers = customersWithCredits.filter(customer => {
    const matchesSearch = !searchTerm || 
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCustomer = selectedCustomerId === "all" || customer.id.toString() === selectedCustomerId;
    
    return matchesSearch && matchesCustomer;
  });

  const totalCredits = customersWithCredits.reduce((sum, customer) => sum + (customer.currentBalance || 0), 0);

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-6 min-h-screen bg-background">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Loading credits...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-4 min-h-[calc(100vh-65px)] bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Credits</h1>
          <p className="text-muted-foreground">Manage and track customer outstanding balances</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSyncBalances}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Balances
          </Button>
          <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <CustomerDialog onSubmit={handleAddCustomer} onClose={() => setIsAddCustomerOpen(false)} />
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Credits</p>
                <p className="text-2xl font-bold text-red-600">PKR {totalCredits.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Customers with Credits</p>
                <p className="text-2xl font-bold text-orange-600">{customersWithCredits.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Average Credit</p>
                <p className="text-2xl font-bold text-blue-600">
                  PKR {customersWithCredits.length > 0 ? Math.round(totalCredits / customersWithCredits.length).toLocaleString() : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customersWithCredits.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id.toString()}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No customers with credits found</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{customer.name}</h3>
                        <Badge variant={customer.type === "Permanent" ? "default" : "secondary"} className="shrink-0">
                          {customer.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {customer.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{customer.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-muted-foreground">Outstanding</p>
                      <p className="text-lg font-bold text-red-600">PKR {(customer.currentBalance || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                      onClick={() => handleSendMessage(customer)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setIsPaymentModalOpen(true);
                      }}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Payment
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setIsReceivableModalOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Credit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewHistory(customer)}
                    >
                      <History className="h-4 w-4 mr-1" />
                      History
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedCustomer && (
        <>
          <PaymentModal
            customer={selectedCustomer}
            open={isPaymentModalOpen}
            onOpenChange={setIsPaymentModalOpen}
            onSubmit={handleRecordPayment}
          />
          <ReceivableModal
            customer={selectedCustomer}
            open={isReceivableModalOpen}
            onOpenChange={setIsReceivableModalOpen}
            onSubmit={handleRecordReceivable}
          />
          <TransactionHistoryModal
            customer={selectedCustomer}
            transactions={transactions}
            open={isTransactionHistoryOpen}
            onOpenChange={setIsTransactionHistoryOpen}
          />
        </>
      )}

      {/* Message Modal */}
      <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCustomer && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Sending to: <span className="font-semibold text-foreground">{selectedCustomer.name}</span>
                </p>
                {selectedCustomer.phone && (
                  <p className="text-sm text-muted-foreground">
                    Phone: <span className="font-semibold text-foreground">{selectedCustomer.phone}</span>
                  </p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={6}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsMessageModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleSendWhatsApp}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Send via WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Customer Dialog Component
const CustomerDialog = ({ onSubmit, onClose }: { onSubmit: (data: any) => void; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    name: "", 
    phone: "", 
    email: "", 
    address: "", 
    city: "",
    type: "Permanent",
    creditLimit: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      creditLimit: parseFloat(formData.creditLimit) || 0
    });
    setFormData({ 
      name: "", phone: "", email: "", address: "", city: "", type: "Permanent", creditLimit: "" 
    });
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add New Customer</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Customer Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="type">Customer Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Permanent">Permanent</SelectItem>
                <SelectItem value="Semi-Permanent">Semi-Permanent</SelectItem>
                <SelectItem value="Temporary">Temporary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="creditLimit">Credit Limit</Label>
            <Input
              id="creditLimit"
              type="number"
              value={formData.creditLimit}
              onChange={(e) => setFormData({...formData, creditLimit: e.target.value})}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            Add Customer
          </Button>
        </div>
      </form>
    </DialogContent>
  );
};

// Payment Modal Component
const PaymentModal = ({ 
  customer, 
  open, 
  onOpenChange, 
  onSubmit 
}: { 
  customer: any; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (customerId: number, amount: number, method: string, reference?: string) => void;
}) => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(customer.id, parseFloat(amount), method, reference);
    setAmount("");
    setReference("");
    setMethod("cash");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment - {customer.name}</DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Current Outstanding</p>
          <p className="text-2xl font-bold text-red-600">PKR {(customer.currentBalance || 0).toLocaleString()}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">Payment Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="Enter amount"
            />
          </div>
          <div>
            <Label htmlFor="method">Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="online">Online Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="reference">Reference (Optional)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction reference or note"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Receivable Modal Component
const ReceivableModal = ({ 
  customer, 
  open, 
  onOpenChange, 
  onSubmit 
}: { 
  customer: any; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (customerId: number, amount: number, reason: string, reference?: string) => void;
}) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(customer.id, parseFloat(amount), reason, reference);
    setAmount("");
    setReason("");
    setReference("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Credit/Receivable - {customer.name}</DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Current Outstanding</p>
          <p className="text-2xl font-bold text-red-600">PKR {(customer.currentBalance || 0).toLocaleString()}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="credit-amount">Credit Amount</Label>
            <Input
              id="credit-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="Enter amount to add"
            />
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Reason for credit (e.g., Purchase, Service charge)"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="credit-reference">Reference (Optional)</Label>
            <Input
              id="credit-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Invoice number or reference"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
              Add Credit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Transaction History Modal
const TransactionHistoryModal = ({ 
  customer, 
  transactions,
  open, 
  onOpenChange 
}: { 
  customer: any; 
  transactions: any[];
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Transaction History - {customer.name}</DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Current Outstanding</p>
          <p className="text-2xl font-bold text-red-600">PKR {(customer.currentBalance || 0).toLocaleString()}</p>
        </div>
        <div className="space-y-3 overflow-y-auto max-h-96">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions found</p>
          ) : (
            transactions.map((txn, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={txn.type === 'payment' ? 'default' : 'secondary'}>
                          {txn.type || 'Transaction'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {txn.createdAt ? format(new Date(txn.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                        </span>
                      </div>
                      {txn.notes && (
                        <p className="text-sm mt-2">{txn.notes}</p>
                      )}
                      {txn.reference && (
                        <p className="text-xs text-muted-foreground mt-1">Ref: {txn.reference}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${txn.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.amount > 0 ? '+' : ''}PKR {Math.abs(txn.amount || 0).toLocaleString()}
                      </p>
                      {txn.balanceAfter !== undefined && (
                        <p className="text-xs text-muted-foreground">Balance: PKR {txn.balanceAfter.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Credits;
