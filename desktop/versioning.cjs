function versionParts(value) {
  return String(value || '0')
    .split(/[.+-]/u)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = a[index] || 0;
    const rightPart = b[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

function resolveDesktopUpdateStatus(options) {
  const currentVersion = String(options.currentVersion || '0.0.0');
  const latestVersion = String(options.latestVersion || currentVersion);
  const minimumSupportedVersion = String(options.minimumSupportedVersion || '0.0.0');
  const currentBuildNumber = normalizedBuildNumber(options.currentBuildNumber);
  const latestBuildNumber = normalizedBuildNumber(options.latestBuildNumber);
  const updateRequired = compareVersions(currentVersion, minimumSupportedVersion) < 0 || Boolean(options.forceUpdate);
  const newerVersion = compareVersions(currentVersion, latestVersion) < 0;
  const sameVersion = compareVersions(currentVersion, latestVersion) === 0;
  const newerBuild = sameVersion && Boolean(options.sameVersionUpdatePublished) && latestBuildNumber > currentBuildNumber;
  const newerRelease = newerBuild;
  const updateAvailable = updateRequired || newerVersion || newerBuild || newerRelease;

  return {
    canDefer: updateAvailable && !updateRequired,
    newerBuild,
    newerRelease,
    newerVersion,
    status: updateRequired ? 'required' : updateAvailable ? 'available' : 'current',
    updateAvailable,
    updateRequired
  };
}

function normalizeWindowsRelease(release) {
  if (!release || typeof release !== 'object' || release.draft || release.prerelease) return null;
  const match = String(release.tag_name || '').match(/^v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/u);
  if (!match) return null;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const setup = assets.find((asset) => /ChemVault-Model-Setup-.*\.exe$/iu.test(String(asset?.name || '')) && /^https:\/\//u.test(String(asset?.browser_download_url || '')));
  if (!setup) return null;
  return {
    version: match[1],
    releaseId: `github-${String(release.id || release.tag_name)}`,
    buildNumber: normalizedBuildNumber(release.id),
    downloadUrl: String(setup.browser_download_url),
    releaseNotesUrl: /^https:\/\//u.test(String(release.html_url || '')) ? String(release.html_url) : '',
    publishedAt: String(release.published_at || '')
  };
}

function normalizedBuildNumber(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

module.exports = {
  compareVersions,
  normalizeWindowsRelease,
  resolveDesktopUpdateStatus,
  versionParts
};
