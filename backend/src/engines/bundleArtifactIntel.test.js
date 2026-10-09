import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mineSwcTransformArtifacts,
  fingerprintBabelPlugins,
  mapPolyfillServices,
  detectCoreJsVersion,
  detectRegeneratorRuntime,
  mapZoneJsPatches,
  mineRxjsOperators,
  extractNgRxStoreShapes,
  mapVuexModules,
  extractPiniaStores,
  analyzeBundleArtifacts,
} from './bundleArtifactIntel.js';

const SWC_SAMPLE = `/*! swc v1.3.90 */
var _swc_class_call_check = function(i,t){if(!(i instanceof t))throw new TypeError("Cannot call a class as a function")};
var _swc_call__LoginForm = _swc_class_call_check.apply(null, arguments);
//# sourceMappingURL=main.js.map
swcHelpers.interopRequireDefault(require("react"));`;

const BABEL_SAMPLE = `// compiled with @babel/plugin-transform-classes
function _asyncToGenerator(fn){return function(){var self=this,args=arguments;return new Promise(function(resolve,reject){var gen=fn.apply(self,args);});};}
function _classCallCheck(instance, Constructor){ if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _taggedTemplateLiteral = function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); };
var login = _asyncToGenerator(function*(){var res = yield fetch('/api/v1/login',{method:'POST'});return res.json();});`;

const POLYFILL_HTML = `<!doctype html><html><head>
<script src="https://cdn.polyfill.io/v3/polyfill.min.js?features=fetch,Promise,Array.prototype.includes&flags=gated"></script>
<script src="https://static.example.com/app.js"></script>
</head><body></body></html>`;

const COREJS_SAMPLE = `/* core-js@3.19.1, http://core-js.github.io/ */
require('core-js/modules/es.array.at');
require('core-js/modules/es.promise.finally');
require('core-js/modules/web.url');`;

const REGENERATOR_SAMPLE = `var regeneratorRuntime = (function (exports) { "use strict"; var Op = Object.prototype; return exports; })({});
function _regeneratorRuntime(){ return regeneratorRuntime; }
async function fetchUser(){ const r = await fetch('/api/v2/users'); return r.json(); }`;

const ZONE_SAMPLE = `Zone.__load_patch('promise', (global) => { /* patch promise */ });
Zone.__load_patch('fetch', (global) => { /* patch fetch */ });
var currentZone = Zone.current;
var delegate = new ZoneDelegate(zone, parentZoneDelegate, zoneSpec);
//# sourceMappingURL=zone.js@0.13.3.map`;

const RXJS_SAMPLE = `import { fromEvent } from 'rxjs';
import { switchMap, catchError, debounceTime, map } from 'rxjs/operators';
const clicks$ = fromEvent(document, 'click').pipe(
  debounceTime(300),
  switchMap((e) => fetch('/api/v1/search?q=' + e.target.value)),
  map((res) => res.json()),
  catchError((err) => of(null))
);`;

const NGRX_SAMPLE = `import { createReducer, on, createFeatureSelector } from '@ngrx/store';
import { createEffect, ofType } from '@ngrx/effects';
export const initialState = { users: [], loading: false };
export const usersReducer = createReducer(initialState,
  on(loadUsers, (state) => ({ ...state, loading: true }))
);
export const selectUsersState = createFeatureSelector<AppState>('users');
const store = StoreModule.forRoot({ users: usersReducer, auth: authReducer });
export const loadUsers$ = createEffect(() =>
  this.actions$.pipe(ofType(loadUsers), mergeMap(() => this.http.get('/api/v3/users').pipe(map(users => loadUsersSuccess({ users }))))
);`;

const VUEX_SAMPLE = `const store = new Vuex.Store({
  modules: {
    users: {
      namespaced: true,
      state: () => ({ list: [] }),
      actions: {
        async fetchUsers({ commit }) {
          const res = await fetch('/api/vue/users');
          commit('setUsers', await res.json());
        },
        async deleteUser({ commit }, id) {
          await axios.delete('/api/vue/users/' + id);
          commit('removeUser', id);
        }
      }
    }
  }
});`;

const PINIA_SAMPLE = `import { defineStore } from 'pinia';
export const useAuthStore = defineStore('auth', {
  state: () => ({ token: null, profile: {} }),
  actions: {
    async login(creds) {
      const res = await axios.post('/api/v1/auth/login', creds);
      this.token = res.data.token;
    },
    async fetchProfile() {
      const res = await fetch('/api/v1/me');
      this.profile = await res.json();
    }
  }
});`;

