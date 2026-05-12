
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
} from "@/components/icons"
import { parseCSV, csvToObjects, buildCsv, downloadFile } from '@/lib/cadastra/csv'
import { useConfig } from '@/lib/cadastra/config-store'
import { cn } from '@/lib/utils'
import { empresasApi, leadsApi, type CreateLeadPayload, type EmpresaDto } from '@/lib/cadastra/api'
import type { LeadFormData } from '@/types/cadastra'

const CHUNK_SIZE = 200

interface ImportViewProps {
  onBack: () => void
}

interface FieldDef {
  key: keyof LeadFormData
  label: string
  required: boolean
  aliases: string[]
  hint?: string
}

const fields: FieldDef[] = [
  { key: 'nome',                 label: 'Nome',                  required: true,  aliases: ['nome', 'name', 'paciente', 'cliente', 'nomedocliente', 'nome_do_cliente'] },
  { key: 'telefone',             label: 'Telefone',              required: true,  aliases: ['telefone', 'phone', 'celular', 'whatsapp', 'tel'] },
  { key: 'origem',               label: 'Origem',                required: true,  aliases: ['origem', 'fonte', 'canal', 'source', 'origemcadastro', 'origem_cadastro'] },
  { key: 'tipo',                 label: 'Tipo',                  required: false, aliases: ['tipo', 'type'], hint: 'Cadastro ou Resgate. Padrão: Cadastro.' },
  { key: 'tipoResgate',          label: 'Tipo de Resgate',       required: false, aliases: ['tiporesgate', 'tipo_resgate', 'resgate', 'tipoderesgate', 'tipo_de_resgate'] },
  { key: 'interacao',            label: 'Interação',             required: false, aliases: ['interacao', 'interação', 'interagiu'], hint: 'sim / não' },
  { key: 'agendouConsulta',      label: 'Agendou consulta',      required: false, aliases: ['agendouconsulta', 'agendou', 'agendou_consulta', 'clienteagendou', 'cliente_agendou'], hint: 'sim / não' },
  { key: 'pagamentoAntecipado',  label: 'Pagamento antecipado',  required: false, aliases: ['pagamentoantecipado', 'pagamento_antecipado'], hint: 'sim / não' },
  { key: 'dataAgendamento',      label: 'Data do agendamento',   required: false, aliases: ['dataagendamento', 'data_agendamento', 'datadoagendamento', 'data_do_agendamento'], hint: 'YYYY-MM-DDTHH:mm ou DD/MM/YYYY' },
  { key: 'motivoNaoAgendamento', label: 'Motivo não agendamento',required: false, aliases: ['motivonaoagendamento', 'motivo_nao_agendamento', 'motivo', 'motivoparanaoagendamento', 'motivo_para_nao_agendamento'] },
  { key: 'nomeResponsavel',      label: 'Responsável',           required: true,  aliases: ['nomeresponsavel', 'responsavel', 'responsável', 'nome_responsavel'] },
  { key: 'createdAt',            label: 'Data de cadastro',      required: false, aliases: ['dataorigem', 'data_origem', 'datacadastro', 'data_cadastro', 'datacriacao', 'data_criacao', 'criadoem', 'criado_em', 'data'], hint: 'Coluna "Data Origem" da planilha. DD/MM/AAAA ou DD/MM/AAAA HH:MM:SS.' },
]

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const usedHeaders = new Set<string>()
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeKey(h) }))
  for (const f of fields) {
    const candidates = [normalizeKey(f.key), normalizeKey(f.label), ...f.aliases.map(normalizeKey)]
    for (const c of candidates) {
      const match = normalizedHeaders.find((h) => h.norm === c && !usedHeaders.has(h.raw))
      if (match) {
        mapping[f.key] = match.raw
        usedHeaders.add(match.raw)
        break
      }
    }
  }
  return mapping
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback
  const v = value.trim().toLowerCase()
  if (['sim', 's', 'true', 'verdadeiro', 'yes', 'y', '1'].includes(v)) return true
  if (['nao', 'não', 'n', 'false', 'falso', 'no', '0', ''].includes(v)) return false
  return fallback
}

