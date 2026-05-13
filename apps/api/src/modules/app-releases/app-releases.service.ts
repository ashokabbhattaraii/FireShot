import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { createHash } from "crypto";
import { spawn } from "child_process";
import { createReadStream, existsSync } from "fs";
import { copyFile, mkdir, readFile, readdir, rm, stat } from "fs/promises";
import { basename, join, resolve } from "path";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "../admin/admin-action-log.service";
import { SystemConfigService } from "../admin/system-config.service";

type CheckStatus = "PASS" | "FAIL" | "WARN" | "INFO";

interface ReleaseCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  required?: boolean;
}

interface CommandResult {
  label: string;
  command: string;
  durationMs: number;
  output: string;
}

interface BuildRequest {
  version: string;
  releaseNotes?: string;
  runTests?: boolean;
}

interface RequestLike {
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
  get?: (name: string) => string | undefined;
}

@Injectable()
export class AppReleasesService {
  private building = false;

  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
    private config: SystemConfigService,
  ) {}

  async getLatest() {
    const r = await this.prisma.appRelease.findFirst({
      where: { isLatest: true },
      orderBy: { createdAt: "desc" },
    });
    if (!r) return null;
    return {
      version: r.version,
      releaseNotes: r.releaseNotes,
      downloadUrl: this.publicDownloadUrl(r.filename),
      fileSizeBytes: r.fileSizeBytes,
      sha256: r.sha256,
      publishedAt: r.publishedAt,
      testStatus: r.testStatus,
    };
  }

  async getPublicConfig(req?: RequestLike) {
    await this.config.ready();
    const latest = await this.getLatest().catch(() => null);
    const apiUrl = this.effectiveApiUrl(req);
    const publicWebUrl = this.effectivePublicWebUrl(req);
    const downloadUrl = latest?.downloadUrl ?? null;
    const fallbackLatestVersion = this.config.getOr("APP_LATEST_VERSION", "1.0.0");
    return {
      maintenance: {
        enabled: this.config.getBool("APP_MAINTENANCE_ENABLED") || this.config.getBool("MAINTENANCE_MODE"),
        message: this.config.getOr(
          "APP_MAINTENANCE_MESSAGE",
          "FireSlot Nepal is updating. Please try again soon.",
        ),
      },
      update: {
        force: this.config.getBool("APP_FORCE_UPDATE_ENABLED"),
        minAndroidVersion: this.config.getOr("APP_MIN_ANDROID_VERSION", "1.0.0"),
        latestVersion: latest?.version ?? fallbackLatestVersion,
        downloadEnabled: this.config.getBool("APP_DOWNLOAD_ENABLED"),
        downloadUrl,
      },
      urls: {
        api: apiUrl,
        publicWeb: publicWebUrl,
        support: this.config.getOr("APP_SUPPORT_URL", "/support"),
      },
      native: {
        loadMode: this.nativeLoadMode(),
      },
    };
  }

  async getPublicStats() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await this.prisma.user.count({
      where: {
        OR: [
          { lastLoginAt: { gte: cutoff } },
          { lastLoginAt: null, createdAt: { gte: cutoff } },
        ],
      },
    });
    const downloads = await this.prisma.appRelease.aggregate({ _sum: { downloadCount: true } });
    return {
      activeUsers,
      totalDownloads: downloads._sum.downloadCount ?? 0,
    };
  }

  async incrementDownload(id: string) {
    return this.prisma.appRelease
      .update({ where: { id }, data: { downloadCount: { increment: 1 } } })
      .catch(() => null);
  }

  async list() {
    return this.prisma.appRelease.findMany({ orderBy: { createdAt: "desc" } });
  }

  getBuildInfo(req?: RequestLike) {
    const repoRoot = this.repoRoot();
    const webDir = join(repoRoot, "apps/web");
    const androidDir = join(webDir, "android");
    const downloadsDir = join(repoRoot, "apps/api/public/downloads");
    const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
    const appUrl = this.effectivePublicWebUrl(req);
    const apiUrl = this.effectiveApiUrl(req);
    return {
      repoRoot,
      webDir,
      androidDir,
      downloadsDir,
      canBuild: existsSync(webDir) && existsSync(androidDir) && existsSync(gradlew),
      hasAppUrl: !!appUrl,
      appUrl: appUrl || null,
      apiUrl,
      nativeLoadMode: this.nativeLoadMode(),
      remoteServerUrl: process.env.CAPACITOR_SERVER_URL ?? null,
      currentBuildRunning: this.building,
    };
  }

  async buildFromSource(data: BuildRequest, adminId: string, ip?: string | null, req?: RequestLike) {
    if (this.building) {
      throw new ConflictException("An APK build is already running.");
    }

    const version = this.normalizeVersion(data.version);
    const releaseNotes = data.releaseNotes?.trim() || undefined;
    const info = this.getBuildInfo(req);
    if (!info.canBuild) {
      throw new BadRequestException("Android build tools are not available on this server.");
    }

    this.building = true;
    const commands: CommandResult[] = [];
    try {
      const repoRoot = this.repoRoot();
      const webDir = join(repoRoot, "apps/web");
      const androidDir = join(webDir, "android");
      await this.pruneBundledDownloadArtifacts();
      const env = {
        ...process.env,
        CAPACITOR_BUILD: "true",
        NEXT_PUBLIC_IS_NATIVE: "true",
        APP_VERSION_NAME: version,
        APP_VERSION_CODE: String(this.versionCode(version)),
        ...(info.apiUrl ? { NEXT_PUBLIC_API_URL: info.apiUrl } : {}),
      };

      commands.push(
        await this.runCommand("Next static export", "pnpm", ["build"], webDir, env, 180_000),
      );
      commands.push(
        await this.runCommand(
          "Capacitor Android sync",
          "pnpm",
          ["exec", "cap", "sync", "android"],
          webDir,
          env,
          180_000,
        ),
      );
      commands.push(
        await this.runCommand(
          "Gradle release APK",
          process.platform === "win32" ? "gradlew.bat" : "./gradlew",
          ["assembleRelease"],
          androidDir,
          env,
          900_000,
        ),
      );

      let apkPath = this.findSignedReleaseApk(androidDir);
      if (!apkPath) {
        commands.push(
          await this.runCommand(
            "Gradle installable debug APK",
            process.platform === "win32" ? "gradlew.bat" : "./gradlew",
            ["assembleDebug"],
            androidDir,
            env,
            600_000,
          ),
        );
        apkPath = this.findDebugApk(androidDir);
      }
      if (!apkPath) {
        throw new BadRequestException("Gradle completed but no installable APK was found.");
      }
      const filename = `fireslot-nepal-${this.safeFilePart(version)}.apk`;
      await this.copyToDownloadDirs(apkPath, filename);
      const apkStat = await stat(apkPath);
      const sha256 = await this.sha256File(apkPath);
      const buildLog = this.compactLog(commands);

      const created = await this.create(
        {
          version,
          releaseNotes,
          filename,
          isLatest: false,
          buildStatus: "BUILT",
          testStatus: "NOT_TESTED",
          fileSizeBytes: apkStat.size,
          sha256,
          buildLog,
          builtAt: new Date(),
          generatedById: adminId,
        },
        adminId,
        ip,
      );

      let release = created;
      if (data.runTests !== false) {
        release = await this.runSystemTests(created.id, adminId, ip, req);
      }

      await this.logs.log(
        adminId,
        "app_release.build",
        "app_release",
        created.id,
        null,
        { version, filename, testStatus: release.testStatus },
        ip,
      );
      return release;
    } catch (err: any) {
      await this.logs.log(
        adminId,
        "app_release.build_failed",
        "app_release",
        null,
        null,
        { version, error: err?.message ?? String(err), commands },
        ip,
      );
      if (err instanceof BadRequestException || err instanceof ConflictException) throw err;
      throw new BadRequestException({
        message: err?.message ?? "APK build failed",
        buildLog: this.compactLog(commands),
      });
    } finally {
      this.building = false;
    }
  }

  async create(
    data: {
      version: string;
      releaseNotes?: string;
      filename: string;
      isLatest?: boolean;
      buildStatus?: string;
      testStatus?: string;
      testReport?: any;
      fileSizeBytes?: number;
      sha256?: string;
      buildLog?: string;
      builtAt?: Date;
      testedAt?: Date;
      generatedById?: string;
    },
    adminId: string,
    ip?: string | null,
  ) {
    if (!data.version || !data.filename) {
      throw new BadRequestException("version and filename required");
    }

    const testStatus = data.testStatus ?? "NOT_TESTED";
    const isLatest = data.isLatest === true && testStatus === "PASSED";

    const created = await this.prisma.$transaction(async (tx: any) => {
      if (isLatest) {
        await tx.appRelease.updateMany({
          where: { isLatest: true },
          data: { isLatest: false },
        });
      }
      return tx.appRelease.create({
        data: {
          version: this.normalizeVersion(data.version),
          releaseNotes: data.releaseNotes,
          filename: data.filename,
          isLatest,
          buildStatus: data.buildStatus ?? "UPLOADED",
          testStatus,
          testReport: data.testReport,
          fileSizeBytes: data.fileSizeBytes,
          sha256: data.sha256,
          buildLog: data.buildLog,
          builtAt: data.builtAt,
          testedAt: data.testedAt,
          generatedById: data.generatedById,
          publishedAt: isLatest ? new Date() : undefined,
        },
      });
    });

    await this.logs.log(adminId, "app_release.create", "app_release", created.id, null, data, ip);
    return created;
  }

  async runSystemTests(id: string, adminId: string, ip?: string | null, req?: RequestLike) {
    const release = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!release) throw new NotFoundException();

    await this.prisma.appRelease.update({
      where: { id },
      data: { testStatus: "TESTING" },
    });

    const checks = await this.buildChecks(release, req);
    const requiredFailures = checks.filter((c) => c.required !== false && c.status === "FAIL");
    const warnings = checks.filter((c) => c.status === "WARN");
    const testStatus = requiredFailures.length ? "FAILED" : "PASSED";
    const report = {
      status: testStatus,
      summary: requiredFailures.length
        ? `${requiredFailures.length} required check(s) failed.`
        : warnings.length
          ? `Passed with ${warnings.length} warning(s).`
          : "All required checks passed.",
      checkedAt: new Date().toISOString(),
      checks,
    };

    const updated = await this.prisma.appRelease.update({
      where: { id },
      data: {
        testStatus,
        testReport: report as any,
        testedAt: new Date(),
      },
    });

    await this.logs.log(
      adminId,
      "app_release.test",
      "app_release",
      id,
      { testStatus: release.testStatus },
      { testStatus, report },
      ip,
    );
    return updated;
  }

  async setLatest(id: string, isLatest: boolean, adminId: string, ip?: string | null) {
    const r = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    if (isLatest && r.testStatus !== "PASSED") {
      throw new BadRequestException("Run and pass app tests before pushing for download.");
    }

    await this.prisma.$transaction(async (tx: any) => {
      if (isLatest) {
        await tx.appRelease.updateMany({
          where: { isLatest: true },
          data: { isLatest: false },
        });
      }
      await tx.appRelease.update({
        where: { id },
        data: { isLatest, publishedAt: isLatest ? new Date() : null },
      });
    });
    await this.logs.log(
      adminId,
      "app_release.set_latest",
      "app_release",
      id,
      { isLatest: r.isLatest },
      { isLatest },
      ip,
    );
    return { ok: true };
  }

  async registerCiRelease(data: {
    version: string;
    apkUrl: string;
    sha256?: string;
    releaseNotes?: string;
    fileSizeBytes?: number;
  }) {
    const version = this.normalizeVersion(data.version);
    const created = await this.prisma.$transaction(async (tx: any) => {
      await tx.appRelease.updateMany({ where: { isLatest: true }, data: { isLatest: false } });
      return tx.appRelease.create({
        data: {
          version,
          releaseNotes: data.releaseNotes ?? `CI build ${version}`,
          filename: data.apkUrl,
          isLatest: true,
          buildStatus: "BUILT",
          testStatus: "PASSED",
          sha256: data.sha256,
          fileSizeBytes: data.fileSizeBytes,
          builtAt: new Date(),
          publishedAt: new Date(),
        },
      });
    });
    return { ok: true, id: created.id, version: created.version, downloadUrl: this.publicDownloadUrl(created.filename) };
  }

  private async buildChecks(release: any, req?: RequestLike): Promise<ReleaseCheck[]> {
    const checks: ReleaseCheck[] = [];
    const localPath = this.localDownloadPath(release.filename);
    let size = release.fileSizeBytes ?? 0;

    if (release.filename.startsWith("http")) {
      const head = await this.head(release.filename);
      checks.push({
        key: "download-url",
        label: "Download URL",
        status: head.ok ? "PASS" : "FAIL",
        detail: head.ok ? `HTTP ${head.status}` : head.error ?? `HTTP ${head.status}`,
        required: true,
      });
      const length = Number(head.headers?.get("content-length") ?? 0);
      if (length) size = length;
    } else if (localPath) {
      const fileStat = await stat(localPath);
      size = fileStat.size;
      checks.push({
        key: "download-file",
        label: "Download file",
        status: "PASS",
        detail: `${release.filename} is available locally.`,
        required: true,
      });
    } else {
      checks.push({
        key: "download-file",
        label: "Download file",
        status: "FAIL",
        detail: `${release.filename} was not found in API download folders.`,
        required: true,
      });
    }

    checks.push({
      key: "apk-size",
      label: "APK size",
      status: size > 1_000_000 ? "PASS" : "FAIL",
      detail: size ? `${this.formatBytes(size)} detected.` : "No APK size detected.",
      required: true,
    });

    const headerOk = localPath
      ? await this.localApkHeaderOk(localPath)
      : await this.remoteApkHeaderOk(release.filename);
    checks.push({
      key: "apk-archive",
      label: "APK archive",
      status: headerOk ? "PASS" : "FAIL",
      detail: headerOk ? "APK opens as a ZIP package." : "APK package header is invalid.",
      required: true,
    });

    if (localPath) {
      const hash = await this.sha256File(localPath);
      checks.push({
        key: "apk-sha256",
        label: "APK checksum",
        status: release.sha256 && release.sha256 !== hash ? "WARN" : "PASS",
        detail: hash,
        required: false,
      });
    } else if (release.sha256) {
      checks.push({
        key: "apk-sha256",
        label: "APK checksum",
        status: "INFO",
        detail: release.sha256,
        required: false,
      });
    }

    const nativeLoadMode = this.nativeLoadMode();
    checks.push({
      key: "native-load-mode",
      label: "Native load mode",
      status: nativeLoadMode === "bundled" ? "PASS" : "WARN",
      detail:
        nativeLoadMode === "bundled"
          ? "APK loads the bundled static app, so deleted Vercel deployment URLs cannot break startup."
          : `APK is configured to open ${process.env.CAPACITOR_SERVER_URL}.`,
      required: true,
    });

    const appUrl = this.effectivePublicWebUrl(req);
    checks.push({
      key: "public-web-url",
      label: "Public web URL",
      status: appUrl ? "INFO" : "WARN",
      detail: appUrl || "APP_PUBLIC_WEB_URL is not configured; native APK still uses bundled assets.",
      required: false,
    });
    if (appUrl?.startsWith("https://")) {
      const liveHome = await this.head(appUrl);
      checks.push({
        key: "live-home",
        label: "Live app",
        status: liveHome.ok ? "PASS" : "FAIL",
        detail: liveHome.ok ? `HTTP ${liveHome.status}` : liveHome.error ?? `HTTP ${liveHome.status}`,
        required: true,
      });
      const liveSw = await this.head(new URL("/sw.js", appUrl).toString());
      checks.push({
        key: "live-service-worker",
        label: "Live service worker",
        status: liveSw.ok ? "PASS" : "FAIL",
        detail: liveSw.ok ? `HTTP ${liveSw.status}` : liveSw.error ?? `HTTP ${liveSw.status}`,
        required: true,
      });
    }

    const apiUrl = this.effectiveApiUrl(req);
    checks.push({
      key: "api-url",
      label: "Native API URL",
      status: apiUrl?.startsWith("https://") ? "PASS" : "FAIL",
      detail: apiUrl || "NEXT_PUBLIC_API_URL is not configured.",
      required: true,
    });
    if (apiUrl?.startsWith("https://")) {
      const apiHealth = await this.head(new URL("/health/live", apiUrl).toString());
      checks.push({
        key: "api-health",
        label: "API health",
        status: apiHealth.ok ? "PASS" : "FAIL",
        detail: apiHealth.ok ? `HTTP ${apiHealth.status}` : apiHealth.error ?? `HTTP ${apiHealth.status}`,
        required: true,
      });
    }

    const repoRoot = this.repoRoot();
    checks.push(this.fileCheck("service-worker", "Static service worker fallback", join(repoRoot, "apps/web/out/sw.js"), false));
    checks.push(this.fileCheck("home-export", "Bundled app home", join(repoRoot, "apps/web/out/index.html"), true));
    checks.push(
      this.fileCheck(
        "tournament-fallback",
        "Tournament detail fallback",
        join(repoRoot, "apps/web/out/tournaments/_/index.html"),
        false,
      ),
    );
    checks.push(
      this.fileCheck(
        "challenge-fallback",
        "Challenge detail fallback",
        join(repoRoot, "apps/web/out/challenges/_/index.html"),
        false,
      ),
    );

    if (release.isLatest) {
      const latest = await this.getLatest();
      checks.push({
        key: "latest-api",
        label: "Latest release API",
        status: latest?.version === release.version ? "PASS" : "FAIL",
        detail: latest?.version
          ? `/app/latest-release returns v${latest.version}.`
          : "/app/latest-release returned no release.",
        required: true,
      });
    } else {
      checks.push({
        key: "latest-api",
        label: "Latest release API",
        status: "INFO",
        detail: "Draft is ready to test; publish to expose it from /app/latest-release.",
        required: false,
      });
    }

    return checks;
  }

  private repoRoot() {
    if (process.env.REPO_ROOT) return resolve(process.env.REPO_ROOT);
    let dir = process.cwd();
    for (let i = 0; i < 8; i += 1) {
      if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
    return resolve(process.cwd(), "../..");
  }

  private normalizeVersion(version: string) {
    const clean = version?.trim();
    if (!clean || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(clean)) {
      throw new BadRequestException("Version must look like 1.2.3.");
    }
    return clean;
  }

  private safeFilePart(value: string) {
    return value.replace(/[^A-Za-z0-9._-]/g, "-");
  }

  private versionCode(version: string) {
    const [major = 0, minor = 0, patch = 0] = version
      .split(/[+-]/)[0]
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
    return Math.max(1, major * 10000 + minor * 100 + patch);
  }

  private publicDownloadUrl(filename: string) {
    if (filename.startsWith("http")) return filename;
    const clean = filename.replace(/^\/+/, "");
    return clean.startsWith("downloads/") ? `/${clean}` : `/downloads/${clean}`;
  }

  private nativeLoadMode() {
    return process.env.CAPACITOR_SERVER_URL ? "remote" : "bundled";
  }

  private cleanUrl(value?: string | null) {
    return value?.trim().replace(/\/+$/, "") || null;
  }

  private normalizeApiUrl(value?: string | null) {
    const clean = this.cleanUrl(value);
    if (!clean) return null;
    return clean.endsWith("/api") ? clean : `${clean}/api`;
  }

  private effectiveApiUrl(req?: RequestLike) {
    const configured =
      this.cleanUrl(this.config.getOr("APP_API_URL", "")) ||
      this.cleanUrl(process.env.NEXT_PUBLIC_API_URL);
    const inferred = this.inferApiUrl(req);
    if (configured && !this.isLocalUrl(configured)) return this.normalizeApiUrl(configured);
    if (inferred) return inferred;
    return this.normalizeApiUrl(configured);
  }

  private effectivePublicWebUrl(req?: RequestLike) {
    const configured =
      this.cleanUrl(this.config.getOr("APP_PUBLIC_WEB_URL", "")) ||
      this.cleanUrl(process.env.NEXT_PUBLIC_APP_URL);
    const inferred = this.headerOrigin(req, "origin") || this.refererOrigin(req);
    if (configured && !this.isLocalUrl(configured)) return configured;
    if (inferred) return inferred;
    return configured;
  }

  private inferApiUrl(req?: RequestLike) {
    const host = this.headerOrigin(req, "x-forwarded-host") ?? this.headerOrigin(req, "host");
    if (!host) return null;
    const proto = this.headerOrigin(req, "x-forwarded-proto") ?? req?.protocol ?? "https";
    return this.normalizeApiUrl(`${proto.split(",")[0]}://${host.split(",")[0]}`);
  }

  private refererOrigin(req?: RequestLike) {
    const referer = this.headerOrigin(req, "referer");
    if (!referer) return null;
    try {
      return this.cleanUrl(new URL(referer).origin);
    } catch {
      return null;
    }
  }

  private headerOrigin(req: RequestLike | undefined, name: string) {
    const value =
      req?.get?.(name) ??
      req?.headers?.[name] ??
      req?.headers?.[name.toLowerCase()];
    const first = Array.isArray(value) ? value[0] : value;
    return this.cleanUrl(first);
  }

  private isLocalUrl(value: string) {
    try {
      const host = new URL(this.normalizeApiUrl(value) ?? value).hostname;
      return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    } catch {
      return false;
    }
  }

  private localDownloadPath(filename: string) {
    if (!filename || filename.startsWith("http")) return null;
    const name = basename(filename);
    const candidates = [
      join(this.repoRoot(), "apps/api/public/downloads", name),
      join(this.repoRoot(), "public/downloads", name),
      join(process.cwd(), "public/downloads", name),
    ];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  private async runCommand(
    label: string,
    command: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
    timeoutMs: number,
  ): Promise<CommandResult> {
    const started = Date.now();
    const output: string[] = [];
    const rendered = `${command} ${args.join(" ")}`;

    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(command, args, {
        cwd,
        env,
        shell: process.platform === "win32",
      });
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);

      const collect = (chunk: Buffer) => {
        output.push(chunk.toString());
        const total = output.join("").length;
        if (total > 60_000) {
          output.splice(0, output.length, output.join("").slice(-60_000));
        }
      };

      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) return resolvePromise();
        reject(new Error(`${label} failed with exit code ${code}.\n${output.join("")}`));
      });
    });

    return {
      label,
      command: rendered,
      durationMs: Date.now() - started,
      output: output.join("").trim(),
    };
  }

  private findSignedReleaseApk(androidDir: string) {
    const releaseDir = join(androidDir, "app/build/outputs/apk/release");
    const signed = join(releaseDir, "app-release.apk");
    return existsSync(signed) ? signed : null;
  }

  private findDebugApk(androidDir: string) {
    const debug = join(androidDir, "app/build/outputs/apk/debug/app-debug.apk");
    return existsSync(debug) ? debug : null;
  }

  private async pruneBundledDownloadArtifacts() {
    const repoRoot = this.repoRoot();
    const dirs = [
      join(repoRoot, "apps/web/public/downloads"),
      join(repoRoot, "apps/web/out/downloads"),
      join(repoRoot, "apps/web/android/app/src/main/assets/public/downloads"),
    ];
    await Promise.all(
      dirs.map(async (dir) => {
        const files = await readdir(dir).catch(() => []);
        await Promise.all(
          files
            .filter((file) => file.toLowerCase().endsWith(".apk"))
            .map((file) => rm(join(dir, file), { force: true })),
        );
      }),
    );
  }

  private async copyToDownloadDirs(source: string, filename: string) {
    const dirs = [
      join(this.repoRoot(), "apps/api/public/downloads"),
      join(this.repoRoot(), "public/downloads"),
    ];
    await Promise.all(
      dirs.map(async (dir) => {
        await mkdir(dir, { recursive: true });
        await copyFile(source, join(dir, filename));
      }),
    );
  }

  private async sha256File(filePath: string) {
    return new Promise<string>((resolvePromise, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolvePromise(hash.digest("hex")));
    });
  }

  private async localApkHeaderOk(filePath: string) {
    const header = await readFile(filePath).then((buf) => buf.subarray(0, 4));
    return header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
  }

  private async remoteApkHeaderOk(url: string) {
    try {
      const res = await fetch(url, {
        headers: { Range: "bytes=0-3" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return false;
      const buf = Buffer.from(await res.arrayBuffer()).subarray(0, 4);
      return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
    } catch {
      return false;
    }
  }

  private async head(url: string) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok && (res.status === 403 || res.status === 405)) {
        const fallback = await fetch(url, {
          headers: { Range: "bytes=0-0" },
          signal: AbortSignal.timeout(10_000),
        });
        return { ok: fallback.ok, status: fallback.status, headers: fallback.headers };
      }
      return { ok: res.ok, status: res.status, headers: res.headers };
    } catch (err: any) {
      return { ok: false, status: 0, error: err?.message ?? String(err), headers: null };
    }
  }

  private fileCheck(key: string, label: string, filePath: string, required: boolean): ReleaseCheck {
    return {
      key,
      label,
      status: existsSync(filePath) ? "PASS" : required ? "FAIL" : "WARN",
      detail: existsSync(filePath) ? filePath : `${filePath} is missing.`,
      required,
    };
  }

  private compactLog(commands: CommandResult[]) {
    return commands
      .map((cmd) => {
        const seconds = (cmd.durationMs / 1000).toFixed(1);
        return [
          `# ${cmd.label}`,
          `$ ${cmd.command}`,
          `duration: ${seconds}s`,
          cmd.output || "(no output)",
        ].join("\n");
      })
      .join("\n\n")
      .slice(-80_000);
  }

  private formatBytes(bytes: number) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }
}
