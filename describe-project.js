/**
 * describe-project.js
 * ═══════════════════════════════════════════════════════════════
 * Lê todos os arquivos do seu projeto Node.js e gera um relatório
 * técnico detalhado em Markdown — sem API, sem internet, 100% local.
 *
 * USO:
 *   1. Coloque este arquivo na raiz do seu projeto
 *   2. Execute: node describe-project.js
 *   3. O relatório será salvo em: project-description.md
 * ═══════════════════════════════════════════════════════════════
 */

const fs   = require("fs");
const path = require("path");

// ─── CONFIGURAÇÕES ────────────────────────────────────────────

const ROOT_DIR    = process.cwd();
const OUTPUT_FILE = path.join(ROOT_DIR, "project-description.md");

const ALLOWED_EXTENSIONS = [
  ".js", ".mjs", ".cjs",
  ".ts", ".tsx", ".jsx",
  ".json", ".html", ".css",
  ".env.example", ".md", ".txt",
  ".sh", ".bat", ".yaml", ".yml"
];

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".svn", "dist", "build",
  "coverage", ".next", ".nuxt", "out", ".cache",
  ".turbo", ".parcel-cache", "tmp", "temp"
]);

const IGNORE_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "describe-project.js", "project-description.md"
]);

const MAX_FILE_SIZE = 100 * 1024; // 100 KB

// ─── UTILITÁRIOS ──────────────────────────────────────────────

function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countLines(content) {
  return content.split("\n").length;
}

// ─── VARREDURA DE ARQUIVOS ─────────────────────────────────────

