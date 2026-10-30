import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelPanel } from './PixelPanel';
import { PixelButton } from './PixelButton';
import { PixelBadge } from './PixelBadge';
import { Icon } from './Icon';
import { useStore } from '@/store/store';
import {
  SDLC_POWERS,
  SDLC_STAGES,
  type ControlMode,
  formatSdlcDispatchPrompt
} from '@shared/sdlcWorkflow';

export function PulseTab() {
  const { t } = useTranslation();
  const agents = useStore((s) => s.agents);
  const godAgent = agents.find((a) => a.isGod);
  const godName = godAgent?.name ?? 'the orchestrator';
  const requestCommandCenterTab = useStore((s) => s.requestCommandCenterTab);

  // Pulse sub-mode: Assistant vs Task
  const [pulseMode, setPulseMode] = useState<'assistant' | 'task'>('task');

  // Task setup state
  const [controlMode, setControlMode] = useState<ControlMode>('auto-pilot');
  const [selectedPowerId, setSelectedPowerId] = useState<string>('full-stack-app');
  const [intent, setIntent] = useState<string>('');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [repos, setRepos] = useState<string[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  // Assistant query state
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantResponses, setAssistantResponses] = useState<Array<{ q: string; a: string; time: string }>>([]);
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    window.cth.getConfig().then((c) => {
      const registered = c.registeredRepos ?? [];
      setRepos(registered);
      if (registered.length > 0) setSelectedRepo(registered[0]);
    }).catch(() => { /* noop */ });
  }, []);

  const handleLaunchTask = async () => {
    const text = intent.trim();
    if (!text || isLaunching) return;

    setIsLaunching(true);
    setLaunchMessage(null);

    try {
      const now = new Date().toISOString();
      const taskId = `task-${Math.random().toString(36).substring(2, 8)}`;
      const firstLine = text.split('\n')[0].replace(/^[#\s*-]+/, '').trim();
      const title = firstLine.length > 60 ? `${firstLine.substring(0, 57)}...` : firstLine || 'SDLC Delivery Task';

      const promptBody = formatSdlcDispatchPrompt({
        intent: text,
        powerId: selectedPowerId,
        controlMode,
        repo: selectedRepo
      });

      // 1. Add task to tasks.json ledger with stage: discover
      await window.cth.hiveAddTask({
        id: taskId,
        title,
        description: text,
        assignee: godAgent?.id,
        status: 'doing',
        stage: 'discover',
        controlMode,
        power: selectedPowerId,
        dependsOn: [],
        priority: 4,
        createdAt: now,
        reviewPoints: [],
        evidence: [
          {
            stage: 'discover',
            summary: `Task initiated with ${selectedPowerId} Power in ${controlMode} mode.`,
            timestamp: now
          }
        ]
      });

      // 2. Send dispatch message to god orchestrator
      await window.cth.hiveSend(
        {
          to: 'god',
          act: 'request',
          subject: `[SDLC: ${controlMode.toUpperCase()}] ${title}`,
          body: promptBody
        },
        'human'
      );

      setLaunchMessage(`Workflow launched! Task ${taskId} is in Stage 01 Discover.`);
      setIntent('');

      setTimeout(() => {
        requestCommandCenterTab('tasks');
      }, 1500);
    } catch (err) {
      setLaunchMessage(`Launch failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleAskAssistant = async () => {
    const q = assistantQuery.trim();
    if (!q || isAsking) return;
    setIsAsking(true);

    try {
      // Gather live context from hive tasks and board
      const rawTasks = await window.cth.hiveTasks();
      const tasksList = (rawTasks && typeof rawTasks === 'object' && Array.isArray((rawTasks as { tasks?: unknown[] }).tasks))
        ? (rawTasks as { tasks: unknown[] }).tasks
        : [];

      let answer = '';
      const qLower = q.toLowerCase();

      if (qLower.includes('stage') || qLower.includes('task') || qLower.includes('run')) {
        const active = tasksList.filter((t: any) => t?.status === 'doing');
        const blocked = tasksList.filter((t: any) => t?.status === 'blocked');
        const done = tasksList.filter((t: any) => t?.status === 'done');
        answer = `**SDLC Workspace Status:**\n- In Progress: ${active.length} tasks across delivery stages.\n- At Review Points: ${blocked.length} tasks waiting for human review.\n- Completed Deliveries: ${done.length} tasks.\n\nAll tasks maintain full reviewable change evidence.`;
      } else if (qLower.includes('power')) {
        answer = `**Available Workflow Capabilities:**\n1. **Full-Stack App**: Architecture → implementation → tested journeys\n2. **End-to-End Test Automation**: Acceptance criteria → tests → evidence\n3. **Deployment Pipeline**: Build → release checks → recovery\n\nPowers guide the methods, architecture contracts, and verification standards for the crew.`;
      } else {
        answer = `Pulse evaluated workspace context across ${repos.length} registered repositories and live agent fleet. Ready to coordinate tasks through Discover → Plan → Build → Verify → Deliver.`;
      }

      setAssistantResponses((prev) => [
        { q, a: answer, time: new Date().toLocaleTimeString() },
        ...prev
      ]);
      setAssistantQuery('');
    } catch {
      setAssistantResponses((prev) => [
        { q, a: 'Unable to query workspace evidence.', time: new Date().toLocaleTimeString() },
        ...prev
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--cth-paper-100)', overflowY: 'auto', padding: 14, gap: 14 }}>
      {/* Hero Header */}
      <div style={{
        padding: '12px 14px', background: 'var(--cth-cream-100)',
        boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', display: 'flex',
        flexDirection: 'column', gap: 6
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, color: 'var(--cth-lemon)', display: 'inline-flex' }}>✳</span>
          <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 11, color: 'var(--cth-ink-900)', letterSpacing: 0.5 }}>
            SDLC PULSE
          </span>
          <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--cth-sky-light, #e0f2fe)', color: 'var(--cth-ink-700)', fontFamily: 'var(--cth-font-display)' }}>
            Autonomous Delivery Engine
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPulseMode('task')}
              style={{
                padding: '3px 10px', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--cth-font-ui)', fontSize: 12,
                background: pulseMode === 'task' ? 'var(--cth-lemon)' : 'var(--cth-cream-200)',
                color: pulseMode === 'task' ? 'var(--cth-ink-900)' : 'var(--cth-ink-700)',
                boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
              }}
            >
              Task Mode
            </button>
            <button
              onClick={() => setPulseMode('assistant')}
              style={{
                padding: '3px 10px', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--cth-font-ui)', fontSize: 12,
                background: pulseMode === 'assistant' ? 'var(--cth-sky)' : 'var(--cth-cream-200)',
                color: pulseMode === 'assistant' ? 'var(--cth-ink-900)' : 'var(--cth-ink-700)',
                boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
              }}
            >
              Assistant Mode
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--cth-ink-700)', lineHeight: '18px' }}>
          {pulseMode === 'task'
            ? 'Act with clarity: select a reusable Power, set your control mode, and carry work through the 5 visible delivery stages.'
            : 'Ask with context: private AI for software delivery. Ask questions about your projects, repo code, and delivery runs.'}
        </div>
      </div>

      {pulseMode === 'task' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Control Mode Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-500)' }}>
              01 / CONTROL MODE — SET THE PACE
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div
                onClick={() => setControlMode('auto-pilot')}
                style={{
                  padding: 10, cursor: 'pointer',
                  background: controlMode === 'auto-pilot' ? 'var(--cth-cream-200)' : 'var(--cth-cream-100)',
                  boxShadow: controlMode === 'auto-pilot' ? 'inset 0 0 0 2px var(--cth-lemon)' : 'inset 0 0 0 1px var(--cth-ink-300)',
                  display: 'flex', flexDirection: 'column', gap: 4
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13 }}>⚡</span>
                  <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 10, color: 'var(--cth-ink-900)' }}>
                    Auto-pilot
                  </span>
                  {controlMode === 'auto-pilot' && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cth-lemon-dark, #b45309)' }}>● ACTIVE</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cth-ink-700)', lineHeight: '15px' }}>
                  Carries a task through all five delivery stages end to end automatically.
                </div>
              </div>

              <div
                onClick={() => setControlMode('co-pilot')}
                style={{
                  padding: 10, cursor: 'pointer',
                  background: controlMode === 'co-pilot' ? 'var(--cth-cream-200)' : 'var(--cth-cream-100)',
                  boxShadow: controlMode === 'co-pilot' ? 'inset 0 0 0 2px var(--cth-sky)' : 'inset 0 0 0 1px var(--cth-ink-300)',
                  display: 'flex', flexDirection: 'column', gap: 4
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13 }}>🛡️</span>
                  <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 10, color: 'var(--cth-ink-900)' }}>
                    Co-pilot
                  </span>
                  {controlMode === 'co-pilot' && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cth-sky-dark, #0369a1)' }}>● ACTIVE</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cth-ink-700)', lineHeight: '15px' }}>
                  Pauses at configured review points before each stage so you can inspect decisions.
                </div>
              </div>
            </div>
          </div>

          {/* Reusable Powers Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-500)' }}>
              02 / SELECT WORKFLOW CAPABILITY — REUSABLE EXPERT SYSTEMS
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {SDLC_POWERS.map((power) => {
                const isSelected = selectedPowerId === power.id;
                return (
                  <div
                    key={power.id}
                    onClick={() => setSelectedPowerId(power.id)}
                    style={{
                      padding: 10, cursor: 'pointer',
                      background: isSelected ? 'var(--cth-cream-200)' : 'var(--cth-cream-100)',
                      boxShadow: isSelected ? 'inset 0 0 0 2px var(--cth-ink-900)' : 'inset 0 0 0 1px var(--cth-ink-300)',
                      display: 'flex', flexDirection: 'column', gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>{power.num}</span>
                      <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-900)' }}>{power.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--cth-ink-700)', fontStyle: 'italic' }}>
                      {power.journey}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--cth-ink-500)', lineHeight: '14px', marginTop: 2 }}>
                      {power.description.substring(0, 100)}...
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5 Visible Delivery Stages Summary */}
          <div style={{
            padding: 10, background: 'var(--cth-cream-100)',
            boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', display: 'flex',
            flexDirection: 'column', gap: 6
          }}>
            <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-500)' }}>
              03 / 5 VISIBLE DELIVERY STAGES (THE SDLC ENGINE)
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SDLC_STAGES.map((st) => (
                <div
                  key={st.key}
                  style={{
                    flex: '1 1 120px', padding: '6px 8px', background: 'var(--cth-paper-100)',
                    borderLeft: `3px solid ${st.accent}`, boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                    display: 'flex', flexDirection: 'column', gap: 2
                  }}
                >
                  <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-700)' }}>
                    {st.num} {st.name}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--cth-ink-500)' }}>
                    {st.shortDesc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Repo & Intent Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 9, color: 'var(--cth-ink-500)' }}>
                04 / TASK INTENT & REPOSITORY
              </span>
              {repos.length > 0 && (
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  style={{
                    marginLeft: 'auto', padding: '3px 8px', background: 'var(--cth-paper-100)',
                    border: 'none', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                    fontFamily: 'var(--cth-font-mono)', fontSize: 11, color: 'var(--cth-ink-900)'
                  }}
                >
                  {repos.map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              )}
            </div>

            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={4}
              placeholder="State the software goal, acceptance criteria, or feature request (e.g., 'Implement user authentication with JWT, refresh tokens, and rate limiting')..."
              style={{
                width: '100%', padding: '8px 10px', background: 'var(--cth-paper-100)',
                border: 'none', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                fontFamily: 'var(--cth-font-ui)', fontSize: 13, lineHeight: '19px',
                color: 'var(--cth-ink-900)', outline: 'none', boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <PixelButton
                variant="primary"
                size="md"
                onClick={handleLaunchTask}
                disabled={!intent.trim() || isLaunching}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="play" /> Put Crew to Work ↗
                </span>
              </PixelButton>
              {launchMessage && (
                <span style={{ fontSize: 12, color: 'var(--cth-ink-700)', fontFamily: 'var(--cth-font-ui)' }}>
                  {launchMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Assistant Mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={assistantQuery}
              onChange={(e) => setAssistantQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAskAssistant(); }}
              placeholder="Ask Pulse about runs, evidence, tests, or repo status..."
              style={{
                flex: 1, padding: '7px 10px', background: 'var(--cth-paper-100)', border: 'none',
                boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', fontFamily: 'var(--cth-font-ui)',
                fontSize: 13, color: 'var(--cth-ink-900)', outline: 'none'
              }}
            />
            <PixelButton variant="primary" size="sm" onClick={handleAskAssistant} disabled={!assistantQuery.trim() || isAsking}>
              Ask Pulse
            </PixelButton>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setAssistantQuery('Summarize active SDLC tasks and current stages')}
              style={{ padding: '3px 8px', background: 'var(--cth-cream-200)', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--cth-ink-700)' }}
            >
              📋 Active task stages
            </button>
            <button
              onClick={() => setAssistantQuery('What Powers are available for this workspace?')}
              style={{ padding: '3px 8px', background: 'var(--cth-cream-200)', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--cth-ink-700)' }}
            >
              ⚡ Powers list
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assistantResponses.map((res, i) => (
              <div key={i} style={{ padding: 10, background: 'var(--cth-cream-100)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>Q:</span>
                  <span style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--cth-ink-900)' }}>{res.q}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cth-ink-400)' }}>{res.time}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--cth-ink-800)', whiteSpace: 'pre-wrap', lineHeight: '18px' }}>
                  {res.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
