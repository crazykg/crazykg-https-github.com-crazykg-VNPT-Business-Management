import type { ContractStatusBreakdown, ExpiringContractSummary, MonthlyRevenueComparison } from './contract';
import type { ProjectStatusBreakdown } from './project';

export interface DashboardStats {
  totalRevenue: number;
  actualRevenue: number;
  forecastRevenueMonth: number;
  forecastRevenueQuarter: number;
  monthlyRevenueComparison: MonthlyRevenueComparison[];
  projectStatusCounts: ProjectStatusBreakdown[];
  contractStatusCounts: ContractStatusBreakdown[];
  collectionRate: number;
  overduePaymentCount: number;
  overduePaymentAmount: number;
  expiringContracts: ExpiringContractSummary[];
}
