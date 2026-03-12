import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'

export const dynamic = 'force-dynamic'

const HISTORY_FILE = process.env.HISTORY_FILE || '/data/history.jsonl'

export interface HistoryEntry {
  display: string
  pastedContents: Record<string, { id: number; type: string; contentHash: string }>
  timestamp: number
  project: string
  sessionId: string
}

export interface Session {
  sessionId: string
  project: string
  projectName: string
  messages: HistoryEntry[]
  firstMessage: string
  lastTimestamp: number
  firstTimestamp: number
  messageCount: number
}

export interface ProjectGroup {
  project: string
  projectName: string
  sessions: Session[]
  totalMessages: number
}

function parseHistoryFile(): HistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return []
    }
    const content = fs.readFileSync(HISTORY_FILE, 'utf-8')
    const entries: HistoryEntry[] = []

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const entry = JSON.parse(trimmed) as HistoryEntry
        if (entry.sessionId && entry.timestamp) {
          entries.push(entry)
        }
      } catch {
        // skip malformed lines
      }
    }

    return entries
  } catch {
    return []
  }
}

function getProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || projectPath
}

function groupIntoSessions(entries: HistoryEntry[]): ProjectGroup[] {
  const sessionMap = new Map<string, Session>()

  for (const entry of entries) {
    const existing = sessionMap.get(entry.sessionId)
    if (existing) {
      existing.messages.push(entry)
      if (entry.timestamp > existing.lastTimestamp) {
        existing.lastTimestamp = entry.timestamp
      }
    } else {
      sessionMap.set(entry.sessionId, {
        sessionId: entry.sessionId,
        project: entry.project,
        projectName: getProjectName(entry.project),
        messages: [entry],
        firstMessage: entry.display,
        lastTimestamp: entry.timestamp,
        firstTimestamp: entry.timestamp,
        messageCount: 1,
      })
    }
  }

  // Update message counts and sort messages
  for (const session of sessionMap.values()) {
    session.messageCount = session.messages.length
    session.messages.sort((a, b) => a.timestamp - b.timestamp)
    session.firstMessage = session.messages[0]?.display || ''
    session.firstTimestamp = session.messages[0]?.timestamp || session.lastTimestamp
  }

  // Group by project
  const projectMap = new Map<string, ProjectGroup>()
  for (const session of sessionMap.values()) {
    const existing = projectMap.get(session.project)
    if (existing) {
      existing.sessions.push(session)
      existing.totalMessages += session.messageCount
    } else {
      projectMap.set(session.project, {
        project: session.project,
        projectName: session.projectName,
        sessions: [session],
        totalMessages: session.messageCount,
      })
    }
  }

  // Sort sessions within each project by last timestamp desc
  for (const group of projectMap.values()) {
    group.sessions.sort((a, b) => b.lastTimestamp - a.lastTimestamp)
  }

  // Sort projects by total messages desc
  const groups = Array.from(projectMap.values())
  groups.sort((a, b) => b.totalMessages - a.totalMessages)

  return groups
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.toLowerCase() || ''
  const project = searchParams.get('project') || ''
  const sessionId = searchParams.get('sessionId') || ''

  const entries = parseHistoryFile()

  // If requesting a specific session
  if (sessionId) {
    const sessionEntries = entries
      .filter((e) => e.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp)
    return NextResponse.json({ messages: sessionEntries })
  }

  let filtered = entries

  // Filter by project
  if (project) {
    filtered = filtered.filter((e) => e.project === project)
  }

  // Filter by search
  if (search) {
    filtered = filtered.filter((e) => e.display.toLowerCase().includes(search))
  }

  const groups = groupIntoSessions(filtered)

  return NextResponse.json({
    groups,
    totalEntries: entries.length,
    filteredEntries: filtered.length,
    historyFile: HISTORY_FILE,
    fileExists: fs.existsSync(HISTORY_FILE),
  })
}
