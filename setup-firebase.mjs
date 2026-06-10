/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         DKRIUK APP — Firebase Auto Setup Script          ║
 * ║  Jalankan: node setup-firebase.mjs                       ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Yang dilakukan script ini secara otomatis:
 *  1. Cek & install dependencies yang dibutuhkan
 *  2. Buat/inisialisasi Firestore collection & documents
 *  3. Tulis firestore.rules
 *  4. Tulis firebase.json (hosting config untuk Vite)
 *  5. Tulis .firebaserc
 *  6. Tulis src/firebase.js
 *  7. Print firebaseConfig sebagai format .env.local
 *
 * PRASYARAT:
 *  - Sudah login Firebase CLI: firebase login
 *  - Sudah set project:        firebase use dkriuk-app
 *    atau ganti PROJECT_ID di bawah sesuai project kamu
 */

import { execSync, exec } from "child_process";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { promisify } from "util";
import * as readline from "readline";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const execAsync = promisify(exec);

// ─── ROOT DIR (fix untuk Windows path dengan spasi) ───────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const root       = (filename) => join(__dirname, filename);

// ─── KONFIGURASI — Sesuaikan ini ──────────────────────────────────────────────
const PROJECT_ID   = "dkriuk-pos-app";   // ← sesuai project Firebase kamu
const APP_NICKNAME = "dkriuk-web";
const REGION       = "asia-southeast2";
// ──────────────────────────────────────────────────────────────────────────────

const BOLD  = "\x1b[1m";
const GREEN = "\x1b[32m";
const BLUE  = "\x1b[34m";
const YELLOW= "\x1b[33m";
const RED   = "\x1b[31m";
const RESET = "\x1b[0m";
const DIM   = "\x1b[2m";

const log   = (msg)  => console.log(`${GREEN}✅${RESET} ${msg}`);
const info  = (msg)  => console.log(`${BLUE}ℹ️ ${RESET} ${msg}`);
const warn  = (msg)  => console.log(`${YELLOW}⚠️ ${RESET} ${msg}`);
const error = (msg)  => console.log(`${RED}❌${RESET} ${msg}`);
const title = (msg)  => console.log(`\n${BOLD}${BLUE}${"─".repeat(55)}${RESET}\n${BOLD}   ${msg}${RESET}\n${BOLD}${BLUE}${"─".repeat(55)}${RESET}`);
const step  = (n, msg) => console.log(`\n${BOLD}[${n}]${RESET} ${msg}`);

// ─── HELPER: tanya user input ─────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ─── HELPER: jalankan command dan return output ───────────────────────────────
function run(cmd, silent = false) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: silent ? "pipe" : "inherit" });
    return out || "";
  } catch (e) {
    return e.stdout || e.message || "";
  }
}

async function runAsync(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd);
    return { out: stdout, err: stderr, ok: true };
  } catch (e) {
    return { out: e.stdout || "", err: e.message, ok: false };
  }
}

// ─── STEP 1: Cek Firebase CLI ─────────────────────────────────────────────────
async function checkCLI() {
  step(1, "Memeriksa Firebase CLI...");
  const result = run("firebase --version", true);
  if (!result || result.includes("not found") || result.includes("'firebase'")) {
    warn("Firebase CLI belum terinstall. Menginstall sekarang...");
    run("npm install -g firebase-tools");
    log("Firebase CLI berhasil diinstall.");
  } else {
    log(`Firebase CLI ditemukan: v${result.trim()}`);
  }
}

// ─── STEP 2: Cek login & project ─────────────────────────────────────────────
async function checkAuth() {
  step(2, "Memeriksa autentikasi Firebase...");
  const result = run("firebase projects:list", true);

  if (result.includes("not logged in") || result.includes("Error") || result.includes("authentication")) {
    warn("Belum login. Membuka browser untuk login...");
    run("firebase login");
  }

  if (result.includes(PROJECT_ID)) {
    log(`Project "${PROJECT_ID}" ditemukan.`);
  } else {
    warn(`Project "${PROJECT_ID}" tidak ditemukan di akun ini.`);
    info(`Mencoba membuat project baru: ${PROJECT_ID}...`);
    const createResult = run(`firebase projects:create ${PROJECT_ID} --display-name "DKRIUK App"`, true);
    if (createResult.includes("already exists")) {
      warn(`Project ${PROJECT_ID} sudah ada, lanjut...`);
    } else {
      log(`Project "${PROJECT_ID}" berhasil dibuat.`);
    }
  }

  run(`firebase use ${PROJECT_ID}`, true);
  log(`Aktif menggunakan project: ${PROJECT_ID}`);
}

