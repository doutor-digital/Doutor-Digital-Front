import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAuthToken } from "@/lib/api";
import { authService } from "@/services/auth";

interface User {
  name: string;
  email: string;
  role?: string;
  photoUrl?: string | null;
  phone?: string | null;
  unitIds?: number[];
}
interface AuthStore {
  user: User | null;
  token: string | null;
  login: (u: User, token: string) => void;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => {
        setAuthToken(token);
        set({ user, token });
      },
      logout: () => {
        // Encerra a sessão no back (tempo logado) antes de limpar o token.
        void authService.logout().catch(() => {});
        setAuthToken(null);
        set({ user: null, token: null });
      },
      updateUser: (patch) =>
        set((state) =>
          state.user ? { user: { ...state.user, ...patch } } : state
        ),
    }),
    { name: "doutor.digital.auth" }
  )
);
