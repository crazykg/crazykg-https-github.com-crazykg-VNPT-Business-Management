import React from 'react';
import { Department, Employee, HRStatistics, ModalType } from '../types';
import { EmployeeList } from './EmployeeList';

interface InternalUserListProps {
  employees: Employee[];
  departments?: Department[];
  onOpenModal: (type: ModalType, item?: Employee) => void;
  hrStatistics?: HRStatistics;
}

export const InternalUserList: React.FC<InternalUserListProps> = (props) => {
  return <EmployeeList {...props} />;
};
