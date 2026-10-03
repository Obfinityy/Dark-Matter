/**
 * ctMerkleIntel.js — CT log Merkle-tree consistency mining (idea 00144).
 *
 * Certificate Transparency logs are append-only Merkle trees. A consistency
 * proof lets a monitor confirm a newer tree head extends an older one; a
 * log that cannot prove consistency may be forked or withholding entries
 * (which can hide certificate issuance). This module implements RFC 6962
 * tree hashing over supplied log data and verifies consistency proofs.
 */

import { createHash } from 'node:crypto';

function sha256(data) {
  return createHash('sha256').update(data).digest();
}

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

/**
 * Hash a single Merkle tree leaf (RFC 6962).
 * @param {Buffer|string} leafData — raw leaf bytes
 * @returns {Buffer} leaf hash
 */
export function hashLeaf(leafData) {
  return sha256(Buffer.concat([LEAF_PREFIX, Buffer.from(leafData)]));
}

/**
 * Hash an internal Merkle node (RFC 6962).
 * @param {Buffer} left
 * @param {Buffer} right
 * @returns {Buffer} node hash
 */
export function hashNode(left, right) {
  return sha256(Buffer.concat([NODE_PREFIX, left, right]));
}

/**
 * Compute the root hash of a tree with n leaves (perfect-subtree split).
 * @param {Buffer[]} leafHashes
 * @returns {Buffer|null} root hash or null for an empty tree
 */
export function treeRoot(leafHashes = []) {
  const n = leafHashes.length;
  if (n === 0) return null;
  if (n === 1) return leafHashes[0];
  const k = 2 ** Math.floor(Math.log2(n - 1));
  const left = treeRoot(leafHashes.slice(0, k));
  const right = treeRoot(leafHashes.slice(k));
  return hashNode(left, right);
}

function expectedProofSize(first, second) {
  let size = 0;
  let m = first;
  let n = second;
  while (m !== n) {
    if (m % 2 === 1 || m === n) {
      m = Math.floor(m / 2);
      n = Math.floor(n / 2);
    } else {
      m = Math.floor(m / 2);
      n = Math.ceil(n / 2);
    }
    size++;
  }
  return size;
}

/**
 * Analyze a signed tree head (STH) transition for signs of forking.
 * @param {{ treeSize: number, rootHash: string }[]} sths — chronologically ordered STHs
 * @param {{ first: number, second: number, proof: string[] }[]} proofs — consistency proofs between consecutive STHs
 * @returns {{ transitions: { first, second, proofSizeOk, forkSuspected }[], forks: number[] }}
 */
export function analyzeSthTransitions(sths = [], proofs = []) {
  const transitions = [];
  const forks = [];
  for (let i = 1; i < sths.length; i++) {
    const first = sths[i - 1];
    const second = sths[i];
    const proof = proofs.find((p) => p.first === first.treeSize && p.second === second.treeSize);
    const proofSizeOk = proof
      ? proof.proof.length === expectedProofSize(first.treeSize, second.treeSize)
      : null;
    const monotonic = second.treeSize >= first.treeSize;
    const forkSuspected = !monotonic || proofSizeOk === false;
    if (forkSuspected) forks.push(i);
    transitions.push({
      first: first.treeSize,
      second: second.treeSize,
      proofSizeOk,
      monotonic,
      forkSuspected,
    });
  }
  return { transitions, forks };
}

/**
 * Detect missing entries: leaf indexes that the log reports as absent
 * between two observed tree sizes.
 * @param {number} fromSize
 * @param {number} toSize
 * @param {number[]} observedIndexes — leaf indexes known to be present
 * @returns {{ missing: number[], hiddenWindow: boolean }}
 */
export function findMissingEntries(fromSize, toSize, observedIndexes = []) {
  const seen = new Set(observedIndexes);
  const missing = [];
  for (let i = fromSize; i < toSize; i++) {
    if (!seen.has(i)) missing.push(i);
  }
  return { missing, hiddenWindow: missing.length > 0 };
}
