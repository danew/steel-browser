import { Page } from 'puppeteer-core';

const captureConsoleLogs = (page: Page) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));
  return logs;
};

export async function runScript(page: Page, close: () => Promise<void>, script: string) {
  const logs = captureConsoleLogs(page);

  try {
    await page.exposeFunction('log', (msg: string) => logs.push(msg));
    const result = await new Function('page', 'log', `"use strict"; return (async () => { ${script} })();`)(page, console.log);
    return { result, logs };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message, logs };
    }
    return { error, logs };
  } finally {
    try {
      await page.removeExposedFunction("log");
      await close();
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }
  }
}