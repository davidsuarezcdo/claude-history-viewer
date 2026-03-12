'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Search,
  MessageSquare,
  FolderOpen,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  Hash,
  Copy,
  Check,
  ArrowUpDown,
  CalendarDays,
} from 'lucide-react'

interface HistoryEntry {
  display: string
  pastedContents: Record<string, { id: number; type: string; contentHash: string }>
  timestamp: number
  project: string
  sessionId: string
}

interface Session {
  sessionId: string
  project: string
  projectName: string
  messages: HistoryEntry[]
  firstMessage: string
  lastTimestamp: number
  firstTimestamp: number
  messageCount: number
}

interface ProjectGroup {
  project: string
  projectName: string
  sessions: Session[]
  totalMessages: number
}

interface ApiResponse {
  groups: ProjectGroup[]
  totalEntries: number
  filteredEntries: number
  historyFile: string
  fileExists: boolean
}

function highlight(text: string, search: string): React.ReactNode {
  if (!search) return text
  const idx = text.toLowerCase().indexOf(search.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="highlight">{text.slice(idx, idx + search.length)}</mark>
      {highlight(text.slice(idx + search.length), search)}
    </>
  )
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}

export default function HistoryViewer() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'messages'>('recent')
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('today')
  const [copiedId, setCopiedId] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (selectedProject) params.set('project', selectedProject)

      const res = await fetch(`/api/history?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ApiResponse = await res.json()
      setData(json)

      // Auto-expand first project
      if (json.groups.length > 0 && expandedProjects.size === 0) {
        setExpandedProjects(new Set([json.groups[0].project]))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedProject])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Re-fetch session messages when session changes (if not already loaded)
  const handleSelectSession = async (session: Session) => {
    if (selectedSession?.sessionId === session.sessionId) {
      setSelectedSession(null)
      return
    }

    // Load full session messages
    try {
      const res = await fetch(`/api/history?sessionId=${session.sessionId}`)
      const json = await res.json()
      setSelectedSession({ ...session, messages: json.messages })
    } catch {
      setSelectedSession(session)
    }
  }

  const toggleProject = (project: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(project)) next.delete(project)
      else next.add(project)
      return next
    })
  }

  const clearSearch = () => {
    setSearch('')
    setDebouncedSearch('')
    setSelectedProject('')
  }

  const copySessionId = async (id: string, project: string) => {
    const command = `cd ${project} && claude --dangerously-skip-permissions --resume ${id}`
    await navigator.clipboard.writeText(command)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  // Compute time boundary for filter
  const getTimeBoundary = (): number => {
    const now = Date.now()
    if (timeFilter === 'today') return now - 24 * 60 * 60 * 1000
    if (timeFilter === 'week') return now - 7 * 24 * 60 * 60 * 1000
    if (timeFilter === 'month') return now - 30 * 24 * 60 * 60 * 1000
    return 0
  }

  const filteredGroups = (data?.groups ?? []).map((group) => {
    const boundary = getTimeBoundary()
    const sessions = group.sessions
      .filter((s) => s.lastTimestamp >= boundary)
      .sort((a, b) => {
        if (sortBy === 'oldest') return a.lastTimestamp - b.lastTimestamp
        if (sortBy === 'messages') return b.messageCount - a.messageCount
        return b.lastTimestamp - a.lastTimestamp // recent (default)
      })
    return { ...group, sessions }
  }).filter((group) => group.sessions.length > 0)

  return (
    <div className="flex h-screen overflow-hidden bg-claude-bg text-claude-text">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-claude-sidebar border-r border-claude-border">
        {/* Header */}
        <div className="p-4 border-b border-claude-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-claude-accent flex items-center justify-center">
              <MessageSquare size={14} className="text-black" />
            </div>
            <h1 className="font-semibold text-sm">Claude History</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar mensajes..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-claude-card border border-claude-border rounded-lg
                         text-claude-text placeholder:text-claude-muted focus:outline-none focus:border-claude-accent
                         transition-colors"
            />
            {(search || selectedProject) && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-claude-muted hover:text-claude-text"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort + Time filter */}
          <div className="flex gap-2 mt-2">
            <div className="flex items-center gap-1 flex-1 bg-claude-card border border-claude-border rounded-lg px-2 py-1.5">
              <ArrowUpDown size={11} className="text-claude-muted flex-shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="flex-1 bg-transparent text-xs text-claude-text focus:outline-none cursor-pointer"
              >
                <option value="recent">Más reciente</option>
                <option value="oldest">Más antigua</option>
                <option value="messages">Más mensajes</option>
              </select>
            </div>
            <div className="flex items-center gap-1 flex-1 bg-claude-card border border-claude-border rounded-lg px-2 py-1.5">
              <CalendarDays size={11} className="text-claude-muted flex-shrink-0" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
                className="flex-1 bg-transparent text-xs text-claude-text focus:outline-none cursor-pointer"
              >
                <option value="all">Todo</option>
                <option value="today">Hoy</option>
                <option value="week">7 días</option>
                <option value="month">30 días</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div className="px-4 py-2 flex gap-3 text-xs text-claude-muted border-b border-claude-border">
            <span className="flex items-center gap-1">
              <Hash size={10} />
              {data.totalEntries.toLocaleString()} msgs
            </span>
            <span className="flex items-center gap-1">
              <FolderOpen size={10} />
              {data.groups.length} proyectos
            </span>
            {debouncedSearch && (
              <span className="text-claude-accent">
                {data.filteredEntries} resultados
              </span>
            )}
          </div>
        )}

        {/* Error / no file */}
        {data && !data.fileExists && (
          <div className="m-3 p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-400 flex gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              Archivo no encontrado:<br />
              <code className="text-red-300">{data.historyFile}</code>
            </div>
          </div>
        )}

        {/* Project list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-claude-muted">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}

          {error && (
            <div className="m-3 p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-400">
              Error: {error}
            </div>
          )}

          {!loading && filteredGroups.map((group) => (
            <div key={group.project}>
              {/* Project header */}
              <button
                onClick={() => toggleProject(group.project)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-claude-hover
                           transition-colors border-b border-claude-border/50
                           ${selectedProject === group.project ? 'bg-claude-hover' : ''}`}
              >
                {expandedProjects.has(group.project)
                  ? <ChevronDown size={14} className="text-claude-muted flex-shrink-0" />
                  : <ChevronRight size={14} className="text-claude-muted flex-shrink-0" />
                }
                <FolderOpen size={14} className="text-claude-accent flex-shrink-0" />
                <span className="flex-1 text-xs font-medium truncate" title={group.project}>
                  {group.projectName}
                </span>
                <span className="text-xs text-claude-muted bg-claude-card px-1.5 py-0.5 rounded">
                  {group.sessions.length}
                </span>
              </button>

              {/* Sessions */}
              {expandedProjects.has(group.project) && (
                <div>
                  {group.sessions.map((session) => (
                    <button
                      key={session.sessionId}
                      onClick={() => handleSelectSession(session)}
                      className={`w-full text-left px-4 py-2.5 border-b border-claude-border/30
                                 hover:bg-claude-hover transition-colors
                                 ${selectedSession?.sessionId === session.sessionId
                                   ? 'bg-claude-card border-l-2 border-l-claude-accent'
                                   : ''}`}
                    >
                      <div className="text-xs text-claude-text leading-snug mb-1 line-clamp-2">
                        {debouncedSearch
                          ? highlight(truncate(session.firstMessage, 100), debouncedSearch)
                          : truncate(session.firstMessage, 90)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-claude-muted">
                        <Clock size={10} />
                        <span>{formatDistanceToNow(session.lastTimestamp, { locale: es, addSuffix: true })}</span>
                        <span className="ml-auto flex items-center gap-1">
                          <MessageSquare size={10} />
                          {session.messageCount}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {!loading && filteredGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-claude-muted text-sm">
              <MessageSquare size={32} className="mb-3 opacity-30" />
              <p>Sin resultados</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSession ? (
          <>
            {/* Session header */}
            <div className="px-6 py-4 border-b border-claude-border flex items-center gap-3 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FolderOpen size={14} className="text-claude-accent" />
                  <span className="text-sm text-claude-muted">{selectedSession.projectName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-claude-muted">
                  <span className="flex items-center gap-1">
                    <MessageSquare size={10} />
                    {selectedSession.messageCount} mensajes
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {format(selectedSession.firstTimestamp, 'dd MMM yyyy HH:mm', { locale: es })}
                  </span>
                  <span className="text-claude-border">→</span>
                  <span>{format(selectedSession.lastTimestamp, 'dd MMM yyyy HH:mm', { locale: es })}</span>
                  <button
                    onClick={() => copySessionId(selectedSession.sessionId, selectedSession.project)}
                    title={`cd ${selectedSession.project} && claude --dangerously-skip-permissions --resume ${selectedSession.sessionId}`}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-claude-card border border-claude-border
                               hover:border-claude-accent hover:text-claude-text transition-colors font-mono"
                  >
                    {copiedId
                      ? <Check size={10} className="text-green-400" />
                      : <Copy size={10} />
                    }
                    <span className={copiedId ? 'text-green-400' : ''}>
                      {copiedId ? 'copiado' : selectedSession.sessionId.slice(0, 8)}
                    </span>
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="ml-auto text-claude-muted hover:text-claude-text p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {selectedSession.messages.map((msg, idx) => (
                <div
                  key={`${msg.sessionId}-${msg.timestamp}-${idx}`}
                  className="group flex gap-3"
                >
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-claude-card border border-claude-border flex-shrink-0
                                  flex items-center justify-center mt-0.5">
                    <span className="text-xs font-bold text-claude-accent">U</span>
                  </div>

                  {/* Bubble */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-claude-text">Tú</span>
                      <span className="text-xs text-claude-muted">
                        {format(msg.timestamp, 'HH:mm:ss')}
                      </span>
                      {Object.keys(msg.pastedContents).length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-claude-card border border-claude-border rounded text-claude-muted">
                          +{Object.keys(msg.pastedContents).length} adjunto
                        </span>
                      )}
                    </div>
                    <div className="bg-claude-card border border-claude-border rounded-xl px-4 py-3
                                    text-sm text-claude-text message-text leading-relaxed">
                      {debouncedSearch
                        ? highlight(msg.display, debouncedSearch)
                        : msg.display}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-claude-muted">
            <div className="w-16 h-16 rounded-full bg-claude-card border border-claude-border flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-claude-accent opacity-60" />
            </div>
            <h2 className="text-lg font-medium text-claude-text mb-2">Claude History Viewer</h2>
            <p className="text-sm text-center max-w-xs">
              Selecciona una sesión del panel izquierdo para ver el historial de mensajes.
            </p>
            {data && (
              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                <div className="bg-claude-card border border-claude-border rounded-xl p-4">
                  <div className="text-2xl font-bold text-claude-accent">{data.totalEntries.toLocaleString()}</div>
                  <div className="text-xs text-claude-muted mt-1">Mensajes</div>
                </div>
                <div className="bg-claude-card border border-claude-border rounded-xl p-4">
                  <div className="text-2xl font-bold text-claude-accent">
                    {data.groups.reduce((acc, g) => acc + g.sessions.length, 0)}
                  </div>
                  <div className="text-xs text-claude-muted mt-1">Sesiones</div>
                </div>
                <div className="bg-claude-card border border-claude-border rounded-xl p-4">
                  <div className="text-2xl font-bold text-claude-accent">{data.groups.length}</div>
                  <div className="text-xs text-claude-muted mt-1">Proyectos</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
