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

export interface AnomalyReport {
  id: string;
  title: string;
  description: string;
  status: AnomalyStatus;
  severity: AnomalySeverity;
  areaId: string;
  area?: Area;
  reporterId: string;
  reporter?: User;
  photos?: AnomalyPhoto[];
  resolvedAt?: string;
  resolvedNote?: string;
  createdAt: string;
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

// Aliases para compatibilidade com páginas geradas
export type Anomaly = AnomalyReport;
export type ChecklistExecution = ChecklistEntry;
export type Consumable = ConsumableStock;

export interface DashboardStats {
  totalClients: number;
  totalAreas: number;
  openAnomalies: number;
  openShortageReports: number;
  checklistsThisMonth: number;
}
