/**
 * deviceApiSurface.test.js — Tests for the device/auth API surface mapper.
 *
 *  deviceApiSurface.js — ideas 831–840
 *    831 mapCredentialStoreCalls      — Credential Management API → auth endpoints
 *    832 mapWebAuthnRelyingParty      — WebAuthn rp.id / attestation / endpoints
 *    833 discoverWebOtpEndpoints      — WebOTP SMS-retriever endpoint discovery
 *    834 mapContactPickerFlows        — contact-picker props → share endpoints
 *    835 mapFileSystemAccessFeatures  — File System Access API → file features
 *    836 mineWebUsbFilters            — WebUSB device-filter mining
 *    837 mapWebBluetoothServices      — WebBluetooth service-UUID mapping
 *    838 mineWebHidCollections        — WebHID device-collection mining
 *    839 mineWebSerialConfigs         — WebSerial port-configuration mining
 *    840 mapWebNfcRecords             — WebNFC record-type mapping
 *
 * Run: node --test tests/deviceApiSurface.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  mapCredentialStoreCalls,
  mapWebAuthnRelyingParty,
  discoverWebOtpEndpoints,
  mapContactPickerFlows,
  mapFileSystemAccessFeatures,
  mineWebUsbFilters,
  mapWebBluetoothServices,
  mineWebHidCollections,
  mineWebSerialConfigs,
  mapWebNfcRecords,
  mapDeviceApiSurface,
} from '../src/engines/deviceApiSurface.js';

/* ------------------------------------------------------------------ */
/* 831 — Credential-Management API mapping                             */
/* ------------------------------------------------------------------ */
describe('831 mapCredentialStoreCalls', () => {
  const src = `
    async function login() {
      const cred = await navigator.credentials.get({ password: true, mediation: 'optional' });
      const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(cred) });
      return res;
    }
    async function save() {
      await navigator.credentials.store(new PasswordCredential({ id: 'u@example.com', password: 'x' }));
      await fetch('/api/auth/signup', { method: 'POST' });
    }
    async function federated() {
      const f = await navigator.credentials.get({ federated: { providers: ['https://accounts.google.com'] } });
      await fetch('/api/auth/google/callback');
      return f;
    }
  `;

  it('detects password store + get call sites', () => {
    const r = mapCredentialStoreCalls(src, 'https://app.example.com/login');
    assert.equal(r.url, 'https://app.example.com/login');
    assert.equal(r.stores.length, 1);
    assert.equal(r.stores[0].credentialType, 'password');
    assert.equal(r.retrievals.length, 2);
  });

  it('classifies federated retrieval and maps auth endpoints', () => {
    const r = mapCredentialStoreCalls(src);
    assert.ok(r.retrievals.some((x) => x.credentialType === 'federated'));
    assert.ok(r.authEndpoints.includes('/api/auth/login'));
    assert.ok(r.authEndpoints.includes('/api/auth/signup'));
    assert.ok(r.authEndpoints.includes('/api/auth/google/callback'));
  });

  it('ignores WebAuthn credentials.get (owned by idea 832)', () => {
    const wa = `const a = await navigator.credentials.get({ publicKey: { challenge: new Uint8Array([1]) } });`;
    const r = mapCredentialStoreCalls(wa);
    assert.deepEqual(r.retrievals, []);
  });

  it('handles empty / non-string input', () => {
    for (const bad of [null, undefined, 42, {}, '']) {
      const r = mapCredentialStoreCalls(bad);
      assert.deepEqual(r.stores, []);
      assert.deepEqual(r.retrievals, []);
      assert.deepEqual(r.authEndpoints, []);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 832 — WebAuthn relying-party mapping                                */
/* ------------------------------------------------------------------ */
describe('832 mapWebAuthnRelyingParty', () => {
  const src = `
    const pubKey = {
      rp: { id: 'example.com', name: 'Example Corp' },
      user: { id: new Uint8Array(16), name: 'ada', displayName: 'Ada' },
      challenge: new Uint8Array(32),
      attestation: 'direct',
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }
    };
    async function register() {
      const cred = await navigator.credentials.create({ publicKey: pubKey });
      await fetch('/webauthn/register/finish', { method: 'POST', body: JSON.stringify(cred) });
    }
    async function authenticate() {
      const assertion = await navigator.credentials.get({
        publicKey: { challenge: new Uint8Array(32), rpId: 'example.com', userVerification: 'preferred' }
      });
      await fetch('/webauthn/login/finish', { method: 'POST', body: JSON.stringify(assertion) });
    }
  `;

  it('extracts rp.id, rp.name, attestation, attachment, userVerification', () => {
    const r = mapWebAuthnRelyingParty(src, 'https://example.com/register');
    assert.equal(r.url, 'https://example.com/register');
    assert.equal(r.relyingParties.length, 1);
    const rp = r.relyingParties[0];
    assert.equal(rp.rpId, 'example.com');
    assert.equal(rp.rpName, 'Example Corp');
    assert.equal(rp.attestation, 'direct');
    assert.equal(rp.authenticatorAttachment, 'platform');
    assert.equal(rp.userVerification, 'required');
  });

  it('records create + get ceremonies with their finish endpoints', () => {
    const r = mapWebAuthnRelyingParty(src);
    assert.equal(r.operations.length, 2);
    assert.deepEqual(r.operations.map((o) => o.ceremony).sort(), ['create', 'get']);
    assert.ok(r.endpoints.includes('/webauthn/register/finish'));
    assert.ok(r.endpoints.includes('/webauthn/login/finish'));
  });

  it('extracts rpId from a get-only ceremony', () => {
    const only = `await navigator.credentials.get({ publicKey: { challenge: c, rpId: 'auth.example.org' } });`;
    const r = mapWebAuthnRelyingParty(only);
    assert.equal(r.relyingParties[0].rpId, 'auth.example.org');
    assert.equal(r.operations[0].ceremony, 'get');
  });

  it('returns empty structure when no WebAuthn is used', () => {
    const r = mapWebAuthnRelyingParty('console.log("hello");');
    assert.deepEqual(r.relyingParties, []);
    assert.deepEqual(r.operations, []);
    assert.deepEqual(r.endpoints, []);
  });

  it('handles non-string input', () => {
    const r = mapWebAuthnRelyingParty(null);
    assert.deepEqual(r.relyingParties, []);
  });
});

/* ------------------------------------------------------------------ */
/* 833 — WebOTP endpoint discovery                                     */
/* ------------------------------------------------------------------ */
describe('833 discoverWebOtpEndpoints', () => {
  const src = `
    async function readSms() {
      const ac = new AbortController();
      const cred = await navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal });
      await fetch('/api/verify-otp', { method: 'POST', body: JSON.stringify({ code: cred.code }) });
      return cred.code;
    }
  `;

  it('detects WebOTP usage, sms transport, and the verify endpoint', () => {
    const r = discoverWebOtpEndpoints(src, 'https://shop.example.com/checkout');
    assert.equal(r.url, 'https://shop.example.com/checkout');
    assert.equal(r.webOtpUsed, true);
    assert.deepEqual(r.transports, ['sms']);
    assert.ok(r.endpoints.includes('/api/verify-otp'));
  });

  it('detects OTPCredential feature-checks', () => {
    const r = discoverWebOtpEndpoints(`if ('OTPCredential' in window) { setup(); }`);
    assert.equal(r.webOtpUsed, true);
  });

  it('reports no usage for unrelated code', () => {
    const r = discoverWebOtpEndpoints(`fetch('/api/products');`);
    assert.equal(r.webOtpUsed, false);
    assert.deepEqual(r.endpoints, []);
  });

  it('handles non-string input', () => {
    const r = discoverWebOtpEndpoints(undefined);
    assert.equal(r.webOtpUsed, false);
  });
});

/* ------------------------------------------------------------------ */
/* 834 — Contact-picker data-flow mapping                              */
/* ------------------------------------------------------------------ */
describe('834 mapContactPickerFlows', () => {
  const src = `
    async function invite() {
      const props = ['name', 'email', 'tel'];
      const contacts = await navigator.contacts.select(props, { multiple: true });
      await fetch('/api/share/invite', { method: 'POST', body: JSON.stringify(contacts) });
      await navigator.share({ title: 'Invite', text: 'Join us', url: '/invite/abc' });
    }
  `;

  it('detects contact-picker usage and requested props', () => {
    const r = mapContactPickerFlows(src);
    assert.equal(r.used, true);
    assert.ok(r.requestedProps.includes('name'));
    assert.ok(r.requestedProps.includes('email'));
    assert.ok(r.requestedProps.includes('tel'));
  });

  it('maps share endpoints and navigator.share usage', () => {
    const r = mapContactPickerFlows(src);
    assert.ok(r.shareEndpoints.includes('/api/share/invite'));
    assert.equal(r.shareApiUsed, true);
  });

  it('detects ContactsManager feature checks', () => {
    const r = mapContactPickerFlows(`const ok = 'contacts' in navigator && 'ContactsManager' in window;`);
    assert.equal(r.used, true);
    assert.deepEqual(r.requestedProps, []);
  });

  it('reports clean negatives', () => {
    const r = mapContactPickerFlows('const x = 1;');
    assert.equal(r.used, false);
    assert.equal(r.shareApiUsed, false);
  });
});

/* ------------------------------------------------------------------ */
/* 835 — File-System-Access API mapping                                */
/* ------------------------------------------------------------------ */
describe('835 mapFileSystemAccessFeatures', () => {
  const src = `
    async function openFile() {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Images', accept: { 'image/*': ['.png', '.jpg'] } }],
        multiple: false
      });
      await fetch('/api/uploads', { method: 'POST', body: await handle.getFile() });
    }
    async function saveReport() {
      const handle = await window.showSaveFilePicker({ suggestedName: 'report.pdf' });
      const w = await handle.createWritable();
      await w.write('data');
      await w.close();
    }
    async function pickDir() {
      const dir = await window.showDirectoryPicker();
      return dir;
    }
  `;

  it('maps open/save/directory pickers to features', () => {
    const r = mapFileSystemAccessFeatures(src, 'https://app.example.com/files');
    assert.equal(r.url, 'https://app.example.com/files');
    const apis = r.features.map((f) => f.api);
    assert.ok(apis.includes('showOpenFilePicker'));
    assert.ok(apis.includes('showSaveFilePicker'));
    assert.ok(apis.includes('showDirectoryPicker'));
    const kinds = r.features.map((f) => f.feature);
    assert.ok(kinds.includes('file-read'));
    assert.ok(kinds.includes('file-write'));
    assert.ok(kinds.includes('directory-access'));
  });

  it('extracts declared accept types and upload endpoints', () => {
    const r = mapFileSystemAccessFeatures(src);
    assert.ok(r.fileTypes.includes('image/*'));
    assert.ok(r.fileTypes.includes('.png'));
    assert.ok(r.endpoints.includes('/api/uploads'));
  });

  it('detects the legacy chooser entry point', () => {
    const r = mapFileSystemAccessFeatures(`const h = await window.chooseFileSystemEntries();`);
    assert.ok(r.features.some((f) => f.feature === 'file-chooser-legacy'));
  });

  it('handles empty input', () => {
    const r = mapFileSystemAccessFeatures('');
    assert.deepEqual(r.features, []);
  });
});

/* ------------------------------------------------------------------ */
/* 836 — WebUSB device-filter mining                                   */
/* ------------------------------------------------------------------ */
describe('836 mineWebUsbFilters', () => {
  const src = `
    async function connectArduino() {
      const device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x2341, productId: 0x0043 },
          { vendorId: 0x1a86, classCode: 0xff }
        ]
      });
      await device.open();
      await fetch('/api/hardware/register', { method: 'POST' });
    }
  `;

  it('mines vendor/product IDs in hex', () => {
    const r = mineWebUsbFilters(src);
    assert.equal(r.used, true);
    assert.equal(r.filters.length, 2);
    assert.equal(r.filters[0].vendorId, '0x2341');
    assert.equal(r.filters[0].productId, '0x0043');
    assert.equal(r.filters[1].vendorId, '0x1A86');
  });

  it('labels USB class codes', () => {
    const r = mineWebUsbFilters(src);
    assert.equal(r.filters[1].classCode, '0x00FF');
    assert.equal(r.filters[1].classLabel, 'Vendor Specific');
    assert.equal(r.filters[0].classLabel, null);
  });

  it('maps endpoints near the request site', () => {
    const r = mineWebUsbFilters(src);
    assert.ok(r.endpoints.includes('/api/hardware/register'));
  });

  it('detects getDevices probes too', () => {
    const r = mineWebUsbFilters(`const ds = await navigator.usb.getDevices();`);
    assert.equal(r.used, true);
    assert.deepEqual(r.filters, []);
  });

  it('handles empty input', () => {
    const r = mineWebUsbFilters(null);
    assert.equal(r.used, false);
  });
});

/* ------------------------------------------------------------------ */
/* 837 — WebBluetooth service-UUID mapping                              */
/* ------------------------------------------------------------------ */
describe('837 mapWebBluetoothServices', () => {
  const src = `
    async function connectWatch() {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate', 'battery_service', 0x180D] }],
        optionalServices: ['device_information']
      });
      await fetch('/api/wearables/sync', { method: 'POST' });
    }
  `;

  it('resolves named aliases and numeric UUIDs to integrations', () => {
    const r = mapWebBluetoothServices(src);
    assert.equal(r.used, true);
    const byService = Object.fromEntries(r.services.map((s) => [s.service, s.integration]));
    assert.ok(byService['0x180D'].includes('fitness tracker'));
    assert.ok(byService['0x180F'].includes('power-state'));
    assert.ok(byService['0x180A'].includes('hardware metadata'));
  });

  it('dedupes repeated services', () => {
    const r = mapWebBluetoothServices(src);
    assert.equal(r.services.filter((s) => s.service === '0x180D').length, 1);
  });

  it('labels unknown UUIDs as proprietary integrations', () => {
    const r = mapWebBluetoothServices(
      `await navigator.bluetooth.requestDevice({ filters: [{ services: [0xFF00] }] });`
    );
    assert.equal(r.services[0].service, '0xFF00');
    assert.ok(r.services[0].integration.includes('proprietary'));
  });

  it('maps endpoints near the request site', () => {
    const r = mapWebBluetoothServices(src);
    assert.ok(r.endpoints.includes('/api/wearables/sync'));
  });

  it('handles empty input', () => {
    const r = mapWebBluetoothServices('');
    assert.equal(r.used, false);
    assert.deepEqual(r.services, []);
  });
});

/* ------------------------------------------------------------------ */
/* 838 — WebHID device-collection mining                               */
/* ------------------------------------------------------------------ */
describe('838 mineWebHidCollections', () => {
  const src = `
    async function connectGamepad() {
      const devices = await navigator.hid.requestDevice({
        filters: [{ vendorId: 0x046d, productId: 0xc216, usagePage: 0x01, usage: 0x05 }]
      });
      await fetch('/api/hid/pair', { method: 'POST' });
    }
    async function connectKeyboard() {
      await navigator.hid.requestDevice({ filters: [{ usagePage: 1, usage: 6 }] });
    }
  `;

  it('mines vendor/product IDs plus usage page and usage', () => {
    const r = mineWebHidCollections(src);
    assert.equal(r.used, true);
    assert.equal(r.collections.length, 2);
    assert.equal(r.collections[0].vendorId, '0x046D');
    assert.equal(r.collections[0].productId, '0xC216');
    assert.equal(r.collections[0].usagePage, '0x0001');
    assert.equal(r.collections[0].usage, '0x0005');
  });

  it('labels known collections', () => {
    const r = mineWebHidCollections(src);
    assert.equal(r.collections[0].collectionLabel, 'Gamepad collection');
    assert.equal(r.collections[1].collectionLabel, 'Keyboard collection');
    assert.equal(r.collections[1].vendorId, null);
  });

  it('maps endpoints near the request site', () => {
    const r = mineWebHidCollections(src);
    assert.ok(r.endpoints.includes('/api/hid/pair'));
  });

  it('handles empty input', () => {
    const r = mineWebHidCollections(undefined);
    assert.equal(r.used, false);
  });
});

/* ------------------------------------------------------------------ */
/* 839 — WebSerial port-configuration mining                           */
/* ------------------------------------------------------------------ */
describe('839 mineWebSerialConfigs', () => {
  const src = `
    async function connectSensor() {
      const port = await navigator.serial.requestPort({
        filters: [{ usbVendorId: 0x10c4, usbProductId: 0xea60 }]
      });
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
      await fetch('/api/sensors/stream', { method: 'POST' });
    }
  `;

  it('extracts USB hardware filters in hex', () => {
    const r = mineWebSerialConfigs(src);
    assert.equal(r.used, true);
    assert.equal(r.portFilters.length, 1);
    assert.equal(r.portFilters[0].usbVendorId, '0x10C4');
    assert.equal(r.portFilters[0].usbProductId, '0xEA60');
  });

  it('extracts the full port.open configuration', () => {
    const r = mineWebSerialConfigs(src);
    assert.equal(r.portConfigs.length, 1);
    const cfg = r.portConfigs[0];
    assert.equal(cfg.baudRate, 9600);
    assert.equal(cfg.dataBits, 8);
    assert.equal(cfg.stopBits, 1);
    assert.equal(cfg.parity, 'none');
    assert.equal(cfg.flowControl, 'none');
  });

  it('maps endpoints near the request site', () => {
    const r = mineWebSerialConfigs(src);
    assert.ok(r.endpoints.includes('/api/sensors/stream'));
  });

  it('reports no usage for unrelated code', () => {
    const r = mineWebSerialConfigs('console.log(1);');
    assert.equal(r.used, false);
    assert.deepEqual(r.portConfigs, []);
  });
});

/* ------------------------------------------------------------------ */
/* 840 — WebNFC record-type mapping                                    */
/* ------------------------------------------------------------------ */
describe('840 mapWebNfcRecords', () => {
  const src = `
    async function tap() {
      const ndef = new NDEFReader();
      await ndef.scan();
      ndef.onreading = (event) => console.log(event.message.records);
      await ndef.write({ records: [
        { recordType: 'url', data: 'https://example.com/pair/abc' },
        { recordType: 'text', data: 'Welcome' },
        { recordType: 'mime', mediaType: 'application/json', data: '{}' }
      ]});
      await fetch('/api/nfc/handshake', { method: 'POST' });
    }
  `;

  it('detects NDEFReader usage and maps record types to features', () => {
    const r = mapWebNfcRecords(src);
    assert.equal(r.used, true);
    const byType = Object.fromEntries(r.recordTypes.map((x) => [x.recordType, x.feature]));
    assert.ok(byType['url'].includes('URL sharing'));
    assert.ok(byType['text'].includes('Text content display'));
    assert.ok(byType['mime'].includes('MIME payload'));
  });

  it('dedupes repeated record types', () => {
    const r = mapWebNfcRecords(src + `await ndef.write({ records: [{ recordType: 'url', data: 'x' }] });`);
    assert.equal(r.recordTypes.filter((x) => x.recordType === 'url').length, 1);
  });

  it('labels unrecognized record types', () => {
    const r = mapWebNfcRecords(
      `const n = new NDEFReader(); n.write({ records: [{ recordType: 'weird', data: 'x' }] });`
    );
    assert.ok(r.recordTypes[0].feature.includes('Unrecognized'));
  });

  it('maps endpoints near the NFC call sites', () => {
    const r = mapWebNfcRecords(src);
    assert.ok(r.endpoints.includes('/api/nfc/handshake'));
  });

  it('handles empty input', () => {
    const r = mapWebNfcRecords(null);
    assert.equal(r.used, false);
  });
});

/* ------------------------------------------------------------------ */
/* Full surface summary                                                 */
/* ------------------------------------------------------------------ */
describe('mapDeviceApiSurface summary', () => {
  const src = `
    await navigator.credentials.store(new PasswordCredential({id:'a', password:'b'}));
    await navigator.credentials.create({ publicKey: { rp: { id: 'example.com', name: 'Ex' }, challenge: c, attestation: 'none' } });
    await navigator.credentials.get({ otp: { transport: ['sms'] } });
    await navigator.contacts.select(['name']);
    await window.showOpenFilePicker();
    await navigator.usb.requestDevice({ filters: [{ vendorId: 0x2341 }] });
    await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    await navigator.hid.requestDevice({ filters: [{ usagePage: 1, usage: 6 }] });
    await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x10c4 }] });
    const ndef = new NDEFReader(); await ndef.scan();
  `;

  it('runs every mapper and returns keyed results', () => {
    const r = mapDeviceApiSurface(src, 'https://app.example.com');
    assert.equal(r.url, 'https://app.example.com');
    for (const key of [
      'credentialManagement', 'webAuthn', 'webOtp', 'contactPicker',
      'fileSystemAccess', 'webUsb', 'webBluetooth', 'webHid', 'webSerial', 'webNfc',
    ]) {
      assert.ok(r[key], `missing key ${key}`);
    }
  });

  it('every mapper sees its own API in the combined source', () => {
    const r = mapDeviceApiSurface(src);
    assert.equal(r.credentialManagement.stores.length, 1);
    assert.equal(r.webAuthn.relyingParties[0].rpId, 'example.com');
    assert.equal(r.webOtp.webOtpUsed, true);
    assert.equal(r.contactPicker.used, true);
    assert.ok(r.fileSystemAccess.features.some((f) => f.feature === 'file-read'));
    assert.equal(r.webUsb.filters[0].vendorId, '0x2341');
    assert.equal(r.webBluetooth.services[0].service, '0x180D');
    assert.equal(r.webHid.collections[0].collectionLabel, 'Keyboard collection');
    assert.equal(r.webSerial.portFilters[0].usbVendorId, '0x10C4');
    assert.equal(r.webNfc.used, true);
  });

  it('is quiet on empty input', () => {
    const r = mapDeviceApiSurface('');
    assert.equal(r.webAuthn.operations.length, 0);
    assert.equal(r.webNfc.used, false);
  });
});
