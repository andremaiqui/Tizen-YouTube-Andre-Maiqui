'use strict';

// What keeps the app alive when the Wi-Fi drops or the set joins another network: the page is served
// from a loopback address that does not move, a request that dies on a stale socket is sent again, and
// a change of the set's own addresses throws every open connection away.

delete process.env.TUBE_PROXY_HOST;

const HEADERS_DEADLINE = 20000;
const setTimer = global.setTimeout;
global.setTimeout = (run, ms, ...rest) => setTimer(run, ms === HEADERS_DEADLINE ? 700 : ms, ...rest);

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ports = require('../lib/ports.js');
const origin = require('../lib/origin.js');
const proxy = require('../lib/proxy.js');
const sending = require('../lib/sending.js');
const { STABLE_HOST, html } = require('../lib/bootScreen.js');

const results = [];

const check = (name, ok, detail) => {
    results.push(!!ok);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  <- ${detail}`}`);
};

const wait = (ms) => new Promise((resolve) => setTimer(resolve, ms));

// ---------------------------------------------------------------- the boot screen hands over to a stable address

const WRITTEN = JSON.parse(/window\.TUBE_BOOT = (\{[^<]*\});/.exec(html(''))[1]);
const POLICY = /Content-Security-Policy" content="([^"]*)"/.exec(html(''))[1];
const ON_STABLE = `http://${STABLE_HOST}:${ports.PROXY}`;

check('the stable address is loopback, but not the 127.0.0.1 Tizen blocks between apps',
    /^127\.\d+\.\d+\.\d+$/.test(STABLE_HOST) && STABLE_HOST !== '127.0.0.1', STABLE_HOST);
check('the boot screen hands over to the stable address', WRITTEN.service === ON_STABLE, WRITTEN.service);
check('the page it hands over to is on the stable address', WRITTEN.target === `${ON_STABLE}/tv`, WRITTEN.target);
check('it is probed there too', WRITTEN.probeUrl === `${ON_STABLE}/__tube/ping`, WRITTEN.probeUrl);
check('127.0.0.1 stays as a fallback', WRITTEN.alternates.indexOf(`http://127.0.0.1:${ports.PROXY}`) !== -1,
    WRITTEN.alternates.join(' '));
check('the stable address is not its own fallback', WRITTEN.alternates.indexOf(ON_STABLE) === -1,
    WRITTEN.alternates.join(' '));
check('Cobalt may navigate to every address the boot screen can fall back to',
    WRITTEN.alternates.every((address) => new RegExp(`h5vcc-location-src[^;]*${address}`).test(POLICY)),
    POLICY);

// ---------------------------------------------------------------- the page's address is the one it was loaded from

const lan = origin.proxyHost();

check('before any page is served, the address is the set\'s own', lan !== STABLE_HOST, lan);

origin.noteHost(`${STABLE_HOST}:${ports.PROXY}`);
check('a page loaded from the stable address is rewritten for it', origin.proxyHost() === STABLE_HOST,
    origin.proxyHost());
check('its origin follows', origin.localOrigin() === ON_STABLE, origin.localOrigin());
check('its bypass prefix follows', origin.proxyPrefix() === `${ON_STABLE}/cors-bypass/`, origin.proxyPrefix());

['evil.example:8099', '', undefined, '1.2.3', '1.2.3.4.5', '<script>'].forEach((host) => {
    origin.noteHost(host);
    check(`a Host that is not an IPv4 address is ignored (${JSON.stringify(host)})`,
        origin.proxyHost() === STABLE_HOST, origin.proxyHost());
});

origin.noteHost('192.168.15.2:8099');
check('a page reloaded from the set\'s own address is rewritten for that instead',
    origin.proxyHost() === '192.168.15.2', origin.proxyHost());
origin.noteHost(STABLE_HOST);

// ---------------------------------------------------------------- upstream that dies on a stale socket

const seen = { posts: [], stalled: 0, closed: 0, reused: 0 };

const upstream = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const socket = req.socket;

    socket.tubeRequests = (socket.tubeRequests || 0) + 1;
    if (socket.tubeRequests > 1 && !url.searchParams.get('stale')) seen.reused += 1;

    // A socket kept alive across a Wi-Fi change: the next request on it never gets an answer.
    if (url.searchParams.get('stale') && socket.tubeRequests > 1) return socket.destroy();

    if (url.searchParams.get('stall') && seen.stalled === 0) {
        seen.stalled += 1;
        return undefined;
    }

    const parts = [];
    req.on('data', (chunk) => parts.push(chunk));
    req.on('end', () => {
        const body = Buffer.concat(parts);
        seen.posts.push({ method: req.method, size: body.length, path: url.pathname });

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, size: body.length, text: body.slice(0, 16).toString() }));
    });

    return undefined;
});

