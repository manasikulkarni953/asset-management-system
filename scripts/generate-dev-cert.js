const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function getLocalIpAddresses() {
  const ips = new Set(['127.0.0.1', '0.0.0.0']);
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.add(net.address);
      }
    }
  }
  return Array.from(ips);
}

function findOpenSSL() {
  // Test PATH first
  try {
    execSync('openssl version', { stdio: 'ignore' });
    return 'openssl';
  } catch {}

  const standardPaths = [
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
    'C:\\Git\\usr\\bin\\openssl.exe',
    'C:\\OpenSSL-Win64\\bin\\openssl.exe',
    'C:\\OpenSSL-Win32\\bin\\openssl.exe',
  ];

  for (const p of standardPaths) {
    if (fs.existsSync(p)) {
      return `"${p}"`;
    }
  }
  return null;
}

function ensureDevCerts() {
  const certDir = path.resolve(__dirname, '..', 'certificates');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  const keyPath = path.join(certDir, 'dev-key.pem');
  const certPath = path.join(certDir, 'dev-cert.pem');

  const ips = getLocalIpAddresses();
  const sanList = ['DNS:localhost', ...ips.map((ip) => `IP:${ip}`)].join(',');

  const openssl = findOpenSSL();
  if (!openssl) {
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      console.log('✓ Using existing development certificates.');
      return { keyPath, certPath };
    }
    throw new Error('OpenSSL not found. Please install Git for Windows or OpenSSL to generate SSL certificates.');
  }

  console.log(`Generating development HTTPS certificate for: localhost, ${ips.join(', ')}...`);
  const cmd = `${openssl} req -x509 -newkey rsa:2048 -nodes -sha256 -subj "/CN=AssetFlowDev" -addext "subjectAltName=${sanList}" -days 365 -keyout "${keyPath}" -out "${certPath}"`;

  execSync(cmd, { stdio: 'inherit' });
  console.log('✓ Development SSL certificates created successfully.');
  return { keyPath, certPath };
}

if (require.main === module) {
  try {
    ensureDevCerts();
  } catch (err) {
    console.error('Failed to ensure dev certificates:', err.message);
    process.exit(1);
  }
}

module.exports = { ensureDevCerts, getLocalIpAddresses };
