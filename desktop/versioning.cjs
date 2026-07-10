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
  const currentBuildId = String(options.currentBuildId || '');
  const latestBuildId = String(options.latestBuildId || '');
  const currentReleaseId = String(options.currentReleaseId || '');
  const latestReleaseId = String(options.latestReleaseId || '');
  const updateRequired = compareVersions(currentVersion, minimumSupportedVersion) < 0 || Boolean(options.forceUpdate);
  const newerVersion = compareVersions(currentVersion, latestVersion) < 0;
  const sameVersion = compareVersions(currentVersion, latestVersion) === 0;
  const newerBuild = sameVersion && Boolean(latestBuildId) && Boolean(currentBuildId) && latestBuildId !== currentBuildId;
  const newerRelease = sameVersion && Boolean(latestReleaseId) && Boolean(currentReleaseId) && latestReleaseId !== currentReleaseId;
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

module.exports = {
  compareVersions,
  resolveDesktopUpdateStatus,
  versionParts
};
