import { USER_ROLES, type UserRole } from './types';

export const USER_ROLES_ARRAY = USER_ROLES;

export function homePathForRole(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/app/admin/analytics';
    case 'INSTITUTE_ADMIN':
      return '/app/dashboard';
    case 'RECEPTIONIST':
      return '/app/dashboard';
    case 'TEACHER':
      return '/app/teacher';
    default:
      return '/app/dashboard';
  }
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'INSTITUTE_ADMIN':
      return 'Institute Admin';
    case 'RECEPTIONIST':
      return 'Receptionist';
    case 'TEACHER':
      return 'Teacher';
    default:
      return role;
  }
}

export function roleBadgeClasses(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-purple-100 text-purple-800 ring-purple-200';
    case 'INSTITUTE_ADMIN':
      return 'bg-blue-100 text-blue-800 ring-blue-200';
    case 'RECEPTIONIST':
      return 'bg-amber-100 text-amber-800 ring-amber-200';
    case 'TEACHER':
      return 'bg-green-100 text-green-800 ring-green-200';
    default:
      return 'bg-slate-100 text-slate-800 ring-slate-200';
  }
}

export function isAdminRole(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'INSTITUTE_ADMIN' || role === 'RECEPTIONIST';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}