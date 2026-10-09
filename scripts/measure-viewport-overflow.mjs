#!/usr/bin/env node
/**
 * 用 CDP 在精确视口下测量原型的溢出与区块几何，用于判断页面能否在目标大屏上单屏呈现。
 *
 * 为什么必须用 Emulation.setDeviceMetricsOverride：
 *   --window-size=1440,900 得到的 innerHeight 只有约 757px（窗口装饰与工具栏占位），
 *   据此判断溢出会得出完全错误的结论（实测偏差约 140px）。
 *
 * 为什么默认自己起 Chrome、而不是复用 devtools 端口：
 *   Chrome 111+ 会拒绝携带 Origin 头的 DevTools WebSocket 连接，必须加 --remote-allow-origins=*，
 *   否则表现为连接被静默拒绝、脚本只打印 "unsettled top-level await"。
 *   若运行环境不允许 spawn 子进程（例如被沙箱杀掉，表现为 WS 关闭 code=1006），
 *   可先自行启动一个常驻 Chrome 并设置 CDP_PORT 复用：
 *     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *       --headless=new --remote-debugging-port=9799 --user-data-dir=/tmp/measure-chrome \
 *       --hide-scrollbars --remote-allow-origins='*' about:blank
 *     CDP_PORT=9799 node scripts/measure-viewport-overflow.mjs <url>
 *
 * 用法：
 *   node scripts/measure-viewport-overflow.mjs <url> [options]
 *
 * options:
 *   --viewport <WxH,WxH,...>  视口列表，默认 1440x900,1920x1080,2560x1440,1366x768
 *   --selectors <a,b,c>       额外输出这些选择器的 top/bottom/height/width
 *   --css <string>            注入候选 CSS 做 A/B 实测（不改源码）
 *   --settle <ms>             导航后等待时间，默认 3500
 *   --json                    输出原始 JSON
 *   --screenshot <prefix>     每个视口额外截图到 <prefix>-<W>x<H>.png（整元素，含溢出部分）
 *   --clip <selector>         截图裁剪目标，默认 .cc-screen
 *
 * 退出码：全部视口 overflowPx <= 0 时为 0，否则为 1（便于接入 CI / 验收脚本）。
 */

import fs from 'node:fs';
import { spawn } from 'node:child_process';

const CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.CHROME_PATH,
].filter(Boolean);

const DEFAULT_VIEWPORTS = [
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
    [1366, 768],
];

function parseArgs(argv) {
    const out = { url: null, viewports: null, selectors: [], css: '', settle: 3500, json: false, screenshot: null, clip: '.cc-screen' };
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--viewport') out.viewports = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        else if (arg === '--selectors') out.selectors = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        else if (arg === '--css') out.css = argv[++i] ?? '';
        else if (arg === '--settle') out.settle = Number(argv[++i] ?? 3500);
        else if (arg === '--json') out.json = true;
        else if (arg === '--screenshot') out.screenshot = argv[++i] ?? null;
        else if (arg === '--clip') out.clip = argv[++i] ?? '.cc-screen';
        else rest.push(arg);
    }
    out.url = rest[0] ?? null;
    return out;
}

