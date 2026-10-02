const dns = require('dns').promises;
const net = require('net');

/**
 * Checks if an IPv4 address is in a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
const isPrivateIPv4 = (ip) => {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP is treated as unsafe
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (b0 === 10) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-local)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 – 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 (Network benchmark tests)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use)
  if (b0 >= 240) return true;

  return false;
};

/**
 * Checks if an IPv6 address is in a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
const isPrivateIPv6 = (ip) => {
  const normalized = ip.toLowerCase();

  // Loopback (::1) and unspecified (::)
  if (normalized === '::1' || normalized === '::') return true;

  // IPv4-mapped IPv6 address (::ffff:x.x.x.x)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.replace('::ffff:', '');
    if (net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
  }

  // Unique local addresses fc00::/7 (fc00... or fd00...)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local addresses fe80::/10
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // Multicast ff00::/8
  if (normalized.startsWith('ff')) return true;

  return false;
};

/**
 * Validates a target URL against SSRF vulnerabilities.
 * Throws an Error with a descriptive message if the URL points to a forbidden host/IP.
 *
 * @param {string} rawUrl
 * @returns {Promise<URL>} The validated URL object
 */
const validateSafeUrl = async (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('A valid URL string is required.');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    throw new Error('Malformed URL provided.');
  }

  // Only http and https protocols allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Invalid URL protocol. Only HTTP and HTTPS are allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check forbidden domain patterns
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home.arpa')
  ) {
    throw new Error(`Access to local/internal hostname "${hostname}" is restricted.`);
  }

  // Direct IP address check
  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isPrivateIPv4(hostname)) {
      throw new Error(`Direct connection to private IPv4 address "${hostname}" is restricted.`);
    }
    if (net.isIPv6(hostname) && isPrivateIPv6(hostname)) {
      throw new Error(`Direct connection to private IPv6 address "${hostname}" is restricted.`);
    }
    return parsed;
  }

  // DNS Resolution check (check all A / AAAA records)
  try {
    const records = await dns.lookup(hostname, { all: true });

    if (!records || records.length === 0) {
      throw new Error(`Could not resolve hostname "${hostname}".`);
    }

    for (const record of records) {
      const { address, family } = record;
      if (family === 4 && isPrivateIPv4(address)) {
        throw new Error(`Hostname "${hostname}" resolved to restricted IP ${address}.`);
      }
      if (family === 6 && isPrivateIPv6(address)) {
        throw new Error(`Hostname "${hostname}" resolved to restricted IPv6 ${address}.`);
      }
    }
  } catch (err) {
    if (err.message.includes('restricted') || err.message.includes('Could not resolve')) {
      throw err;
    }
    throw new Error(`DNS lookup failed for hostname "${hostname}": ${err.message}`);
  }

  return parsed;
};

module.exports = {
  validateSafeUrl,
  isPrivateIPv4,
  isPrivateIPv6
};
