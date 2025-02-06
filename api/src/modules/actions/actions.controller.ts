import { FastifyReply } from "fastify";
import { Page } from "puppeteer-core";
import { CDPService } from "../../services/cdp.service";
import { SessionService } from "../../services/session.service";
import { ScrapeFormat } from "../../types";
import { getErrors } from "../../utils/errors";
import { updateLog } from "../../utils/logging";
import { getProxyServer } from "../../utils/proxy";
import { cleanHtml, getMarkdown, getReadabilityContent } from "../../utils/scrape";
import { PDFRequest, ScrapeRequest, ScreenshotRequest } from "./actions.schema";

interface GetPageReturn {
  page: Page;
  close(): Promise<void>;
  times: Record<string, number>;
}

export async function getPage(
  times: Record<string, number>,
  startTime: number,
  sessionService: SessionService,
  browserService: CDPService,
  proxyUrl?: string | null,
): Promise<GetPageReturn> {
  const browserOperation = !browserService.isRunning() && browserService.launch();

  const proxy = await getProxyServer(proxyUrl, sessionService);
  times.proxyTime = Date.now() - startTime;

  await browserOperation;

  if (proxy) {
    const context = await browserService.createBrowserContext(proxy.url);
    const page = await context.newPage();
    times.proxyPageTime = Date.now() - startTime - times.proxyTime;
    return { 
      page, 
      times,
      close: context.close,
    };
  }
  const page = await browserService.getPrimaryPage();
  times.pageTime = Date.now() - startTime - times.proxyTime;
  return { 
    page, 
    times,
    close: browserService.refreshPrimaryPage,
  };
}

export const handleScrape = async (sessionService: SessionService, browserService: CDPService, request: ScrapeRequest, reply: FastifyReply) => {
  const startTime = Date.now();
  let times: Record<string, number> = {};
  const { url, format, screenshot, pdf, proxyUrl, logUrl, delay } = request.body;
  try {
    const { page, close } = await getPage(times, startTime, sessionService, browserService, proxyUrl);

    await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    times.pageLoadTime = Date.now() - startTime - times.pageTime;

    let scrapeResponse: Record<string, any> = { content: {} };

    const [{ html, metadata, links }, base64Screenshot, pdfBuffer] = await Promise.all([
      page.evaluate(() => {
        const getMetaContent = (name: string) => {
          const element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
          return element ? element.getAttribute("content") : null;
        };

        return {
          html: document.documentElement.outerHTML,
          links: [...document.links].map((l) => ({ url: l.href, text: l.textContent })),
          metadata: {
            title: document.title,
            ogImage: getMetaContent("og:image") || undefined,
            ogTitle: getMetaContent("og:title") || undefined,
            urlSource: window.location.href,
            description: getMetaContent("description") || undefined,
            ogDescription: getMetaContent("og:description") || undefined,
            statusCode: 200, // This will always be 200 if the page loaded successfully
            language: document.documentElement.lang,
            timestamp: new Date().toISOString(),
            published_timestamp: getMetaContent("article:published_time") || undefined,
          },
        };
      }),
      screenshot ? page.screenshot({ encoding: "base64", type: "jpeg", quality: 100 }) : null,
      pdf ? page.pdf() : null,
    ]);

    times.extractionTime = Date.now() - startTime - times.pageLoadTime;

    scrapeResponse.metadata = metadata;
    scrapeResponse.links = links;

    if (format && format.length > 0) {
      if (format.includes(ScrapeFormat.HTML)) {
        scrapeResponse.content.html = html;
      }
      if (format.includes(ScrapeFormat.READABILITY)) {
        scrapeResponse.content.readability = getReadabilityContent(html);
        times.readabilityTime = Date.now() - startTime - times.extractionTime;
      }
      if (format.includes(ScrapeFormat.CLEANED_HTML)) {
        scrapeResponse.content.cleaned_html = cleanHtml(html);
        times.cleanedHtmlTime = (Date.now() - times.readabilityTime || Date.now() - times.extractionTime) - startTime;
      }
      if (format.includes(ScrapeFormat.MARKDOWN)) {
        const readabilityContent = scrapeResponse.content.readability ?? getReadabilityContent(html);
        scrapeResponse.content.markdown = getMarkdown(readabilityContent ? readabilityContent?.content : html);
        times.markdownTime =
          (Date.now() - times.cleanedHtmlTime ||
            Date.now() - times.readabilityTime ||
            Date.now() - times.extractionTime) - startTime;
      }
    } else {
      scrapeResponse.content.html = html;
    }

    if (base64Screenshot) {
      scrapeResponse.screenshot = base64Screenshot;
    }
    if (pdfBuffer) {
      const base64Pdf = Buffer.from(pdfBuffer).toString("base64");
      scrapeResponse.pdf = base64Pdf;
    }

    times.totalInstanceTime = Date.now() - startTime;

    await close();

    if (logUrl) {
      await updateLog(logUrl, { times });
    }
    return reply.send(scrapeResponse);
  } catch (e: unknown) {
    const error = getErrors(e);
    if (logUrl) {
      await updateLog(logUrl, { times, response: { browserError: error } });
    }
    await browserService.refreshPrimaryPage();
    return reply.code(500).send({ message: error });
  }
};

export const handleScreenshot = async (sessionService: SessionService, browserService: CDPService, request: ScreenshotRequest, reply: FastifyReply) => {
  const startTime = Date.now();
  let times: Record<string, number> = {};
  const { url, logUrl, proxyUrl, delay, fullPage } = request.body;
  if (!browserService.isRunning()) {
    await browserService.launch();
  }
  try {
    const { page, close } = await getPage(times, startTime, sessionService, browserService, proxyUrl);
    await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
    times.pageLoadTime = Date.now() - times.pageTime - times.proxyTime - startTime;

    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const screenshot = await page.screenshot({ fullPage, type: "jpeg", quality: 100 });
    times.screenshotTime = Date.now() - times.pageLoadTime - times.pageTime - times.proxyTime - startTime;
    await close();

    if (logUrl) {
      await updateLog(logUrl, { times });
    }
    return reply.send(screenshot);
  } catch (e: unknown) {
    const error = getErrors(e);
    if (logUrl) {
      await updateLog(logUrl, { times, response: { browserError: error } });
    }
    await browserService.refreshPrimaryPage();
    return reply.code(500).send({ message: error });
  }
};

export const handlePDF = async (sessionService: SessionService, browserService: CDPService, request: PDFRequest, reply: FastifyReply) => {
  const startTime = Date.now();
  let times: Record<string, number> = {};
  const { url, logUrl, proxyUrl, delay } = request.body;

  try {
    const { page, close } = await getPage(times, startTime, sessionService, browserService, proxyUrl);
    await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
    times.pageLoadTime = Date.now() - times.pageTime - times.proxyTime - startTime;

    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const pdf = await page.pdf();
    times.pdfTime = Date.now() - times.pageLoadTime - times.pageTime - times.proxyTime - startTime;
    await close();
    if (logUrl) {
      await updateLog(logUrl, { times });
    }
    return reply.send(pdf);
  } catch (e: unknown) {
    const error = getErrors(e);
    if (logUrl) {
      await updateLog(logUrl, { times, response: { browserError: error } });
    }
    await browserService.refreshPrimaryPage();
    return reply.code(500).send({ message: error });
  }
};