describe('mineSwcTransformArtifacts', () => {
  it('detects SWC and extracts version, helpers, source hints', () => {
    const r = mineSwcTransformArtifacts(SWC_SAMPLE);
    assert.equal(r.swcDetected, true);
    assert.equal(r.version, '1.3.90');
    assert.ok(r.helpers.includes('_swc_class_call_check'));
    assert.ok(r.helpers.includes('swcHelpers.interopRequireDefault'));
    assert.equal(r.sourceMapUrl, 'main.js.map');
    assert.ok(Array.isArray(r.sourceHints));
  });
  it('returns clean negatives on plain JS', () => {
    const r = mineSwcTransformArtifacts('var a = 1; console.log(a);');
    assert.equal(r.swcDetected, false);
    assert.equal(r.version, null);
    assert.deepEqual(r.helpers, []);
  });
});

describe('fingerprintBabelPlugins', () => {
  it('fingerprints Babel helpers and maps them to plugins', () => {
    const r = fingerprintBabelPlugins(BABEL_SAMPLE);
    assert.equal(r.babelDetected, true);
    assert.ok(r.helpers.includes('_asyncToGenerator'));
    assert.ok(r.helpers.includes('_classCallCheck'));
    assert.ok(r.helpers.includes('_interopRequireDefault'));
    assert.ok(r.helpers.includes('_taggedTemplateLiteral'));
    assert.ok(r.plugins.includes('plugin-transform-async-to-generator'));
    assert.ok(r.plugins.includes('plugin-transform-classes'));
    assert.ok(r.plugins.includes('@babel/plugin-transform-classes'));
  });
  it('returns clean negatives on plain JS', () => {
    const r = fingerprintBabelPlugins('function add(a,b){return a+b;}');
    assert.equal(r.babelDetected, false);
    assert.deepEqual(r.helpers, []);
  });
});

describe('mapPolyfillServices', () => {
  it('maps polyfill.io script with feature set', () => {
    const r = mapPolyfillServices(POLYFILL_HTML);
    assert.equal(r.length, 1);
    assert.equal(r[0].service, 'polyfill.io');
    assert.equal(r[0].host, 'cdn.polyfill.io');
    assert.deepEqual(r[0].features, ['fetch', 'Promise', 'Array.prototype.includes']);
    assert.ok(r[0].url.startsWith('https://cdn.polyfill.io'));
  });
  it('ignores non-polyfill scripts', () => {
    const r = mapPolyfillServices('<script src="https://static.example.com/app.js"></script>');
    assert.deepEqual(r, []);
  });
});

describe('detectCoreJsVersion', () => {
  it('detects version and module markers, flags not-vulnerable new version', () => {
    const r = detectCoreJsVersion(COREJS_SAMPLE);
    assert.equal(r.detected, true);
    assert.equal(r.version, '3.19.1');
    assert.ok(r.modules.includes('es.array.at'));
    assert.ok(r.modules.includes('web.url'));
    assert.equal(r.vulnerable, false);
  });
  it('flags old core-js as vulnerable', () => {
    const r = detectCoreJsVersion('/* core-js@2.6.12 */ require("core-js/modules/es.promise");');
    assert.equal(r.version, '2.6.12');
    assert.equal(r.vulnerable, true);
  });
  it('returns clean negatives on plain JS', () => {
    const r = detectCoreJsVersion('var a = 1;');
    assert.equal(r.detected, false);
    assert.equal(r.version, null);
  });
});

describe('detectRegeneratorRuntime', () => {
  it('detects regenerator runtime and async contexts', () => {
    const r = detectRegeneratorRuntime(REGENERATOR_SAMPLE);
    assert.equal(r.detected, true);
    assert.equal(r.variant, 'inline regeneratorRuntime');
    assert.ok(r.asyncContexts.includes('fetchUser'));
  });
  it('detects versioned regenerator-runtime require', () => {
    const r = detectRegeneratorRuntime("require('regenerator-runtime/runtime'); // regenerator-runtime@0.14.1");
    assert.equal(r.detected, true);
    assert.equal(r.variant, 'regenerator-runtime@0.14.1');
  });
  it('returns clean negatives', () => {
    const r = detectRegeneratorRuntime('function sync(){return 1;}');
    assert.equal(r.detected, false);
    assert.equal(r.variant, null);
  });
});

describe('mapZoneJsPatches', () => {
  it('maps Zone.js patches and async channels', () => {
    const r = mapZoneJsPatches(ZONE_SAMPLE);
    assert.equal(r.detected, true);
    assert.ok(r.patches.includes('promise'));
    assert.ok(r.patches.includes('fetch'));
    assert.ok(r.asyncChannels.includes('promise'));
    assert.ok(r.asyncChannels.includes('fetch'));
    assert.equal(r.version, '0.13.3');
  });
  it('returns clean negatives', () => {
    const r = mapZoneJsPatches('var a = 1;');
    assert.equal(r.detected, false);
    assert.deepEqual(r.patches, []);
  });
});

