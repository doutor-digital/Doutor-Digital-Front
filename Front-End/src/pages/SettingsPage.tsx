import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Bot, Camera, Eye, EyeOff, Gauge, KeyRound, Link as LinkIcon,
  Loader2, Lock, Mail, MessageSquare, Phone, Save, ShieldCheck, Sparkles,
  Thermometer, Trash2, User as UserIcon, Webhook, X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { configService } from "@/services/config";
import { profileService, type UserProfile } from "@/services/profile";
import { useAuth } from "@/hooks/useAuth";
import {
  setAdminKey,
  setCloudiaBaseUrl,
  setCloudiaBearerToken,
} from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

export default function SettingsPage() {
  const qc = useQueryClient();
  const [adminKey, setAdmin] = useState(localStorage.getItem("admin_key") ?? "");
  const [apiKey, setApiKey] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [cloudiaBearer, setCloudiaBearer] = useState(
    localStorage.getItem("cloudia_bearer_token") ?? ""
  );
  const [cloudiaUrl, setCloudiaUrl] = useState(
    localStorage.getItem("cloudia_base_url") ?? ""
  );

  const status = useQuery({
    queryKey: ["cloudia-status"],
    queryFn: () => configService.status(),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      configService.setCloudiaKey({
        apiKey,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success("Chave Cloudia atualizada");
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["cloudia-status"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => configService.remove(),
    onSuccess: () => {
      toast.success("Chave removida");
      qc.invalidateQueries({ queryKey: ["cloudia-status"] });
    },
  });

  const persistAdmin = useMutation({
    mutationFn: (key: string) => configService.setAdminKey(key),
  });

  async function saveAdminKey() {
    setAdminKey(adminKey || null);
    if (!adminKey) {
      toast.success("Admin key removida (local)");
      return;
    }
    try {
      await persistAdmin.mutateAsync(adminKey);
      toast.success("Admin key salva (local + backend)");
    } catch {
      toast.success("Admin key salva localmente (backend indisponível)");
    }
  }

  function saveCloudiaLocalConfig() {
    setCloudiaBearerToken(cloudiaBearer || null);
    setCloudiaBaseUrl(cloudiaUrl || null);
    toast.success("Configuração Cloudia local salva");
  }
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Integrações e credenciais do painel"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lg:col-span-2">
          <ProfileCard />
        </div>

        <Card>
          <CardHeader
            title="Admin key"
            subtitle="Header X-Admin-Key para rotas protegidas"
          />
          <CardBody className="space-y-3">
            <label className="label">Chave</label>
            <Input
              type="password"
              icon={<ShieldCheck className="h-4 w-4" />}
              value={adminKey}
              onChange={(e) => setAdmin(e.target.value)}
              placeholder="••••••••"
            />
            <p className="text-xs text-slate-400">
              Armazenada localmente; enviada apenas nos requests para rotas admin.
            </p>
            <Button onClick={saveAdminKey} className="w-full justify-center">
              Salvar admin key
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Cloudia local (Bearer + URL)"
            subtitle="Salvo no navegador; útil para testar e evitar 502 de URL incorreta"
          />
          <CardBody className="space-y-3">
            <label className="label">Bearer token da Cloudia</label>
            <Input
              type="password"
              icon={<KeyRound className="h-4 w-4" />}
              value={cloudiaBearer}
              onChange={(e) => setCloudiaBearer(e.target.value)}
              placeholder="Bearer ..."
            />

            <label className="label">URL base da Cloudia</label>
            <Input
              type="url"
              icon={<LinkIcon className="h-4 w-4" />}
              value={cloudiaUrl}
              onChange={(e) => setCloudiaUrl(e.target.value)}
              placeholder="https://api.cloudia.com.br"
            />

            <p className="text-xs text-slate-400">
              O app envia isso automaticamente nos headers <code>X-Cloudia-Bearer</code> e <code>X-Cloudia-Base-Url</code>.
            </p>

            <Button onClick={saveCloudiaLocalConfig} className="w-full justify-center">
              Salvar Cloudia local
            </Button>
          </CardBody>
        </Card>

        <AiSettingsCard />

        <WhatsAppSettingsCard />

        <Card className="lg:col-span-2">
          <CardHeader
            title="API Cloudia"
            subtitle="Token salvo no backend (AppConfiguration)"
            action={
              <Badge tone={status.data?.configured ? "green" : "slate"}>
                {status.data?.configured ? "Configurada" : "Não definida"}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            {status.data?.expiresAt && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
                Expira em <strong>{formatDate(status.data.expiresAt)}</strong>
              </div>
            )}

            <label className="label">Nova chave</label>
            <Input
              type="password"
              icon={<KeyRound className="h-4 w-4" />}
              placeholder="Cloudia API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />

            <label className="label">Expira em (opcional)</label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />

            <div className="flex gap-2">
              <Button
                onClick={() => save.mutate()}
                loading={save.isPending}
                disabled={!apiKey}
                className="flex-1 justify-center"
              >
                Atualizar chave
              </Button>
              {status.data?.configured && (
                <Button
                  variant="danger"
                  onClick={() => remove.mutate()}
                  loading={remove.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  IA + WhatsApp — MOCKADOS (UI apenas, back-end ainda em desenvolvimento)
 *  Os valores são persistidos em localStorage só pra preservar a digitação
 *  entre reloads. Nada é enviado pro servidor.
 * ═══════════════════════════════════════════════════════════════════ */

function MockBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-[11.5px] text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function useMockForm<T extends Record<string, string | number>>(
  storageKey: string,
  initial: T,
): [T, (patch: Partial<T>) => void, () => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return initial;
    try {
      return { ...initial, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const patch = (p: Partial<T>) => setState((prev) => ({ ...prev, ...p }));
  const reset = () => setState(initial);
  return [state, patch, reset];
}

/* ─── IA ─────────────────────────────────────────────────────────── */

type AiProvider = "openai" | "anthropic" | "gemini" | "cloudia";

const AI_DEFAULTS = {
  provider: "openai" as AiProvider,
  model: "gpt-4o-mini",
  apiKey: "",
  temperature: "0.7",
  maxTokens: "1024",
  systemPrompt:
    "Você é a assistente virtual da clínica. Responda de forma breve, acolhedora e sempre ofereça agendamento quando o paciente demonstrar interesse.",
};

function AiSettingsCard() {
  const [form, patch, reset] = useMockForm("mock.ai.settings", AI_DEFAULTS);

  const handleSave = () => {
    toast.success("Configuração da IA salva localmente (mock)");
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-300" />
            Configuração da IA
          </span>
        }
        subtitle="Modelo, chave, temperatura e prompt do sistema"
        action={<Badge tone="yellow">Em desenvolvimento</Badge>}
      />
      <CardBody className="space-y-4">
        <MockBanner>
          Esses campos são <strong>mockados</strong>. Salvam só no navegador por enquanto —
          a integração com o backend ainda está em desenvolvimento.
        </MockBanner>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Provedor
            </label>
            <select
              value={form.provider}
              onChange={(e) => patch({ provider: e.target.value as AiProvider })}
              className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-slate-100 focus:border-white/[0.18] focus:bg-white/[0.03] focus:outline-none transition [color-scheme:dark]"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google Gemini</option>
              <option value="cloudia">Cloudia nativa</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Modelo
            </label>
            <Input
              icon={<Sparkles className="h-4 w-4" />}
              value={form.model}
              onChange={(e) => patch({ model: e.target.value })}
              placeholder="ex: gpt-4o-mini, claude-sonnet-4, gemini-2.5-pro"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Chave de API
            </label>
            <Input
              type="password"
              icon={<KeyRound className="h-4 w-4" />}
              value={form.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
              placeholder="sk-..."
            />
            <p className="mt-1 text-[10.5px] text-slate-500">
              Quando o backend estiver pronto, a chave vai pro cofre do servidor. Por enquanto fica só aqui.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Thermometer className="h-3 w-3" /> Temperatura · {form.temperature}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={form.temperature}
              onChange={(e) => patch({ temperature: e.target.value })}
              className="w-full accent-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Máx. tokens
            </label>
            <Input
              type="number"
              min={64}
              max={8192}
              icon={<Gauge className="h-4 w-4" />}
              value={form.maxTokens}
              onChange={(e) => patch({ maxTokens: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Prompt do sistema
            </label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => patch({ systemPrompt: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-white/[0.18] focus:bg-white/[0.03] focus:outline-none transition"
              placeholder="Você é a assistente da clínica..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={reset}>
            Resetar
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Salvar (mock)
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ─── WhatsApp ──────────────────────────────────────────────────── */

type WaProvider = "meta_cloud" | "twilio" | "zapi" | "evolution";

const WA_DEFAULTS = {
  provider: "meta_cloud" as WaProvider,
  phoneNumber: "",
  displayName: "",
  accessToken: "",
  phoneNumberId: "",
  webhookUrl: "",
  verifyToken: "",
  autoReply: "1",
};

function WhatsAppSettingsCard() {
  const [form, patch, reset] = useMockForm("mock.whatsapp.settings", WA_DEFAULTS);
  const autoReplyOn = form.autoReply === "1";

  const handleSave = () => {
    toast.success("Configuração do WhatsApp salva localmente (mock)");
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-300" />
            Configuração do WhatsApp
          </span>
        }
        subtitle="Provedor, número de envio e webhook"
        action={<Badge tone="yellow">Em desenvolvimento</Badge>}
      />
      <CardBody className="space-y-4">
        <MockBanner>
          Esses campos são <strong>mockados</strong>. A integração real com Meta Cloud / Twilio /
          Z-API ainda está sendo desenvolvida — nada é enviado pro servidor ainda.
        </MockBanner>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Provedor
            </label>
            <select
              value={form.provider}
              onChange={(e) => patch({ provider: e.target.value as WaProvider })}
              className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-slate-100 focus:border-white/[0.18] focus:bg-white/[0.03] focus:outline-none transition [color-scheme:dark]"
            >
              <option value="meta_cloud">Meta Cloud API (oficial)</option>
              <option value="twilio">Twilio</option>
              <option value="zapi">Z-API</option>
              <option value="evolution">Evolution API</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Nome de exibição
            </label>
            <Input
              value={form.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
              placeholder="Clínica Doutor Digital"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Número do WhatsApp
            </label>
            <Input
              icon={<Phone className="h-4 w-4" />}
              value={form.phoneNumber}
              onChange={(e) => patch({ phoneNumber: e.target.value })}
              placeholder="+55 11 91234-5678"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Phone Number ID
            </label>
            <Input
              value={form.phoneNumberId}
              onChange={(e) => patch({ phoneNumberId: e.target.value })}
              placeholder="somente Meta Cloud / Twilio"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Access token
            </label>
            <Input
              type="password"
              icon={<KeyRound className="h-4 w-4" />}
              value={form.accessToken}
              onChange={(e) => patch({ accessToken: e.target.value })}
              placeholder="token do provedor"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Webhook URL
            </label>
            <Input
              icon={<Webhook className="h-4 w-4" />}
              type="url"
              value={form.webhookUrl}
              onChange={(e) => patch({ webhookUrl: e.target.value })}
              placeholder="https://api.seudominio.com/webhooks/whatsapp"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Verify token
            </label>
            <Input
              icon={<LinkIcon className="h-4 w-4" />}
              value={form.verifyToken}
              onChange={(e) => patch({ verifyToken: e.target.value })}
              placeholder="usado pela Meta no handshake"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={autoReplyOn}
                onChange={(e) => patch({ autoReply: e.target.checked ? "1" : "0" })}
                className="accent-emerald-500"
              />
              Habilitar resposta automática da IA nas mensagens recebidas
              <span className="text-[10.5px] text-amber-400">(mock)</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={reset}>
            Resetar
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Salvar (mock)
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Meu perfil — edição do usuário logado + upload de foto
 * ═══════════════════════════════════════════════════════════════════ */

function ProfileCard() {
  const qc = useQueryClient();
  const storeUser = useAuth((s) => s.user);
  const updateStoreUser = useAuth((s) => s.updateUser);

  const profile = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => profileService.me(),
    staleTime: 60_000,
  });

  const user: UserProfile | undefined = profile.data;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dirty, setDirty] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
    setDirty(false);
  }, [user]);

  const saveProfile = useMutation({
    mutationFn: () =>
      profileService.update({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() === "" ? null : phone.trim(),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["profile", "me"], data);
      updateStoreUser({
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        photoUrl: data.photoUrl ?? null,
      });
      setDirty(false);
      toast.success("Perfil atualizado");
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      profileService.changePassword({
        currentPassword: currentPwd,
        newPassword: newPwd,
      }),
    onSuccess: () => {
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      toast.success("Senha alterada");
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => profileService.uploadPhoto(file),
    onSuccess: (data) => {
      qc.setQueryData(["profile", "me"], data);
      updateStoreUser({ photoUrl: data.photoUrl ?? null });
      setPreviewUrl(null);
      toast.success("Foto de perfil atualizada");
    },
    onError: () => {
      setPreviewUrl(null);
    },
  });

  const removePhoto = useMutation({
    mutationFn: () => profileService.removePhoto(),
    onSuccess: async () => {
      const fresh = await profileService.me();
      qc.setQueryData(["profile", "me"], fresh);
      updateStoreUser({ photoUrl: null });
      toast.success("Foto removida");
    },
  });

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo excede 5MB");
      return;
    }
    if (!/^image\//.test(file.type)) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setPreviewUrl(blobUrl);
    uploadPhoto.mutate(file);
  }

  const pwdMismatch = newPwd.length > 0 && confirmPwd.length > 0 && newPwd !== confirmPwd;
  const pwdReady =
    currentPwd.length > 0 &&
    newPwd.length >= 8 &&
    confirmPwd.length >= 8 &&
    !pwdMismatch;

  const avatarSrc = previewUrl ?? user?.photoUrl ?? storeUser?.photoUrl ?? null;
  const initials = getInitials(user?.name ?? storeUser?.name ?? "");

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-brand-300" />
            Meu perfil
          </span>
        }
        subtitle="Atualize seus dados, foto e senha"
        action={
          user?.role ? (
            <Badge tone="slate" className="uppercase">
              {user.role}
            </Badge>
          ) : null
        }
      />
      <CardBody className="space-y-5">
        {profile.isLoading ? (
          <div className="flex items-center gap-3 text-[13px] text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando perfil…
          </div>
        ) : (
          <>
            <div className="flex items-start gap-5">
              <div className="relative">
                <div
                  className={cn(
                    "h-24 w-24 rounded-full overflow-hidden",
                    "ring-2 ring-white/10 shadow-lg",
                    "bg-gradient-to-br from-brand-500/80 to-accent-500/80",
                    "grid place-items-center"
                  )}
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={user?.name ?? "Avatar"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white">{initials}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadPhoto.isPending}
                  className={cn(
                    "absolute -bottom-1 -right-1 h-9 w-9 grid place-items-center rounded-full",
                    "bg-brand-500 text-white shadow-lg hover:bg-brand-400 transition",
                    "ring-2 ring-[#0a0a0d]",
                    uploadPhoto.isPending && "opacity-60 cursor-wait"
                  )}
                  title="Trocar foto"
                >
                  {uploadPhoto.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={onPickFile}
                  className="hidden"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {user?.name ?? "—"}
                </p>
                <p className="text-[12px] text-slate-400 truncate">{user?.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadPhoto.isPending}
                  >
                    <Camera className="mr-2 h-3.5 w-3.5" />
                    Enviar foto
                  </Button>
                  {user?.photoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePhoto.mutate()}
                      disabled={removePhoto.isPending}
                      className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                    >
                      <X className="mr-2 h-3.5 w-3.5" />
                      Remover
                    </Button>
                  )}
                  <p className="text-[10.5px] text-slate-500">
                    JPG, PNG, WEBP ou GIF · até 5MB
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="label">Nome</label>
                <Input
                  className="mt-1"
                  icon={<UserIcon className="h-4 w-4" />}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setDirty(true); }}
                />
              </div>
              <div>
                <label className="label">E-mail</label>
                <Input
                  className="mt-1"
                  type="email"
                  icon={<Mail className="h-4 w-4" />}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Telefone</label>
                <Input
                  className="mt-1"
                  type="tel"
                  icon={<Phone className="h-4 w-4" />}
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setDirty(true); }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!user) return;
                  setName(user.name);
                  setEmail(user.email);
                  setPhone(user.phone ?? "");
                  setDirty(false);
                }}
                disabled={!dirty || saveProfile.isPending}
              >
                Descartar
              </Button>
              <Button
                onClick={() => saveProfile.mutate()}
                disabled={!dirty || saveProfile.isPending}
                loading={saveProfile.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar alterações
              </Button>
            </div>

            <div className="pt-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-400" />
                <p className="text-[13px] font-semibold text-slate-200">Alterar senha</p>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Mínimo de 8 caracteres. Vamos pedir sua senha atual para confirmar.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="label">Senha atual</label>
                  <Input
                    className="mt-1"
                    type={showPwd ? "text" : "password"}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    icon={<KeyRound className="h-4 w-4" />}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="label">Nova senha</label>
                  <Input
                    className="mt-1"
                    type={showPwd ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    icon={<Lock className="h-4 w-4" />}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div>
                  <label className="label">Confirmar nova senha</label>
                  <Input
                    className="mt-1"
                    type={showPwd ? "text" : "password"}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    icon={<Lock className="h-4 w-4" />}
                    placeholder="Repita a nova senha"
                  />
                  {pwdMismatch && (
                    <p className="mt-1 text-[11px] text-rose-300">As senhas não coincidem.</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200"
                >
                  {showPwd ? (
                    <><EyeOff className="h-3 w-3" /> Ocultar senhas</>
                  ) : (
                    <><Eye className="h-3 w-3" /> Mostrar senhas</>
                  )}
                </button>
                <Button
                  onClick={() => changePassword.mutate()}
                  disabled={!pwdReady || changePassword.isPending}
                  loading={changePassword.isPending}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Atualizar senha
                </Button>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = parts[0][0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (a + b).toUpperCase();
}
