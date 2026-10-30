/**
 * Autonomous SDLC Workflow Engine & Capabilities Catalog
 *
 * Provides:
 *  - 5 Visible Delivery Stages: Discover, Plan, Build, Verify, Deliver
 *  - 2 Control Modes: Auto-pilot (autonomous) and Co-pilot (human review gates)
 *  - Reusable Capabilities (Powers): Expert systems guiding method, context, and standards
 *  - Stage Review Points & Reviewable Change Evidence
 */

export type SDLCStage = 'discover' | 'plan' | 'build' | 'verify' | 'deliver';
export type ControlMode = 'auto-pilot' | 'co-pilot';

export interface StageDefinition {
  key: SDLCStage;
  num: string;
  name: string;
  shortDesc: string;
  description: string;
  reviewPointName: string;
  reviewPrompt: string;
  accent: string;
}

export const SDLC_STAGES: readonly StageDefinition[] = [
  {
    key: 'discover',
    num: '01',
    name: 'Discover',
    shortDesc: 'Understand request, repository & constraints',
    description: 'Explore the intent, investigate relevant codebase files, identify constraints, dependencies, and architecture requirements.',
    reviewPointName: 'Discovery & Scope Review',
    reviewPrompt: 'Confirm understanding of problem scope, architecture boundaries, and requirements before planning.',
    accent: 'var(--cth-sky)'
  },
  {
    key: 'plan',
    num: '02',
    name: 'Plan',
    shortDesc: 'Make approach, steps & risks explicit',
    description: 'Design architecture changes, sequence execution steps, specify schemas/contracts, and outline risk mitigations.',
    reviewPointName: 'Architecture & Plan Review',
    reviewPrompt: 'Approve the implementation plan, affected components, and risk assessment before code is written.',
    accent: 'var(--cth-lemon)'
  },
  {
    key: 'build',
    num: '03',
    name: 'Build',
    shortDesc: 'Implement changes in project context',
    description: 'Write functional source code, tests, and configuration following project standards and selected capability guidance.',
    reviewPointName: 'Code & Implementation Review',
    reviewPrompt: 'Inspect the newly written code and implementation diffs before verification runs.',
    accent: 'var(--cth-coral)'
  },
  {
    key: 'verify',
    num: '04',
    name: 'Verify',
    shortDesc: 'Review work & test against goal',
    description: 'Run unit, integration, and end-to-end tests; run linters and typechecks; validate all acceptance criteria.',
    reviewPointName: 'Verification & Quality Review',
    reviewPrompt: 'Confirm test results, quality checks, and evidence pass all criteria before packaging for delivery.',
    accent: 'var(--cth-mint)'
  },
  {
    key: 'deliver',
    num: '05',
    name: 'Deliver',
    shortDesc: 'Bring result & evidence back for delivery',
    description: 'Generate reviewable change evidence, release summary, git commit / PR, and rollback instructions.',
    reviewPointName: 'Final Delivery & Acceptance',
    reviewPrompt: 'Review final change evidence, pull request / commit package, and sign off on completion.',
    accent: 'var(--cth-lilac)'
  }
] as const;

export interface StageReviewPoint {
  stage: SDLCStage;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewerNotes?: string;
  decisions?: string[];
}

export interface StageEvidence {
  stage: SDLCStage;
  summary: string;
  artifacts?: string[];
  timestamp: string;
  decisions?: string[];
}

export interface SdlcPower {
  id: string;
  num: string;
  name: string;
  headline: string;
  journey: string;
  description: string;
  standards: string[];
  stagesGuidance: Record<SDLCStage, string>;
}

// SdlcPower is exported by the interface above.

