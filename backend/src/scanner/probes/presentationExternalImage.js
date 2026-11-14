// Dark Matter rule-based scanner — generated-presentation (.pptx)
// external-image probe (V10-VC-1 control, Meta Cat 7 family).
//
// Thin wrapper over probeOfficeExternalImage (officeExternalImage.js):
// discovers .pptx links on the target, downloads each, and reports a
// finding ONLY when the package links an external image
// (TargetMode="External" + <a:blip r:link>). The V10 pipeline bakes
// each slide as a rendered image, so the expected outcome is NO
// finding: the images are embedded (<a:blip r:embed> + ppt/media/
// parts) and the phase records that as a verified control
// (diagnostics.controlStatus). Embedded is not a channel — never a
// finding. Read-only GETs.
import { probeOfficeExternalImage } from './officeExternalImage.js';

export async function probePresentationExternalImage(url, opts = {}) {
  return probeOfficeExternalImage(url, opts, 'pptx');
}

export const __presentationExternalImageMeta = { phases: ['presentation-external-image'], depth: ['quick', 'standard', 'deep'] };
