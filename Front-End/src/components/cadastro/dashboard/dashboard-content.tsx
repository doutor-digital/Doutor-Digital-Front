
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { DashboardSidebar, type DashboardView } from '@/components/cadastro/dashboard/sidebar'
import { DashboardView as DashboardHomeView } from '@/components/cadastro/dashboard/dashboard-view'
import { LeadForm } from '@/components/cadastro/views/lead-form'
import { LeadsListView } from '@/components/cadastro/views/leads-list-view'
import { LeadDetailView } from '@/components/cadastro/views/lead-detail-view'
import { ConsultaForm } from '@/components/cadastro/views/consulta-form'
import { TratamentoForm } from '@/components/cadastro/views/tratamento-form'
import { RecebimentosList } from '@/components/cadastro/views/recebimentos-list'
import { EmpresaView } from '@/components/cadastro/empresa/empresa-view'
import { ImportView } from '@/components/cadastro/views/import-view'
import { ImportadosView } from '@/components/cadastro/views/importados-view'
import { RelatoriosView } from '@/components/cadastro/views/relatorios-view'
import { ConfigView } from '@/components/cadastro/views/config-view'
import { LogsView } from '@/components/cadastro/views/logs-view'
import { KommoView } from '@/components/cadastro/views/kommo-view'
import { IntegrationsView } from '@/components/cadastro/views/integrations-view'
import { PainelView } from '@/components/cadastro/views/painel-view'
import { ProfileView } from '@/components/cadastro/dashboard/profile-view'
import { useAuth } from '@/contexts/cadastra/auth-context'
import { useCadastroStore } from '@/lib/cadastra/cadastro-store'
import type { Consulta, Lead, Tratamento } from '@/types/cadastra'

const validViews: DashboardView[] = [
  'dashboard',
  'leads-list',
  'lead-detail',
  'lead',
  'consulta',
  'tratamento',
  'recebimentos',
  'empresa',
  'importar',
  'importados',
  'relatorios',
  'config',
  'perfil',
  'logs',
  'kommo',
  'integracoes',
  'painel',
]

function isValidView(value: string | null): value is DashboardView {
  return value !== null && (validViews as string[]).includes(value)
}

// Views que possuem rota dedicada (URL própria). As demais permanecem internas em /dashboard.
const PATH_TO_VIEW: Record<string, DashboardView> = {
  '/cadastro/leads': 'leads-list',
  '/cadastro/importados': 'importados',
  '/cadastro/integracoes': 'integracoes',
}
const VIEW_TO_PATH: Partial<Record<DashboardView, string>> = {
  'leads-list': '/cadastro/leads',
  importados: '/cadastro/importados',
  integracoes: '/cadastro/integracoes',
}

function viewFromLocation(pathname: string, searchView: string | null): DashboardView {
  if (PATH_TO_VIEW[pathname]) return PATH_TO_VIEW[pathname]
  if (isValidView(searchView)) return searchView
  return 'dashboard'
}

