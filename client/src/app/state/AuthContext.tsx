import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export type TenantModules = Record<string, boolean>;

type SetAuthOptions = { readOnly?: boolean };

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
    options?: SetAuthOptions,
  ) => void;
  hasPermission: (code: string) => boolean;
  moduleEnabled: (featureCode: string) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [schoolSlug, setSchoolSlug] = useState<string | null>(null);
  const [modules, setModules] = useState<TenantModules>({});
  const [impersonationReadOnly, setImpersonationReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const match = location.pathname.match(/^\/s\/([^/]+)/);
    const slug = match ? match[1] : null;
    const isImpersonateRoute = /\/impersonate/.test(location.pathname);

    if (!slug) {
      setLoading(false);
      return;
    }

    setSchoolSlug(slug);

    if (isImpersonateRoute) {
      setLoading(false);
      return;
    }

    api
      .get(`/s/${slug}/api/auth/me`)
      .then((res) => {
        if (res.success && res.user) {
          setUser(res.user);
          setPermissions(res.permissions || []);
          setRoles(res.roles || []);
          if (res.modules) setModules(res.modules);
          setImpersonationReadOnly(Boolean(res.impersonation?.readOnly));
        } else {
          setUser(null);
          setImpersonationReadOnly(false);
        }
      })
      .catch(() => {
        setUser(null);
        setImpersonationReadOnly(false);
      })
      .finally(() => setLoading(false));
  }, [location.pathname]);

  const setAuth = (
    newUser: User | null,
    slug: string | null,
    perms: string[] = [],
    userRoles: { id: string; name: string }[] = [],
    mods?: TenantModules,
    options?: SetAuthOptions,
  ) => {
    setUser(newUser);
    setSchoolSlug(slug);
    setPermissions(perms);
    setRoles(userRoles);
    if (mods) setModules(mods);
    if (options?.readOnly !== undefined) {
      setImpersonationReadOnly(options.readOnly);
    }
  };

  const hasPermission = (code: string) => permissions.includes(code);
  const moduleEnabled = (featureCode: string) => modules[featureCode] === true;

  const logout = async () => {
    if (schoolSlug) {
      await api.post(`/s/${schoolSlug}/api/auth/logout`);
    }
    setUser(null);
    setImpersonationReadOnly(false);
    window.location.href = schoolSlug ? `/s/${schoolSlug}/login` : "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        roles,
        modules,
        impersonationReadOnly,
        loading,
        schoolSlug,
        setAuth,
        hasPermission,
        moduleEnabled,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
