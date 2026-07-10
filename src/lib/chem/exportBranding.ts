export const CHEMVAULT_EXPORT_LOGO_PATH = '/brand/chemvault-logo.png';
export const CHEMVAULT_EXPORT_COPYRIGHT = 'Copyright (c) ChemVault. All rights reserved.';

export type ChemVaultExportBranding = {
  dataUrl: string;
  pngBytes: Uint8Array;
};

let brandingPromise: Promise<ChemVaultExportBranding | null> | null = null;

export function loadChemVaultExportBranding() {
  if (!brandingPromise) {
    brandingPromise = fetch(CHEMVAULT_EXPORT_LOGO_PATH)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Logo request failed with status ${response.status}.`);
        const blob = await response.blob();
        const [buffer, dataUrl] = await Promise.all([blob.arrayBuffer(), blobToDataUrl(blob)]);
        return {
          dataUrl,
          pngBytes: new Uint8Array(buffer)
        };
      })
      .catch(() => null);
  }
  return brandingPromise;
}

export async function createBrandedPngDataUrl(sourceDataUrl: string) {
  const [source, branding] = await Promise.all([
    loadImage(sourceDataUrl),
    loadChemVaultExportBranding()
  ]);
  if (!branding) return sourceDataUrl;

  const logo = await loadImage(branding.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth || source.width;
  canvas.height = source.naturalHeight || source.height;
  const context = canvas.getContext('2d');
  if (!context) return sourceDataUrl;

  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  const scale = Math.max(1, Math.min(canvas.width, canvas.height) / 900);
  const badgeHeight = Math.round(44 * scale);
  const logoSize = Math.round(30 * scale);
  const horizontalPadding = Math.round(9 * scale);
  const gap = Math.round(7 * scale);
  const margin = Math.round(14 * scale);
  const fontSize = Math.round(11 * scale);
  context.font = `600 ${fontSize}px Arial, sans-serif`;
  const label = 'Copyright (c) ChemVault';
  const textWidth = context.measureText(label).width;
  const badgeWidth = Math.ceil(horizontalPadding * 2 + logoSize + gap + textWidth);
  const x = canvas.width - badgeWidth - margin;
  const y = canvas.height - badgeHeight - margin;

  context.save();
  context.fillStyle = '#ffffff';
  context.strokeStyle = 'rgba(148, 163, 184, 0.7)';
  context.lineWidth = Math.max(1, scale);
  roundedRect(context, x, y, badgeWidth, badgeHeight, Math.round(6 * scale));
  context.fill();
  context.stroke();
  context.drawImage(logo, x + horizontalPadding, y + (badgeHeight - logoSize) / 2, logoSize, logoSize);
  context.fillStyle = '#475569';
  context.textBaseline = 'middle';
  context.fillText(label, x + horizontalPadding + logoSize + gap, y + badgeHeight / 2);
  context.restore();

  return canvas.toDataURL('image/png');
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the ChemVault logo.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load an image for export.'));
    image.src = source;
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}
