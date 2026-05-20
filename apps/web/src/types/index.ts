export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'OPERATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  clientId?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  nif?: string;
  email?: string;
  phone?: string;
  address?: string;
  sector?: string;
  active: boolean;
  createdAt: string;
}

export interface Area {
  id: string;
  name: string;
  description?: string;
  floor?: string;
  clientId: string;
  active: boolean;
}

export interface ChecklistTask {
  id: string;
  description: string;
  order: number;
  templateId: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  areaId: string;
  active: boolean;
  isDefault: boolean;
  tasks?: ChecklistTask[];
}

export interface ChecklistEntry {
  id: string;
  completedAt: string;
  notes?: string;
  templateId: string;
  areaId: string;
  operatorId: string;
  operator?: User;
  area?: Area;
}

export type AnomalyStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AnomalyPhoto {
  id: string;
  url: string;
  filename: string;
}

export type HigienizacaoZona = 'COZINHA' | 'PRODUCAO' | 'ARMAZEM' | 'SERVICO';

export const zonaLabel: Record<HigienizacaoZona, string> = {
  COZINHA: 'Cozinha',
  PRODUCAO: 'Produção',
  ARMAZEM: 'Armazém',
  SERVICO: 'Serviço',
};

export interface AnomalyReport {
  id: string;
  title: string;
  description: string;
  status: AnomalyStatus;
  severity: AnomalySeverity;
  zona?: HigienizacaoZona;
  clientId: string;
  areaId?: string;
  area?: Area;
  reporterId: string;
  reporter?: User;
  photos?: AnomalyPhoto[];
  resolvedAt?: string;
  resolvedNote?: string;
  createdAt: string;
}

export interface ZonaConfig {
  id: string;
  zona: HigienizacaoZona;
  itens: { key: string; label: string; period: string }[];
  clientId: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unit: string;
  category?: string;
  price?: number;
  active: boolean;
}

export interface ConsumableStock {
  id: string;
  quantity: number;
  minQuantity: number;
  clientId: string;
  productId: string;
  product?: Product;
}

export type ConsumableStatus = 'OPEN' | 'ORDERED' | 'RESOLVED';

export interface ConsumableReport {
  id: string;
  quantity?: number;
  notes?: string;
  status: ConsumableStatus;
  stockId: string;
  reporterId: string;
  createdAt: string;
}

export type OrderStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice?: number;
  productId: string;
  product?: Product;
}

export interface Order {
  id: string;
  status: OrderStatus;
  notes?: string;
  totalAmount?: number;
  clientId: string;
  client?: Client;
  items?: OrderItem[];
  createdAt: string;
  deliveredAt?: string;
}

// Aliases para compatibilidade com páginas geradas
export type Anomaly = AnomalyReport;
export type ChecklistExecution = ChecklistEntry;
export type Consumable = ConsumableStock;

export interface DashboardStats {
  totalClients: number;
  totalAreas: number;
  openAnomalies: number;
  pendingOrders: number;
  lowStockAlerts: number;
  checklistsThisMonth: number;
  consumableShortagCount: number;
}

export interface OrderSuggestion {
  productId: string;
  productName: string;
  unit: string;
  mediaMensal: number;
  stockAtual: number;
  quantidadeSugerida: number;
}
