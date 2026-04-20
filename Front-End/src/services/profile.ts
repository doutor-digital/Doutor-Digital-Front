import { api } from "@/lib/api";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  photoUrl?: string | null;
  tenantId?: number | null;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  phone?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const profileService = {
  async me(): Promise<UserProfile> {
    const { data } = await api.get<UserProfile>("/users/me");
    return data;
  },

  async update(input: UpdateProfileInput): Promise<UserProfile> {
    const { data } = await api.patch<UserProfile>("/users/me", input);
    return data;
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await api.post("/users/me/password", input);
  },

  async uploadPhoto(file: File): Promise<UserProfile> {
    const form = new FormData();
    form.append("file", file);

    const token = localStorage.getItem("auth_token");
    const { data } = await api.post<UserProfile>("/users/me/photo", form, {
      // Deixa o axios/browser definir o Content-Type (com boundary) automaticamente.
      // Passamos o Authorization explicitamente como garantia.
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return data;
  },

  async removePhoto(): Promise<void> {
    await api.delete("/users/me/photo");
  },
};