describe('mineRxjsOperators', () => {
  it('mines operators with endpoint chains', () => {
    const r = mineRxjsOperators(RXJS_SAMPLE);
    assert.equal(r.rxjsDetected, true);
    assert.ok(r.operators.includes('switchMap'));
    assert.ok(r.operators.includes('debounceTime'));
    assert.ok(r.operators.includes('catchError'));
    assert.ok(r.operators.includes('map'));
    const sm = r.chains.find((c) => c.operator === 'switchMap');
    assert.ok(sm.endpoints.includes('/api/v1/search?q='));
  });
  it('returns clean negatives', () => {
    const r = mineRxjsOperators('var a = 1;');
    assert.equal(r.rxjsDetected, false);
    assert.deepEqual(r.operators, []);
  });
});

describe('extractNgRxStoreShapes', () => {
  it('extracts reducers, selectors, modules, effects, endpoints', () => {
    const r = extractNgRxStoreShapes(NGRX_SAMPLE);
    assert.equal(r.detected, true);
    assert.ok(r.reducers.includes('initialState'));
    assert.ok(r.featureSelectors.includes('users'));
    assert.ok(r.storeModules.includes('users'));
    assert.ok(r.storeModules.includes('auth'));
    assert.equal(r.effects, 1);
    assert.ok(r.endpoints.includes('/api/v3/users'));
  });
  it('returns clean negatives', () => {
    const r = extractNgRxStoreShapes('var a = 1;');
    assert.equal(r.detected, false);
    assert.equal(r.effects, 0);
  });
});

describe('mapVuexModules', () => {
  it('maps Vuex modules and actions with endpoints', () => {
    const r = mapVuexModules(VUEX_SAMPLE);
    assert.equal(r.detected, true);
    assert.ok(r.modules.includes('users'));
    const fetchAction = r.actions.find((a) => a.action === 'fetchUsers');
    assert.ok(fetchAction);
    assert.ok(fetchAction.endpoints.includes('/api/vue/users'));
    const deleteAction = r.actions.find((a) => a.action === 'deleteUser');
    assert.ok(deleteAction);
    assert.ok(deleteAction.endpoints.includes('/api/vue/users/'));
  });
  it('returns clean negatives', () => {
    const r = mapVuexModules('var a = 1;');
    assert.equal(r.detected, false);
    assert.deepEqual(r.modules, []);
  });
});

describe('extractPiniaStores', () => {
  it('extracts Pinia stores with state keys and actions', () => {
    const r = extractPiniaStores(PINIA_SAMPLE);
    assert.equal(r.detected, true);
    assert.equal(r.stores.length, 1);
    assert.equal(r.stores[0].name, 'auth');
    assert.ok(r.stores[0].state.includes('token'));
    assert.ok(r.stores[0].state.includes('profile'));
    const login = r.stores[0].actions.find((a) => a.name === 'login');
    assert.ok(login);
    assert.ok(login.endpoints.includes('/api/v1/auth/login'));
    const profile = r.stores[0].actions.find((a) => a.name === 'fetchProfile');
    assert.ok(profile);
    assert.ok(profile.endpoints.includes('/api/v1/me'));
  });
  it('returns clean negatives', () => {
    const r = extractPiniaStores('var a = 1;');
    assert.equal(r.detected, false);
    assert.deepEqual(r.stores, []);
  });
});

describe('analyzeBundleArtifacts', () => {
  it('runs all ten extractors and keys results by idea', () => {
    const bundle = [SWC_SAMPLE, BABEL_SAMPLE, COREJS_SAMPLE, RXJS_SAMPLE, PINIA_SAMPLE].join('\n');
    const r = analyzeBundleArtifacts(bundle);
    assert.deepEqual(Object.keys(r), [
      'swc', 'babel', 'polyfillServices', 'coreJs', 'regenerator',
      'zoneJs', 'rxjs', 'ngrx', 'vuex', 'pinia',
    ]);
    assert.equal(r.swc.swcDetected, true);
    assert.equal(r.babel.babelDetected, true);
    assert.equal(r.coreJs.version, '3.19.1');
    assert.equal(r.rxjs.rxjsDetected, true);
    assert.equal(r.pinia.detected, true);
    assert.equal(r.zoneJs.detected, false);
    assert.equal(r.vuex.detected, false);
  });
});
