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
  photoUrl?: string | null;
  authMethod?: string;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  selectedUnit: Unit;
  availableUnits: Unit[];
}

export interface MeResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  photoUrl?: string | null;
  authMethod?: string;
  tenantId?: number | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  unitIds: string[];
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

  async googleLogin(idToken: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      "/api/auth/google",
      { idToken }
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

  async me(): Promise<MeResponse> {
    const { data } = await api.get<MeResponse>("/api/auth/me");
    return data;
  },

  /** Ping de atividade — acumula o tempo logado da sessão atual. */
  async heartbeat(): Promise<void> {
    await api.post("/api/auth/heartbeat", null, { silent401: true });
  },

  /** Envia as coordenadas (GPS) após a usuária consentir no navegador. */
  async geoConsent(coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }): Promise<void> {
    await api.post("/api/auth/geo-consent", coords);
  },

  async logout(): Promise<void> {
    await api.post("/api/auth/logout", null, { silent401: true });
  },
};