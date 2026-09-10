export interface TenderDepartment {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface TenderDepartmentCreate {
  name: string;
}

export interface TenderDepartmentUpdate {
  name?: string;
  is_active?: boolean;
}