function parseViewport(spec) {
    const m = /^(\d+)x(\d+)$/.exec(spec);
    if (!m) throw new Error(`视口格式应为 WxH，收到: ${spec}`);
    return [Number(m[1]), Number(m[2])];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveChrome() {
    for (const p of CHROME_CANDIDATES) {
        try {
            fs.accessSync(p, fs.constants.X_OK);
            return p;
        } catch {
            /* 继续找下一个 */
        }
    }
    throw new Error(`未找到可执行的 Chrome，试过: ${CHROME_CANDIDATES.join(', ')}`);
}

class Cdp {
    constructor(ws) {
        this.ws = ws;
        this.seq = 0;
        this.pending = new Map();
        this.events = new Set();
        ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                if (msg.error) reject(new Error(JSON.stringify(msg.error)));
                else resolve(msg.result);
            } else if (msg.method) {
                this.events.add(msg.method);
            }
        };
        // 没有 onclose 时，连接被拒会表现为 "top-level await 未结算"，看不出真实原因
        ws.onclose = (ev) => {
            for (const [id, p] of this.pending) p.reject(new Error(`WS 关闭(code=${ev.code})，请求 #${id} 未完成`));
            this.pending.clear();
        };
    }

    send(method, params = {}, timeoutMs = 30000) {
        const id = ++this.seq;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP 请求超时: ${method}`));
            }, timeoutMs);
            this.pending.set(id, {
                resolve: (v) => {
                    clearTimeout(timer);
                    resolve(v);
                },
                reject: (e) => {
                    clearTimeout(timer);
                    reject(e);
                },
            });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression) {
        const r = await this.send('Runtime.evaluate', { expression, returnByValue: true });
        return r.result?.value;
    }

    async waitForLoad(maxMs = 15000) {
        const deadline = Date.now() + maxMs;
        while (Date.now() < deadline) {
            if (this.events.has('Page.loadEventFired')) return true;
            await sleep(150);
        }
        return false;
    }
}

async function connect(port) {
    for (let i = 0; i < 80; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            const page = list.find((t) => t.type === 'page');
            if (page?.webSocketDebuggerUrl) {
                const ws = new WebSocket(page.webSocketDebuggerUrl);
                await new Promise((resolve, reject) => {
                    ws.onopen = resolve;
                    ws.onerror = reject;
                });
                return new Cdp(ws);
            }
        } catch {
            /* 还没起来 */
        }
        await sleep(250);
    }
    throw new Error(`未找到 CDP 调试目标（端口 ${port}）`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.url) {
        console.error('用法: node scripts/measure-viewport-overflow.mjs <url> [--viewport 1440x900,1920x1080] [--selectors a,b] [--css "..."] [--json] [--screenshot prefix]');
        process.exit(2);
    }

    const viewports = (args.viewports ?? DEFAULT_VIEWPORTS.map(([w, h]) => `${w}x${h}`)).map(parseViewport);
    const externalPort = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : null;
    const port = externalPort ?? 9700 + Math.floor(Math.random() * 300);

    let chrome = null;
    if (!externalPort) {
        chrome = spawn(
            resolveChrome(),
            [
                '--headless=new',
                `--remote-debugging-port=${port}`,
                `--user-data-dir=/tmp/measure-overflow-${port}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-gpu',
                '--hide-scrollbars',
                // Chrome 111+ 必须放开，否则带 Origin 头的 DevTools 连接会被拒
                '--remote-allow-origins=*',
                'about:blank',
            ],
            { stdio: ['ignore', 'ignore', 'ignore'] },
        );
    }

    const cdp = await connect(port);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const results = [];
    for (const [width, height] of viewports) {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        cdp.events.delete('Page.loadEventFired');
        await cdp.send('Page.navigate', { url: args.url });
        await cdp.waitForLoad();
        await sleep(args.settle);

        if (args.css) {
            await cdp.evaluate(`(() => {
                const s = document.createElement('style');
                s.textContent = ${JSON.stringify(args.css)};
                document.head.appendChild(s);
                return true;
            })()`);
            await sleep(400);
        }

        const report = JSON.parse(
            await cdp.evaluate(`(() => {
                const out = {
                    viewport: { w: innerWidth, h: innerHeight },
                    docScrollHeight: document.documentElement.scrollHeight,
                    overflowPx: document.documentElement.scrollHeight - innerHeight,
                    sections: [],
                };
                for (const sel of ${JSON.stringify(args.selectors)}) {
                    const el = document.querySelector(sel);
                    if (!el) { out.sections.push({ sel, missing: true }); continue; }
                    const r = el.getBoundingClientRect();
                    out.sections.push({
                        sel,
                        top: Math.round(r.top),
                        bottom: Math.round(r.bottom),
                        h: Math.round(r.height),
                        w: Math.round(r.width),
                    });
                }
                return JSON.stringify(out);
            })()`),
        );

        if (args.screenshot) {
            const clip = await cdp.evaluate(`(() => {
                const el = document.querySelector(${JSON.stringify(args.clip)});
                if (!el) return null;
                const b = el.getBoundingClientRect();
                return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height });
            })()`);
            if (clip) {
                const rect = JSON.parse(clip);
                const shot = await cdp.send('Page.captureScreenshot', {
                    format: 'png',
                    // captureBeyondViewport 让超出视口的部分也能整块截下来
                    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
                    captureBeyondViewport: true,
                });
                const file = `${args.screenshot}-${width}x${height}.png`;
                fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
                report.screenshot = file;
            } else {
                report.screenshot = `未命中裁剪选择器: ${args.clip}`;
            }
        }

        results.push(report);
    }

    if (args.json) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        for (const r of results) {
            const verdict = r.overflowPx <= 0 ? 'OK  ' : 'OVER';
            console.log(`${verdict} ${r.viewport.w}x${r.viewport.h}  doc=${r.docScrollHeight}  overflow=${r.overflowPx}`);
            for (const s of r.sections) {
                if (s.missing) {
                    console.log(`       ${s.sel}  MISSING`);
                    continue;
                }
                console.log(`       ${s.sel}  top=${s.top} bottom=${s.bottom} h=${s.h} w=${s.w}`);
            }
            if (r.screenshot) console.log(`       screenshot: ${r.screenshot}`);
        }
    }

    cdp.ws.close();
    if (chrome) chrome.kill('SIGKILL');
    process.exit(results.every((r) => r.overflowPx <= 0) ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