upstream.on('connection', (socket) => socket.on('close', () => { seen.closed += 1; }));
upstream.keepAliveTimeout = 60000;

const app = proxy.create();
proxy.attachFallback(app);

const finish = (server, child) => {
    const passed = results.filter(Boolean).length;
    console.log(`\n${passed}/${results.length} checks passed.`);

    if (child) child.kill();
    server.close();
    upstream.close();
    process.exit(passed === results.length ? 0 : 1);
};

// ---------------------------------------------------------------- the service notices the network change

const PRELOAD = [
    "const fs = require('fs'), os = require('os');",
    'const real = os.networkInterfaces;',
    "os.networkInterfaces = () => { try { return JSON.parse(fs.readFileSync(process.env.TUBE_FAKE_NET, 'utf8')); } catch (e) { return real(); } };"
].join('\n');

const wifi = (address) => ({ wlan0: address ? [{ address, family: 'IPv4', internal: false }] : [] });

const watchNetwork = (done) => {
    const entry = path.join(__dirname, '..', 'dist', 'index.js');
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tube-network-'));
    const fake = path.join(scratch, 'net.json');
    const preload = path.join(scratch, 'preload.js');
    const PORT = 8397;

    if (!fs.existsSync(entry)) {
        check('the service bundle exists to watch the network (run `npm run build` first)', false, entry);
        return done(null);
    }

    fs.writeFileSync(preload, PRELOAD);
    fs.writeFileSync(fake, JSON.stringify(wifi('192.168.15.2')));

    const child = spawn(process.execPath, ['-r', preload, entry], {
        env: Object.assign({}, process.env, {
            TUBE_PROXY_PORT: String(PORT),
            TUBE_LOG: path.join(scratch, 'service.log'),
            TUBE_FAKE_NET: fake
        }),
        stdio: 'ignore'
    });

    const notes = () => new Promise((resolve) => {
        const request = http.get({ host: '127.0.0.1', port: PORT, path: '/__tube/boot?since=0', timeout: 3000 }, (res) => {
            const parts = [];
            res.on('data', (chunk) => parts.push(chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(parts).toString()).log.filter((line) => line.what === 'network')
                        .map((line) => line.text));
                } catch (error) {
                    resolve([]);
                }
            });
        });

        request.on('error', () => resolve([]));
        request.on('timeout', () => { request.destroy(); resolve([]); });
    });

    const until = async (matches, within) => {
        const started = Date.now();
        const held = { lines: await notes() };

        while (!held.lines.some(matches) && Date.now() - started < within) {
            await wait(300);
            held.lines = await notes();
        }

        return held.lines;
    };

    const change = (state) => fs.writeFileSync(fake, JSON.stringify(state));

    return (async () => {
        await until(() => false, 1500);

        change(wifi(null));
        const dropped = await until((line) => /192\.168\.15\.2 → none/.test(line), 8000);
        check('the Wi-Fi going away is noticed and the connections to YouTube are dropped',
            dropped.some((line) => /192\.168\.15\.2 → none.*dropping the connections/.test(line)), dropped.join(' | '));

        change(wifi('192.168.15.2'));
        const back = await until((line) => /none → 192\.168\.15\.2/.test(line), 8000);
        check('the Wi-Fi coming back is noticed too, even on the same address',
            back.some((line) => /none → 192\.168\.15\.2/.test(line)), back.join(' | '));

        change(wifi('192.168.0.45'));
        const moved = await until((line) => /192\.168\.15\.2 → 192\.168\.0\.45/.test(line), 8000);
        check('a new address on another network is noticed',
            moved.some((line) => /192\.168\.15\.2 → 192\.168\.0\.45/.test(line)), moved.join(' | '));

        const before = moved.length;
        await wait(4500);
        check('an unchanged network is left alone', (await notes()).length === before, '');

        done(child);
    })();
};

// ---------------------------------------------------------------- run