function walkDir(dir, fileList = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fileList;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (IGNORE_FILES.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walkDir(fullPath, fileList);
    } else if (entry.isFile()) {
      const ext = getExtension(entry.name);
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

// ─── ANÁLISE DE ARQUIVO JS/TS ─────────────────────────────────

function analyzeJsFile(content) {
  const info = {
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    routes: [],
    envVars: [],
  };

  const importMatches = content.matchAll(
    /(?:import\s+.*?\s+from\s+['"](.+?)['"]|require\(['"](.+?)['"]\))/g
  );
  for (const m of importMatches) {
    const dep = m[1] || m[2];
    if (dep && !info.imports.includes(dep)) info.imports.push(dep);
  }

  const exportMatches = content.matchAll(
    /export\s+(?:const|let|var|function|class|default)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g
  );
  for (const m of exportMatches) info.exports.push(m[1]);

  if (/module\.exports\s*=/.test(content)) info.exports.push("module.exports");

  const funcMatches = content.matchAll(
    /(?:^|\s)(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm
  );
  for (const m of funcMatches) info.functions.push(m[1]);

  const arrowMatches = content.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/g
  );
  for (const m of arrowMatches) info.functions.push(m[1]);

  const classMatches = content.matchAll(/class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g);
  for (const m of classMatches) info.classes.push(m[1]);

  const routeMatches = content.matchAll(
    /(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi
  );
  for (const m of routeMatches) info.routes.push(`${m[1].toUpperCase()} ${m[2]}`);

  const envMatches = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
  for (const m of envMatches) {
    if (!info.envVars.includes(m[1])) info.envVars.push(m[1]);
  }

  info.functions = [...new Set(info.functions)];

  return info;
}

// ─── ANÁLISE DE package.json ──────────────────────────────────

function analyzePackageJson(content) {
  try {
    const pkg = JSON.parse(content);
    return {
      name:        pkg.name        || "—",
      version:     pkg.version     || "—",
      description: pkg.description || "—",
      main:        pkg.main        || "—",
      scripts:     pkg.scripts     || {},
      dependencies:    Object.keys(pkg.dependencies    || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      engines:     pkg.engines     || {},
    };
  } catch {
    return null;
  }
}

// ─── GERAÇÃO DO RELATÓRIO ─────────────────────────────────────

function buildReport(files) {
  const lines = [];
  const now   = new Date().toLocaleString("pt-BR");

  lines.push(`# 📦 Descrição Técnica do Projeto`);
  lines.push(`\n> Gerado automaticamente em **${now}**`);
  lines.push(`> Raiz analisada: \`${ROOT_DIR}\``);
  lines.push(`> Total de arquivos: **${files.length}**\n`);
  lines.push("---\n");

  const pkgPath = path.join(ROOT_DIR, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkgContent = fs.readFileSync(pkgPath, "utf8");
    const pkg = analyzePackageJson(pkgContent);
    if (pkg) {
      lines.push("## 🗂 Informações do Projeto\n");
      lines.push(`| Campo | Valor |`);
      lines.push(`|-------|-------|`);
      lines.push(`| Nome | \`${pkg.name}\` |`);
      lines.push(`| Versão | \`${pkg.version}\` |`);
      lines.push(`| Descrição | ${pkg.description} |`);
      lines.push(`| Arquivo principal | \`${pkg.main}\` |`);
      if (Object.keys(pkg.engines).length) {
        lines.push(`| Engines | \`${JSON.stringify(pkg.engines)}\` |`);
      }
      lines.push("");

      if (Object.keys(pkg.scripts).length) {
        lines.push("### Scripts disponíveis\n");
        lines.push("| Script | Comando |");
        lines.push("|--------|---------|");
        for (const [k, v] of Object.entries(pkg.scripts)) {
          lines.push(`| \`npm run ${k}\` | \`${v}\` |`);
        }
        lines.push("");
      }

      if (pkg.dependencies.length) {
        lines.push(`### Dependências (${pkg.dependencies.length})\n`);
        lines.push(pkg.dependencies.map(d => `- \`${d}\``).join("\n"));
        lines.push("");
      }

      if (pkg.devDependencies.length) {
        lines.push(`### Dev Dependencies (${pkg.devDependencies.length})\n`);
        lines.push(pkg.devDependencies.map(d => `- \`${d}\``).join("\n"));
        lines.push("");
      }

      lines.push("---\n");
    }
  }

  lines.push("## 🗃 Estrutura de Arquivos\n");
  lines.push("```");
  for (const filePath of files) {
    const rel = path.relative(ROOT_DIR, filePath);
    lines.push(rel);
  }
  lines.push("```\n");
  lines.push("---\n");

  lines.push("## 📄 Detalhes por Arquivo\n");

  const allRoutes  = [];
  const allEnvVars = [];

  for (const filePath of files) {
    const rel  = path.relative(ROOT_DIR, filePath);
    const ext  = getExtension(filePath);
    const stat = fs.statSync(filePath);
    const size = formatSize(stat.size);

    lines.push(`### \`${rel}\``);
    lines.push(`- **Tamanho:** ${size}`);

    if (stat.size > MAX_FILE_SIZE) {
      lines.push(`- ⚠️ Arquivo grande demais para análise detalhada (${size})`);
      lines.push("");
      continue;
    }

    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      lines.push(`- ❌ Não foi possível ler o arquivo`);
      lines.push("");
      continue;
    }

    const numLines = countLines(content);
    lines.push(`- **Linhas:** ${numLines}`);

    if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext)) {
      const info = analyzeJsFile(content);

      if (info.imports.length) {
        const internals = info.imports.filter(i => i.startsWith("."));
        const externals = info.imports.filter(i => !i.startsWith("."));
        if (externals.length) lines.push(`- **Pacotes externos usados:** ${externals.map(i => `\`${i}\``).join(", ")}`);
        if (internals.length) lines.push(`- **Módulos internos importados:** ${internals.map(i => `\`${i}\``).join(", ")}`);
      }

      if (info.classes.length)   lines.push(`- **Classes:** ${info.classes.map(c => `\`${c}\``).join(", ")}`);
      if (info.functions.length) lines.push(`- **Funções/Arrow fns:** ${info.functions.slice(0, 15).map(f => `\`${f}\``).join(", ")}${info.functions.length > 15 ? " ..." : ""}`);
      if (info.exports.length)   lines.push(`- **Exports:** ${info.exports.map(e => `\`${e}\``).join(", ")}`);

      if (info.routes.length) {
        lines.push(`- **Rotas HTTP:**`);
        for (const r of info.routes) lines.push(`  - \`${r}\``);
        allRoutes.push(...info.routes);
      }

      if (info.envVars.length) {
        lines.push(`- **Variáveis de ambiente:** ${info.envVars.map(v => `\`${v}\``).join(", ")}`);
        allEnvVars.push(...info.envVars);
      }
    }

    if (ext === ".json" && filePath !== pkgPath) {
      try {
        const parsed = JSON.parse(content);
        const keys   = Object.keys(parsed);
        lines.push(`- **Chaves de nível raiz:** ${keys.slice(0, 10).map(k => `\`${k}\``).join(", ")}${keys.length > 10 ? " ..." : ""}`);
      } catch {
        lines.push(`- ⚠️ JSON inválido ou mal formatado`);
      }
    }

    if ([".yaml", ".yml"].includes(ext)) {
      const topKeys = content
        .split("\n")
        .filter(l => /^[a-zA-Z]/.test(l))
        .map(l => l.split(":")[0].trim())
        .slice(0, 8);
      if (topKeys.length) lines.push(`- **Chaves principais:** ${topKeys.map(k => `\`${k}\``).join(", ")}`);
    }

    lines.push("");
  }

  if (allRoutes.length) {
    lines.push("---\n");
    lines.push("## 🌐 Todas as Rotas HTTP Encontradas\n");
    const unique = [...new Set(allRoutes)];
    for (const r of unique) lines.push(`- \`${r}\``);
    lines.push("");
  }

  if (allEnvVars.length) {
    lines.push("---\n");
    lines.push("## 🔑 Variáveis de Ambiente Utilizadas\n");
    const unique = [...new Set(allEnvVars)].sort();
    for (const v of unique) lines.push(`- \`${v}\``);
    lines.push("");
    lines.push("> ⚠️ Certifique-se de que todas estão definidas no seu `.env`\n");
  }

  lines.push("---\n");
  lines.push(`*Relatório gerado por \`describe-project.js\` — ${now}*`);

  return lines.join("\n");
}

// ─── EXECUÇÃO PRINCIPAL ───────────────────────────────────────

function main() {
  console.log("🔍 Varrendo projeto em:", ROOT_DIR);

  const files = walkDir(ROOT_DIR);
  console.log(`📁 ${files.length} arquivo(s) encontrado(s)`);

  if (files.length === 0) {
    console.log("⚠️  Nenhum arquivo compatível encontrado.");
    return;
  }

  console.log("📝 Gerando relatório...");
  const report = buildReport(files);

  fs.writeFileSync(OUTPUT_FILE, report, "utf8");
  console.log(`\n✅ Relatório salvo em: ${OUTPUT_FILE}`);
  console.log("   Abra o arquivo .md em qualquer editor com preview Markdown.");
}

main();