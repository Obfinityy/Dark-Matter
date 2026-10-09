/**
 * apiSpecRecon.test.js — node:test coverage for the API spec discovery
 * recon engine (ideas 01001–01010). All tests are offline: they feed
 * operator-supplied fixtures into pure analysis functions.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSwaggerProbePaths,
  parseSwaggerResponse,
  SWAGGER_DOC_PATHS,
  buildFastApiProbePaths,
  detectFastApiDocs,
  actuatorPathList,
  parseActuatorResponse,
  redactSensitiveValue,
  postmanQueryBuilder,
  extractPostmanEndpoints,
  asyncapiCandidatePaths,
  parseAsyncApiResponse,
  wsdlCandidatePaths,
  parseWsdlResponse,
  wadlCandidatePaths,
  parseWadlResponse,
  odataMetadataParser,
  odataBatchProbeDescriptor,
  graphqlIntrospectionQuery,
  parseGraphqlIntrospectionResponse,
  graphqlCandidatePaths,
  apiSpecFinding,
} from './apiSpecRecon.js';

// --- Idea 01001 ------------------------------------------------------------
describe('Idea 01001 — Swagger/OpenAPI sweep', () => {
  it('builds 40+ absolute probe URLs including the canonical paths', () => {
    const urls = buildSwaggerProbePaths('https://api.example.com/');
    assert.ok(urls.length >= 40, `expected >=40 paths, got ${urls.length}`);
    assert.equal(SWAGGER_DOC_PATHS.length, urls.length);
    const flat = urls.map(u => u.url);
    assert.ok(flat.includes('https://api.example.com/v3/api-docs'));
    assert.ok(flat.includes('https://api.example.com/swagger.json'));
    assert.ok(flat.includes('https://api.example.com/openapi.yaml'));
    for (const u of urls) assert.ok(u.url.startsWith('https://api.example.com/'));
  });

  it('detects an OpenAPI 3 JSON spec and lists its paths', () => {
    const spec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Shop API', version: '2.1.0' },
      paths: { '/users': {}, '/users/{id}': {}, '/orders': {} },
    });
    const r = parseSwaggerResponse(spec);
    assert.equal(r.found, true);
    assert.equal(r.shape, 'openapi-3');
    assert.deepEqual(r.paths, ['/users', '/users/{id}', '/orders']);
    assert.equal(r.title, 'Shop API');
    assert.equal(r.version, '2.1.0');
  });

  it('detects Swagger UI HTML and rejects non-spec bodies', () => {
    const html = '<html><script src="/swagger-ui-bundle.js">SwaggerUIBundle</script></html>';
    const r = parseSwaggerResponse(html);
    assert.equal(r.found, true);
    assert.equal(r.shape, 'swagger-ui-html');
    assert.equal(parseSwaggerResponse('<html><body>hello</body></html>').found, false);
  });
});

// --- Idea 01002 ------------------------------------------------------------
describe('Idea 01002 — FastAPI docs exposure', () => {
  it('covers /docs, /redoc and /openapi.json probe paths', () => {
    const urls = buildFastApiProbePaths('https://ml.example.com');
    const flat = urls.map(u => u.url);
    assert.ok(flat.includes('https://ml.example.com/docs'));
    assert.ok(flat.includes('https://ml.example.com/redoc'));
    assert.ok(flat.includes('https://ml.example.com/openapi.json'));
  });

  it('recognises FastAPI Swagger-UI and ReDoc page markers', () => {
    const docs = detectFastApiDocs('<title>FastAPI - Swagger UI</title><script src="swagger-ui-bundle.js">');
    assert.equal(docs.exposed, true);
    assert.equal(docs.kind, 'swagger-ui');
    const redoc = detectFastApiDocs('<redoc spec-url="/openapi.json"></redoc>');
    assert.equal(redoc.exposed, true);
    assert.equal(redoc.kind, 'redoc');
    assert.equal(detectFastApiDocs('{"detail":"Not Found"}').exposed, false);
  });
});

// --- Idea 01003 -------------------------------------------------------------
describe('Idea 01003 — Spring Boot actuator enumeration', () => {
  it('enumerates base paths x endpoints including env and heapdump', () => {
    const paths = actuatorPathList();
    const flat = paths.map(p => p.path);
    assert.ok(flat.includes('/actuator'));
    assert.ok(flat.includes('/actuator/env'));
    assert.ok(flat.includes('/actuator/heapdump'));
    assert.ok(flat.includes('/actuator/beans'));
    const envEntry = paths.find(p => p.path === '/actuator/env');
    assert.equal(envEntry.sensitive, true);
    assert.equal(paths.find(p => p.path === '/actuator/health').sensitive, false);
  });

  it('parses the actuator index and lists exposed endpoints', () => {
    const body = JSON.stringify({ _links: { self: {}, health: {}, env: {}, heapdump: {} } });
    const r = parseActuatorResponse('/actuator', body);
    assert.equal(r.ok, true);
    assert.deepEqual(r.detail.endpoints, ['self', 'health', 'env', 'heapdump']);
  });

  it('redacts sensitive env values and reports property sources', () => {
    const body = JSON.stringify({
      propertySources: [{
        name: 'applicationConfig',
        properties: {
          'server.port': { value: '8080' },
          'spring.datasource.password': { value: 's3cr3t!' },
          'jwt.secret': { value: 'topsecret' },
        },
      }],
    });
    const r = parseActuatorResponse('/actuator/env', body);
    assert.equal(r.ok, true);
    const props = r.detail.redactedProperties.applicationConfig;
    assert.equal(props['server.port'], '8080');
    assert.equal(props['spring.datasource.password'], '***REDACTED***');
    assert.equal(props['jwt.secret'], '***REDACTED***');
  });

  it('parses beans context and mappings counts', () => {
    const beans = JSON.stringify({ contexts: { app: { beans: { a: {}, b: {}, c: {} } } } });
    const rb = parseActuatorResponse('/actuator/beans', beans);
    assert.equal(rb.detail.beanCount, 3);
    const mappings = JSON.stringify({
      contexts: { app: { mappings: { dispatcherServlets: { ds: [{}, {}] } } } },
    });
    assert.equal(parseActuatorResponse('/actuator/mappings', mappings).detail.mappingCount, 2);
  });

  it('flags heapdump exposure and rejects non-JSON bodies', () => {
    const r = parseActuatorResponse('/actuator/heapdump', 'binary-garbage');
    assert.match(r.summary, /not JSON|high-severity/i);
    assert.equal(redactSensitiveValue('apiKey', 'abc'), '***REDACTED***');
    assert.equal(redactSensitiveValue('server.port', '8080'), '8080');
  });
});

// --- Idea 01004 ------------------------------------------------------------
describe('Idea 01004 — Postman workspace harvesting', () => {
  it('builds a brand-scoped public search URL', () => {
    const q = postmanQueryBuilder('Acme Shop');
    assert.ok(q.searchUrl.startsWith('https://api.getpostman.com/search?'));
    assert.ok(q.searchUrl.includes('q=Acme+Shop') || q.searchUrl.includes('q=Acme%20Shop'));
    assert.equal(q.query, 'Acme Shop');
  });

  it('extracts in-scope endpoints from a collection', () => {
    const coll = {
      item: [
        { name: 'List orders', request: { method: 'GET', url: 'https://api.acme.test/v1/orders' } },
        {
          name: 'Nested', item: [
            { name: 'Delete user', request: { method: 'DELETE', url: { raw: 'https://api.acme.test/v1/users/1' } } },
          ],
        },
        { name: 'Other brand', request: { method: 'GET', url: 'https://other.example/v1/x' } },
      ],
    };
    const r = extractPostmanEndpoints(coll, 'api.acme.test');
    assert.equal(r.requests.length, 2);
    assert.ok(r.stats.methods.includes('DELETE'));
    assert.ok(r.requests.every(x => x.url.includes('api.acme.test')));
  });
});

// --- Idea 01005 ------------------------------------------------------------
describe('Idea 01005 — AsyncAPI discovery', () => {
  it('covers asyncapi.json/yaml and EventCatalog portal paths', () => {
    const urls = asyncapiCandidatePaths('https://events.example.com');
    const flat = urls.map(u => u.url);
    assert.ok(flat.includes('https://events.example.com/asyncapi.json'));
    assert.ok(flat.includes('https://events.example.com/asyncapi.yaml'));
    assert.ok(flat.includes('https://events.example.com/eventcatalog'));
  });

  it('detects AsyncAPI 3 JSON and extracts channels', () => {
    const body = JSON.stringify({
      asyncapi: '3.0.0',
      channels: { 'user/created': {}, 'order/shipped': {} },
    });
    const r = parseAsyncApiResponse(body);
    assert.equal(r.found, true);
    assert.equal(r.shape, 'asyncapi-json-3');
    assert.deepEqual(r.channels, ['user/created', 'order/shipped']);
    assert.equal(parseAsyncApiResponse('{"a":1}').found, false);
  });
});

// --- Idea 01006 ------------------------------------------------------------
describe('Idea 01006 — WSDL discovery', () => {
  it('covers ?wsdl, /soap and .asmx variants', () => {
    const urls = wsdlCandidatePaths('https://legacy.example.com');
    const flat = urls.map(u => u.url);
    assert.ok(flat.includes('https://legacy.example.com/service?wsdl'));
    assert.ok(flat.includes('https://legacy.example.com/Service.asmx'));
    assert.ok(flat.includes('https://legacy.example.com/service.wsdl'));
  });

  it('parses services, ports and operations from WSDL XML', () => {
    const xml = `<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/">
      <wsdl:service name="OrderService"><wsdl:port name="OrderPort" binding="tns:OrderBinding"/></wsdl:service>
      <wsdl:binding name="OrderBinding"><wsdl:operation name="PlaceOrder"/><wsdl:operation name="CancelOrder"/></wsdl:binding>
    </wsdl:definitions>`;
    const r = parseWsdlResponse(xml);
    assert.equal(r.found, true);
    assert.deepEqual(r.services, ['OrderService']);
    assert.deepEqual(r.ports, [{ name: 'OrderPort', binding: 'tns:OrderBinding' }]);
    assert.deepEqual(r.operations, ['PlaceOrder', 'CancelOrder']);
    assert.equal(parseWsdlResponse('<html>nope</html>').found, false);
  });
});

// --- Idea 01007 ------------------------------------------------------------
describe('Idea 01007 — WADL probing', () => {
  it('covers application.wadl and /wadl paths', () => {
    const urls = wadlCandidatePaths('https://jaxrs.example.com');
    const flat = urls.map(u => u.url);
    assert.ok(flat.includes('https://jaxrs.example.com/application.wadl'));
    assert.ok(flat.includes('https://jaxrs.example.com/api/application.wadl'));
  });

  it('parses base URL, resources and methods from WADL XML', () => {
    const xml = `<?xml version="1.0"?><application xmlns="http://wadl.dev.java.net/2009/02">
      <resources base="https://jaxrs.example.com/api/">
        <resource path="/users"><method name="GET"/><method name="POST"/></resource>
        <resource path="/users/{id}"><method name="GET"/><method name="DELETE"/></resource>
      </resources></application>`;
    const r = parseWadlResponse(xml);
    assert.equal(r.found, true);
    assert.equal(r.base, 'https://jaxrs.example.com/api/');
    assert.equal(r.resources.length, 2);
    assert.deepEqual(r.resources[0], { path: '/users', methods: ['GET', 'POST'] });
    assert.equal(parseWadlResponse('{}').found, false);
  });
});

// --- Idea 01008 ------------------------------------------------------------
describe('Idea 01008 — OData metadata extraction', () => {
  it('extracts entity sets, types, keys and function imports', () => {
    const xml = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
      <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm">
        <EntityType Name="Product"><Key><PropertyRef Name="Id"/></Key>
          <Property Name="Id" Type="Edm.Int32"/><Property Name="Name" Type="Edm.String"/>
          <NavigationProperty Name="Category" Type="Category"/></EntityType>
        <EntityContainer Name="Shop"><EntitySet Name="Products" EntityType="Product"/></EntityContainer>
        <FunctionImport Name="TopSelling" Function="TopSelling"/>
      </Schema></edmx:DataServices></edmx:Edmx>`;
    const r = odataMetadataParser(xml);
    assert.equal(r.found, true);
    assert.equal(r.version, '4.0');
    assert.deepEqual(r.entitySets, [{ name: 'Products', entityType: 'Product' }]);
    assert.deepEqual(r.entityTypes[0].keys, ['Id']);
    assert.deepEqual(r.entityTypes[0].properties, ['Id', 'Name']);
    assert.deepEqual(r.functionImports, ['TopSelling']);
    assert.deepEqual(r.navProperties, [{ entity: 'Product', name: 'Category' }]);
    assert.equal(odataMetadataParser('<html></html>').found, false);
  });
});

// --- Idea 01009 ------------------------------------------------------------
describe('Idea 01009 — OData $batch probe descriptor', () => {
  it('builds a read-only multipart batch descriptor with assertions', () => {
    const d = odataBatchProbeDescriptor('https://odata.example.com/svc/', { entitySet: 'Orders' });
    assert.equal(d.method, 'POST');
    assert.equal(d.url, 'https://odata.example.com/svc/$batch');
    assert.match(d.headers['Content-Type'], /multipart\/mixed;boundary=/);
    assert.ok(d.bodyTemplate.includes('GET Orders HTTP/1.1'));
    assert.ok(d.assertions.batchSupported.includes('202'));
    assert.match(d.note, /Read-only/i);
  });
});

// --- Idea 01010 ------------------------------------------------------------
describe('Idea 01010 — GraphQL introspection check', () => {
  it('returns full and minimal introspection query bodies', () => {
    const full = graphqlIntrospectionQuery('full');
    assert.ok(full.query.includes('__schema'));
    assert.ok(full.query.includes('possibleTypes'));
    const minimal = graphqlIntrospectionQuery('minimal');
    assert.ok(minimal.query.includes('__schema'));
    assert.ok(minimal.query.length < full.query.length);
    assert.equal(full.operationName, 'IntrospectionQuery');
  });

  it('interprets an enabled-introspection response', () => {
    const body = JSON.stringify({
      data: {
        __schema: {
          queryType: { name: 'Query' },
          types: [{ name: 'Query' }, { name: 'User' }, { name: 'String' }],
        },
      },
    });
    const r = parseGraphqlIntrospectionResponse(body);
    assert.equal(r.introspectionEnabled, true);
    assert.equal(r.queryType, 'Query');
    assert.equal(r.typeCount, 3);
    assert.deepEqual(r.types, ['Query', 'User', 'String']);
  });

  it('reports disabled introspection on error responses', () => {
    const r = parseGraphqlIntrospectionResponse(JSON.stringify({ errors: [{ message: 'introspection disabled' }] }));
    assert.equal(r.introspectionEnabled, false);
    assert.equal(parseGraphqlIntrospectionResponse('not json').introspectionEnabled, false);
  });

  it('lists GraphQL endpoint path variants', () => {
    const urls = graphqlCandidatePaths('https://gql.example.com');
    assert.ok(urls.includes('https://gql.example.com/graphql'));
    assert.ok(urls.includes('https://gql.example.com/graphiql'));
    assert.ok(urls.includes('https://gql.example.com/api/graphql'));
  });
});

// --- Finding builder -------------------------------------------------------
describe('apiSpecFinding', () => {
  it('grades exposed sensitive surfaces as High and quiet negatives as Info', () => {
    const f = apiSpecFinding({ category: 'actuator', exposed: true, sensitive: true, routeCount: 5, detail: 'env exposed' });
    assert.equal(f.severity, 'High');
    assert.equal(f.confidence, 'high');
    assert.match(f.recommendation, /Restrict/);
    const neg = apiSpecFinding({ category: 'graphql', exposed: false });
    assert.equal(neg.severity, 'Info');
  });
});
