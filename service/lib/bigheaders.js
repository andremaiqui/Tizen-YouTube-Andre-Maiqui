'use strict';

// A response whose header block overflows Node's HTTP/1 parser is refetched over HTTP/2.

const http2 = require('http2');
const zlib = require('zlib');
const { PassThrough } = require('stream');
const URL = require('url');

const SESSION_IDLE = 30000;
const REQUEST_TIMEOUT = 30000;
const MAX_HEADER_LIST = 262144;

const ILLEGAL_IN_H2 = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'host'];

// A session per request would cost a handshake apiece.
const sessions = new Map();

// IPv4 first: a TV on a network with a broken IPv6 route stalls on the AAAA address. A host with no
// IPv4 route at all is retried on any family (see fetchOverHttp2), under its own session key.
const sessionFor = (origin, anyFamily) => {
    const key = anyFamily ? `${origin}#any` : origin;
    const existing = sessions.get(key);
    if (existing && !existing.closed && !existing.destroyed) return existing;

    const session = http2.connect(origin, anyFamily
        ? { settings: { maxHeaderListSize: MAX_HEADER_LIST }, family: 0, autoSelectFamily: true }
        : { settings: { maxHeaderListSize: MAX_HEADER_LIST }, family: 4 });
    const forget = () => { if (sessions.get(key) === session) sessions.delete(key); };

    session.setTimeout(SESSION_IDLE, () => session.close());
    session.on('error', forget);
    session.on('close', forget);

    sessions.set(key, session);
    return session;
};

// node-fetch's Response in the shapes the proxy uses: headers.raw(), headers.get(), a readable
// body and text().
const responseOf = (status, received, stream) => {
    const raw = Object.fromEntries(Object.keys(received)
        .filter((name) => name[0] !== ':')
        .map((name) => [name, Array.isArray(received[name]) ? received[name] : [String(received[name])]]));

    const text = () => new Promise((resolve, reject) => {
        const held = { parts: [] };

        stream.on('data', (chunk) => { held.parts = held.parts.concat([chunk]); });
        stream.on('end', () => resolve(Buffer.concat(held.parts).toString('utf8')));
        stream.on('error', reject);
    });

    return {
        status,
        ok: status >= 200 && status < 300,
        body: stream,
        headers: {
            raw: () => raw,
            get: (name) => {
                const found = raw[String(name).toLowerCase()];
                return found ? found.join(', ') : null;
            }
        },
        text
    };
};

// Decoded as node-fetch would, because the proxy treats the body as text.
const decoded = (request, encoding) => {
    const out = new PassThrough();
    const decoder = encoding === 'gzip' ? zlib.createGunzip()
        : (encoding === 'deflate' ? zlib.createInflate() : null);

    request.on('error', (error) => out.destroy(error));

    if (!decoder) {
        request.pipe(out);
        return out;
    }

    decoder.on('error', (error) => out.destroy(error));
    request.pipe(decoder).pipe(out);

    return out;
};

// Errors that mean there is no IPv4 route to the host, so the IPv4-only attempt is worth repeating.
const NO_V4_ROUTE = [
    'ENETUNREACH', 'EHOSTUNREACH', 'EADDRNOTAVAIL', 'ENOTFOUND', 'EAFNOSUPPORT',
    'EAI_ADDRFAMILY', 'EAI_NODATA', 'EAI_NONAME'
];

// Follows error.cause up to four deep, since the route failure is often wrapped.
const causedByNoV4Route = (error, depth) => !!error && depth < 4
    && (NO_V4_ROUTE.indexOf(error.code) !== -1
        || NO_V4_ROUTE.indexOf(error.errno) !== -1
        || causedByNoV4Route(error.cause, depth + 1));

const noV4Route = (error) => causedByNoV4Route(error, 0)
    || /EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_NODATA/.test(String((error && error.message) || ''));

const fetchOverHttp2 = (target, options, anyFamily) => new Promise((resolve, reject) => {
    const parsed = URL.parse(target);
    if (!parsed.host) return reject(new Error(`not a URL this can fetch: ${target}`));

    const session = sessionFor(`https://${parsed.host}`, anyFamily);

    if (!anyFamily) {
        const giveUp = reject;
        reject = (error) => (noV4Route(error)
            ? fetchOverHttp2(target, options, true).then(resolve, giveUp)
            : giveUp(error));
    }

    const headers = Object.fromEntries(Object.entries(options.headers || {})
        .filter(([name]) => ILLEGAL_IN_H2.indexOf(name) === -1));

    const request = session.request(Object.assign({
        ':method': options.method || 'GET',
        ':path': parsed.path || '/',
        ':authority': parsed.host,
        ':scheme': 'https'
    }, headers));

    request.setTimeout(REQUEST_TIMEOUT, () => request.destroy(new Error('http2 request timed out')));
    request.on('error', reject);

    request.on('response', (received) => {
        // Whatever is handed on is identity-encoded now, so the headers must not claim otherwise.
        const announced = Object.fromEntries(Object.entries(received)
            .filter(([name]) => name !== 'content-encoding' && name !== 'content-length'));

        resolve(responseOf(
            Number(received[':status']) || 502,
            announced,
            decoded(request, String(received['content-encoding'] || '').toLowerCase())
        ));
    });

    return Buffer.isBuffer(options.body) ? request.end(options.body) : request.end();
});

const isHeaderOverflow = (error) => !!error
    && (error.code === 'HPE_HEADER_OVERFLOW' || /header overflow/i.test(error.message || ''));

// Every session belonged to a network that is gone: a dead one looks open until its own timeout.
const reset = () => {
    Array.from(sessions.values()).forEach((session) => {
        try {
            session.destroy();
        } catch (error) {
            // Already closed.
        }
    });
    sessions.clear();
};

module.exports = { fetchOverHttp2, isHeaderOverflow, reset };
