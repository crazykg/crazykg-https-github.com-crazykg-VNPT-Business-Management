import { Contract, Customer, Department, Employee, Opportunity, Project, Vendor } from '../types';

type ApiListResponse<T> = {
  data?: T[];
};

type ApiItemResponse<T> = {
  data?: T;
};

const JSON_ACCEPT_HEADER = { Accept: 'application/json' };
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

const parseJson = async <T>(res: Response): Promise<ApiListResponse<T>> => {
  if (!res.ok) {
    return { data: [] };
  }

  const payload = await res.json();
  return payload as ApiListResponse<T>;
};

const parseErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const payload = await res.json();
    if (payload?.message) {
      return `${fallback} (${payload.message})`;
    }
  } catch {
    // Ignore parsing error.
  }

  return `${fallback} (HTTP ${res.status})`;
};

const parseItemJson = async <T>(res: Response): Promise<T> => {
  const payload = (await res.json()) as ApiItemResponse<T>;
  return payload.data as T;
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};

const normalizeNumber = (value: unknown, fallback = 0): number => {
  const normalized = normalizeNullableNumber(value);
  return normalized ?? fallback;
};

export const fetchV5MasterData = async () => {
  const requests = await Promise.allSettled([
    fetch('/api/v5/departments', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/employees', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/customers', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/vendors', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/projects', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/contracts', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/opportunities', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
  ]);

  const [departmentsRes, employeesRes, customersRes, vendorsRes, projectsRes, contractsRes, opportunitiesRes] = requests;

  const departments = departmentsRes.status === 'fulfilled' ? await parseJson<Department>(departmentsRes.value) : { data: [] };
  const employees = employeesRes.status === 'fulfilled' ? await parseJson<Employee>(employeesRes.value) : { data: [] };
  const customers = customersRes.status === 'fulfilled' ? await parseJson<Customer>(customersRes.value) : { data: [] };
  const vendors = vendorsRes.status === 'fulfilled' ? await parseJson<Vendor>(vendorsRes.value) : { data: [] };
  const projects = projectsRes.status === 'fulfilled' ? await parseJson<Project>(projectsRes.value) : { data: [] };
  const contracts = contractsRes.status === 'fulfilled' ? await parseJson<Contract>(contractsRes.value) : { data: [] };
  const opportunities = opportunitiesRes.status === 'fulfilled' ? await parseJson<Opportunity>(opportunitiesRes.value) : { data: [] };

  return {
    departments: departments.data ?? [],
    employees: employees.data ?? [],
    customers: customers.data ?? [],
    vendors: vendors.data ?? [],
    projects: projects.data ?? [],
    contracts: contracts.data ?? [],
    opportunities: opportunities.data ?? [],
  };
};

export const createDepartment = async (payload: Partial<Department>): Promise<Department> => {
  const res = await fetch('/api/v5/departments', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      dept_code: payload.dept_code,
      dept_name: payload.dept_name,
      parent_id: normalizeNullableNumber(payload.parent_id),
      is_active: payload.is_active ?? true,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_DEPARTMENT_FAILED'));
  }

  return parseItemJson<Department>(res);
};

export const updateDepartment = async (id: string | number, payload: Partial<Department>): Promise<Department> => {
  const res = await fetch(`/api/v5/departments/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      dept_code: payload.dept_code,
      dept_name: payload.dept_name,
      parent_id: normalizeNullableNumber(payload.parent_id),
      is_active: payload.is_active,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_DEPARTMENT_FAILED'));
  }

  return parseItemJson<Department>(res);
};

export const deleteDepartment = async (id: string | number): Promise<void> => {
  const res = await fetch(`/api/v5/departments/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DEPARTMENT_FAILED'));
  }
};

export const createEmployee = async (payload: Partial<Employee>): Promise<Employee> => {
  const res = await fetch('/api/v5/employees', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      username: payload.username || String(payload.id || ''),
      full_name: payload.full_name,
      email: payload.email,
      status: payload.status || 'ACTIVE',
      department_id: normalizeNullableNumber(payload.department_id),
      position_id: normalizeNullableNumber(payload.position_id),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_EMPLOYEE_FAILED'));
  }

  return parseItemJson<Employee>(res);
};

export const updateEmployee = async (id: string | number, payload: Partial<Employee>): Promise<Employee> => {
  const res = await fetch(`/api/v5/employees/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      username: payload.username,
      full_name: payload.full_name,
      email: payload.email,
      status: payload.status,
      department_id: normalizeNullableNumber(payload.department_id),
      position_id: normalizeNullableNumber(payload.position_id),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_EMPLOYEE_FAILED'));
  }

  return parseItemJson<Employee>(res);
};

export const deleteEmployee = async (id: string | number): Promise<void> => {
  const res = await fetch(`/api/v5/employees/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_EMPLOYEE_FAILED'));
  }
};

export const createCustomer = async (payload: Partial<Customer>): Promise<Customer> => {
  const res = await fetch('/api/v5/customers', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      customer_code: payload.customer_code,
      customer_name: payload.customer_name,
      tax_code: payload.tax_code,
      address: payload.address,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CUSTOMER_FAILED'));
  }

  return parseItemJson<Customer>(res);
};

export const updateCustomer = async (id: string | number, payload: Partial<Customer>): Promise<Customer> => {
  const res = await fetch(`/api/v5/customers/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      customer_code: payload.customer_code,
      customer_name: payload.customer_name,
      tax_code: payload.tax_code,
      address: payload.address,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CUSTOMER_FAILED'));
  }

  return parseItemJson<Customer>(res);
};

export const deleteCustomer = async (id: string | number): Promise<void> => {
  const res = await fetch(`/api/v5/customers/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CUSTOMER_FAILED'));
  }
};

export const createVendor = async (payload: Partial<Vendor>): Promise<Vendor> => {
  const res = await fetch('/api/v5/vendors', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      vendor_code: payload.vendor_code,
      vendor_name: payload.vendor_name,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_VENDOR_FAILED'));
  }

  return parseItemJson<Vendor>(res);
};

export const updateVendor = async (id: string | number, payload: Partial<Vendor>): Promise<Vendor> => {
  const res = await fetch(`/api/v5/vendors/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      vendor_code: payload.vendor_code,
      vendor_name: payload.vendor_name,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_VENDOR_FAILED'));
  }

  return parseItemJson<Vendor>(res);
};

export const deleteVendor = async (id: string | number): Promise<void> => {
  const res = await fetch(`/api/v5/vendors/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_VENDOR_FAILED'));
  }
};

export const createOpportunity = async (payload: Partial<Opportunity>): Promise<Opportunity> => {
  const res = await fetch('/api/v5/opportunities', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      opp_name: payload.opp_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      amount: normalizeNumber(payload.amount, 0),
      stage: payload.stage || 'NEW',
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_OPPORTUNITY_FAILED'));
  }

  return parseItemJson<Opportunity>(res);
};

export const updateOpportunity = async (id: string | number, payload: Partial<Opportunity>): Promise<Opportunity> => {
  const res = await fetch(`/api/v5/opportunities/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      opp_name: payload.opp_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      amount: normalizeNumber(payload.amount, 0),
      stage: payload.stage,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_OPPORTUNITY_FAILED'));
  }

  return parseItemJson<Opportunity>(res);
};

export const deleteOpportunity = async (id: string | number): Promise<void> => {
  const res = await fetch(`/api/v5/opportunities/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_OPPORTUNITY_FAILED'));
  }
};

export const createProject = async (payload: Partial<Project> & Record<string, unknown>): Promise<Project> => {
  const res = await fetch('/api/v5/projects', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      project_code: payload.project_code,
      project_name: payload.project_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      status: payload.status || 'PLANNING',
      opportunity_id: normalizeNullableNumber(payload.opportunity_id),
      investment_mode: payload.investment_mode,
      start_date: payload.start_date,
      expected_end_date: payload.expected_end_date,
      actual_end_date: payload.actual_end_date,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROJECT_FAILED'));
  }

  return parseItemJson<Project>(res);
};

export const updateProject = async (id: string | number, payload: Partial<Project> & Record<string, unknown>): Promise<Project> => {
  const res = await fetch(`/api/v5/projects/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      project_code: payload.project_code,
      project_name: payload.project_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      status: payload.status,
      opportunity_id: normalizeNullableNumber(payload.opportunity_id),
      investment_mode: payload.investment_mode,
      start_date: payload.start_date,
      expected_end_date: payload.expected_end_date,
      actual_end_date: payload.actual_end_date,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROJECT_FAILED'));
  }

  return parseItemJson<Project>(res);
};

export const deleteProject = async (id: string | number): Promise<void> => {
  const res = await fetch(`/api/v5/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PROJECT_FAILED'));
  }
};

export const createContract = async (payload: Partial<Contract> & Record<string, unknown>): Promise<Contract> => {
  const res = await fetch('/api/v5/contracts', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      contract_code: payload.contract_code,
      contract_name: payload.contract_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      project_id: normalizeNullableNumber(payload.project_id),
      value: normalizeNumber(payload.value, 0),
      status: payload.status || 'DRAFT',
      sign_date: payload.sign_date,
      expiry_date: payload.expiry_date,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CONTRACT_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const updateContract = async (id: string | number, payload: Partial<Contract> & Record<string, unknown>): Promise<Contract> => {
  const res = await fetch(`/api/v5/contracts/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      contract_code: payload.contract_code,
      contract_name: payload.contract_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      project_id: normalizeNullableNumber(payload.project_id),
      value: normalizeNumber(payload.value, 0),
      status: payload.status,
      sign_date: payload.sign_date,
      expiry_date: payload.expiry_date,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CONTRACT_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const deleteContract = async (id: string | number): Promise<void> => {
  const res = await fetch(`/api/v5/contracts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CONTRACT_FAILED'));
  }
};
