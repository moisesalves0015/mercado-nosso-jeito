import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../hooks/useAuth';

export interface OrderTimelineEvent {
  status: string;
  label: string;
  timestamp?: unknown;
  actor?: string;
  details?: string;
}

export interface OrderItemSummary {
  id?: string;
  title: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface AdminOrder {
  id: string;
  orderNumber?: string;
  uid: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'awaiting_confirmation' | 'on_delivery' | 'approved' | 'rejected';
  paymentMethod?: string;
  paymentReference?: string | null;
  paymentNote?: string;
  subtotal?: number;
  shippingFee?: number;
  discountValue?: number;
  couponCode?: string | null;
  total: number;
  deliveryMethod?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  paidAt?: unknown;
  confirmedBy?: string;
  cancelledBy?: string;
  cancellationReason?: string | null;
  items: OrderItemSummary[];
  timeline?: OrderTimelineEvent[];
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    condominio?: string;
    bloco?: string;
    apartamento?: string;
    referencia?: string;
    apelido?: string;
  };
}

export interface StockHistoryItem {
  delta: number;
  note: string;
  date: string;
  actorUid?: string;
}

export interface AdminProduct {
  id: string;
  title: string;
  price: number;
  costPrice?: number;
  oldPrice?: number;
  category: string;
  stock: number;
  minStock?: number;
  sku?: string;
  ean?: string;
  unit?: string;
  weight?: string;
  supplier?: string;
  location?: string;
  image: string;
  description?: string;
  active?: boolean;
  featured?: boolean;
  tags?: string;
  InternalNotes?: string;
  updatedAt?: string;
  stockHistory?: StockHistoryItem[];
}

export interface AdminClient {
  id: string;
  name: string;
  email: string;
  telefone?: string;
  cpf?: string;
  cpfMasked?: string | null;
  foto?: string;
  role: string;
  diamonds?: number;
  createdAt?: unknown;
  lastLogin?: unknown;
  bannedAt?: unknown;
  banReason?: string;
  firstOrderPlaced?: boolean;
}

export interface SupportTicketTimelineEvent {
  action: string;
  actorUid: string;
  actorRole?: string | null;
  note: string;
  internal?: boolean;
  createdAtMillis: number;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  uid: string;
  customerName: string;
  customerEmail?: string | null;
  subject: string;
  category: string;
  description: string;
  orderId?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'archived';
  assignedTo?: string | null;
  assignedName?: string | null;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  timeline?: SupportTicketTimelineEvent[];
}

export interface StoreSettings {
  pixKey: string;
  pixName: string;
  pixBank: string;
  storePhone: string;
  storeName?: string;
  supportHours?: string;
}

export interface ShippingSettings {
  freeShippingThreshold: number;
  baseShippingFee: number;
  condos: Record<string, number>;
}

interface AdminDataContextValue {
  orders: AdminOrder[];
  products: AdminProduct[];
  clients: AdminClient[];
  tickets: SupportTicket[];
  storeSettings: StoreSettings;
  shippingSettings: ShippingSettings;
  loading: boolean;
  dataError: string | null;
  ordersHasMore: boolean;
  customersHasMore: boolean;
  ticketsHasMore: boolean;
  refreshData: () => Promise<void>;
  loadMoreOrders: () => Promise<void>;
  loadMoreCustomers: () => Promise<void>;
  loadMoreTickets: () => Promise<void>;
  actionLoading: string | null;
  feedback: { msg: string; type: 'ok' | 'err' } | null;
  showToast: (msg: string, type?: 'ok' | 'err') => void;
  handleConfirmPayment: (orderId: string, paymentReference?: string, note?: string) => Promise<boolean>;
  handleUpdateOrderStatus: (orderId: string, status: string, note?: string) => Promise<boolean>;
  handleCancelOrder: (orderId: string, reason: string) => Promise<boolean>;
  handleGrantDiamonds: (targetUid: string, amount: number, reason: string) => Promise<boolean>;
  handleBanUser: (targetUid: string, reason: string) => Promise<boolean>;
  handleAdjustStock: (productId: string, delta: number, reason: string, minStock?: number) => Promise<boolean>;
  handleArchiveProduct: (productId: string, reason: string) => Promise<boolean>;
  handleToggleProductActive: (product: AdminProduct) => Promise<boolean>;
  handleCreateTicket: (payload: {
    uid?: string;
    subject: string;
    category: string;
    description: string;
    orderId?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }) => Promise<{ ticketId: string; ticketNumber: string } | null>;
  handleUpdateTicket: (payload: {
    ticketId: string;
    status?: SupportTicket['status'];
    priority?: SupportTicket['priority'];
    assignedTo?: string | null;
    assignedName?: string | null;
    note?: string;
    internal?: boolean;
  }) => Promise<boolean>;
  saveStoreSettings: (next: StoreSettings) => Promise<boolean>;
  saveShippingSettings: (next: ShippingSettings) => Promise<boolean>;
}

