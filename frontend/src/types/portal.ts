export interface Portal {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PortalCreate {
  name: string;
}

export interface PortalUpdate {
  name?: string;
  is_active?: boolean;
}
