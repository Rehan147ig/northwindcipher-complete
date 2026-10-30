import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelPanel } from './PixelPanel';
import { PixelButton } from './PixelButton';
import { PixelBadge } from './PixelBadge';
import { Icon } from './Icon';
import { useStore } from '@/store/store';
import { MarkdownPreview } from '@/markdown/MarkdownPreview';
import { useRtl } from '@/i18n/useDirection';
import {
  SDLC_STAGES,
  SDLC_POWERS,
  type SDLCStage,
  type ControlMode,
  type StageReviewPoint,
  type StageEvidence,
  getPower,
  getNextStage
} from '@shared/sdlcWorkflow';

export interface HumanQA {
  q: string;
  a?: string;
  askedAt?: string;
  answeredAt?: string;
  dismissedAt?: string;
}

export interface HiveTask {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  status: 'todo' | 'doing' | 'blocked' | 'done';
  dependsOn: string[];
  priority: number;
  createdAt: string;
  humanQA?: HumanQA[];
  stage?: SDLCStage;
  controlMode?: ControlMode;
  power?: string;
  reviewPoints?: StageReviewPoint[];
  evidence?: StageEvidence[];
}

export function openQuestion(t: HiveTask): HumanQA | undefined {
  if (!Array.isArray(t.humanQA)) return undefined;
  for (let i = t.humanQA.length - 1; i >= 0; i--) {
    const e = t.humanQA[i];
    if (e && typeof e.q === 'string' && !e.a && !e.dismissedAt) return e;
  }
  return undefined;
}

export function waitsOnHuman(t: HiveTask): boolean {
  return t.status === 'blocked' && !!openQuestion(t);
}

export function isAwaitingReview(t: HiveTask): boolean {
  if (t.controlMode === 'co-pilot' && t.status === 'blocked') return true;
  const currentStage = t.stage || 'discover';
  const point = t.reviewPoints?.find((rp) => rp.stage === currentStage);
  return point ? point.status === 'pending' : false;
}

type Status = HiveTask['status'];

const KANBAN_COLUMNS: { key: Status; labelKey: string; accent: string }[] = [
  { key: 'todo',    labelKey: 'kanban.colTodo',    accent: 'var(--cth-sky)' },
  { key: 'doing',   labelKey: 'kanban.colDoing',   accent: 'var(--cth-lemon)' },
  { key: 'blocked', labelKey: 'kanban.colBlocked', accent: 'var(--cth-coral)' },
  { key: 'done',    labelKey: 'kanban.colDone',    accent: 'var(--cth-mint)' }
];

const POLL_MS = 5000;

function stableId(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (((h << 5) + h) ^ seed.charCodeAt(i)) | 0;
  return `t-${(h >>> 0).toString(36)}`;
}

export function parseTasks(raw: unknown): HiveTask[] {
  const list = (raw && typeof raw === 'object' && Array.isArray((raw as { tasks?: unknown }).tasks))
    ? (raw as { tasks: unknown[] }).tasks
    : [];
  return list
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t, i) => {
      const validStatuses = ['todo', 'doing', 'blocked', 'done'] as const;
      const status: Status = validStatuses.includes(t.status as Status) ? (t.status as Status) : 'todo';
      const validStages = ['discover', 'plan', 'build', 'verify', 'deliver'] as const;
      const stage: SDLCStage = validStages.includes(t.stage as SDLCStage)
        ? (t.stage as SDLCStage)
        : status === 'done' ? 'deliver' : status === 'doing' ? 'build' : status === 'blocked' ? 'plan' : 'discover';

      const controlMode: ControlMode = t.controlMode === 'co-pilot' ? 'co-pilot' : 'auto-pilot';

      return {
        id: typeof t.id === 'string' && t.id
          ? t.id
          : stableId(`${typeof t.title === 'string' ? t.title : ''}|${typeof t.createdAt === 'string' ? t.createdAt : ''}|${i}`),
        title: typeof t.title === 'string' ? t.title : '(untitled)',
        description: typeof t.description === 'string' ? t.description : undefined,
        assignee: typeof t.assignee === 'string' ? t.assignee : undefined,
        status,
        stage,
        controlMode,
        power: typeof t.power === 'string' ? t.power : undefined,
        dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.filter((d): d is string => typeof d === 'string') : [],
        priority: typeof t.priority === 'number' ? t.priority : 3,
        createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
        humanQA: Array.isArray(t.humanQA)
          ? (t.humanQA as unknown[])
            .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && typeof (e as { q?: unknown }).q === 'string')
            .map((e) => ({
              q: e.q as string,
              a: typeof e.a === 'string' ? e.a : undefined,
              askedAt: typeof e.askedAt === 'string' ? e.askedAt : undefined,
              answeredAt: typeof e.answeredAt === 'string' ? e.answeredAt : undefined,
              dismissedAt: typeof e.dismissedAt === 'string' ? e.dismissedAt : undefined
            }))
          : undefined,
        reviewPoints: Array.isArray(t.reviewPoints) ? (t.reviewPoints as StageReviewPoint[]) : undefined,
        evidence: Array.isArray(t.evidence) ? (t.evidence as StageEvidence[]) : undefined
      };
    });
}

