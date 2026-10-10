/**
 * brainLinkController — per-account Kaggle brain links (encrypted at rest).
 *
 * The user pastes their 3 Kaggle Gradio links once; they are saved against
 * their ACCOUNT so the agent machine (dedicated box / Oracle free-tier VM)
 * can fetch them 24/7 via the agent poller without the browser open.
 *
 * Security: auth required on every route; users only ever see their OWN
 * links. Gradio URLs are bearer tokens — they are encrypted at rest
 * (see brainLinkStore.js) and never logged here.
 */
import { brainLinkStore as defaultBrainLinkStore } from '../services/brainLinkStore.js';
import { VALID_BRAIN_SLOTS } from '../services/brainLinkStore.js';

export function createBrainLinkController({ brainLinkStore, brainProviderModel = null } = {}) {
  const store = brainLinkStore || defaultBrainLinkStore;

  const userIdOf = (req) => String(req.user?.id || req.user?._id || 'anonymous');

  /**
   * Best-effort sync: mirror saved Kaggle links into the brain SELECTION
   * slotSources so every consumer (mid-hunt chat, agent status, older hunt
   * flows) resolves the same brains. The links store remains the source of
   * truth; a sync failure never fails the save.
   */
  async function syncSelection(userId, links) {
    if (!brainProviderModel || !userId || userId === 'anonymous') return;
    for (const [slot, entry] of Object.entries(links || {})) {
      if (!entry?.url) continue;
      try {
        await brainProviderModel.setSlotKaggle(userId, slot, entry.url, entry.name || null);
      } catch {
        /* best-effort only */
      }
    }
  }

  return {
    /**
     * GET /brain-links — the caller's saved brain links.
     * Returns { links: { slot: { url, name, updatedAt } } }.
     * The URLs belong to the caller; the agent poller uses this same
     * endpoint with the user's token.
     *
     * Async because the store is Mongo-backed (file fallback when Mongo is down).
     */
    async list(req, res) {
      try {
        const links = await store.getLinks(userIdOf(req));
        res.json({ links, keyStable: !store.isEphemeralKey });
      } catch (err) {
        res.status(500).json({ error: err?.message || 'Failed to read brain links' });
      }
    },

    /**
     * POST /brain-links { links: { slot: { url, name? } } }
     * Saves (or replaces) brain links. A slot value of null deletes it.
     * Only valid brain slots are accepted; invalid URLs are rejected.
     */
    async save(req, res) {
      try {
        const { links } = req.body || {};
        const userId = userIdOf(req);
        const saved = await store.saveLinks(userId, links);
        await syncSelection(userId, saved);
        res.json({ ok: true, links: saved, keyStable: !store.isEphemeralKey });
      } catch (err) {
        const status = /Invalid|Unknown/.test(err?.message || '') ? 400 : 500;
        res.status(status).json({ error: err?.message || 'Failed to save brain links' });
      }
    },

    /** DELETE /brain-links/:slot — remove one slot's link. */
    async remove(req, res) {
      try {
        const slot = String(req.params.slot || '').toLowerCase();
        if (!VALID_BRAIN_SLOTS.includes(slot)) {
          return res.status(400).json({ error: `Unknown brain slot "${slot}"` });
        }
        const userId = userIdOf(req);
        const removed = await store.deleteSlot(userId, slot);
        if (brainProviderModel && userId !== 'anonymous') {
          try {
            await brainProviderModel.clearSlotKaggle(userId, slot);
          } catch {
            /* best-effort only */
          }
        }
        res.json({ ok: true, removed });
      } catch (err) {
        res.status(500).json({ error: err?.message || 'Failed to delete brain link' });
      }
    },
  };
}
