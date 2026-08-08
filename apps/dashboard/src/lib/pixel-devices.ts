export type PixelDevice = {
  codename: string;
  productName: string;
};

/** GrapheneOS 17 / Pixel reference list — register on demand via dashboard. */
export const PIXEL_DEVICES: PixelDevice[] = [
  { codename: "frankel", productName: "Pixel 10" },
  { codename: "blazer", productName: "Pixel 10 Pro" },
  { codename: "mustang", productName: "Pixel 10 Pro XL" },
  { codename: "rango", productName: "Pixel 10 Pro Fold" },
  { codename: "stallion", productName: "Pixel 10a" },
  { codename: "tokay", productName: "Pixel 9" },
  { codename: "caiman", productName: "Pixel 9 Pro" },
  { codename: "komodo", productName: "Pixel 9 Pro XL" },
  { codename: "comet", productName: "Pixel 9 Pro Fold" },
  { codename: "tegu", productName: "Pixel 9a" },
  { codename: "shiba", productName: "Pixel 8" },
  { codename: "husky", productName: "Pixel 8 Pro" },
  { codename: "akita", productName: "Pixel 8a" },
  { codename: "panther", productName: "Pixel 7" },
  { codename: "cheetah", productName: "Pixel 7 Pro" },
  { codename: "lynx", productName: "Pixel 7a" },
  { codename: "oriole", productName: "Pixel 6" },
  { codename: "raven", productName: "Pixel 6 Pro" },
  { codename: "bluejay", productName: "Pixel 6a" },
  { codename: "felix", productName: "Pixel Fold" },
  { codename: "tangorpro", productName: "Pixel Tablet" },
];

export function getPixelDevice(codename: string): PixelDevice | undefined {
  return PIXEL_DEVICES.find((d) => d.codename === codename);
}

export function isEligibleCodename(codename: string): boolean {
  return PIXEL_DEVICES.some((d) => d.codename === codename);
}

export function formatDeviceLabel(codename: string, displayName?: string): string {
  const ref = getPixelDevice(codename);
  const name = displayName ?? ref?.productName ?? codename;
  return `${name} · ${codename}`;
}
