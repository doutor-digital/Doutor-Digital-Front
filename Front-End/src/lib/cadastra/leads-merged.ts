
import { useEffect, useMemo, useState } from 'react'
import { empresasApi, leadsApi, type LeadSummaryDto } from '@/lib/cadastra/api'
import { useCadastroStore } from '@/lib/cadastra/cadastro-store'
import type { Lead } from '@/types/cadastra'

interface ApiLeadSummary extends LeadSummaryDto {}

function fromSummary(s: ApiLeadSummary): Lead {
  return {
    id: s.id,
    empresaId: s.empresaId,
    nome: s.nome,
    telefone: s.telefone,
    origem: s.origem,
    tipo: (s.tipo as Lead['tipo']) ?? 'Cadastro',
    tipoResgate: s.tipoResgate ?? undefined,
    interacao: s.interacao,
    agendouConsulta: s.agendouConsulta,
    pagamentoAntecipado: s.pagamentoAntecipado,
    dataAgendamento: s.dataAgendamento ?? undefined,
    motivoNaoAgendamento: s.motivoNaoAgendamento ?? undefined,
    nomeResponsavel: s.nomeResponsavel,
    createdAt: s.createdAt,
    importado: s.importado,
  }
}

export interface MergedLeadsResult {
  leads: Lead[]
  apiSummaries: ApiLeadSummary[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useMergedLeads(): MergedLeadsResult {
  const local = useCadastroStore()
  const [apiSummaries, setApiSummaries] = useState<ApiLeadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const empresas = await empresasApi.list()
        // Pega todos paginados — pageSize máximo (500) por chamada.
        // Esse hook é usado por views agregadas (dashboard, importados); aceita carregar tudo.
        const lists = await Promise.all(
          empresas.map(async (e) => {
            const acc: ApiLeadSummary[] = []
            let page = 0
            while (true) {
              const resp = await leadsApi.list(e.id, { page, pageSize: 500 })
              acc.push(...resp.items)
              if (acc.length >= resp.total || resp.items.length === 0) break
              page++
            }
            return acc
          }),
        )
        if (cancelled) return
        const merged: ApiLeadSummary[] = []
        for (const list of lists) merged.push(...list)
        setApiSummaries(merged)
      } catch (err) {
        if (cancelled) return
        // Sem rede / sem auth: degrada graciosamente para apenas localStorage.
        setError(err instanceof Error ? err.message : 'Erro ao buscar leads do servidor')
        setApiSummaries([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tick])

  const leads: Lead[] = useMemo(() => {
    const fromApi = apiSummaries.map(fromSummary)
    const seen = new Set(fromApi.map((l) => l.id))
    const fromLocal = local.leads.filter((l) => !seen.has(l.id))
    const all = [...fromApi, ...fromLocal]
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return all
  }, [apiSummaries, local.leads])

  return {
    leads,
    apiSummaries,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  }
}
