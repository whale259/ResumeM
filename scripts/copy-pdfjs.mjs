import { cp, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const vendorDir = join(root, "vendor");

await mkdir(vendorDir, { recursive: true });
await copyFile(
  join(root, "node_modules", "pdfjs-dist", "build", "pdf.mjs"),
  join(vendorDir, "pdf.mjs")
);
await copyFile(
  join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs"),
  join(vendorDir, "pdf.worker.mjs")
);
await cp(join(root, "node_modules", "pdfjs-dist", "cmaps"), join(vendorDir, "cmaps"), {
  recursive: true
});
await cp(
  join(root, "node_modules", "pdfjs-dist", "standard_fonts"),
  join(vendorDir, "standard_fonts"),
  { recursive: true }
);

console.log("Copied PDF.js assets into vendor/.");
