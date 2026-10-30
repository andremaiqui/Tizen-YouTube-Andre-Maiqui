'use strict';

const ports = require('./ports.js');
const { switches } = require('./cobaltConfig.js');
const { serviceAddress } = require('./serviceAddress.js');

// The container reaches nothing but the origin named in --base_url.
const servedHost = () => (/--base_url=http:\/\/([^/:\s"]+)/.exec(switches() || '') || [])[1] || null;

// The address the page was actually loaded from, taken from the Host of its /tv request. When that
// is the stable loopback address of the boot screen it cannot change under the page, however often
// the Wi-Fi drops or the set is handed a new lease.
const seen = { host: null };

const noteHost = (host) => {
    const name = String(host || '').replace(/:\d+$/, '');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) seen.host = name;
};

// Asked each time: DHCP can change this set's address while the service runs.
const proxyHost = () => process.env.TUBE_PROXY_HOST || servedHost() || seen.host || serviceAddress();

const localOrigin = () => `http://${proxyHost()}:${ports.PROXY}`;

// What a redirect out of the bypass has to be prefixed with to come back through here.
const proxyPrefix = () => `${localOrigin()}/cors-bypass/`;

module.exports = { proxyHost, localOrigin, proxyPrefix, noteHost };
