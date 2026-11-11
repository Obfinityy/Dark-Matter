// Dark Matter rule-based scanner — generated-document (.docx)
// external-image probe (V10-F4, Meta Cat 7).
//
// Thin wrapper over probeOfficeExternalImage (officeExternalImage.js):
// discovers .docx links on the target, downloads each, and reports a
// finding when the package links an external image
// (TargetMode="External" + <a:blip r:link>, no word/media/ embedding).
// Read-only GETs; never a finding for an embedded image.
import { probeOfficeExternalImage } from './officeExternalImage.js';

export async function probeDocumentExternalImage(url, opts = {}) {
  return probeOfficeExternalImage(url, opts, 'docx');
}

export const __documentExternalImageMeta = { phases: ['document-external-image'], depth: ['quick', 'standard', 'deep'] };
