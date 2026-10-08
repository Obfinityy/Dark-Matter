import { asyncHandler } from '../core/utils.js';

export function createScanController(scanService, eventService) {
  return {
    list: asyncHandler(async (request, response) => {
      response.json({ scans: await scanService.list(request.user.id) });
    }),
    get: asyncHandler(async (request, response) => {
      response.json(await scanService.get(request.user.id, request.params.scanId));
    }),
    events: asyncHandler(async (request, response) => {
      const scan = await scanService.get(request.user.id, request.params.scanId);
      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders?.();
      const send = event => {
        response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };
      const lastEventId = request.header('last-event-id');
      const events = await eventService.list(scan.id);
      const startIndex = lastEventId ? events.findIndex(event => event.id === lastEventId) + 1 : 0;
      events.slice(Math.max(0, startIndex)).forEach(send);
      const unsubscribe = eventService.subscribe(scan.id, send);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);
      request.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    }),
  };
}
