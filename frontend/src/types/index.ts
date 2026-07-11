export interface CalculationResult {
  bricks: number;
  cement: number;
  sand: number;
  storeys: number;
}

export interface StatItem {
  label: string;
  value: number;
  icon: 'FolderOpen' | 'Globe' | 'Target' | 'Bot';
  accent: string;
}

export interface AuthFormData {
  name?: string;
  phone: string;
  password: string;
}

export interface NavLink {
  id: 'home' | 'projects' | 'new-project';
  label: string;
}
