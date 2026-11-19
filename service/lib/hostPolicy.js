'use strict';

const URL = require('url');

// These are the upstreams the application actually uses. Keep this list explicit: the proxy is
// reachable from the TV's LAN and must never become a general-purpose HTTP/WebSocket tunnel.
const ALLOWED_HOSTS = [
    'youtube.com',
    'googlevideo.com',
    'googleapis.com',
    'google.com',
    'ggpht.com',
    'gstatic.com',
    'googleusercontent.com'
];

const normalized = (host) => String(host || '').toLowerCase().replace(/\.$/, '');

const isAllowedHost = (host) => {
    const value = normalized(host);
    return ALLOWED_HOSTS.some((base) => value === base || value.endsWith(`.${base}`));
};

const isAllowedPort = (port, protocol) => {
    if (!port) return true;
    const number = Number(port);
    return number === (protocol === 'http:' || protocol === 'ws:' ? 80 : 443);
};

const parseTarget = (target) => {
    try { return URL.parse(String(target || '')); } catch (e) { return null; }
};

const isAllowedHttpTarget = (target) => {
    const parsed = parseTarget(target);

    if (!parsed || ['http:', 'https:'].indexOf(parsed.protocol) === -1) return false;
    const testLoopback = process.env.TUBE_TEST_UPSTREAM === '1'
        && /^127\.\d+\.\d+\.\d+$/.test(normalized(parsed.hostname));
    return (isAllowedHost(parsed.hostname) || testLoopback)
        && (testLoopback || isAllowedPort(parsed.port, parsed.protocol));
};

const isAllowedWebSocketTarget = (host, port, secure) => (
    (isAllowedHost(host) || (process.env.TUBE_TEST_UPSTREAM === '1'
        && /^127\.\d+\.\d+\.\d+$/.test(normalized(host))))
    && (process.env.TUBE_TEST_UPSTREAM === '1' || isAllowedPort(port, secure ? 'wss:' : 'ws:'))
);

module.exports = {
    isAllowedHost,
    isAllowedHttpTarget,
    isAllowedWebSocketTarget
};
