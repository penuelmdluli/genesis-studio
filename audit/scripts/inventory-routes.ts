/**
 * Genesis Studio Audit — Route Inventory
 * Lists every API route by walking src/app/api/.
 *
 * Usage: npx tsx audit/scripts/inventory-routes.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const API_DIR = join(__dirname, "../../src/app/api");

function walkRoutes(dir: string, routes: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkRoutes(full, routes);
    } else if (entry === "route.ts" || entry === "route.tsx") {
      const rel = relative(API_DIR, dir).replace(/\\/g, "/");
      const path = `/api/${rel}`;

      // Read file to find exported HTTP methods
      const content = readFileSync(full, "utf-8");
      const methods: string[] = [];
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
        if (content.includes(`export async function ${method}`) || content.includes(`export function ${method}`)) {
          methods.push(method);
        }
      }

      routes.push(`${methods.join(",")} ${path} → ${relative(join(__dirname, "../.."), full).replace(/\\/g, "/")}`);
    }
  }
  return routes;
}

console.log("=== GENESIS STUDIO API ROUTE INVENTORY ===\n");
const routes = walkRoutes(API_DIR);
routes.sort();
for (const route of routes) {
  console.log(route);
}
console.log(`\nTotal route files: ${routes.length}`);