const AdminDataContext = createContext<AdminDataContextValue | undefined>(undefined);

export const AdminDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, staffAccess, canAny } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ordersCursor, setOrdersCursor] = useState<number | null>(null);
  const [customersCursor, setCustomersCursor] = useState<string | null>(null);
  const [ticketsCursor, setTicketsCursor] = useState<number | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    pixKey: '',
    pixName: '',
    pixBank: '',
    storePhone: '',
    storeName: 'Mercado Nosso Jeito',
    supportHours: 'Seg a Sáb • 08h às 22h',
  });
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>({
    freeShippingThreshold: 100,
    baseShippingFee: 10,
    condos: {},
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setFeedback({ msg, type });
    setTimeout(() => {
      setFeedback((prev) => (prev?.msg === msg ? null : prev));
    }, 4500);
  }, []);

  const canReadOrders = canAny(['pedidos:view', 'financeiro:view', 'suporte:view']);
  const canReadProducts = canAny(['produtos:view', 'estoque:view']);
  const canReadCustomers = canAny(['clientes:view', 'crm:view', 'suporte:view']);
  const canReadTickets = canAny(['suporte:view']);

  const refreshData = useCallback(async () => {
    if (!user || !staffAccess?.isStaff) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setDataError(null);
    try {
      const tasks: Array<Promise<void>> = [];

      if (canReadOrders) {
        const fn = httpsCallable<{ limit: number }, { orders: AdminOrder[]; nextCursor: number | null }>(
          functions,
          'adminListOrders',
        );
        tasks.push(
          fn({ limit: 50 }).then((res) => {
            setOrders(res.data.orders || []);
            setOrdersCursor(res.data.nextCursor ?? null);
          }),
        );
      } else {
        setOrders([]);
        setOrdersCursor(null);
      }

      if (canReadProducts) {
        const fn = httpsCallable<{ limit: number }, { products: AdminProduct[]; nextCursor: string | null }>(
          functions,
          'adminListProducts',
        );
        tasks.push(
          fn({ limit: 150 }).then((res) => {
            setProducts(res.data.products || []);
          }),
        );
      } else {
        setProducts([]);
      }

      if (canReadCustomers) {
        const fn = httpsCallable<{ limit: number }, { customers: AdminClient[]; nextCursor: string | null }>(
          functions,
          'adminListCustomers',
        );
        tasks.push(
          fn({ limit: 50 }).then((res) => {
            setClients(res.data.customers || []);
            setCustomersCursor(res.data.nextCursor ?? null);
          }),
        );
      } else {
        setClients([]);
        setCustomersCursor(null);
      }

      if (canReadTickets) {
        const fn = httpsCallable<{ limit: number }, { tickets: SupportTicket[]; nextCursor: number | null }>(
          functions,
          'adminListTickets',
        );
        tasks.push(
          fn({ limit: 50 }).then((res) => {
            setTickets(res.data.tickets || []);
            setTicketsCursor(res.data.nextCursor ?? null);
          }),
        );
      } else {
        setTickets([]);
        setTicketsCursor(null);
      }

      await Promise.all(tasks);
    } catch (err: unknown) {
      setDataError((err as { message?: string })?.message || 'Erro ao carregar dados operacionais.');
    } finally {
      setLoading(false);
    }
  }, [user, staffAccess?.isStaff, canReadOrders, canReadProducts, canReadCustomers, canReadTickets]);

  const loadMoreOrders = useCallback(async () => {
    if (!ordersCursor || !canReadOrders) return;
    const fn = httpsCallable<
      { limit: number; startAfterMillis: number },
      { orders: AdminOrder[]; nextCursor: number | null }
    >(functions, 'adminListOrders');
    const res = await fn({ limit: 50, startAfterMillis: ordersCursor });
    setOrders((prev) => [...prev, ...(res.data.orders || [])]);
    setOrdersCursor(res.data.nextCursor ?? null);
  }, [ordersCursor, canReadOrders]);

  const loadMoreCustomers = useCallback(async () => {
    if (!customersCursor || !canReadCustomers) return;
    const fn = httpsCallable<
      { limit: number; startAfterId: string },
      { customers: AdminClient[]; nextCursor: string | null }
    >(functions, 'adminListCustomers');
    const res = await fn({ limit: 50, startAfterId: customersCursor });
    setClients((prev) => [...prev, ...(res.data.customers || [])]);
    setCustomersCursor(res.data.nextCursor ?? null);
  }, [customersCursor, canReadCustomers]);

  const loadMoreTickets = useCallback(async () => {
    if (!ticketsCursor || !canReadTickets) return;
    const fn = httpsCallable<
      { limit: number; startAfterMillis: number },
      { tickets: SupportTicket[]; nextCursor: number | null }
    >(functions, 'adminListTickets');
    const res = await fn({ limit: 50, startAfterMillis: ticketsCursor });
    setTickets((prev) => [...prev, ...(res.data.tickets || [])]);
    setTicketsCursor(res.data.nextCursor ?? null);
  }, [ticketsCursor, canReadTickets]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refreshData();
    });

    getDoc(doc(db, 'settings', 'store'))
      .then((snap) => {
        if (snap.exists()) {
          setStoreSettings((prev) => ({ ...prev, ...(snap.data() as Partial<StoreSettings>) }));
        }
      })
      .catch(() => {});

    getDoc(doc(db, 'settings', 'shipping'))
      .then((snap) => {
        if (snap.exists()) {
          setShippingSettings((prev) => ({ ...prev, ...(snap.data() as Partial<ShippingSettings>) }));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user, refreshData]);

  const handleConfirmPayment = useCallback(
    async (orderId: string, paymentReference?: string, note?: string): Promise<boolean> => {
      setActionLoading(`pay-${orderId}`);
      try {
        const fn = httpsCallable(functions, 'confirmPayment');
        await fn({ orderId, paymentMethod: 'Pix (Conciliado)', paymentReference, note });
        showToast('Pagamento confirmado com sucesso!', 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao confirmar pagamento.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const handleUpdateOrderStatus = useCallback(
    async (orderId: string, status: string, note?: string): Promise<boolean> => {
      setActionLoading(`status-${orderId}`);
      try {
        const fn = httpsCallable(functions, 'updateOrderStatus');
        await fn({ orderId, status, note });
        showToast(`Status do pedido atualizado para "${status}"!`, 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao atualizar status.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const handleCancelOrder = useCallback(
    async (orderId: string, reason: string): Promise<boolean> => {
      setActionLoading(`cancel-${orderId}`);
      try {
        const fn = httpsCallable(functions, 'cancelOrder');
        await fn({ orderId, reason });
        showToast('Pedido cancelado e estoque estornado com sucesso!', 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao cancelar pedido.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const handleGrantDiamonds = useCallback(
    async (targetUid: string, amount: number, reason: string): Promise<boolean> => {
      setActionLoading(`diamonds-${targetUid}`);
      try {
        const fn = httpsCallable(functions, 'adminGrantDiamonds');
        await fn({
          targetUid,
          amount,
          reason,
          idempotencyKey: `grant_${targetUid}_${Date.now()}`,
        });
        showToast(`${amount > 0 ? `+${amount}` : amount} diamantes aplicados com sucesso!`, 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao ajustar diamantes.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const handleBanUser = useCallback(
    async (targetUid: string, reason: string): Promise<boolean> => {
      setActionLoading(`ban-${targetUid}`);
      try {
        const fn = httpsCallable(functions, 'adminBanUser');
        await fn({ targetUid, reason });
        showToast('Conta suspensa e auditada com sucesso.', 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao suspender conta.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const handleAdjustStock = useCallback(
    async (productId: string, delta: number, reason: string, minStock?: number): Promise<boolean> => {
      setActionLoading(`stock-${productId}`);
      try {
        const fn = httpsCallable(functions, 'adminAdjustStock');
        await fn({ productId, delta, reason, minStock });
        showToast(`Estoque ajustado (${delta > 0 ? `+${delta}` : delta} un.) com auditoria!`, 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao ajustar estoque.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const handleArchiveProduct = useCallback(
    async (productId: string, reason: string): Promise<boolean> => {
      setActionLoading(`archive-${productId}`);
      try {
        const fn = httpsCallable(functions, 'adminArchiveProduct');
        await fn({ productId, reason });
        showToast('Produto arquivado e ocultado do catálogo.', 'ok');
        await refreshData();
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao arquivar produto.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast, refreshData],
  );

  const handleToggleProductActive = useCallback(
    async (product: AdminProduct): Promise<boolean> => {
      setActionLoading(`toggle-${product.id}`);
      try {
        const nextActive = !(product.active ?? true);
        const fn = httpsCallable(functions, 'adminToggleProductActive');
        await fn({ productId: product.id, active: nextActive });
        showToast(
          nextActive ? 'Produto ativado no catálogo!' : 'Produto pausado no catálogo.',
          'ok',
        );
        await refreshData();
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao alterar visibilidade.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast, refreshData],
  );

  const handleCreateTicket = useCallback(
    async (payload: {
      uid?: string;
      subject: string;
      category: string;
      description: string;
      orderId?: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
    }): Promise<{ ticketId: string; ticketNumber: string } | null> => {
      setActionLoading('ticket-create');
      try {
        const fn = httpsCallable<
          typeof payload,
          { success: boolean; ticketId: string; ticketNumber: string }
        >(functions, 'adminCreateSupportTicket');
        const res = await fn(payload);
        showToast(`Chamado ${res.data.ticketNumber} registrado com sucesso!`, 'ok');
        return { ticketId: res.data.ticketId, ticketNumber: res.data.ticketNumber };
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao abrir chamado.', 'err');
        return null;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const handleUpdateTicket = useCallback(
    async (payload: {
      ticketId: string;
      status?: SupportTicket['status'];
      priority?: SupportTicket['priority'];
      assignedTo?: string | null;
      assignedName?: string | null;
      note?: string;
      internal?: boolean;
    }): Promise<boolean> => {
      setActionLoading(`ticket-${payload.ticketId}`);
      try {
        const fn = httpsCallable(functions, 'adminUpdateSupportTicket');
        await fn(payload);
        showToast('Chamado atualizado e registrado na auditoria!', 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao atualizar chamado.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const saveStoreSettings = useCallback(
    async (next: StoreSettings): Promise<boolean> => {
      setActionLoading('save-store');
      try {
        const fn = httpsCallable(functions, 'adminUpdateSettings');
        await fn({ settingId: 'store', payload: next });
        setStoreSettings(next);
        showToast('Configurações de recebimento e contato salvas!', 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao salvar configurações.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const saveShippingSettings = useCallback(
    async (next: ShippingSettings): Promise<boolean> => {
      setActionLoading('save-shipping');
      try {
        const fn = httpsCallable(functions, 'adminUpdateSettings');
        await fn({ settingId: 'shipping', payload: next });
        setShippingSettings(next);
        showToast('Regras de frete por condomínio salvas!', 'ok');
        return true;
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Erro ao salvar frete.', 'err');
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  return (
    <AdminDataContext.Provider
      value={{
        orders,
        products,
        clients,
        tickets,
        storeSettings,
        shippingSettings,
        loading,
        dataError,
        ordersHasMore: Boolean(ordersCursor),
        customersHasMore: Boolean(customersCursor),
        ticketsHasMore: Boolean(ticketsCursor),
        refreshData,
        loadMoreOrders,
        loadMoreCustomers,
        loadMoreTickets,
        actionLoading,
        feedback,
        showToast,
        handleConfirmPayment,
        handleUpdateOrderStatus,
        handleCancelOrder,
        handleGrantDiamonds,
        handleBanUser,
        handleAdjustStock,
        handleArchiveProduct,
        handleToggleProductActive,
        handleCreateTicket,
        handleUpdateTicket,
        saveStoreSettings,
        saveShippingSettings,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminData = (): AdminDataContextValue => {
  const ctx = useContext(AdminDataContext);
  if (!ctx) {
    throw new Error('useAdminData must be used inside AdminDataProvider');
  }
  return ctx;
};
