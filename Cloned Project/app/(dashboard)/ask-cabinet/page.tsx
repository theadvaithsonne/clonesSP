"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Using native textarea to avoid extra UI dependency
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function AskCabinetPage() {
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a video to upload");
      return;
    }
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }

    try {
      setLoading(true);
      setAnswer("");
      const form = new FormData();
      form.append("file", file);
      form.append("question", question.trim());

      const data = await api<{ answer: string }>("/ask-cabinet", {
        method: "POST",
        body: form,
      });
      setAnswer(data?.answer || "");
      toast.success("Answer generated");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Card className="bg-[#0e0e12] border-[#2a2a35]">
        <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
          <CardTitle className="text-lg sm:text-xl">Ask Cabinet</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="video" className="text-sm sm:text-base">Video</Label>
              <Input
                id="video"
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-xs sm:text-sm h-9 sm:h-10"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="question" className="text-sm sm:text-base">Question</Label>
              <textarea
                id="question"
                rows={4}
                placeholder="Ask a question about the video..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full rounded-md border border-[#2a2a35] bg-[#0b0b10] px-3 py-2 text-xs sm:text-sm text-[#c7c7da] placeholder:text-[#8a8aa3] focus:outline-none focus:ring-2 focus:ring-[#363649]"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button type="submit" disabled={loading} className="text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto">
                {loading ? "Analyzing..." : "Ask"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto"
                onClick={() => {
                  setFile(null);
                  setQuestion("");
                  setAnswer("");
                }}
              >
                Reset
              </Button>
            </div>
          </form>

          {answer && (
            <div className="mt-4 sm:mt-6">
              <Label className="text-sm sm:text-base">Answer</Label>
              <div className="mt-1.5 sm:mt-2 whitespace-pre-wrap text-xs sm:text-sm text-[#c7c7da] p-3 sm:p-4 border border-[#2a2a35] rounded-md bg-[#0b0b10]">
                {answer}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