upstream.listen(0, '127.0.0.1', () => {
    const target = `http://127.0.0.1:${upstream.address().port}`;

    const server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;

        const ask = (method, pathname, body, headers) => new Promise((resolve) => {
            const sent = Buffer.from(body || '');
            const req = http.request({
                host: '127.0.0.1',
                port,
                path: pathname,
                method,
                timeout: 8000,
                agent: false,
                // Cobalt keeps its connections alive, and the proxy hands the header on.
                headers: Object.assign({ connection: 'keep-alive' }, body ? { 'content-length': sent.length } : {}, headers)
            }, (res) => {
                const parts = [];
                res.on('data', (chunk) => parts.push(chunk));
                res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(parts).toString() }));
            });

            req.on('error', (error) => resolve({ status: 0, body: String(error.code || error.message) }));
            req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timed out' }); });
            req.end(sent);
        });

        const bypass = (method, pathname, body) => ask(method, `/cors-bypass/${target}${pathname}`, body);

        (async () => {
            // /tv is the one request whose Host becomes the page's address.
            const tv = http.request({
                host: '127.0.0.1', port, path: '/tv?x=1', headers: { host: `${STABLE_HOST}:${ports.PROXY}` }, agent: false
            });
            tv.on('error', () => undefined);
            tv.end();
            origin.noteHost('10.9.9.9');
            await wait(300);
            tv.destroy();
            check('the Host of a /tv request becomes the page\'s address', origin.proxyHost() === STABLE_HOST,
                origin.proxyHost());

            const other = http.request({
                host: '127.0.0.1', port, path: '/tv_config?x=1', headers: { host: '10.8.8.8:8099' }, agent: false
            });
            other.on('error', () => undefined);
            other.end();
            await wait(300);
            other.destroy();
            check('the Host of any other request is not', origin.proxyHost() === STABLE_HOST, origin.proxyHost());

            // The premise of everything below: the proxy keeps its connections to the upstream alive.
            await bypass('GET', '/reuse1');
            await bypass('GET', '/reuse2');
            check('the proxy reuses a connection it kept alive', seen.reused > 0, String(seen.reused));

            // A single socket kept alive by the proxy, then one request on it that the upstream kills.
            sending.dropAll();
            await wait(150);
            await bypass('GET', '/warm?stale=1');
            const post = await bypass('POST', '/youtubei/v1/browse?stale=1', JSON.stringify({ context: { client: 'TVHTML5' } }));
            check('a POST that dies on a stale socket is sent again on a fresh one',
                post.status === 200 && JSON.parse(post.body).text.indexOf('{"context"') === 0, `${post.status} ${post.body}`);
            check('the POST reached the upstream with its whole body',
                seen.posts.some((p) => p.method === 'POST' && p.size === JSON.stringify({ context: { client: 'TVHTML5' } }).length),
                JSON.stringify(seen.posts));

            sending.dropAll();
            await wait(150);
            await bypass('GET', '/warm2?stale=1');
            const get = await bypass('GET', '/watch?stale=1');
            check('a GET that dies on a stale socket is still sent again', get.status === 200, `${get.status} ${get.body}`);

            // The wait for headers gives up on a socket that was dead without a word.
            const stalled = await bypass('POST', '/youtubei/v1/next?stall=1', '{"a":1}');
            check('a POST that gets no answer is sent again once the wait for headers is over',
                stalled.status === 200 && seen.stalled === 1, `${stalled.status} ${stalled.body}`);

            // Too big to hold: still streamed whole, and never sent twice.
            const big = 'x'.repeat(400000);
            const large = await bypass('POST', '/big', big);
            check('a large POST is streamed through whole', large.status === 200 && JSON.parse(large.body).size === big.length,
                `${large.status} ${large.body}`);

            const plain = await bypass('POST', '/youtubei/v1/log_event', '{"ok":true}');
            check('an ordinary POST is unchanged', plain.status === 200 && JSON.parse(plain.body).text === '{"ok":true}',
                `${plain.status} ${plain.body}`);

            // Whatever is open belongs to the network that is gone.
            await bypass('GET', '/keepalive');
            const open = seen.closed;
            sending.dropAll();
            await wait(300);
            check('dropping the connections closes the ones that were kept open', seen.closed > open,
                `${open} -> ${seen.closed}`);

            const after = await bypass('GET', '/after');
            check('and the next request simply opens a new one', after.status === 200, `${after.status} ${after.body}`);

            watchNetwork((child) => finish(server, child));
        })();
    });
});