export const SDLC_POWERS: readonly SdlcPower[] = [
  {
    id: 'full-stack-app',
    num: '01',
    name: 'Full-Stack App',
    headline: 'An idea. A connected product.',
    journey: 'Architecture → implementation → tested journeys',
    description: 'Shape interface, API, and persistent data around the journeys your users need. End-to-end full-stack feature delivery with strict type-safety and contract validation.',
    standards: [
      'Preserve API contract compatibility and database migration integrity',
      'Ensure frontend components have accessible, responsive states',
      'Follow unidirectional data flow and isolate side-effects',
      'Write end-to-end integration journeys for critical user paths'
    ],
    stagesGuidance: {
      discover: 'Analyze frontend components, backend endpoints, database schemas, and shared types.',
      plan: 'Draft API contracts, state management model, UI flow diagrams, and migration scripts.',
      build: 'Implement server logic, client UI, state bindings, and database changes in harmony.',
      verify: 'Execute automated user journey tests, contract tests, and visual state validations.',
      deliver: 'Package delivery evidence: route inventory, schema diffs, test videos/logs, and deployment notes.'
    }
  },
  {
    id: 'test-automation',
    num: '02',
    name: 'End-to-End Test Automation',
    headline: 'Confidence you can run again.',
    journey: 'Acceptance criteria → tests → evidence',
    description: 'Turn acceptance criteria into executable browser tests for your critical journeys. Resilient selectors, deterministic test fixtures, and comprehensive failure triage.',
    standards: [
      'Use user-facing role and accessible text locators rather than brittle CSS paths',
      'Isolate test states with clean setup and teardown fixtures',
      'Verify positive journeys, negative error handling, and recovery flows',
      'Generate inspectable trace logs, screenshots, and assertions evidence'
    ],
    stagesGuidance: {
      discover: 'Inspect acceptance criteria, user stories, application entrypoints, and mock data.',
      plan: 'Define test scenarios, coverage matrix, required test doubles, and test run topology.',
      build: 'Write automated test suites (Vitest/Playwright/Cypress) and deterministic mock servers.',
      verify: 'Execute test suites against test environments; verify zero flake and fast execution.',
      deliver: 'Produce test coverage reports, execution matrices, failure trace links, and CI hook configs.'
    }
  },
  {
    id: 'deployment-pipeline',
    num: '03',
    name: 'Deployment Pipeline',
    headline: 'A repeatable way to ship.',
    journey: 'Build → release checks → recovery',
    description: 'Define the path from a tested commit to deployment, verification, and rollback. Automated release gating, containerization, environment security, and zero-downtime shipping.',
    standards: [
      'Enforce atomic, immutable build artifacts and reproducible builds',
      'Embed pre-flight health checks and canary verification gates',
      'Provide deterministic, tested rollback scripts and blast-radius containment',
      'Document secret isolation and environment configuration boundaries'
    ],
    stagesGuidance: {
      discover: 'Inspect deployment manifests, CI workflows, environment secrets, and cloud infra configs.',
      plan: 'Draft release pipeline topology, artifact registry paths, automated check gates, and rollback plan.',
      build: 'Create/update Dockerfiles, CI/CD action scripts, infrastructure-as-code, and release scripts.',
      verify: 'Run dry-run deployments, container vulnerability scans, and canary health validations.',
      deliver: 'Compile pipeline audit checklist, rollback procedure guide, and automated release pipeline triggers.'
    }
  }
] as const;


/** Helper: find Power definition by ID */
export function getPower(id?: string): SdlcPower | undefined {
  if (!id) return undefined;
  return SDLC_POWERS.find((p) => p.id === id);
}

/** Helper: get next SDLC stage in sequence */
export function getNextStage(current: SDLCStage): SDLCStage | null {
  const idx = SDLC_STAGES.findIndex((s) => s.key === current);
  if (idx === -1 || idx >= SDLC_STAGES.length - 1) return null;
  return SDLC_STAGES[idx + 1].key;
}

/** Helper: format SDLC prompt preamble for agent orchestrator */
export function formatSdlcDispatchPrompt(opts: {
  intent: string;
  powerId?: string;
  controlMode: ControlMode;
  repo?: string;
}): string {
  const power = getPower(opts.powerId);
  const powerInfo = power
    ? `\nSELECTED POWER: ${power.name} (${power.journey})\nMethod & Standards:\n${power.standards.map((s) => `- ${s}`).join('\n')}\n`
    : '';

  return `[SDLC WORKFLOW: ${opts.controlMode.toUpperCase()}]
${powerInfo}
TASK INTENT:
${opts.intent}

WORKFLOW EXECUTION RULES:
1. Carry this task through the 5 visible delivery stages:
   - 01 Discover: Understand the request, the repository, and the constraints.
   - 02 Plan: Make the approach, steps, and risks explicit.
   - 03 Build: Implement the change in the context of your project.
   - 04 Verify: Review the work and test it against the goal.
   - 05 Deliver: Bring the result and its evidence back for delivery.

2. In tasks.json:
   - Set "stage" to the current stage ('discover' | 'plan' | 'build' | 'verify' | 'deliver').
   - Set "controlMode" to '${opts.controlMode}'.
   - Set "power" to '${opts.powerId || 'custom'}'.
   ${
     opts.controlMode === 'co-pilot'
       ? `3. CO-PILOT REVIEW POINTS: Before transitioning to the next stage, record the stage decisions & summary into the "evidence" array, add a pending entry in "reviewPoints" for the stage, set card status to "blocked", and await human review before proceeding!`
       : `3. AUTO-PILOT EXECUTION: Autonomously progress through all 5 stages, recording stage evidence and decisions along the way until stage 05 Deliver is complete.`
   }
4. When finished with stage 05 Deliver, compile final change evidence and set card status to 'done'.`;
}

