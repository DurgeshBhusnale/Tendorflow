export interface TenderName {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface TenderNameCreate {
  name: string;
}

export interface TenderNameUpdate {
  name?: string;
  is_active?: boolean;
}
