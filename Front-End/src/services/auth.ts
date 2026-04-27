import { api } from "@/lib/api";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Unit {
  id: number;
  clinicId: number;
  name: string;
  isDefault: boolean;
}

export interface LoginResponse {
  userName: string;
  email: string;
  role: string;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  selectedUnit: Unit;
  availableUnits: Unit[];
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface SimpleMessageResponse {
  message: string;
}

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      "/api/auth/login",
      payload
    );

    return data;
  },

  async forgotPassword(payload: ForgotPasswordRequest): Promise<SimpleMessageResponse> {
    const { data } = await api.post<SimpleMessageResponse>(
      "/api/auth/forgot-password",
      payload
    );
    return data;
  },

  async verifyResetCode(payload: VerifyResetCodeRequest): Promise<SimpleMessageResponse> {
    const { data } = await api.post<SimpleMessageResponse>(
      "/api/auth/verify-reset-code",
      payload
    );
    return data;
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<SimpleMessageResponse> {
    const { data } = await api.post<SimpleMessageResponse>(
      "/api/auth/reset-password",
      payload
    );
    return data;
  },
};