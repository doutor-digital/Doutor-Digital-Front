// Estado do tour guiado para o gap-analysis da Kommo. Persiste no localStorage
// para não incomodar quem já viu, mas pode ser re-disparado pelo botão "ver tour".
//
// Cada step aponta para um data-attribute (data-tour-step="<id>") que o componente
// usa pra calcular posição do tooltip via getBoundingClientRect.

const STORAGE_KEY = 'kommo.tour.seen.v2'

export interface TourStep {
  id: string
  title: string
  body: string
  // Posição preferida do tooltip relativa ao alvo.
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export const KOMMO_TOUR_STEPS: TourStep[] = [
  {
    id: 'progress',
    title: '1 / 6 · Onde você está',
    body:
      'Estes três passos mostram seu progresso: Revisar (o que a Kommo mandou), Preencher (o que falta) e Promover (criar o lead no Cadastro). O número de campos detectados e a completude aparecem aqui — mire em 100% nos obrigatórios antes de promover.',
    placement: 'bottom',
  },
  {
    id: 'next-step',
    title: '2 / 6 · O que fazer agora',
    body:
      'Este banner é seu copiloto: ele lê o estado atual e diz exatamente o próximo passo — qual campo obrigatório falta, qual precisa de revisão, ou se está tudo pronto. Clique em "Ir para o campo" e a tela rola até a linha certa, já destacada.',
    placement: 'bottom',
  },
  {
    id: 'field-row',
    title: '3 / 6 · Decifrando as cores',
    body:
      '🟢 Verde = a Kommo trouxe o valor com alta confiança, pode confiar. 🟡 Amarelo = a CadastraAi.API achou um palpite, mas confira. 🔴 Vermelho = obrigatório vazio, precisa preencher. 🟣 Roxo = você editou manualmente, vence qualquer auto-detect.',
    placement: 'top',
  },
  {
    id: 'source-tooltip',
    title: '4 / 6 · De onde veio cada valor',
    body:
      'Cada linha mostra a origem no payload da Kommo (ex: "contact.phone · 95%"). Passe o mouse para ver o caminho exato no JSON — útil para debug quando algo veio errado. Se o campo Kommo se chama diferente do esperado, vá em "Mapeamento" e crie um override permanente.',
    placement: 'top',
  },
  {
    id: 'fill-defaults',
    title: '5 / 6 · Atalho: preencher defaults',
    body:
      'Sem tempo? O botão "Preencher defaults" (ao lado de "Ir para o campo") completa todos os obrigatórios que faltam com valores neutros ("—", "A definir", false). Você ajusta depois pelo Cadastro. Útil em sync em massa quando a Kommo veio incompleta.',
    placement: 'left',
  },
  {
    id: 'promote',
    title: '6 / 6 · Promover para lead',
    body:
      'Quando todos os obrigatórios estiverem 🟢 ou 🟣, este botão libera. Promover cria o lead no Cadastro (substituto da planilha), marca o item da inbox como "importado" e o LeadDetail/dashboard passam a contá-lo nas estatísticas.',
    placement: 'left',
  },
]

export function hasSeenTour(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markTourSeen(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

export function resetTour(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