// ─── STEP 3: Tulis firestore.rules ───────────────────────────────────────────
async function writeFirestoreRules() {
  step(3, "Menulis firestore.rules...");

  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /appData/{document} {
      allow read, write: if true;
    }
  }
}
`;
  writeFileSync(root("firestore.rules"), rules, "utf8");
  log("firestore.rules berhasil ditulis.");
}

// ─── STEP 4: Tulis firebase.json ─────────────────────────────────────────────
async function writeFirebaseJson() {
  step(4, "Menulis firebase.json...");

  const config = {
    firestore: {
      rules: "firestore.rules",
      indexes: "firestore.indexes.json"
    },
    hosting: {
      public: "dist",
      ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
      rewrites: [{ source: "**", destination: "/index.html" }]
    }
  };

  writeFileSync(root("firebase.json"), JSON.stringify(config, null, 2), "utf8");
  log("firebase.json berhasil ditulis.");

  writeFileSync(root("firestore.indexes.json"), JSON.stringify({ indexes: [], fieldOverrides: [] }, null, 2), "utf8");
  log("firestore.indexes.json berhasil ditulis.");
}

// ─── STEP 5: Tulis .firebaserc ────────────────────────────────────────────────
async function writeFirebaseRc() {
  step(5, "Menulis .firebaserc...");

  const rc = { projects: { default: PROJECT_ID } };
  writeFileSync(root(".firebaserc"), JSON.stringify(rc, null, 2), "utf8");
  log(".firebaserc berhasil ditulis.");
}

// ─── STEP 6: Deploy Firestore rules ──────────────────────────────────────────
async function deployRules() {
  step(6, "Men-deploy Firestore rules ke Firebase...");
  info("Ini membutuhkan Blaze plan aktif. Jika gagal, rules bisa di-deploy manual.");

  const result = run("firebase deploy --only firestore:rules", true);
  if (result.includes("Error") || result.includes("error")) {
    warn("Deploy rules otomatis gagal. Kamu perlu deploy manual lewat Firebase Console.");
    warn("Atau jalankan: firebase deploy --only firestore:rules");
  } else {
    log("Firestore rules berhasil di-deploy.");
  }
}

// ─── STEP 7: Dapatkan firebaseConfig ─────────────────────────────────────────
async function getFirebaseConfig() {
  step(7, "Mengambil firebaseConfig dari Firebase...");

  // Coba ambil dari firebase apps:sdkconfig
  const result = run(`firebase apps:sdkconfig web --project ${PROJECT_ID}`, true);

  // Coba parse config dari output CLI
  const apiKeyMatch        = result.match(/apiKey:\s*["']([^"']+)["']/);
  const authDomainMatch    = result.match(/authDomain:\s*["']([^"']+)["']/);
  const projectIdMatch     = result.match(/projectId:\s*["']([^"']+)["']/);
  const storageBucketMatch = result.match(/storageBucket:\s*["']([^"']+)["']/);
  const senderIdMatch      = result.match(/messagingSenderId:\s*["']([^"']+)["']/);
  const appIdMatch         = result.match(/appId:\s*["']([^"']+)["']/);

  if (apiKeyMatch && appIdMatch) {
    return {
      apiKey:            apiKeyMatch[1],
      authDomain:        authDomainMatch?.[1]    || `${PROJECT_ID}.firebaseapp.com`,
      projectId:         projectIdMatch?.[1]     || PROJECT_ID,
      storageBucket:     storageBucketMatch?.[1] || `${PROJECT_ID}.appspot.com`,
      messagingSenderId: senderIdMatch?.[1]      || "",
      appId:             appIdMatch[1],
    };
  }

  // Jika tidak bisa otomatis, minta input manual
  warn("Tidak bisa mengambil config otomatis.");
  info("Buka Firebase Console → Project Settings → Web App → salin config.");
  console.log("\nMasukkan nilai firebaseConfig secara manual:\n");

  return {
    apiKey:            await ask("  apiKey            : "),
    authDomain:        await ask("  authDomain        : ") || `${PROJECT_ID}.firebaseapp.com`,
    projectId:         await ask("  projectId         : ") || PROJECT_ID,
    storageBucket:     await ask("  storageBucket     : ") || `${PROJECT_ID}.appspot.com`,
    messagingSenderId: await ask("  messagingSenderId : "),
    appId:             await ask("  appId             : "),
  };
}

// ─── STEP 8: Tulis .env.local ─────────────────────────────────────────────────
async function writeEnvLocal(config) {
  step(8, "Menulis .env.local...");

  // Jangan overwrite jika sudah ada isinya
  if (existsSync(root(".env.local"))) {
    const ans = await ask("  .env.local sudah ada. Timpa? (y/N): ");
    if (ans.toLowerCase() !== "y") {
      warn(".env.local tidak ditimpa. Lewati.");
      return;
    }
  }

  const envContent = `# Firebase Config — generated by setup-firebase.mjs