function parseDateValue(value: string): string | undefined {
  if (!value) return undefined
  const v = value.trim()
  if (!v) return undefined
  // DD/MM/YYYY [HH:MM[:SS]] em horário local do navegador → ISO UTC com Z.
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    const [, d, mo, y, hh = '0', mm = '0', ss = '0'] = m
    const yyyy = y.length === 2 ? Number(`20${y}`) : Number(y)
    const dt = new Date(yyyy, Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss))
    if (!isNaN(dt.getTime())) return dt.toISOString()
  }
  // Fallback: tenta o construtor padrão (ISO etc).
  const fallback = new Date(v)
  if (!isNaN(fallback.getTime())) return fallback.toISOString()
  return undefined
}

function pickFromList(value: string, list: string[]): string | null {
  const v = value.trim().toLowerCase()
  return list.find((x) => x.toLowerCase() === v) ?? null
}

function pickTipo(value: string): LeadFormData['tipo'] {
  const v = value.trim().toLowerCase()
  if (v.startsWith('resgate')) return 'Resgate'
  return 'Cadastro'
}

interface PreparedRow {
  index: number
  raw: Record<string, string>
  ok: boolean
  error?: string
  data?: LeadFormData
}

function prepareRows(
  records: Record<string, string>[],
  mapping: Record<string, string>,
  _config: ReturnType<typeof useConfig>,
): PreparedRow[] {
  return records.map((raw, idx) => {
    try {
      const get = (key: keyof LeadFormData) => {
        const col = mapping[key]
        return col ? (raw[col] ?? '').trim() : ''
      }

      const nome = get('nome').slice(0, 200)
      const telefoneRaw = get('telefone')
      const origemRaw = get('origem')
      const responsavelRaw = get('nomeResponsavel')

      if (!nome) throw new Error('Nome é obrigatório')

      // Os campos abaixo são obrigatórios no backend, mas aplicamos fallbacks
      // pra não rejeitar linhas vindas de planilhas externas com vazios pontuais.
      // Telefone tem MaxLength(20) no backend; cabemos nos limites de cada coluna.
      const telefone = (telefoneRaw || 'Sem telefone').slice(0, 20)
      const origem = (origemRaw || 'Sem origem').slice(0, 100)
      const responsavel = (responsavelRaw || 'Não informado').slice(0, 100)

      const tipo = pickTipo(get('tipo'))
      const tipoResgateRaw = get('tipoResgate')
      const tipoResgate = tipo === 'Resgate' && tipoResgateRaw ? tipoResgateRaw.slice(0, 50) : undefined
      const agendou = parseBool(get('agendouConsulta'))
      const dataAgendamento = agendou ? parseDateValue(get('dataAgendamento')) : undefined
      const motivoNaoAgendamento = !agendou
        ? (get('motivoNaoAgendamento') || 'Não informado').slice(0, 200)
        : undefined

      const createdAt = parseDateValue(get('createdAt'))

      const data: LeadFormData = {
        nome,
        telefone,
        origem,
        tipo,
        tipoResgate,
        interacao: parseBool(get('interacao')),
        agendouConsulta: agendou,
        pagamentoAntecipado: parseBool(get('pagamentoAntecipado')),
        dataAgendamento,
        motivoNaoAgendamento,
        nomeResponsavel: responsavel,
        createdAt,
      }

      return { index: idx, raw, ok: true, data }
    } catch (err) {
      return {
        index: idx,
        raw,
        ok: false,
        error: err instanceof Error ? err.message : 'Erro de validação',
      }
    }
  })
}

