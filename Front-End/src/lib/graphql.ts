import axios, { AxiosError } from "axios";
import { toast } from "sonner";

export const GRAPHQL_URL =
  import.meta.env.VITE_GRAPHQL_URL ||
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") + "/graphql" ||
  "http://localhost:3000/graphql";

const gqlClient = axios.create({
  baseURL: GRAPHQL_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

gqlClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

export class GraphQLError extends Error {
  constructor(
    public readonly errors: Array<{ message: string; extensions?: Record<string, unknown> }>,
  ) {
    super(errors.map((e) => e.message).join("; ") || "Erro GraphQL");
    this.name = "GraphQLError";
  }
}

export async function gql<T, V = Record<string, unknown>>(
  query: string,
  variables?: V,
  options?: { silent?: boolean },
): Promise<T> {
  try {
    const { data } = await gqlClient.post<GraphQLResponse<T>>("", {
      query,
      variables,
    });

    if (data.errors?.length) {
      if (!options?.silent) toast.error(data.errors[0].message);
      throw new GraphQLError(data.errors);
    }

    if (!data.data) throw new Error("Resposta GraphQL vazia.");
    return data.data;
  } catch (err) {
    if (err instanceof GraphQLError) throw err;
    const ax = err as AxiosError<GraphQLResponse<T>>;
    const status = ax.response?.status;
    if (status === 401) {
      localStorage.removeItem("auth_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    const remote = ax.response?.data?.errors?.[0]?.message;
    const message = remote || ax.message || "Falha de comunicação";
    if (!options?.silent && status !== 401) toast.error(message);
    throw err;
  }
}
