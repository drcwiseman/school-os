import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export type TenantModules = { messaging_enabled: boolean; portal_enabled: boolean };

interface AuthContextType {
  user: User | null;
  permissions: string[];
  roles: { id: string; name: string }[];
  modules: TenantModules;
  impersonationReadOnly: boolean;
  loading: boolean;
  schoolSlug: string | null;
  setAuth: (
    user: User | null,
    slug: string | null,
    permissions?: string[],
    roles?: { id: string; name: string }[],
    modules?: TenantModules,
  ) => void;
  hasPermission: (code: string) => boolean;
  moduleEnabled: (key: keyof TenantModules) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [schoolSlug, setSchoolSlug] = useState<string | null>(null);
  const [modules, setModules] = useState<TenantModules>({ messaging_enabled: true, portal_enabled: true });
  const [impersonationReadOnly, setImpersonationReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract slug from URL if present (e.g. /s/school-a/...)
    const match = window.location.pathname.match(/^\/s\/([^\/]+)/);
    const slug = match ? match[1] : null;
    
    if (slug) {
      setSchoolSlug(slug);
      api.get(`/s/${slug}/api/auth/me`)
        .then((res) => {
          if (res.success && res.user) {
            setUser(res.user);
            setPermissions(res.permissions || []);
            setRoles(res.roles || []);
            if (res.modules) setModules(res.modules);
            setImpersonationReadOnly(Boolean(res.impersonation?.readOnly));
          }
        })
        .catch(() => {
          setUser(null);
          setImpersonationReadOnly(false);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const setAuth = (
    newUser: User | null,
    slug: string | null,
    perms: string[] = [],
    userRoles: { id: string; name: string }[] = [],
    mods?: TenantModules,
  ) => {
    setUser(newUser);
    setSchoolSlug(slug);
    setPermissions(perms);
    setRoles(userRoles);
    if (mods) setModules(mods);
  };

  const hasPermission = (code: string) => permissions.includes(code);
  const moduleEnabled = (key: keyof TenantModules) => modules[key] !== false;

  const logout = async () => {
    if (schoolSlug) {
      await api.post(`/s/${schoolSlug}/api/auth/logout`);
    }
    setUser(null);
    window.location.href = schoolSlug ? `/s/${schoolSlug}/login` : "/";
  };

  return (
    <AuthContext.Provider value={{ user, permissions, roles, modules, impersonationReadOnly, loading, schoolSlug, setAuth, hasPermission, moduleEnabled, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