export function ImportView({ onBack }: ImportViewProps) {
  const config = useConfig()
  const [headers, setHeaders] = useState<string[]>([])
  const [records, setRecords] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [importErrors, setImportErrors] = useState<{ index: number; error: string }[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [empresaId, setEmpresaId] = useState<string>('')
  const [empresasError, setEmpresasError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    empresasApi
      .list()
      .then((list) => {
        if (cancelled) return
        setEmpresas(list)
        if (list.length === 1) setEmpresaId(list[0].id)
      })
      .catch((err) => {
        if (cancelled) return
        setEmpresasError(err instanceof Error ? err.message : 'Erro ao carregar empresas')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFile = useCallback((file: File) => {
    setParseError(null)
    setImportedCount(null)
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setParseError('Por enquanto aceitamos apenas CSV. Salve sua planilha como CSV (UTF-8) no Excel/Sheets.')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const rows = parseCSV(text)
        const { headers: h, records: r } = csvToObjects(rows)
        if (h.length === 0) {
          setParseError('Planilha vazia.')
          setHeaders([])
          setRecords([])
          return
        }
        setHeaders(h)
        setRecords(r)
        setMapping(autoMap(h))
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Erro ao ler o arquivo.')
      }
    }
    reader.onerror = () => setParseError('Não foi possível ler o arquivo.')
    reader.readAsText(file, 'utf-8')
  }, [])

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const prepared = useMemo(() => {
    if (records.length === 0) return [] as PreparedRow[]
    return prepareRows(records, mapping, config)
  }, [records, mapping, config])

  const validRows = useMemo(() => prepared.filter((r) => r.ok), [prepared])
  const invalidRows = useMemo(() => prepared.filter((r) => !r.ok), [prepared])
  const previewRows = useMemo(() => prepared.slice(0, 100), [prepared])
  const requiredMissing = useMemo(
    () => fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label),
    [mapping],
  )

  const downloadTemplate = () => {
    const headers = fields.map((f) => f.label)
    const example = [
      'João Silva',
      '(11) 99999-0001',
      config.origens[0] ?? 'Instagram',
      'Cadastro',
      '',
      'sim',
      'sim',
      'não',
      '15/06/2026 14:00',
      '',
      config.responsaveis[0] ?? 'Rayssa',
    ]
    const csv = buildCsv(headers, [example])
    downloadFile('cadastra-ai-template-leads.csv', csv)
  }

  const handleImport = async () => {
    if (importing) return
    if (!empresaId) {
      setParseError('Selecione a empresa de destino antes de importar.')
      return
    }
    setImporting(true)
    setImportedCount(null)
    setImportErrors([])
    setParseError(null)

    const allPayload: CreateLeadPayload[] = []
    const originalIndex: number[] = []
    for (const r of validRows) {
      if (!r.data) continue
      originalIndex.push(r.index)
      allPayload.push({
        nome: r.data.nome,
        telefone: r.data.telefone,
        origem: r.data.origem,
        tipo: r.data.tipo,
        tipoResgate: r.data.tipoResgate,
        interacao: r.data.interacao,
        agendouConsulta: r.data.agendouConsulta,
        pagamentoAntecipado: r.data.pagamentoAntecipado,
        dataAgendamento: r.data.dataAgendamento,
        motivoNaoAgendamento: r.data.motivoNaoAgendamento,
        nomeResponsavel: r.data.nomeResponsavel,
        createdAt: r.data.createdAt,
      })
    }

    setProgress({ done: 0, total: allPayload.length })

    let totalCreated = 0
    const allErrors: { index: number; error: string }[] = []

    try {
      for (let start = 0; start < allPayload.length; start += CHUNK_SIZE) {
        const chunk = allPayload.slice(start, start + CHUNK_SIZE)
        // Cede o thread pro browser respirar (paint, etc.) entre lotes.
        await new Promise((r) => setTimeout(r, 0))
        try {
          const resp = await leadsApi.bulkCreate(empresaId, chunk)
          totalCreated += resp.createdCount
          for (const f of resp.failed) {
            allErrors.push({
              index: originalIndex[start + f.index] ?? start + f.index,
              error: f.error,
            })
          }
        } catch (err) {
          // Se o request inteiro do chunk falhar, registra todos como falha.
          const msg = err instanceof Error ? err.message : 'Erro de rede'
          for (let k = 0; k < chunk.length; k++) {
            allErrors.push({
              index: originalIndex[start + k] ?? start + k,
              error: msg,
            })
          }
        }
        setProgress({ done: Math.min(start + chunk.length, allPayload.length), total: allPayload.length })
      }
      setImportedCount(totalCreated)
      setImportErrors(allErrors)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro ao importar.')
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setHeaders([])
    setRecords([])
    setMapping({})
    setFileName(null)
    setParseError(null)
    setImportedCount(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <motion.div
      className="px-8 py-8 max-w-5xl mx-auto"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/[0.05] text-[13px] text-white/70 hover:text-white hover:border-white/[0.12] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar para Dashboard
        </button>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-cyan-500/[0.08] border border-cyan-400/25 text-[13px] text-cyan-300 hover:bg-cyan-500/[0.15] transition-colors"
        >
          <Download className="h-4 w-4" />
          Baixar modelo CSV
        </button>
      </div>

      {/* Empresa selector */}
      <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-4 mb-4 flex items-center gap-3">
        <label className="text-[12px] uppercase tracking-wider text-white/55 shrink-0">Empresa de destino</label>
        <select
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="flex-1 h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px] focus:outline-none focus:border-cyan-400/60"
        >
          <option value="">— selecione —</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        {empresasError && (
          <span className="text-[11px] text-rose-300 inline-flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {empresasError}
          </span>
        )}
      </div>

      {/* Hero — IMPORTAÇÃO EM MASSA (cor âmbar para diferenciar de cadastro manual) */}
      <div
        className="rounded-3xl p-7 mb-5 text-amber-50 ring-2 ring-amber-300/40 shadow-[0_0_0_4px_rgba(251,191,36,0.06)]"
        style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 55%, #92400e 100%)' }}
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/20 grid place-items-center shrink-0">
            <FileSpreadsheet className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-md bg-white/20 text-[10px] font-bold uppercase tracking-[0.2em] text-white mb-2">
              Modo: importação em massa
            </span>
            <h1 className="text-[28px] font-bold tracking-tight leading-none">Importar Planilha</h1>
            <p className="text-[13px] text-amber-50/95 mt-2 leading-relaxed">
              Esta tela é só para subir CSV. <strong className="text-white">Todos os leads enviados aqui serão marcados como &quot;IMPORTADOS&quot;</strong> e ficam separados dos cadastros manuais.
            </p>
            <p className="text-[12px] text-amber-100/85 mt-1.5">
              Para cadastrar UM lead a mão, use o menu <strong>“Novo Lead”</strong>.
            </p>
          </div>
        </div>
      </div>

      {records.length === 0 ? (
        <label
          htmlFor="csv-input"
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={cn(
            'block cursor-pointer rounded-3xl border-2 border-dashed px-8 py-16 text-center transition-colors',
            dragActive
              ? 'border-cyan-400/60 bg-cyan-500/[0.06]'
              : 'border-white/[0.08] bg-[#15171b] hover:border-cyan-400/30 hover:bg-[#191c20]',
          )}
        >
          <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/25 grid place-items-center mx-auto mb-4">
            <Upload className="h-6 w-6 text-cyan-400" />
          </div>
          <p className="text-base text-white font-medium mb-1">
            Arraste o arquivo CSV aqui ou clique para selecionar
          </p>
          <p className="text-[13px] text-white/55 max-w-md mx-auto">
            No Excel/Sheets escolha &quot;Salvar como&quot; → CSV UTF-8. Os cabeçalhos são reconhecidos automaticamente.
          </p>
          <input
            ref={inputRef}
            id="csv-input"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {parseError && (
            <p className="mt-4 text-sm text-rose-300 inline-flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              {parseError}
            </p>
          )}
        </label>
      ) : (
        <div className="space-y-4">
          {/* File summary */}
          <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-400/25 grid place-items-center shrink-0">
                <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] text-white font-medium truncate">{fileName}</p>
                <p className="text-[11px] text-white/55">
                  {records.length} linhas · {headers.length} colunas detectadas
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[12px] text-white/70 hover:text-white hover:border-white/[0.12] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Trocar arquivo
            </button>
          </div>

          {/* Mapping */}
          <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-6">
            <h3 className="text-[14px] font-semibold mb-4">Mapeamento de colunas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-white/65">
                    {f.label}
                    {f.required && <span className="text-cyan-400 ml-1">*</span>}
                  </label>
                  <select
                    value={mapping[f.key] ?? ''}
                    onChange={(e) =>
                      setMapping((cur) => {
                        const next = { ...cur }
                        if (e.target.value) next[f.key] = e.target.value
                        else delete next[f.key]
                        return next
                      })
                    }
                    style={{ colorScheme: 'dark' }}
                    className="h-12 px-4 rounded-2xl bg-[#0c0d10] border border-white/[0.05] text-[14px] focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-colors"
                  >
                    <option value="">— ignorar —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {f.hint && <p className="text-[11px] text-white/45">{f.hint}</p>}
                </div>
              ))}
            </div>

            {requiredMissing.length > 0 && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] text-amber-200 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Campos obrigatórios sem coluna mapeada: {requiredMissing.join(', ')}.</span>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] overflow-hidden">
            <div className="flex items-center justify-between px-6 h-14 border-b border-white/[0.05]">
              <h3 className="text-[14px] font-semibold">Pré-visualização</h3>
              <div className="flex items-center gap-3 text-[12px]">
                <span className="text-cyan-300 tabular-nums">{validRows.length} válidas</span>
                {invalidRows.length > 0 && (
                  <span className="text-rose-300 tabular-nums">{invalidRows.length} com erro</span>
                )}
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0c0d10] sticky top-0">
                  <tr className="text-[10px] uppercase tracking-wider text-white/45">
                    <th className="text-left px-5 py-2.5 font-medium">#</th>
                    <th className="text-left px-5 py-2.5 font-medium">Status</th>
                    <th className="text-left px-5 py-2.5 font-medium">Nome</th>
                    <th className="text-left px-5 py-2.5 font-medium">Telefone</th>
                    <th className="text-left px-5 py-2.5 font-medium">Origem</th>
                    <th className="text-left px-5 py-2.5 font-medium">Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr
                      key={r.index}
                      className={cn(
                        'border-t border-white/[0.04]',
                        r.ok ? 'text-white' : 'text-rose-200/90 bg-rose-500/[0.03]',
                      )}
                    >
                      <td className="px-5 py-2 tabular-nums text-white/40 text-xs">{r.index + 1}</td>
                      <td className="px-5 py-2">
                        {r.ok ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            ok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-300" title={r.error}>
                            <AlertCircle className="h-3.5 w-3.5" />
                            {r.error}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2 truncate max-w-[180px]">{r.data?.nome ?? r.raw[mapping.nome] ?? ''}</td>
                      <td className="px-5 py-2 tabular-nums">{r.data?.telefone ?? r.raw[mapping.telefone] ?? ''}</td>
                      <td className="px-5 py-2 truncate max-w-[140px]">{r.data?.origem ?? r.raw[mapping.origem] ?? ''}</td>
                      <td className="px-5 py-2">{r.data?.nomeResponsavel ?? r.raw[mapping.nomeResponsavel] ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prepared.length > 100 && (
                <p className="text-center text-[11px] text-white/45 py-2">
                  Mostrando 100 de {prepared.length} linhas. Todas as válidas serão importadas.
                </p>
              )}
            </div>
          </div>

          {/* Progress */}
          {importing && progress && (
            <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-4">
              <div className="flex items-center justify-between mb-2 text-[12px]">
                <span className="text-white/65">Importando em lotes…</span>
                <span className="tabular-nums text-cyan-300">
                  {progress.done} / {progress.total} ({progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-[width] duration-150"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {importedCount !== null ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-4 h-11 rounded-2xl bg-cyan-500/[0.08] border border-cyan-400/30 text-cyan-200 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                  {importedCount} {importedCount === 1 ? 'lead importado' : 'leads importados'}.
                </div>
                {importErrors.length > 0 && (
                  <div className="px-4 py-2 rounded-2xl bg-rose-500/[0.08] border border-rose-400/30 text-rose-200 text-xs max-w-md">
                    <div className="font-semibold mb-1">{importErrors.length} linha(s) rejeitada(s) pelo servidor:</div>
                    <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-auto">
                      {importErrors.slice(0, 10).map((e) => (
                        <li key={e.index}>linha {e.index + 1}: {e.error}</li>
                      ))}
                      {importErrors.length > 10 && <li>… +{importErrors.length - 10}</li>}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/55">
                {validRows.length} de {prepared.length} linhas serão importadas.
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-4 h-11 rounded-2xl bg-[#0c0d10] border border-white/[0.05] text-sm text-white/70 hover:text-white hover:border-white/[0.12] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0 || requiredMissing.length > 0 || !empresaId}
                title={!empresaId ? 'Selecione a empresa de destino' : undefined}
                className={cn(
                  'px-5 h-11 rounded-2xl text-sm font-semibold inline-flex items-center gap-2 transition-colors',
                  'bg-cyan-400 hover:bg-cyan-300 text-slate-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <Upload className="h-4 w-4" />
                {importing ? 'Importando…' : `Importar ${validRows.length} ${validRows.length === 1 ? 'lead' : 'leads'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
