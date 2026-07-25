import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  accessToken: null,
  usuario: null,
  setAuth: (accessToken, usuario) => set({ accessToken, usuario }),
  logout: () => set({ accessToken: null, usuario: null })
}));