export function TasksKanban() {
  const { t } = useTranslation();
  const agents = useStore((s) => s.agents);
  const [tasks, setTasks] = useState<HiveTask[]>([]);
  const [viewMode, setViewMode] = useState<'sdlc' | 'classic'>('sdlc');
  const openTaskDetail = useStore((s) => s.openTaskDetail);
  const requestCommandCenterTab = useStore((s) => s.requestCommandCenterTab);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try { setTasks(parseTasks(await window.cth.hiveTasks())); } catch { /* keep last good */ }
  }, []);

  const dismissTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      const result = await window.cth.hiveDeleteTask(id);
      if (!result.ok) void refresh();
    } catch { /* keep last good */ }
  }, [refresh]);

  const approveReviewPoint = async (task: HiveTask) => {
    const currentStage = task.stage || 'discover';
    const next = getNextStage(currentStage);
    const now = new Date().toISOString();

    const updatedReviewPoints = (task.reviewPoints || []).filter((rp) => rp.stage !== currentStage);
    updatedReviewPoints.push({
      stage: currentStage,
      status: 'approved',
      reviewedAt: now,
      reviewerNotes: 'Approved via SDLC stage review'
    });

    const patch: Partial<HiveTask> = {
      reviewPoints: updatedReviewPoints,
      status: next ? 'doing' : 'done',
      stage: next || currentStage
    };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    await window.cth.hivePatchTask(task.id, patch);

    // Notify the orchestrator
    await window.cth.hiveSend({
      to: 'god',
      act: 'inform',
      subject: `[SDLC REVIEW APPROVED] ${task.title}`,
      body: `Review point for Stage ${currentStage.toUpperCase()} approved. Task advanced to ${next ? next.toUpperCase() : 'DELIVER (COMPLETE)'}.`
    }, 'human');
    void refresh();
  };

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [refresh]);

  const restorableAgents = useStore((s) => s.restorableAgents);
  const nameFor = (id?: string): string | undefined =>
    id
      ? (agents.find((a) => a.id === id)?.name
        ?? restorableAgents.find((a) => a.id === id)?.name
        ?? id)
      : undefined;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--cth-paper-200)', position: 'relative' }}>
      {/* Top Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', flexShrink: 0,
        borderBottom: '1px solid var(--cth-ink-300)', background: 'var(--cth-cream-100)'
      }}>
        {/* View Mode Switcher */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--cth-cream-200)', padding: 2, boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
          <button
            onClick={() => setViewMode('sdlc')}
            style={{
              padding: '3px 8px', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--cth-font-ui)', fontSize: 11,
              background: viewMode === 'sdlc' ? 'var(--cth-lemon)' : 'transparent',
              color: 'var(--cth-ink-900)', fontWeight: viewMode === 'sdlc' ? 'bold' : 'normal'
            }}
          >
            ✳ SDLC Delivery Stages
          </button>
          <button
            onClick={() => setViewMode('classic')}
            style={{
              padding: '3px 8px', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--cth-font-ui)', fontSize: 11,
              background: viewMode === 'classic' ? 'var(--cth-lemon)' : 'transparent',
              color: 'var(--cth-ink-900)', fontWeight: viewMode === 'classic' ? 'bold' : 'normal'
            }}
          >
            Classic Kanban
          </button>
        </div>

        <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-500)' }}>
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <PixelButton variant="secondary" size="sm" onClick={() => requestCommandCenterTab('pulse')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="sparkle" /> Pulse
            </span>
          </PixelButton>
        </div>
      </div>

      {/* Main Board Columns */}
      {viewMode === 'sdlc' ? (
        /* 5-Stage SDLC Workflow View */
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, padding: 10, overflowX: 'auto' }}>
          {SDLC_STAGES.map((stageDef) => {
            const cards = tasks.filter((t) => (t.stage || 'discover') === stageDef.key);
            return (
              <div
                key={stageDef.key}
                style={{
                  flex: '1 1 0', minWidth: 200, display: 'flex', flexDirection: 'column',
                  background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
                }}
              >
                {/* Stage Header */}
                <div style={{
                  padding: '6px 8px', background: stageDef.accent,
                  boxShadow: 'inset 0 -1px 0 var(--cth-ink-900)', display: 'flex',
                  flexDirection: 'column', gap: 2
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-900)' }}>
                      {stageDef.num} {stageDef.name.toUpperCase()}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--cth-font-ui)', color: 'var(--cth-ink-900)' }}>
                      {cards.length}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--cth-ink-700)', lineHeight: '12px' }}>
                    {stageDef.shortDesc}
                  </div>
                </div>

                {/* Cards Container */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cards.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--cth-ink-300)', textAlign: 'center', padding: '12px 0' }}>
                      — no tasks in {stageDef.name} —
                    </div>
                  )}
                  {cards.map((t) => (
                    <SDLCWorkflowCard
                      key={t.id}
                      task={t}
                      stageDef={stageDef}
                      assigneeName={nameFor(t.assignee)}
                      onOpen={() => openTaskDetail(t.id)}
                      onDismiss={() => dismissTask(t.id)}
                      onApproveReview={() => approveReviewPoint(t)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Classic 4-Column Kanban View */
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, padding: 10, overflowX: 'auto' }}>
          {KANBAN_COLUMNS.map((col) => {
            const cards = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} style={{
                flex: '1 1 0', minWidth: 170, display: 'flex', flexDirection: 'column',
                background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 4px',
                  background: col.accent, boxShadow: 'inset 0 -1px 0 var(--cth-ink-900)',
                  fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-900)'
                }}>
                  {t(col.labelKey)}
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--cth-font-ui)' }}>{cards.length}</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cards.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--cth-ink-300)', textAlign: 'center', padding: '8px 0' }}>—</div>
                  )}
                  {cards.map((t) => (
                    <ClassicTaskCard
                      key={t.id}
                      task={t}
                      accent={col.accent}
                      assigneeName={nameFor(t.assignee)}
                      onOpen={() => openTaskDetail(t.id)}
                      onDismiss={() => dismissTask(t.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SDLC Workflow Card ──────────────────────────────────────────

function SDLCWorkflowCard({
  task,
  stageDef,
  assigneeName,
  onOpen,
  onDismiss,
  onApproveReview
}: {
  task: HiveTask;
  stageDef: typeof SDLC_STAGES[number];
  assigneeName?: string;
  onOpen: () => void;
  onDismiss: () => void;
  onApproveReview: () => void;
}) {
  const power = getPower(task.power);
  const awaitingReview = isAwaitingReview(task);

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      background: 'var(--cth-paper-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-200)'
    }}>
      <button
        onClick={onOpen}
        style={{
          display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px',
          border: 'none', cursor: 'pointer', textAlign: 'left', background: 'transparent'
        }}
      >
        {/* Top Meta Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--cth-font-mono)', fontSize: 9, color: 'var(--cth-ink-500)' }}>
            {task.id}
          </span>

          {/* Control Mode Badge */}
          <span style={{
            fontFamily: 'var(--cth-font-display)', fontSize: 7, padding: '1px 4px',
            background: task.controlMode === 'co-pilot' ? 'var(--cth-sky-light, #e0f2fe)' : 'var(--cth-lemon-light, #fef3c7)',
            color: 'var(--cth-ink-900)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
          }}>
            {task.controlMode === 'co-pilot' ? '🛡️ Co-pilot' : '⚡ Auto-pilot'}
          </span>

          {/* Power Badge */}
          {power && (
            <span style={{
              fontSize: 9, padding: '1px 5px', background: 'var(--cth-cream-200)',
              color: 'var(--cth-ink-700)', fontFamily: 'var(--cth-font-display)'
            }}>
              {power.name}
            </span>
          )}

          {assigneeName && (
            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-display)' }}>
              {assigneeName.toUpperCase()}
            </span>
          )}
        </div>

        {/* Title */}
        <span style={{
          fontFamily: 'var(--cth-font-ui)', fontSize: 12, lineHeight: '16px',
          color: 'var(--cth-ink-900)', fontWeight: 500
        }}>
          {task.title}
        </span>

        {/* Evidence Count */}
        {(task.evidence?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--cth-ink-500)' }}>📁</span>
            <span style={{ fontSize: 10, color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-display)' }}>
              {task.evidence!.length} {task.evidence!.length === 1 ? 'evidence item' : 'evidence items'}
            </span>
          </div>
        )}
      </button>

      {/* Review Point Gate Notice (In Co-pilot Mode) */}
      {awaitingReview && (
        <div style={{
          margin: '0 6px 6px 6px', padding: '6px 8px',
          background: 'var(--cth-coral-light, #fee2e2)',
          boxShadow: 'inset 0 0 0 1px var(--cth-coral)',
          display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10 }}>⚠️</span>
            <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-coral-dark, #991b1b)' }}>
              REVIEW POINT: {stageDef.reviewPointName.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--cth-ink-800)', lineHeight: '13px' }}>
            {stageDef.reviewPrompt}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onApproveReview(); }}
            style={{
              marginTop: 2, padding: '3px 8px', background: 'var(--cth-mint)',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--cth-font-ui)',
              fontSize: 11, fontWeight: 'bold', color: 'var(--cth-ink-900)',
              boxShadow: 'inset 0 0 0 1px var(--cth-ink-900)'
            }}
          >
            ✓ Approve & Advance Stage
          </button>
        </div>
      )}

      {/* Dismiss Button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        title="Dismiss task"
        style={{
          position: 'absolute', top: 2, right: 2, width: 16, height: 16, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', background: 'transparent',
          color: 'var(--cth-ink-400)', fontSize: 11
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--cth-coral)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--cth-ink-400)'; }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Classic Task Card ──────────────────────────────────────────────────────

function ClassicTaskCard({ task, accent, assigneeName, onOpen, onDismiss }: {
  task: HiveTask;
  accent: string;
  assigneeName?: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button
        onClick={onOpen}
        title={t('kanban.openTaskDetails')}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'stretch', gap: 0, padding: 0,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          background: 'var(--cth-paper-100)',
          boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)'
        }}
      >
        <span style={{ width: 4, flexShrink: 0, background: accent, boxShadow: 'inset -1px 0 0 var(--cth-ink-700)' }} />
        <span style={{ flex: 1, minWidth: 0, padding: '6px 18px 6px 7px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'var(--cth-font-mono)', fontSize: 10, color: 'var(--cth-ink-500)' }}>
              {task.id}
            </span>
            {task.stage && (
              <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 7, color: 'var(--cth-ink-500)' }}>
                {task.stage.toUpperCase()}
              </span>
            )}
          </div>
          <span style={{
            fontFamily: 'var(--cth-font-ui)', fontSize: 12, lineHeight: '16px',
            color: 'var(--cth-ink-900)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>{task.title}</span>
          {assigneeName && (
            <span style={{ fontSize: 10, color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-display)' }}>
              {assigneeName.toUpperCase()}
            </span>
          )}
        </span>
        {waitsOnHuman(task) && (
          <span title={t('kanban.needsYouTitle')} style={{
            alignSelf: 'center', marginRight: 18, flexShrink: 0,
            fontFamily: 'var(--cth-font-display)', fontSize: 10, padding: '2px 5px 1px',
            background: 'var(--cth-lilac)', color: 'var(--cth-ink-900)',
            boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
          }}>?</span>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        title={t('kanban.dismissTitle')}
        aria-label={t('kanban.dismissAria')}
        style={{
          position: 'absolute', top: 0, right: 0, width: 16, height: 16, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          border: 'none', cursor: 'pointer', background: 'transparent',
          color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-ui)', fontSize: 12
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--cth-coral)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--cth-ink-500)'; }}
      >✕</button>
    </div>
  );
}

// ─── Task Detail Modal Overlay ──────────────────────────────────────────────

export function TaskDetail({ task, all, assigneeName, onMove, onAssign, onClose }: {
  task: HiveTask;
  all: HiveTask[];
  assigneeName?: string;
  onMove: (s: Status) => void;
  onAssign: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const power = getPower(task.power);
  const currentStageKey = task.stage || 'discover';
  const currentStageDef = SDLC_STAGES.find((s) => s.key === currentStageKey) || SDLC_STAGES[0];
  const col = KANBAN_COLUMNS.find((c) => c.key === task.status) ?? KANBAN_COLUMNS[0];
  const deps = (task.dependsOn ?? []).map((id) => all.find((t) => t.id === id)).filter((t): t is HiveTask => !!t);
  const created = new Date(task.createdAt);

  const [reviewNote, setReviewNote] = useState('');
  const [controlMode, setControlMode] = useState<ControlMode>(task.controlMode || 'auto-pilot');

  const handleSetControlMode = async (mode: ControlMode) => {
    setControlMode(mode);
    await window.cth.hivePatchTask(task.id, { controlMode: mode });
  };

  const handleAdvanceStage = async (nextStage: SDLCStage) => {
    const isLast = nextStage === 'deliver';
    await window.cth.hivePatchTask(task.id, {
      stage: nextStage,
      status: isLast ? 'done' : 'doing'
    });
    onClose();
  };

  const handleApproveReviewPoint = async () => {
    const next = getNextStage(currentStageKey);
    const now = new Date().toISOString();
    const updatedReviewPoints = (task.reviewPoints || []).filter((rp) => rp.stage !== currentStageKey);
    updatedReviewPoints.push({
      stage: currentStageKey,
      status: 'approved',
      reviewedAt: now,
      reviewerNotes: reviewNote || 'Approved via SDLC review point gate'
    });

    const updatedEvidence = task.evidence ? [...task.evidence] : [];
    updatedEvidence.push({
      stage: currentStageKey,
      summary: reviewNote || `Stage ${currentStageKey.toUpperCase()} approved and passed review gate.`,
      timestamp: now
    });

    await window.cth.hivePatchTask(task.id, {
      reviewPoints: updatedReviewPoints,
      evidence: updatedEvidence,
      stage: next || currentStageKey,
      status: next ? 'doing' : 'done'
    });

    await window.cth.hiveSend({
      to: 'god',
      act: 'inform',
      subject: `[SDLC REVIEW APPROVED] ${task.title}`,
      body: `Review point for Stage ${currentStageKey.toUpperCase()} approved by human. Notes: ${reviewNote || 'Approved'}. Work continuing.`
    }, 'human');

    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 280,
        background: 'rgba(26, 19, 32, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 780, maxWidth: '96vw', maxHeight: '92vh', display: 'flex' }}>
        <PixelPanel variant="dialog" title={t('kanban.taskTitle')} noPadding style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0 }}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflowY: 'auto' }}>
            
            {/* Title Bar */}
            <div style={{ borderLeft: `4px solid ${currentStageDef.accent}`, paddingLeft: 8 }}>
              <div style={{ fontFamily: 'var(--cth-font-ui)', fontSize: 16, lineHeight: '22px', color: 'var(--cth-ink-900)', fontWeight: 600 }}>
                {task.title}
              </div>
            </div>

            {/* 5-Stage Stepper */}
            <div style={{
              padding: 10, background: 'var(--cth-cream-100)',
              boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
              display: 'flex', flexDirection: 'column', gap: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>
                  SDLC DELIVERY PIPELINE
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cth-ink-500)' }}>
                  Stage: <strong>{currentStageDef.num} {currentStageDef.name}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {SDLC_STAGES.map((s, idx) => {
                  const isCurrent = s.key === currentStageKey;
                  const currentIdx = SDLC_STAGES.findIndex((st) => st.key === currentStageKey);
                  const isCompleted = currentIdx > idx || task.status === 'done';

                  return (
                    <div
                      key={s.key}
                      onClick={() => handleAdvanceStage(s.key)}
                      style={{
                        flex: 1, padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
                        background: isCurrent ? s.accent : isCompleted ? 'var(--cth-mint-light, #d1fae5)' : 'var(--cth-paper-100)',
                        boxShadow: isCurrent ? 'inset 0 0 0 2px var(--cth-ink-900)' : 'inset 0 0 0 1px var(--cth-ink-300)',
                        display: 'flex', flexDirection: 'column', gap: 2
                      }}
                    >
                      <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-900)' }}>
                        {isCompleted && !isCurrent ? '✓ ' : ''}{s.num} {s.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fact Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--cth-font-mono)', fontSize: 10, color: 'var(--cth-ink-500)' }}>
                {task.id}
              </span>

              {/* Control Mode Switcher */}
              <div style={{ display: 'flex', gap: 2, background: 'var(--cth-cream-200)', padding: 2, boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
                <button
                  onClick={() => handleSetControlMode('auto-pilot')}
                  style={{
                    padding: '2px 6px', border: 'none', cursor: 'pointer', fontSize: 10,
                    fontFamily: 'var(--cth-font-display)',
                    background: controlMode === 'auto-pilot' ? 'var(--cth-lemon)' : 'transparent',
                    color: 'var(--cth-ink-900)'
                  }}
                >
                  ⚡ Auto-pilot
                </button>
                <button
                  onClick={() => handleSetControlMode('co-pilot')}
                  style={{
                    padding: '2px 6px', border: 'none', cursor: 'pointer', fontSize: 10,
                    fontFamily: 'var(--cth-font-display)',
                    background: controlMode === 'co-pilot' ? 'var(--cth-sky)' : 'transparent',
                    color: 'var(--cth-ink-900)'
                  }}
                >
                  🛡️ Co-pilot
                </button>
              </div>

              {power && (
                <span style={{
                  fontFamily: 'var(--cth-font-display)', fontSize: 8, padding: '2px 6px 1px',
                  background: 'var(--cth-cream-200)', color: 'var(--cth-ink-900)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
                }}>
                  Power: {power.name}
                </span>
              )}

              {assigneeName ? (
                <PixelBadge status="working" label={assigneeName} />
              ) : (
                <span style={{ fontSize: 11, color: 'var(--cth-ink-300)' }}>{t('kanban.unassigned')}</span>
              )}

              <PriorityDots level={Math.max(1, Math.min(5, task.priority))} />

              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cth-ink-500)', fontFamily: 'var(--cth-font-display)' }}>
                {isNaN(created.getTime()) ? '' : created.toLocaleString()}
              </span>
            </div>

            {/* Review Point Gate (If Co-pilot or Pending) */}
            {(controlMode === 'co-pilot' || isAwaitingReview(task)) && (
              <div style={{
                padding: 10, background: 'var(--cth-coral-light, #fee2e2)',
                boxShadow: 'inset 0 0 0 1px var(--cth-coral)', display: 'flex',
                flexDirection: 'column', gap: 6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>⚠️</span>
                  <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-coral-dark, #991b1b)' }}>
                    REVIEW POINT: {currentStageDef.reviewPointName.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--cth-ink-900)', lineHeight: '17px' }}>
                  {currentStageDef.reviewPrompt}
                </div>
                <input
                  type="text"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Optional review notes, decisions, or guidance before advancing..."
                  style={{
                    padding: '6px 8px', background: 'var(--cth-paper-100)', border: 'none',
                    boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', fontFamily: 'var(--cth-font-ui)',
                    fontSize: 12, color: 'var(--cth-ink-900)'
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <PixelButton variant="primary" size="sm" onClick={handleApproveReviewPoint}>
                    ✓ Approve & Advance to {getNextStage(currentStageKey)?.toUpperCase() || 'DELIVERY'}
                  </PixelButton>
                </div>
              </div>
            )}

            {/* Task Description / Contract */}
            <div style={{
              padding: 10, background: 'var(--cth-paper-100)',
              boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
              fontFamily: 'var(--cth-font-mono)', fontSize: 12, lineHeight: '18px',
              color: 'var(--cth-ink-900)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
            }} dir={rtl ? 'auto' : undefined}>
              {task.description?.trim() || <span style={{ color: 'var(--cth-ink-300)' }}>{t('kanban.noDescription')}</span>}
            </div>

            {/* Change Evidence Behind the Work */}
            {(task.evidence?.length ?? 0) > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>
                  REVIEWABLE CHANGE EVIDENCE ({task.evidence!.length})
                </div>
                {task.evidence!.map((ev, i) => (
                  <div key={i} style={{
                    padding: '6px 8px', background: 'var(--cth-cream-200)',
                    boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', display: 'flex',
                    flexDirection: 'column', gap: 2
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-700)' }}>
                        STAGE: {ev.stage.toUpperCase()}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cth-ink-400)' }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--cth-ink-900)' }}>
                      {ev.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Human Q&A Trail */}
            {(task.humanQA?.length ?? 0) > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>
                  {t('kanban.humanQA')}
                </div>
                {task.humanQA!.map((e, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{
                      display: 'flex', gap: 6, padding: '5px 7px',
                      background: 'var(--cth-lilac-light, #ece2f5)',
                      boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                      fontSize: 12, lineHeight: '17px', color: 'var(--cth-ink-900)'
                    }}>
                      <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, flexShrink: 0, marginTop: 2 }}>Q</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <MarkdownPreview source={e.q} variant="card" />
                      </div>
                    </div>
                    {e.a ? (
                      <div style={{
                        display: 'flex', gap: 6, padding: '5px 7px',
                        background: 'var(--cth-mint-light, #d9eed9)',
                        boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                        fontSize: 12, lineHeight: '17px', color: 'var(--cth-ink-900)'
                      }}>
                        <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, flexShrink: 0, marginTop: 2 }}>A</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <MarkdownPreview source={e.a} variant="card" />
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--cth-coral)', fontFamily: 'var(--cth-font-display)' }}>
                        {t('kanban.awaitingAnswer')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dependencies */}
            {deps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>
                  {t('kanban.dependsOn')}
                </div>
                {deps.map((d) => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px',
                    background: 'var(--cth-cream-200)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                    fontSize: 12, color: 'var(--cth-ink-700)'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <select
                value={task.status}
                onChange={(e) => onMove(e.target.value as Status)}
                style={{
                  padding: '4px 6px', background: 'var(--cth-paper-100)', border: 'none',
                  boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', fontFamily: 'var(--cth-font-ui)',
                  fontSize: 12, color: 'var(--cth-ink-900)', cursor: 'pointer'
                }}
              >
                {KANBAN_COLUMNS.map((c) => (<option key={c.key} value={c.key}>{t(c.labelKey).toLowerCase()}</option>))}
              </select>

              <PixelButton variant="secondary" size="sm" onClick={onAssign}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Icon name="arrow-right" /> {t('kanban.assign')}
                </span>
              </PixelButton>

              <PixelButton variant="ghost" size="sm" onClick={onClose}>{t('common.close')}</PixelButton>
            </div>
          </div>
        </PixelPanel>
      </div>
    </div>
  );
}

function PriorityDots({ level }: { level: number }) {
  const { t } = useTranslation();
  const color = level >= 4 ? 'var(--cth-coral)' : level === 3 ? 'var(--cth-lemon)' : 'var(--cth-mint)';
  return (
    <span title={t('kanban.priority', { level })} style={{ display: 'inline-flex', gap: 1, flexShrink: 0, marginTop: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{
          width: 4, height: 8,
          background: i <= level ? color : 'var(--cth-cream-200)',
          boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
        }} />
      ))}
    </span>
  );
}