# JANGAN commit file ini ke Git!
VITE_FIREBASE_API_KEY=${config.apiKey}
VITE_FIREBASE_AUTH_DOMAIN=${config.authDomain}
VITE_FIREBASE_PROJECT_ID=${config.projectId}
VITE_FIREBASE_STORAGE_BUCKET=${config.storageBucket}
VITE_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId}
VITE_FIREBASE_APP_ID=${config.appId}
`;

  writeFileSync(root(".env.local"), envContent, "utf8");
  log(".env.local berhasil ditulis.");
}

// ─── STEP 9: Tulis src/firebase.js ───────────────────────────────────────────
async function writeFirebaseJs() {
  step(9, "Menulis src/firebase.js...");

  if (!existsSync(root("src"))) {
    mkdirSync(root("src"), { recursive: true });
  }

  const firebaseJs = `// Firebase initialization — auto-generated by setup-firebase.mjs
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
`;

  writeFileSync(root("src/firebase.js"), firebaseJs, "utf8");
  log("src/firebase.js berhasil ditulis.");
}

// ─── STEP 10: Cek .gitignore ──────────────────────────────────────────────────
async function checkGitignore() {
  step(10, "Memeriksa .gitignore...");

  let content = "";
  if (existsSync(root(".gitignore"))) {
    const { readFileSync } = await import("fs");
    content = readFileSync(root(".gitignore"), "utf8");
  }

  const toAdd = [];
  if (!content.includes(".env.local"))  toAdd.push(".env.local");
  if (!content.includes(".env*.local")) toAdd.push(".env*.local");

  if (toAdd.length > 0) {
    const append = "\n# Firebase & env secrets\n" + toAdd.join("\n") + "\n";
    writeFileSync(root(".gitignore"), content + append, "utf8");
    log(`.gitignore diupdate — ditambahkan: ${toAdd.join(", ")}`);
  } else {
    log(".gitignore sudah benar.");
  }
}

// ─── STEP 11: Print ringkasan ─────────────────────────────────────────────────
function printSummary(config) {
  console.log(`
${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗
║               ✅  SETUP SELESAI!                         ║
╚══════════════════════════════════════════════════════════╝${RESET}

${BOLD}File yang dibuat:${RESET}
  ${GREEN}✓${RESET} firestore.rules
  ${GREEN}✓${RESET} firestore.indexes.json
  ${GREEN}✓${RESET} firebase.json
  ${GREEN}✓${RESET} .firebaserc
  ${GREEN}✓${RESET} .env.local
  ${GREEN}✓${RESET} src/firebase.js

${BOLD}Firebase Config (tersimpan di .env.local):${RESET}
${DIM}  VITE_FIREBASE_API_KEY            = ${config.apiKey}
  VITE_FIREBASE_AUTH_DOMAIN        = ${config.authDomain}
  VITE_FIREBASE_PROJECT_ID         = ${config.projectId}
  VITE_FIREBASE_STORAGE_BUCKET     = ${config.storageBucket}
  VITE_FIREBASE_MESSAGING_SENDER_ID= ${config.messagingSenderId}
  VITE_FIREBASE_APP_ID             = ${config.appId}${RESET}

${BOLD}Langkah selanjutnya:${RESET}
  ${BLUE}1.${RESET} Update App.jsx — ganti storageGet/storageSet pakai Firestore
     ${DIM}(gunakan Copilot Chat: Ctrl+Alt+I di VS Code)${RESET}
  ${BLUE}2.${RESET} Test lokal:
     ${YELLOW}npm run dev${RESET}
  ${BLUE}3.${RESET} Push ke GitHub & deploy ke Vercel
     ${DIM}Jangan lupa tambahkan env variables di Vercel dashboard!${RESET}

${BOLD}Untuk deploy Firebase Hosting (opsional):${RESET}
  ${YELLOW}npm run build && firebase deploy${RESET}
`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  title("🍗 DKRIUK App — Firebase Auto Setup");
  info(`Project ID : ${PROJECT_ID}`);
  info(`Region     : ${REGION}`);
  info(`App Name   : ${APP_NICKNAME}`);

  try {
    await checkCLI();
    await checkAuth();
    await writeFirestoreRules();
    await writeFirebaseJson();
    await writeFirebaseRc();
    await deployRules();

    const config = await getFirebaseConfig();

    await writeEnvLocal(config);
    await writeFirebaseJs();
    await checkGitignore();

    printSummary(config);

  } catch (err) {
    error(`Setup gagal: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
