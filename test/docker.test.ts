import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DockerDiscovery, parseContainer, parseDockerTarget } from '../src/server/docker.ts';

const jelly = { Names: ['/jellyfin'], State: 'running', Labels: { 'abode.name': 'Jellyfin', 'abode.group': 'Media' }, Ports: [{ PrivatePort: 8096, PublicPort: 8096, Type: 'tcp' }, { PrivatePort: 1900, PublicPort: 1900, Type: 'udp' }] };
const paper = { Names: ['/paperless'], State: 'exited', Labels: { 'abode.name': 'Paperless', 'abode.url': 'http://nas.local:8000/' }, Ports: [] };
const plain = { Names: ['/redis'], State: 'running', Labels: {}, Ports: [{ PrivatePort: 6379, PublicPort: 6379, Type: 'tcp' }] };
const noPort = { Names: ['/worker'], State: 'running', Labels: { 'abode.name': 'Worker' }, Ports: [] };
const stopped = { Names: ['/sonarr'], State: 'exited', Labels: { 'abode.name': 'Sonarr' }, Ports: [] };

test('parseContainer reads the labels, the first published TCP port and the running state', () => {
  assert.deepEqual(parseContainer(jelly), { name: 'jellyfin', label: 'Jellyfin', url: null, port: 8096, group: 'Media', running: true, state: 'running' });
  assert.deepEqual(parseContainer(paper), { name: 'paperless', label: 'Paperless', url: 'http://nas.local:8000/', port: null, group: '', running: false, state: 'exited' });
  assert.equal(parseContainer(plain), null, 'unlabelled containers are ignored');
  assert.equal(parseContainer({ Names: ['/x'], Labels: { 'abode.name': 'X', 'abode.url': 'javascript:alert(1)' } })!.url, null, 'only http(s) or site paths are accepted as urls');
});

test('discovery polls the socket, builds bookmarks from the request host, and reports state as status', async () => {
  const calls: string[] = [];
  const fetcher = async (path: string) => {
    calls.push(path);
    if (path === '/containers/sonarr/json') return { HostConfig: { PortBindings: { '8989/tcp': [{ HostPort: '8989' }], '9/udp': [{ HostPort: '9' }] } } };
    if (path === '/containers/worker/json') return { HostConfig: { PortBindings: {} } };
    return [jelly, paper, plain, noPort, stopped];
  };
  const d = new DockerDiscovery({ fetcher });
  assert.ok(d.enabled);
  await d.refresh();
  assert.ok(calls[0].startsWith('/containers/json?all=true&filters='), 'asks for all containers filtered by label');
  assert.ok(decodeURIComponent(calls[0]).includes('"abode.name"'));

  const marks = d.asBookmarks('a');
  assert.deepEqual(marks.map((b) => [b.id, b.label, b.url, b.group, b.owner, b.shared]), [
    ['docker:jellyfin', 'Jellyfin', 'http://a:8096', 'Media', 'docker', true],
    ['docker:paperless', 'Paperless', 'http://nas.local:8000/', '', 'docker', true],
    ['docker:sonarr', 'Sonarr', 'http://a:8989', '', 'docker', true],
  ]);
  assert.equal(d.asBookmarks('10.0.0.5:8080')[0].url, 'http://10.0.0.5:8096', 'port is stripped from the request host');
  assert.equal(marks.length, 3, 'a labelled container with neither a url nor any port binding is skipped');
  assert.ok(calls.includes('/containers/sonarr/json'), 'a stopped container without listed ports is inspected for its configured binding');
  assert.ok(!calls.includes('/containers/jellyfin/json'), 'running containers need no extra call');
  assert.equal(d.statusOf('docker:sonarr'), 'down');

  assert.equal(d.statusOf('docker:jellyfin'), 'up');
  assert.equal(d.statusOf('docker:paperless'), 'down', 'a stopped container is listed, with a red dot');
  assert.equal(d.statusOf('docker:nope'), null);
});

test('discovery is disabled without a socket and survives socket errors', async () => {
  const off = new DockerDiscovery({ socketPath: '/nonexistent/docker.sock' });
  assert.ok(!off.enabled);
  await off.refresh();
  assert.deepEqual(off.list(), []);

  const broken = new DockerDiscovery({ fetcher: async () => { throw new Error('permission denied'); } });
  await broken.refresh();
  assert.deepEqual(broken.list(), []);
  assert.match(broken.error ?? '', /permission denied/);
});

test('the docker target is a socket path or a tcp proxy address', () => {
  assert.deepEqual(parseDockerTarget('/var/run/docker.sock'), { socketPath: '/var/run/docker.sock' });
  assert.deepEqual(parseDockerTarget('tcp://docker-proxy:2375'), { host: 'docker-proxy', port: 2375 });
  assert.deepEqual(parseDockerTarget('tcp://docker-proxy'), { host: 'docker-proxy', port: 2375 });
  assert.deepEqual(parseDockerTarget('http://10.0.0.5:2376/'), { host: '10.0.0.5', port: 2376 });
  assert.ok(new DockerDiscovery({ socketPath: 'tcp://docker-proxy:2375' }).enabled, 'a proxy address counts as configured');
});
