import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScreenshot } from "@/hooks/use-screenshot";
import { ScrapeResponse, scrape } from "@/steel-client";
import { Skeleton } from "@radix-ui/themes";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

type ActionType = "scrape";

export default function SessionActions() {
  const [action, setAction] = useState<ActionType>("scrape");
  const [input, setInput] = useState<string>("");
  const [response, setResponse] = useState<ScrapeResponse | undefined>();

  const actionMutation = useMutation({
    mutationFn: async () => {
      const res = await scrape({
        body: {
          url: input,
          format: ["markdown"],
          screenshot: true,
        },
      });
      if (res.error) throw new Error("Action failed");
      return res.data;
    },
    onSuccess: (data) => {
      setResponse(data);
    },
    onError: () => {
      setResponse(undefined);
    },
  });

  const screenshot = useScreenshot(response?.screenshot);

  return (
    <div className="w-full h-full overflow-y-auto bg-[var(--gray-2)] p-3 pt-8 font-mono text-xs flex flex-col">
      <div className="flex justify-between items-center border-b border-[var(--gray-6)] pb-2 mb-4">
        <div className="text-[var(--gray-11)] font-bold">Session Actions</div>
      </div>

      <div className="mb-3">
        <label className="text-[var(--gray-11)] text-sm mb-1 block">Select Action:</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as ActionType)}
          className="w-full p-2 border border-[var(--gray-6)] bg-[var(--gray-3)] text-[var(--gray-11)] rounded"
        >
          <option value="scrape">Scrape</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="text-[var(--gray-11)] text-sm mb-1 block">Input:</label>
        <Input
          type="text"
          placeholder={action === "scrape" ? "Enter URL to scrape" : undefined}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>

      <Button
        variant="outline"
        className="text-[var(--blue-11)] border-[var(--blue-7)] hover:bg-[var(--blue-3)]"
        onClick={() => actionMutation.mutate()}
        disabled={actionMutation.isLoading}
      >
        {actionMutation.isLoading ? "Processing..." : "Execute Action"}
      </Button>

      <div className="mt-4">
        {actionMutation.isLoading && (
          <Skeleton className="w-full h-10 border-b border-[var(--gray-6)]" />
        )}

        {actionMutation.isError && <div className="text-red-500">Error executing action</div>}

        {response && action === "scrape" && (
          <div className="border border-[var(--gray-6)] p-2 mt-3">
            {screenshot && <img src={screenshot} alt="Screenshot" className="border border-[var(--gray-6)] max-w-full" />}
            <pre className="max-h-40 overflow-auto p-2 bg-gray-800 text-white rounded-md whitespace-pre-wrap">
              {response.content?.markdown as string ?? ""}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
