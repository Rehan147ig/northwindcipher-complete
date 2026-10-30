/**
 * Browser Mock Bridge for window.cth
 * Enables Munder Difflin & SDLC Workflow to run seamlessly in any web browser (e.g. on Vercel)
 */

if (typeof window !== 'undefined' && !(window as any).cth) {
  // In a browser context there is no Electron HivePicker — skip it unconditionally.
  // App.tsx reads this flag in the useState initializer (before render) and sets hiveOpened=true.
  try { localStorage.setItem('cth.skipHivePickerOnce', '1'); } catch { /* noop */ }

  const STORAGE_KEY_TASKS = 'munder_sdlc_tasks_v1';
  const STORAGE_KEY_ROSTER = 'munder_roster_v1';
  const STORAGE_KEY_CONFIG = 'munder_config_v1';

  const defaultTasks = {
    tasks: [
      {
        id: 'sdlc-app-1',
        title: 'Full-Stack User Authentication & JWT Refresh Engine',
        description: 'Shape interface, API endpoints, and persistent token storage around user sign-in journeys.',
        assignee: 'agent-michael',
        status: 'doing',
        stage: 'discover',
        controlMode: 'auto-pilot',
        power: 'full-stack-app',
        priority: 5,
        dependsOn: [],
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        evidence: [
          {
            stage: 'discover',
            summary: 'Analyzed existing authentication routes, token storage contracts, and DB schema.',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
          }
        ]
      },
      {
        id: 'sdlc-e2e-2',
        title: 'End-to-End Playwright Journey Automation',
        description: 'Turn acceptance criteria into executable browser tests with resilient locators and trace logs.',
        assignee: 'agent-dwight',
        status: 'blocked',
        stage: 'plan',
        controlMode: 'co-pilot',
        power: 'test-automation',
        priority: 4,
        dependsOn: ['sdlc-app-1'],
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        reviewPoints: [
          {
            stage: 'plan',
            status: 'pending',
            decisions: ['Selected Playwright over Cypress for web-worker support', 'Isolated test fixture per suite']
          }
        ],
        evidence: [
          {
            stage: 'discover',
            summary: 'Mapped 14 core user checkout and login journeys.',
            timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
          }
        ]
      },
      {
        id: 'sdlc-pipe-3',
        title: 'Zero-Downtime Docker Container & CI/CD Pipeline',
        description: 'Multi-stage Docker builds, healthcheck probes, and canary rollback automation.',
        assignee: 'agent-jim',
        status: 'doing',
        stage: 'build',
        controlMode: 'auto-pilot',
        power: 'deployment-pipeline',
        priority: 3,
        dependsOn: [],
        createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        evidence: [
          {
            stage: 'discover',
            summary: 'Evaluated Dockerfile cache optimization and Alpine base image.',
            timestamp: new Date(Date.now() - 3600000 * 7).toISOString()
          },
          {
            stage: 'plan',
            summary: 'Designed multi-stage build topology with non-root security context.',
            timestamp: new Date(Date.now() - 3600000 * 6).toISOString()
          }
        ]
      },
      {
        id: 'sdlc-perf-4',
        title: 'Memory Graph & Vector Retrieval Verification',
        description: 'Run benchmark suites against knowledge graph nodes to ensure sub-20ms latency.',
        assignee: 'agent-pam',
        status: 'doing',
        stage: 'verify',
        controlMode: 'co-pilot',
        power: 'test-automation',
        priority: 4,
        dependsOn: [],
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        evidence: [
          {
            stage: 'build',
            summary: 'Implemented indexed SQLite query plan and cached node lookups.',
            timestamp: new Date(Date.now() - 3600000 * 9).toISOString()
          }
        ]
      },
      {
        id: 'sdlc-ship-5',
        title: 'Release Packaging & Change Evidence Summary v0.5.0',
        description: 'Generate release manifest, audit verification logs, and package signed bundles.',
        assignee: 'agent-michael',
        status: 'done',
        stage: 'deliver',
        controlMode: 'auto-pilot',
        power: 'full-stack-app',
        priority: 5,
        dependsOn: [],
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        evidence: [
          {
            stage: 'deliver',
            summary: 'All 5 SDLC stages completed. Change evidence verified and signed.',
            timestamp: new Date(Date.now() - 3600000 * 1).toISOString()
          }
        ]
      }
    ]
  };

  const getStoredTasks = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TASKS);
      return saved ? JSON.parse(saved) : defaultTasks;
    } catch {
      return defaultTasks;
    }
  };

  const saveStoredTasks = (data: any) => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(data));
    } catch { /* noop */ }
  };

  const defaultConfig = {
    onboardingComplete: true,
    harnessHome: '/browser/workspace',
    registeredRepos: ['munder-difflin', 'core-engine', 'frontend-web'],
    autoMode: true,
    defaultCommand: 'claude',
    godProvider: 'claude',
    godModel: 'claude-opus-4-8',
    semanticMemory: true,
    embeddingModel: 'minilm',
    terminalTheme: 'dark',
    costCapTokens: 1000000,
    orgTrigger: { enabled: false, apiKey: '', mode: 'trust-all' },
    webhookTriggers: []
  };

  const defaultRoster = {
    agents: [
      {
        id: 'agent-michael',
        name: 'Michael',
        isGod: true,
        status: 'working',
        character: 'michael',
        accent: 'sky',
        cwd: '/workspace/munder-difflin',
        command: 'claude',
        role: 'Orchestrator & Delivery Lead'
      },
      {
        id: 'agent-dwight',
        name: 'Dwight',
        isGod: false,
        status: 'working',
        character: 'dwight',
        accent: 'lemon',
        cwd: '/workspace/munder-difflin',
        command: 'claude',
        role: 'Test Automation Specialist'
      },
      {
        id: 'agent-jim',
        name: 'Jim',
        isGod: false,
        status: 'working',
        character: 'jim',
        accent: 'mint',
        cwd: '/workspace/munder-difflin',
        command: 'claude',
        role: 'Full-Stack & DevOps Engineer'
      },
      {
        id: 'agent-pam',
        name: 'Pam',
        isGod: false,
        status: 'idle',
        character: 'pam',
        accent: 'lilac',
        cwd: '/workspace/munder-difflin',
        command: 'claude',
        role: 'UX & Journey Designer'
      }
    ],
    archived: [],
    restorable: [],
    queues: {},
    selectedId: 'agent-michael'
  };

  const noop = () => {};
  const noopUnsub = () => noop;

  const getCleanRoster = () => {
    try {
      const r = localStorage.getItem(STORAGE_KEY_ROSTER);
      if (r) {
        const parsed = JSON.parse(r);
        return {
          agents: Array.isArray(parsed.agents) ? parsed.agents : defaultRoster.agents,
          archived: Array.isArray(parsed.archived) ? parsed.archived : [],
          restorable: Array.isArray(parsed.restorable) ? parsed.restorable : [],
          queues: parsed.queues && typeof parsed.queues === 'object' ? parsed.queues : {},
          selectedId: parsed.selectedId || 'agent-michael'
        };
      }
    } catch { /* noop */ }
    return defaultRoster;
  };

  const baseBridge: Record<string, any> = {
    platform: 'web',
    arch: 'x64',
    getConfig: () => {
      try {
        const c = localStorage.getItem(STORAGE_KEY_CONFIG);
        return Promise.resolve(c ? JSON.parse(c) : defaultConfig);
      } catch {
        return Promise.resolve(defaultConfig);
      }
    },
    updateConfig: (patch: any) => {
      try {
        const c = { ...defaultConfig, ...patch };
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(c));
        return Promise.resolve(c);
      } catch {
        return Promise.resolve(defaultConfig);
      }
    },
    onConfigChanged: noopUnsub,
    onCloseRequested: noopUnsub,
    onHireImport: noopUnsub,
    onHireError: noopUnsub,
    drainPendingHires: () => Promise.resolve([]),
    onClosingTime: noopUnsub,
    startClosingTime: () => Promise.resolve({ ok: true }),
    cancelClosingTime: noop,
    confirmClose: () => Promise.resolve(),
    cancelClose: () => Promise.resolve(),
    listPtys: () => Promise.resolve([]),
    rosterReadSync: () => getCleanRoster(),
    rosterWrite: (data: any) => {
      try {
        localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(data));
      } catch { /* noop */ }
      return Promise.resolve({ ok: true });
    },
    harnessHomeSync: () => '/browser/workspace',
    hiveTasks: () => Promise.resolve(getStoredTasks()),
    hiveAddTask: (task: any) => {
      const current = getStoredTasks();
      current.tasks = [task, ...current.tasks];
      saveStoredTasks(current);
      return Promise.resolve({ ok: true });
    },
    hivePatchTask: (id: string, patch: any) => {
      const current = getStoredTasks();
      current.tasks = current.tasks.map((t: any) => (t.id === id ? { ...t, ...patch } : t));
      saveStoredTasks(current);
      return Promise.resolve({ ok: true });
    },
    hiveDeleteTask: (id: string) => {
      const current = getStoredTasks();
      current.tasks = current.tasks.filter((t: any) => t.id !== id);
      saveStoredTasks(current);
      return Promise.resolve({ ok: true });
    },
    hiveSend: (msg: any) => {
      console.log('[WebBridge HiveSend]', msg);
      return Promise.resolve({ ok: true, message: msg });
    },
    hiveRegistry: () => Promise.resolve({ agents: {} }),
    hiveBoard: () => Promise.resolve('# SDLC Active Workspace\nAll systems nominal.'),
    hiveLog: () => Promise.resolve([]),
    hiveMemory: () => Promise.resolve('Autonomous agent memories synced.'),
    hiveInbox: () => Promise.resolve([]),
    hiveMessages: () => Promise.resolve([]),
    hiveAgentDirectory: () => Promise.resolve({ agents: {} }),
    realtimeHasOpenAiKey: () => Promise.resolve(false),
    controlSnapshot: () => Promise.resolve({ paused: false, autoDeliveryPaused: false }),
    controlAutoDelivery: () => Promise.resolve({ ok: true }),
    telemetrySnapshot: () => Promise.resolve({}),
    listMissions: () => Promise.resolve([]),
    saveMissions: () => Promise.resolve({ ok: true }),
    listWorkers: () => Promise.resolve({ live: [], preserved: [], maxWorkers: 4 }),
    getOrgTrigger: () => Promise.resolve({ enabled: false, apiKey: '', mode: 'trust-all' }),
    setOrgTrigger: (cfg: any) => Promise.resolve(cfg),
    listWebhooks: () => Promise.resolve([]),
    saveWebhooks: (list: any) => Promise.resolve(list),
    deleteWebhook: () => Promise.resolve([]),
    webhooksStatus: () => Promise.resolve({ running: false, endpoints: [] }),
    generateWebhookSecret: () => Promise.resolve('whsec_' + Math.random().toString(36).slice(2, 12)),
    getContextTrigger: () => Promise.resolve({
      compact: { enabled: false, everyMs: 3600000, minContextPct: 75, minContextPctLargeWindow: 75, message: '' },
      clear: { enabled: false, everyMs: 3600000, minContextPct: 90, minContextPctLargeWindow: 90, message: '' }
    }),
    setContextTrigger: () => Promise.resolve({ ok: true }),
    memoryStatus: () => Promise.resolve({ available: true, enabled: true, active: true, initialized: true }),
    toolsStatus: () => Promise.resolve([]),
    heroPayload: () => Promise.resolve({ hero: { sponsor: 'SDLC Engine', plan: 'pro' }, fetchedAt: Date.now(), stale: false }),
    modelCatalog: () => Promise.resolve({ catalog: null, fetchedAt: Date.now(), stale: false }),
    skillsLocal: () => Promise.resolve([]),
    skillsCatalog: () => Promise.resolve({ skills: [], fetchedAt: Date.now(), stale: false }),
    searchMemory: () => Promise.resolve({ ok: true, output: '' }),
    textSearch: () => Promise.resolve({ ok: true, results: [] }),
    githubIssues: () => Promise.resolve({ ok: true, issues: [] }),
    openExternal: (url: string) => { window.open(url, '_blank'); },
    appInfo: () => Promise.resolve({ version: '0.5.0-sdlc' }),
    onHiveHookEvent: noopUnsub,
    onHiveMessage: noopUnsub,
    onHiveContextUpdate: noopUnsub,
    onHiveEnqueue: noopUnsub,
    onHiveTerminalHandoff: noopUnsub,
    onMissionsUpdated: noopUnsub,
    onAutoCompact: noopUnsub,
    onRealtimeFloorDelta: noopUnsub,
    onRealtimeCompletion: noopUnsub
  };

  // Robust Proxy wrapper so ANY missing cth call safely returns a noop or async resolution
  (window as any).cth = new Proxy(baseBridge, {
    get(target, prop: string) {
      if (prop in target) {
        return target[prop];
      }
      if (typeof prop === 'string' && prop.startsWith('on')) {
        return noopUnsub;
      }
      if (typeof prop === 'string' && prop.endsWith('Sync')) {
        return () => null;
      }
      return (..._args: any[]) => Promise.resolve({ ok: true });
    }
  });

  console.log('[WebBridge] Initialized robust browser bridge for window.cth');
}

export {};
