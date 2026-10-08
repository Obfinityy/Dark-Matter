/**
 * CrewService — file-based CRUD store for Infinity Crew members.
 *
 * Crew members are persistent AI coworkers. Each record describes the
 * coworker's identity, role, instructions and which tools it may use.
 * Persistence is a single JSON file (data/crew/crews.json) with atomic
 * tmp+rename writes so concurrent updates cannot corrupt the store.
 *
 * @module services/crewService
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Default on-disk location for crew data: <repo>/backend/data/crew */
const DEFAULT_DATA_DIR = path.resolve(__dirname, '..', '..', 'data', 'crew');

export const CREW_TOOLS = Object.freeze(['computer', 'shell', 'files']);
export const CREW_STATUSES = Object.freeze(['idle', 'running', 'waiting_brain']);

const CREW_ID_BYTES = 6; // 12 hex chars

/**
 * @typedef {object} CrewMember
 * @property {string} id            `crew_` + 12 hex chars
 * @property {string} name          Display name (1-60 chars)
 * @property {string} role          Short role description (1-120 chars)
 * @property {string} instructions  System-level instructions (may be empty)
 * @property {string[]} toolsAllowed Subset of ['computer','shell','files']
 * @property {string} workspacePath Absolute dir the crew member may work in
 * @property {'idle'|'running'|'waiting_brain'} status
 * @property {string} createdAt     ISO timestamp
 * @property {string} updatedAt     ISO timestamp
 */

export class CrewService {
  /**
   * @param {{ dataDir?: string }} [opts]
   */
  constructor(opts = {}) {
    this.dataDir = opts.dataDir ? path.resolve(opts.dataDir) : DEFAULT_DATA_DIR;
    this.filePath = path.join(this.dataDir, 'crews.json');
  }

  // ---------------------------------------------------------------- internals

  /** @private */
  async _readStore() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.crews === 'object' && parsed.crews !== null) {
        return parsed.crews;
      }
      return {};
    } catch (err) {
      if (err && err.code === 'ENOENT') return {};
      throw err;
    }
  }

  /** @private Atomic write: write tmp file then rename over the target. */
  async _writeStore(crews) {
    await fs.mkdir(this.dataDir, { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify({ crews }, null, 2) + '\n', 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }

  /** @private */
  _newId() {
    return `crew_${crypto.randomBytes(CREW_ID_BYTES).toString('hex')}`;
  }

  /** @private */
  _validateCreate({ name, role, instructions, toolsAllowed }) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
      throw new Error('Crew name is required (1-60 characters).');
    }
    if (typeof role !== 'string' || role.trim().length === 0 || role.length > 120) {
      throw new Error('Crew role is required (1-120 characters).');
    }
    if (instructions !== undefined && typeof instructions !== 'string') {
      throw new Error('Crew instructions must be a string.');
    }
    const tools = this._validateTools(toolsAllowed);
    return {
      name: name.trim(),
      role: role.trim(),
      instructions: instructions ?? '',
      toolsAllowed: tools,
    };
  }

  /** @private */
  _validateTools(toolsAllowed) {
    if (toolsAllowed === undefined) return ['computer', 'shell', 'files'];
    if (!Array.isArray(toolsAllowed)) {
      throw new Error('toolsAllowed must be an array.');
    }
    for (const tool of toolsAllowed) {
      if (!CREW_TOOLS.includes(tool)) {
        throw new Error(`Unknown tool "${tool}". Allowed tools: ${CREW_TOOLS.join(', ')}.`);
      }
    }
    return [...new Set(toolsAllowed)];
  }

  // ------------------------------------------------------------------ CRUD

  /** @returns {Promise<CrewMember[]>} All crew members, oldest first. */
  async list() {
    const crews = await this._readStore();
    return Object.values(crews).sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
    );
  }

  /**
   * @param {string} id
   * @returns {Promise<CrewMember|null>} The crew member, or null if not found.
   */
  async get(id) {
    if (!id) return null;
    const crews = await this._readStore();
    return crews[id] ?? null;
  }

  /**
   * @param {{ name: string, role: string, instructions?: string, toolsAllowed?: string[] }} input
   * @returns {Promise<CrewMember>} The created crew member.
   */
  async create(input) {
    const validated = this._validateCreate(input || {});
    const crews = await this._readStore();
    const id = this._newId();
    const now = new Date().toISOString();
    const crew = {
      id,
      name: validated.name,
      role: validated.role,
      instructions: validated.instructions,
      toolsAllowed: validated.toolsAllowed,
      workspacePath: path.join(this.dataDir, 'workspace', id),
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
    crews[id] = crew;
    await this._writeStore(crews);
    return { ...crew };
  }

  /**
   * Only name / role / instructions / toolsAllowed may be patched.
   * @param {string} id
   * @param {{ name?: string, role?: string, instructions?: string, toolsAllowed?: string[] }} patch
   * @returns {Promise<CrewMember|null>} Updated member, or null if not found.
   */
  async update(id, patch) {
    const crews = await this._readStore();
    const crew = crews[id];
    if (!crew) return null;

    const next = { ...crew };
    if (patch.name !== undefined) {
      if (
        typeof patch.name !== 'string' ||
        patch.name.trim().length === 0 ||
        patch.name.length > 60
      ) {
        throw new Error('Crew name must be 1-60 characters.');
      }
      next.name = patch.name.trim();
    }
    if (patch.role !== undefined) {
      if (
        typeof patch.role !== 'string' ||
        patch.role.trim().length === 0 ||
        patch.role.length > 120
      ) {
        throw new Error('Crew role must be 1-120 characters.');
      }
      next.role = patch.role.trim();
    }
    if (patch.instructions !== undefined) {
      if (typeof patch.instructions !== 'string') {
        throw new Error('Crew instructions must be a string.');
      }
      next.instructions = patch.instructions;
    }
    if (patch.toolsAllowed !== undefined) {
      next.toolsAllowed = this._validateTools(patch.toolsAllowed);
    }
    next.updatedAt = new Date().toISOString();
    crews[id] = next;
    await this._writeStore(crews);
    return { ...next };
  }

  /**
   * @param {string} id
   * @returns {Promise<boolean>} True if a member was removed.
   */
  async remove(id) {
    const crews = await this._readStore();
    if (!crews[id]) return false;
    delete crews[id];
    await this._writeStore(crews);
    return true;
  }

  /**
   * @param {string} id
   * @param {'idle'|'running'|'waiting_brain'} status
   * @returns {Promise<CrewMember|null>} Updated member, or null if not found.
   */
  async setStatus(id, status) {
    if (!CREW_STATUSES.includes(status)) {
      throw new Error(`Unknown status "${status}". Allowed: ${CREW_STATUSES.join(', ')}.`);
    }
    const crews = await this._readStore();
    const crew = crews[id];
    if (!crew) return null;
    crew.status = status;
    crew.updatedAt = new Date().toISOString();
    await this._writeStore(crews);
    return { ...crew };
  }
}

export default CrewService;
