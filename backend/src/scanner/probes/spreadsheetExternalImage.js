// Dark Matter rule-based scanner — generated-spreadsheet (.xlsx)
// external-image probe (V10-F5, Meta Cat 7).
//
// Thin wrapper over probeOfficeExternalImage (officeExternalImage.js):
// discovers .xlsx links on the target, downloads each, and reports a
// finding when the package links an external image
// (TargetMode="External" + <a:blip r:link> in a drawing, no xl/media/
// embedding). Read-only GETs; never a finding for an embedded picture.
import { probeOfficeExternalImage } from './officeExternalImage.js';

export async function probeSpreadsheetExternalImage(url, opts = {}) {
  return probeOfficeExternalImage(url, opts, 'xlsx');
}

export const __spreadsheetExternalImageMeta = { phases: ['spreadsheet-external-image'], depth: ['quick', 'standard', 'deep'] };
