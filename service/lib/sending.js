'use strict';

const fetch = require('node-fetch');
const http = require('http');
const https = require('https');

const postmortem = require('./postmortem.js');
const bigheaders = require('./bigheaders.js');

// A booting page opens about thirty requests at once.
const MOST_SOCKETS = 64;

// No socket timeout: a paused SABR stream is an idle socket, and a timeout would cut playback.
const AGENT_OPTIONS = { keepAlive: true, keepAliveMsecs: 15000, maxSockets: MOST_SOCKETS, family: 4 };
const httpsAgent = new https.Agent(AGENT_OPTIONS);
const httpAgent = new http.Agent(AGENT_OPTIONS);
const agentFor = (url) => (String(url).indexOf('https:') === 0 ? httpsAgent : httpAgent);

// A retry must not reuse the pool, and must stay on IPv4 like everything else: the default agent
// does neither, and on a network with a broken IPv6 route it would stall on the AAAA address.
const FRESH_OPTIONS = { keepAlive: false, family: 4 };
const freshHttpsAgent = new https.Agent(FRESH_OPTIONS);
const freshHttpAgent = new http.Agent(FRESH_OPTIONS);
const freshAgentFor = (url) => (String(url).indexOf('https:') === 0 ? freshHttpsAgent : freshHttpAgent);

// Idle keep-alive sockets die silently when the Wi-Fi changes, and each would fail one request.
// The first failure throws all of them away.
const dropIdle = () => [httpsAgent, httpAgent].forEach((agent) => {
    const idle = agent.freeSockets || {};

    Object.keys(idle).forEach((key) => (idle[key] || []).slice().forEach((socket) => {
        try {
            socket.destroy();
        } catch (error) {
            // Already closed.
        }
    }));
});

// The network changed under us: nothing already open can be trusted, in use or not. A response that
// stopped arriving on a dead socket would otherwise wait for the kernel's own timeout.
const dropAll = () => {
    [httpsAgent, httpAgent].forEach((agent) => {
        try {
            agent.destroy();
        } catch (error) {
            // Already closed.
        }
    });
    bigheaders.reset();
};

// Only the wait for headers is bounded, so a streaming body is never cut.
const HEADERS_DEADLINE = 20000;

const RETRIABLE = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'];

const BODIED = ['POST', 'PUT', 'PATCH'];

const isRepeatable = (req) => !!req && BODIED.indexOf(req.method) === -1;

const isRetriable = (error) => !!error
    && (RETRIABLE.indexOf(error.code) !== -1 || /socket hang up|premature close/i.test(error.message || ''));

// The wait for headers gave up: the socket was most likely dead and nobody said so.
const isStalled = (error) => !!error && (error.name === 'AbortError' || error.type === 'aborted');

// A body this small is held in memory, so a request that fails on a dead socket can be sent again.
// Anything larger, or of unknown length, is still streamed and can only be sent once.
const MOST_BUFFERED = 262144;

const lengthOf = (req) => {
    const size = parseInt(req.headers && req.headers['content-length'], 10);
    return isFinite(size) ? size : -1;
};

const canBuffer = (req) => !isRepeatable(req)
    && !/chunked/i.test(String((req.headers && req.headers['transfer-encoding']) || ''))
    && lengthOf(req) > 0 && lengthOf(req) <= MOST_BUFFERED;

const readBody = (req) => new Promise((resolve, reject) => {
    if (req.readableEnded) return resolve(Buffer.concat([]));

    const held = { parts: [] };

    req.on('data', (chunk) => { held.parts = held.parts.concat([chunk]); });
    req.on('end', () => resolve(Buffer.concat(held.parts)));
    req.on('error', reject);
    req.on('close', () => { if (!req.complete) reject(new Error('the page dropped the request')); });

    return undefined;
});

// Node 12 has no AbortController, and node-fetch accepts any signal whose constructor is named
// AbortSignal.
const SIGNAL = { constructor: { name: 'AbortSignal' } };

// Below node 8 node-fetch refuses any signal beside a streamed body, so those requests go unbounded.
const SIGNAL_BESIDE_STREAM = 'destroy' in require('stream').Readable.prototype;

const untilHeaders = (make) => {
    const held = { listeners: [] };
    const signal = Object.assign(Object.create(SIGNAL), {
        aborted: false,
        addEventListener: (_, listener) => { held.listeners = held.listeners.concat(listener); },
        removeEventListener: (_, listener) => {
            held.listeners = held.listeners.filter((other) => other !== listener);
        }
    });
    const timer = setTimeout(() => {
        signal.aborted = true;
        held.listeners.forEach((listener) => listener());
    }, HEADERS_DEADLINE);
    const stop = (answer) => { clearTimeout(timer); return answer; };

    return make(signal).then(stop, (error) => { stop(); throw error; });
};

const send = (url, req, headers, fresh) => {
    const streamed = !isRepeatable(req);
    const read = streamed && canBuffer(req) ? readBody(req) : Promise.resolve(null);

    return read.then((buffered) => {
        const replayable = !streamed || !!buffered;
        const body = streamed ? (buffered || req) : undefined;

        const options = {
            method: req.method,
            headers,
            body,
            redirect: 'manual',
            agent: fresh ? freshAgentFor(url) : agentFor(url)
        };

        const attempt = (changed) => (streamed && !buffered && !SIGNAL_BESIDE_STREAM
            ? fetch(url, Object.assign({}, options, changed))
            : untilHeaders((signal) => fetch(url, Object.assign({}, options, changed, { signal }))));

        return attempt().catch((error) => {
            if (bigheaders.isHeaderOverflow(error) && !streamed && url.indexOf('https:') === 0) {
                postmortem.note('upstream', `header overflow on ${url.slice(0, 80)} — retrying over http2`);
                return bigheaders.fetchOverHttp2(url, { method: req.method, headers });
            }

            const dead = isRetriable(error) || isStalled(error);
            if (dead) dropIdle();

            // A streamed body cannot be sent twice.
            if (!dead || !replayable) throw error;

            postmortem.note('upstream', `${postmortem.describe(error)} on ${req.method} ${url.slice(0, 80)}`
                + ' — retrying on a fresh connection');

            return attempt({ agent: freshAgentFor(url) });
        });
    });
};

const textOf = (response) => response.text().then((text) => ({ response, text }));

const readText = (response, url, req, headers) => textOf(response).catch((error) => {
    if (!isRetriable(error) || !isRepeatable(req)) throw error;

    postmortem.note('upstream', `${postmortem.describe(error)} reading ${url.slice(0, 80)}`
        + ' — asking again');

    return send(url, req, headers, true).then(textOf);
});

module.exports = { send, readText, dropAll };