export function DashboardContent() {
  const [params] = useSearchParams()
  const pathname = useLocation().pathname
  const navigate = useNavigate()
  const initial = viewFromLocation(pathname, params.get('view'))
  const [view, setView] = useState<DashboardView>(initial)
  const [chainedLeadId, setChainedLeadId] = useState<string | null>(null)
  const [chainedConsultaId, setChainedConsultaId] = useState<string | null>(null)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [editingConsulta, setEditingConsulta] = useState<Consulta | null>(null)
  const [editingTratamento, setEditingTratamento] = useState<Tratamento | null>(null)
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null)
  const store = useCadastroStore()
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/cadastro/login')
  }

  // Mantém o estado interno em sync com URL (navegação via voltar/avançar do browser).
  useEffect(() => {
    const next = viewFromLocation(pathname, params.get('view'))
    if (next !== view) setView(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, params])

  // Empurra a URL apropriada para a view. Views com rota dedicada usam pathname próprio,
  // as demais ficam em /dashboard?view=<id>.
  const navigateTo = (v: DashboardView) => {
    const dedicated = VIEW_TO_PATH[v]
    const target = dedicated ?? (v === 'dashboard' ? '/cadastro' : `/dashboard?view=${v}`)
    navigate(target)
  }

  const goDashboard = () => {
    setChainedLeadId(null)
    setChainedConsultaId(null)
    setEditingLead(null)
    setEditingConsulta(null)
    setEditingTratamento(null)
    setDetailLeadId(null)
    setView('dashboard')
    if (pathname !== '/cadastro') navigate('/cadastro')
  }

  const handleNavigate = (v: DashboardView) => {
    setChainedLeadId(null)
    setChainedConsultaId(null)
    if (v !== 'lead') setEditingLead(null)
    if (v !== 'consulta') setEditingConsulta(null)
    if (v !== 'tratamento') setEditingTratamento(null)
    if (v !== 'lead-detail') setDetailLeadId(null)
    setView(v)
    navigateTo(v)
  }

  const handleEditConsulta = (consulta: Consulta) => {
    setEditingConsulta(consulta)
    setView('consulta')
  }

  const handleEditTratamento = (tratamento: Tratamento) => {
    setEditingTratamento(tratamento)
    setView('tratamento')
  }

  const handleOpenLead = (lead: Lead) => {
    setDetailLeadId(lead.id)
    setView('lead-detail')
  }

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead)
    setView('lead')
  }

  const handleNewLead = () => {
    setEditingLead(null)
    setView('lead')
  }

  return (
    <div className="min-h-screen flex bg-[#0c0d10] text-white">
      <DashboardSidebar active={view} onChange={handleNavigate} />

      <div className="flex-1 min-w-0 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${view}-${editingLead?.id ?? detailLeadId ?? 'new'}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'dashboard' && <DashboardHomeView />}
            {view === 'leads-list' && (
              <LeadsListView
                onBack={goDashboard}
                onEdit={handleEditLead}
                onCreateNew={handleNewLead}
                onOpen={handleOpenLead}
              />
            )}
            {view === 'lead-detail' && detailLeadId && (
              <LeadDetailView
                leadId={detailLeadId}
                onBack={() => {
                  setDetailLeadId(null)
                  setView('leads-list')
                }}
                onEdit={handleEditLead}
                onEditConsulta={handleEditConsulta}
                onEditTratamento={handleEditTratamento}
                onDeleted={() => {
                  setDetailLeadId(null)
                  setView('leads-list')
                }}
              />
            )}
            {view === 'lead' && (
              <LeadForm
                onBack={() => {
                  setEditingLead(null)
                  setView('leads-list')
                }}
                editing={editingLead ?? undefined}
                onSaved={(lead) => {
                  if (editingLead) {
                    setEditingLead(null)
                    setDetailLeadId(lead.id)
                    setView('lead-detail')
                  } else if (lead.agendouConsulta) {
                    setChainedLeadId(lead.id)
                    setView('consulta')
                  } else {
                    setView('leads-list')
                  }
                }}
              />
            )}
            {view === 'consulta' && (
              <ConsultaForm
                onBack={() => {
                  if (editingConsulta) {
                    const lead = store.leads.find((l) => l.id === editingConsulta.leadId)
                    setEditingConsulta(null)
                    if (lead) {
                      setDetailLeadId(lead.id)
                      setView('lead-detail')
                      return
                    }
                  }
                  goDashboard()
                }}
                prefilledLeadId={chainedLeadId ?? undefined}
                editing={editingConsulta ?? undefined}
                onSaved={(consulta) => {
                  setChainedLeadId(null)
                  if (editingConsulta) {
                    setEditingConsulta(null)
                    setDetailLeadId(consulta.leadId)
                    setView('lead-detail')
                  } else {
                    setChainedConsultaId(consulta.id)
                    setView('tratamento')
                  }
                }}
              />
            )}
            {view === 'tratamento' && (
              <TratamentoForm
                onBack={() => {
                  if (editingTratamento) {
                    const consulta = store.consultas.find(
                      (c) => c.id === editingTratamento.consultaId,
                    )
                    setEditingTratamento(null)
                    if (consulta) {
                      setDetailLeadId(consulta.leadId)
                      setView('lead-detail')
                      return
                    }
                  }
                  goDashboard()
                }}
                prefilledConsultaId={chainedConsultaId ?? undefined}
                editing={editingTratamento ?? undefined}
                onSaved={(tratamento) => {
                  setChainedConsultaId(null)
                  setEditingTratamento(null)
                  const consulta = store.consultas.find((c) => c.id === tratamento.consultaId)
                  if (consulta) {
                    setDetailLeadId(consulta.leadId)
                    setView('lead-detail')
                  } else {
                    setView('dashboard')
                  }
                }}
                onNavigateToConsulta={() => handleNavigate('consulta')}
                onNavigateToLead={() => handleNavigate('lead')}
              />
            )}
            {view === 'recebimentos' && (
              <RecebimentosList
                onBack={goDashboard}
                onViewLead={(leadId) => {
                  setDetailLeadId(leadId)
                  setView('lead-detail')
                }}
                onEditConsulta={handleEditConsulta}
                onEditTratamento={handleEditTratamento}
              />
            )}
            {view === 'empresa' && <EmpresaView onBack={goDashboard} />}
            {view === 'importar' && <ImportView onBack={goDashboard} />}
            {view === 'importados' && <ImportadosView onBack={goDashboard} />}
            {view === 'relatorios' && <RelatoriosView onBack={goDashboard} />}
            {view === 'config' && <ConfigView onBack={goDashboard} />}
            {view === 'logs' && <LogsView onBack={goDashboard} />}
            {view === 'kommo' && <KommoView onBack={goDashboard} />}
            {view === 'integracoes' && <IntegrationsView onBack={goDashboard} />}
            {view === 'painel' && (
              <PainelView
                onBack={goDashboard}
                onNavigateLogs={() => handleNavigate('logs')}
                onNavigateKommo={() => handleNavigate('kommo')}
                onNavigateLeads={() => handleNavigate('leads-list')}
              />
            )}
            {view === 'perfil' && <ProfileView onBack={goDashboard} onLogout={handleLogout} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
